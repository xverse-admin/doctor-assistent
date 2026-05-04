// src/agents/orchestrator.js
const { ChatOpenAI } = require("@langchain/openai");
const { z } = require("zod");
const { BASE_PERSONA } = require("../constants/prompts");

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

const orchestratorNode = async (state) => {
  const lastMessage = state.messages[state.messages.length - 1].content;

  const now = new Date();
  const currentDateTime = now.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const classificationSchema = z.object({
    next_step: z.enum([
      "doctor_assistant",   // general chat, greetings, appointment process
      "check_availability", // check calendar slots
      "booking_agent",      // confirm & book appointment
      "knowledge_query",    // query MongoDB: doctors, services, fees, FAQs, patient lookup
    ]),
    extracted_name:  z.string().nullable().describe("User's name if mentioned"),
    extracted_email: z.string().nullable().describe("User's email if mentioned"),
    extracted_date:  z.string().nullable().describe("Appointment date if mentioned"),
    extracted_time:  z.string().nullable().describe("Appointment time if mentioned"),
  });

  const structuredLlm = llm.withStructuredOutput(classificationSchema, {
    method: "functionCalling",
  });

  const prompt = `
    ${BASE_PERSONA}

    CONTEXT:
    - Current Date & Time: "${currentDateTime}"

    YOUR JOB:
    1. Analyze the user's input carefully.
    2. RESOLVE DATES: Convert "tomorrow", "next Friday", "in 2 days" to exact YYYY-MM-DD using today's date.
    3. Route to the correct worker using these rules:

    → "knowledge_query"   — Use when user asks about:
        • How many doctors / specialists are there?
        • What specializations are available?
        • Tell me about Dr. [name] or cardiologist / neurologist etc.
        • What services / tests / packages do you offer?
        • What is the consultation fee / cost / price?
        • What are your working hours / location / parking / insurance?
        • Looking up a patient by email
        • Anything that requires querying the hospital database
        EXAMPLES: "how many specialist doctors?", "what is the fee for cardiology?",
                  "list all services", "do you have a neurologist?", "what tests are available?"

    → "check_availability" — Use when user asks for available slots/times
        EXAMPLES: "when is Dr. Smith free?", "check Tuesday slots", "is 11am free?"

    → "booking_agent"     — Use when user provides contact info or confirms booking
        EXAMPLES: "my name is John, email john@gmail.com", "yes confirm it", "book it"

    → "doctor_assistant"  — Use for everything else: greetings, general questions,
                            image uploads, follow-up during booking flow

    User Input: "${lastMessage}"
  `;

  const result = await structuredLlm.invoke(prompt);
  console.log(`[Orchestrator] Routed to: ${result.next_step}`);

  return {
    nextAgent: result.next_step,
    appointmentData: {
      ...(result.extracted_name  !== null && { name:  result.extracted_name  }),
      ...(result.extracted_email !== null && { email: result.extracted_email }),
      ...(result.extracted_date  !== null && { date:  result.extracted_date  }),
      ...(result.extracted_time  !== null && { time:  result.extracted_time  }),
    },
  };
};

module.exports = { orchestratorNode };
