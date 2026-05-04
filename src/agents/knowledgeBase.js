// src/agents/knowledgeBase.js
// Queries MongoDB live and answers using real hospital data

const { ChatOpenAI } = require("@langchain/openai");
const { AIMessage } = require("@langchain/core/messages");
const {
  getDoctors,
  getDoctorBySpecialization,
  getFaqs,
  searchFaqs,
  getServices,
  getPatientByEmail,
  getAppointmentsByPatientEmail,
  getAllAppointments,
} = require("../utils/database");

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0.2, maxTokens: 1200 });

// ── Intent detectors ──────────────────────────────────────────────────────────
const isDoctorQuery   = (m) => /doctor|specialist|cardiolog|neurolog|orthop|endocrin|general med|physician|how many doc|who is|dr\./i.test(m);
const isServiceQuery  = (m) => /service|test|ecg|echo|mri|blood|lipid|package|hba1c|eeg|scan|procedure|tmt|stress|offer|available test/i.test(m);
const isApptQuery     = (m) => /appointment|booking|scheduled|upcoming|history|my visit|when.*booked/i.test(m);
const isFeeQuery      = (m) => /fee|cost|price|charge|how much|consultation charge/i.test(m);
const isHoursQuery    = (m) => /hour|timing|open|close|when.*available|working day|schedule/i.test(m);
const isLocationQuery = (m) => /location|address|where|direction|parking|map/i.test(m);
const isInsurQuery    = (m) => /insurance|cashless|policy|cover/i.test(m);
const isEmergQuery    = (m) => /emergency|urgent|helpline|24.?7/i.test(m);
const emailRegex      = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/**
 * Runs smart MongoDB queries based on what the user is asking.
 * Returns a formatted context string injected into GPT-4o prompt.
 */
