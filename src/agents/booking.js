const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage } = require("@langchain/core/messages");
const { bookAppointmentTool } = require("../tools/calendar");
const { BOOKING_RULES } = require("../constants/prompts");

const bookingNode = async (state) => {
  const { appointmentData } = state;
  const missingFields = [];

  // --- GUARDRAIL START ---
  if (!appointmentData.doctorId)   missingFields.push("Doctor selection");
  if (!appointmentData.date)       missingFields.push("Date");
  if (!appointmentData.time)       missingFields.push("Time");
  if (!appointmentData.email)      missingFields.push("Email");
  if (!appointmentData.patientName) missingFields.push("Name");

  if (missingFields.length > 0) {
    const responseText = `I need a little more information to complete your booking. Please provide your: ${missingFields.join(", ")}.`;

    return {
      messages: [new HumanMessage(responseText)],
    };
  }
  // --- GUARDRAIL END ---

  // All data present — authorize the LLM to call the tool.
  const llm = new ChatOpenAI({ temperature: 0 }).bindTools([bookAppointmentTool]);

  const systemMessage = `
    You are the Booking Agent.
    You have all the required details:
    - Patient Name: ${appointmentData.patientName}
    - Email: ${appointmentData.email}
    - Date: ${appointmentData.date}
    - Time: ${appointmentData.time}
    - Doctor ID: ${appointmentData.doctorId}
    - Doctor Name: ${appointmentData.doctorName}

    Call the 'book_appointment' tool now using exactly these values:
    doctorId="${appointmentData.doctorId}", date="${appointmentData.date}", time="${appointmentData.time}",
    email="${appointmentData.email}", name="${appointmentData.patientName}".
  `;

  const response = await llm.invoke([
    { role: "system", content: BOOKING_RULES },
    { role: "system", content: systemMessage },
    ...state.messages
  ]);

  return { messages: [response] };
};

module.exports = { bookingNode };