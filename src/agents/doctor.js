// src/agents/doctor.js

const { ChatOpenAI } = require("@langchain/openai");
const { DOCTOR_RULES } = require("../constants/prompts");
const { checkAvailabilityTool, bookAppointmentTool } = require("../tools/calendar");

const model = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0
});

const modelWithTools = model.bindTools([
    checkAvailabilityTool,
    bookAppointmentTool
]);

const doctorNode = async (state) => {
  const { messages, patientRecord, userPhone, patientRecords, activePatientId, appointmentData } = state;

  let patientContext;

  if (appointmentData?.registeringNewFamilyMember) {
    patientContext = `PATIENT LOOKUP: The user wants to register a NEW family member under phone ${userPhone}, separate from any existing profile on this number. Begin registration for this new person one field at a time: Full name → Age → Gender → City → Known conditions/allergies (optional). Do not confuse this with the existing patient(s) already on file.`;

  } else if (!userPhone) {
    patientContext =
      "PATIENT LOOKUP: No phone number available yet. Ask the user for their registered phone number before anything else (unless this is an emergency).";

  } else if (Array.isArray(patientRecords) && patientRecords.length > 1 && !activePatientId) {
    const names = patientRecords.map(p => p.name).join(", ");
    patientContext = `PATIENT LOOKUP: Multiple family profiles found for phone ${userPhone}: ${names}.
Ask the user which of these this conversation is for, or whether they'd like to register a new family
member under this number. Do not proceed with registration, purpose, or booking until this is resolved.`;

  } else if (activePatientId && Array.isArray(patientRecords)) {
    const active = patientRecords.find(p => String(p._id) === activePatientId);
    if (active) {
      patientContext = `PATIENT LOOKUP: Continuing with ${active.name} (selected from family profiles on phone ${userPhone}).
Age: ${active.age}, Gender: ${active.gender}, Patient ID: ${active.patient_id}.
Do NOT re-ask for name, age, or gender. Move straight to their purpose unless already stated.`;
    } else if (patientRecord) {
      patientContext = `PATIENT LOOKUP: Existing patient found for phone ${userPhone}.
Name: ${patientRecord.name}, Age: ${patientRecord.age}, Gender: ${patientRecord.gender}, Patient ID: ${patientRecord.patient_id}.

Greet them by name and ask ONE question: "Welcome back, ${patientRecord.name}! Is this for you or another family member?"
Do not ask anything else in this turn. Do not re-ask name/age/gender.
- If they say it's for themselves (e.g. "me", "myself", "yes it's for me"), continue as ${patientRecord.name} and move to asking their purpose.
- If they say it's for someone else (e.g. "my father", "someone else", a different name), begin registering that new family member: Full name → Age → Gender → City → Known conditions/allergies (optional).`;
    } else {
      patientContext = `PATIENT LOOKUP: No patient record found for phone ${userPhone}. Begin registration: Full name → Age → Gender → City → Conditions.`;
    }

  } else if (patientRecord) {
    patientContext = `PATIENT LOOKUP: Existing patient found for phone ${userPhone}.
Name: ${patientRecord.name}, Age: ${patientRecord.age}, Gender: ${patientRecord.gender}, Patient ID: ${patientRecord.patient_id}.

Greet them by name and ask ONE question: "Welcome back, ${patientRecord.name}! Is this for you or another family member?"
Do not ask anything else in this turn. Do not re-ask name/age/gender.
- If they say it's for themselves (e.g. "me", "myself", "yes it's for me"), continue as ${patientRecord.name} and move to asking their purpose.
- If they say it's for someone else (e.g. "my father", "someone else", a different name), begin registering that new family member: Full name → Age → Gender → City → Known conditions/allergies (optional).`;

  } else {
    patientContext = `PATIENT LOOKUP: No patient record found for phone ${userPhone}. Begin registration: Full name → Age → Gender → City → Conditions.`;
  }

  const response = await modelWithTools.invoke([
    { role: "system", content: DOCTOR_RULES },
    { role: "system", content: patientContext },
    ...messages
  ]);

  return { messages: [response] };
};

module.exports = { doctorNode };