const fetchContext = async (userMessage) => {
  const msg = userMessage.toLowerCase();
  const parts = [];

  // 1. Doctors
  if (isDoctorQuery(msg) || isFeeQuery(msg)) {
    const specMatch = msg.match(/cardiolog|neurolog|orthop|endocrin|general med/i);
    const doctors = specMatch
      ? await getDoctorBySpecialization(specMatch[0])
      : await getDoctors();

    if (doctors.length) {
      parts.push(`📋 HOSPITAL DOCTORS (${doctors.length} specialist${doctors.length > 1 ? "s" : ""}):`);
      doctors.forEach(d => {
        parts.push(
          `• ${d.name} | ${d.specialization} | ${d.qualification} | ${d.experience_years} yrs exp | ` +
          `Fee: ₹${d.consultation_fee} | Days: ${d.available_days?.join(", ")} | ` +
          `Hours: ${d.office_hours?.start}–${d.office_hours?.end} | ` +
          `Services: ${d.services?.join(", ")} | Languages: ${d.languages?.join(", ")} | ` +
          `Rating: ${d.rating}/5 (${d.total_reviews} reviews) | Phone: ${d.phone}`
        );
      });
    }
  }

  // 2. Services / Tests
  if (isServiceQuery(msg)) {
    const deptMatch = msg.match(/cardio|neuro|ortho|endocrin|general|patholog|radiol/i);
    const services = await getServices(deptMatch ? deptMatch[0] : null);
    if (services.length) {
      parts.push(`\n🏥 AVAILABLE SERVICES & TESTS (${services.length}):`);
      services.forEach(s => {
        parts.push(
          `• ${s.name} (${s.department}) | ₹${s.price} | ${s.duration_minutes} min | ` +
          `${s.description} | Preparation: ${s.preparation}`
        );
      });
    }
  }

  // 3. Patient lookup by email
  const emailMatch = userMessage.match(emailRegex);
  if (emailMatch) {
    const patient = await getPatientByEmail(emailMatch[0]);
    if (patient) {
      parts.push(`\n👤 PATIENT RECORD:`);
      parts.push(
        `• Name: ${patient.name} | Age: ${patient.age} | Gender: ${patient.gender} | ` +
        `Blood: ${patient.blood_group} | Phone: ${patient.phone}`
      );
      parts.push(
        `• Conditions: ${patient.medical_history?.conditions?.join(", ") || "None"} | ` +
        `Allergies: ${patient.medical_history?.allergies?.join(", ") || "None"} | ` +
        `Medications: ${patient.medical_history?.current_medications?.join(", ") || "None"}`
      );
      const appts = await getAppointmentsByPatientEmail(emailMatch[0]);
      if (appts.length) {
        parts.push(`\n📅 PATIENT APPOINTMENTS (${appts.length}):`);
        appts.forEach(a => {
          parts.push(
            `• ${a.appointment_date} at ${a.appointment_time} | Dr. ${a.doctor_name} (${a.specialization}) | ` +
            `Status: ${a.status} | Reason: ${a.reason}`
          );
        });
      }
    } else {
      parts.push(`\n👤 No patient found with email: ${emailMatch[0]}`);
    }
  }

  // 4. Appointment stats query ("how many appointments today?" etc)
  if (isApptQuery(msg) && !emailMatch) {
    const allAppts = await getAllAppointments(20);
    if (allAppts.length) {
      const today = new Date().toISOString().slice(0, 10);
      const todayAppts   = allAppts.filter(a => a.appointment_date === today);
      const upcoming     = allAppts.filter(a => a.appointment_date >= today && a.status === "confirmed");
      const completed    = allAppts.filter(a => a.status === "completed");
      parts.push(`\n📅 APPOINTMENTS SUMMARY:`);
      parts.push(`• Total in system: ${allAppts.length}`);
      parts.push(`• Today (${today}): ${todayAppts.length}`);
      parts.push(`• Upcoming confirmed: ${upcoming.length}`);
      parts.push(`• Completed: ${completed.length}`);
      if (upcoming.length > 0) {
        parts.push(`\nNext upcoming appointments:`);
        upcoming.slice(0, 5).forEach(a => {
          parts.push(`• ${a.appointment_date} ${a.appointment_time} — ${a.patient_name} with ${a.doctor_name}`);
        });
      }
    }
  }

  // 5. FAQ search — always run for hours/location/insurance/emergency + general
  if (isHoursQuery(msg) || isLocationQuery(msg) || isInsurQuery(msg) || isEmergQuery(msg) || parts.length === 0) {
    const keywords = msg.replace(/[^a-z0-9 ]/g, " ").split(" ").filter(w => w.length > 3).slice(0, 4).join("|");
    const faqs = await searchFaqs(keywords || msg.slice(0, 40));
    if (faqs.length) {
      parts.push(`\n❓ RELEVANT FAQ ANSWERS:`);
      faqs.forEach(f => parts.push(`Q: ${f.question}\nA: ${f.answer}`));
    }
  }

  return parts.join("\n");
};

// ── Knowledge Base Node ───────────────────────────────────────────────────────
const knowledgeBaseNode = async (state) => {
  const userMessage = state.messages[state.messages.length - 1].content;
  console.log(`[KnowledgeBase] Query: "${userMessage.slice(0, 80)}"`);

  const context = await fetchContext(userMessage);
  console.log(`[KnowledgeBase] Context: ${context.length} chars`);

  const systemPrompt =
    `You are Amy, the AI assistant at Apollo Specialty Hospital, Hyderabad.\n\n` +
    `Answer the user's question using ONLY the real hospital database data below.\n` +
    `Be concise, accurate, and friendly. Use bullet points for lists. Use ₹ for prices.\n` +
    `If the data doesn't contain the answer, say: "I'll connect you with our reception — call +91-40-2345-6789."\n\n` +
    `LIVE DATABASE DATA:\n` +
    (context || "No specific data found for this query.");

  const response = await llm.invoke([
    { role: "system", content: systemPrompt },
    { role: "user",   content: userMessage },
  ]);

  // Wrap in AIMessage so LangGraph handles it correctly
  return { messages: [new AIMessage(response.content)] };
};

module.exports = { knowledgeBaseNode, fetchContext };
