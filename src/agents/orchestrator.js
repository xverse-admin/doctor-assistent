const { ChatOpenAI } = require("@langchain/openai");
const { z } = require("zod");
const { BASE_PERSONA } = require("../constants/prompts");

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

const DOCTOR_ID_MAP = {
  "fatima al-sheikh": "fatima-al-sheikh",
  "rajesh iyer":       "rajesh-iyer",
  "arjun mehta":       "arjun-mehta",
  "sneha reddy":       "sneha-reddy",
  "vikram nair":       "vikram-nair",
};

const resolveDoctorId = (name) => {
  if (!name) return null;
  const key = name.toLowerCase().replace(/^dr\.?\s*/, "").trim();
  return DOCTOR_ID_MAP[key] || null;
};

const orchestratorNode = async (state) => {
  const lastMessage = state.messages[state.messages.length - 1].content;

  const recentHistory = state.messages
    .slice(-8)
    .map(m => `${m._getType ? m._getType() : m.role}: ${m.content}`)
    .join("\n");

  // patientRecords.length === 0 means genuinely not found (new patient).
  // patientRecords.length > 1 means family — handled separately below.
  const isUnregisteredNewPatient =
    state.userPhone &&
    Array.isArray(state.patientRecords) &&
    state.patientRecords.length === 0 &&
    !state.appointmentData?.patientRegistered;

  const needsFamilySelection =
    Array.isArray(state.patientRecords) &&
    state.patientRecords.length > 1 &&
    !state.activePatientId;

  const { doctorId, doctorName, date, time, email, bookingIntent } = state.appointmentData || {};
  const bookingFieldsPresent = [doctorId, doctorName, date, time, email].filter(Boolean).length;
  const bookingInProgress = bookingFieldsPresent > 0 || bookingIntent === true;

  const now = new Date();
  const currentDateTime = now.toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const familyNames = needsFamilySelection
    ? state.patientRecords.map(p => p.name).join(", ")
    : null;

  const classificationSchema = z.object({
    next_step: z.enum([
      "doctor_assistant",
      "check_availability",
      "booking_agent",
      "knowledge_query",
    ]),
    extracted_patient_name: z.string().nullable()
      .describe("The PATIENT's own name, only when they introduce themselves, e.g. 'my name is Aravind' or 'I'm Aravind'. NEVER put a doctor's name here."),
    extracted_doctor_name: z.string().nullable()
      .describe("Name of the doctor the patient wants to see/book, if mentioned, e.g. 'Vikram Nair'."),
    extracted_email: z.string().nullable().describe("User's email if mentioned"),
    extracted_date:  z.string().nullable().describe("Appointment date if mentioned"),
    extracted_time:  z.string().nullable().describe("Appointment time if mentioned"),
    extracted_age:        z.string().nullable().describe("Patient's age, only during new patient registration"),
    extracted_gender:     z.string().nullable().describe("Patient's gender, only during new patient registration"),
    extracted_city:       z.string().nullable().describe("Patient's city, only during new patient registration"),
    extracted_conditions: z.string().nullable().describe("Known conditions/allergies, only during new patient registration. Use 'None' if patient says none."),
    wants_to_book: z.boolean().describe("True if this message expresses intent to book/schedule an appointment, even if no doctor/date/time given yet."),
    extracted_family_selection: z.string().nullable()
      .describe("Only relevant if multiple family profiles were listed to the user. If they picked one by name, put that name here exactly as it appears in the list."),
    confirms_self: z.boolean()
  .describe("True if the user is confirming this conversation is for themselves (e.g. 'me', 'myself', 'yes it's for me') in response to being asked whether it's for them or a family member."),
      wants_new_family_member: z.boolean()
  .describe("True if the user explicitly says they want to add/register a different family member, a new person, or book for someone else under this same phone number — e.g. 'add my father', 'book for someone else', 'register a new family member'. False otherwise."),
  });

  const structuredLlm = llm.withStructuredOutput(classificationSchema, {
    method: "functionCalling",
  });

  const prompt = `
    ${BASE_PERSONA}

    CONTEXT:
    - Current Date & Time: "${currentDateTime}"
    - Booking flow already in progress: ${bookingInProgress ? "YES" : "NO"}
    ${bookingInProgress ? `- Details already captured: ${JSON.stringify({ doctorId, doctorName, date, time, email })}` : ""}
    ${needsFamilySelection ? `- Multiple family profiles are on file for this phone number and the user was just asked to choose one: ${familyNames} (or say they want to register a new family member)` : ""}

    RECENT CONVERSATION (most recent last — use this to understand what a short
    answer like a number or single word is actually responding to):
    ${recentHistory}

    YOUR JOB:
    1. Analyze the user's LATEST message using the recent conversation above for context.
       e.g. if the assistant just asked "What is your age?" and the user replies "22",
       extract extracted_age = "22", even though the message alone has no explicit label.
    2. RESOLVE DATES: Convert "tomorrow", "next Friday", "in 2 days" to exact YYYY-MM-DD using today's date.
    3. Extract every relevant field present in the message, even if you're not sure which agent to route to.
    4. If family profiles were listed (see CONTEXT above), check if this message picks one of the
       listed names (extracted_family_selection) or asks to add a new family member (wants_new_family_member).
    5. Route to the correct worker using these rules:

    → "knowledge_query"   — ONLY when booking is NOT already in progress and there is no booking intent,
        and the user asks a general informational question, e.g. doctor specialties, fees, hours, services.
        IMPORTANT: If "Booking flow already in progress" is YES, NEVER route here — a doctor name mentioned
        during an active booking is a SELECTION, not a question. Route to "doctor_assistant" or
        "booking_agent" instead.

    → "check_availability" — booking in progress, doctor+date known, time not yet picked.

    → "booking_agent"     — booking in progress and this message supplies/confirms a remaining field
        (doctor, date, time, email, name), or user explicitly confirms ("yes book it", "confirm").

    → "doctor_assistant"  — everything else: greetings, registration, general Q&A, first message
        stating booking intent before any doctor/date/time captured yet, and family profile selection.

    Classify and extract fields from the user's most recent message: "${lastMessage}"
  `;

  const result = await structuredLlm.invoke(prompt);

  // Resolve family selection if applicable
  let activePatientIdUpdate = {};
  if (needsFamilySelection && result.extracted_family_selection) {
    const match = state.patientRecords.find(p =>
      p.name.toLowerCase().includes(result.extracted_family_selection.toLowerCase())
    );
    if (match) activePatientIdUpdate = { activePatientId: String(match._id) };
  }

 const registeringNewMember = result.wants_new_family_member === true;

 const singlePatientAwaitingConfirmation =
  Array.isArray(state.patientRecords) &&
  state.patientRecords.length === 1 &&
  !state.activePatientId &&
  !registeringNewMember;

let selfConfirmUpdate = {};
if (singlePatientAwaitingConfirmation && result.confirms_self) {
  selfConfirmUpdate = { activePatientId: String(state.patientRecords[0]._id) };
}
  // Force flow: unresolved registration or unresolved family selection both stay on doctor_assistant
 const stillNeedsSelection =
  (needsFamilySelection && !activePatientIdUpdate.activePatientId && !registeringNewMember) ||
  (singlePatientAwaitingConfirmation && !selfConfirmUpdate.activePatientId && !registeringNewMember);

const finalStep =
  isUnregisteredNewPatient || stillNeedsSelection || registeringNewMember
    ? "doctor_assistant"
    : result.next_step;

  console.log(
    `[Orchestrator] Routed to: ${finalStep} (bookingInProgress: ${bookingInProgress}, forcedRegistration: ${isUnregisteredNewPatient}, needsFamilySelection: ${needsFamilySelection})`
  );

  return {
    nextAgent: finalStep,
    ...activePatientIdUpdate,
    ...selfConfirmUpdate,
    appointmentData: {
      ...(result.extracted_patient_name !== null && { patientName: result.extracted_patient_name }),
      ...(result.extracted_doctor_name  !== null && {
        doctorName: result.extracted_doctor_name,
        doctorId:   resolveDoctorId(result.extracted_doctor_name),
      }),
      ...(result.extracted_email      !== null && { email:      result.extracted_email }),
      ...(result.extracted_date       !== null && { date:       result.extracted_date }),
      ...(result.extracted_time       !== null && { time:       result.extracted_time }),
      ...(result.extracted_age        !== null && { age:        result.extracted_age }),
      ...(result.extracted_gender     !== null && { gender:     result.extracted_gender }),
      ...(result.extracted_city       !== null && { city:       result.extracted_city }),
      ...(result.extracted_conditions !== null && { conditions: result.extracted_conditions }),
      ...(result.wants_to_book === true && { bookingIntent: true }),
      ...(registeringNewMember && { registeringNewFamilyMember: true }),
    },
  };
};

module.exports = { orchestratorNode };