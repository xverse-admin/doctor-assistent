// // src/controllers/chatController.js
// const { HumanMessage } = require("@langchain/core/messages");
// const { graph } = require("../graph/index");
// const { validateSession, updateSession, endSession } = require("../utils/sessionManager");
// const { appendMessageToSession, saveAppointment, upsertSession } = require("../utils/database");

// const handleChat = async (req, res) => {
//   const { message, threadId } = req.body;

//   if (!message || !threadId) {
//     return res.status(400).json({ error: "Both 'message' and 'threadId' are required." });
//   }

//   // Check session timeout
//   const isValid = await validateSession(threadId);
//   if (!isValid) {
//     return res.json({
//       response: "Session timed out due to inactivity. Please start a new conversation.",
//       sessionStatus: "expired",
//     });
//   }

//   // Update activity
//   await updateSession(threadId);

//   // Persist user message
//   await appendMessageToSession(threadId, {
//     role: "user",
//     content: message,
//     timestamp: new Date(),
//   });

//   try {
//     const config = { configurable: { thread_id: threadId } };
//     const inputs = { messages: [new HumanMessage(message)] };
//     const result = await graph.invoke(inputs, config);

//     const lastMessage = result.messages[result.messages.length - 1];
//     let responseText = lastMessage.content;
//     let sessionStatus = "active";

//     // Detect booking completion
//     const isBooked =
//       responseText.toLowerCase().includes("booked") ||
//       responseText.toLowerCase().includes("confirmed");

//     if (isBooked) {
//       responseText += "\n\n(Session complete. Start a new session anytime!)";
//       sessionStatus = "completed";
//       await endSession(threadId, "completed");

//       // Try to save appointment data
//       try {
//         const apptData = result.appointmentData || {};
//         if (apptData.name || apptData.email || apptData.date) {
//           await saveAppointment({
//             thread_id: threadId,
//             name: apptData.name,
//             email: apptData.email,
//             date: apptData.date,
//             time: apptData.time,
//             status: "confirmed",
//             response_text: responseText,
//           });
//         }
//       } catch (e) {
//         console.error("[ChatController] Failed to save appointment:", e.message);
//       }
//     }

//     // Persist assistant response
//     await appendMessageToSession(threadId, {
//       role: "assistant",
//       content: responseText,
//       agent: result.nextAgent,
//       timestamp: new Date(),
//     });

//     return res.json({
//       response: responseText,
//       agentUsed: result.nextAgent,
//       sessionStatus,
//     });
//   } catch (error) {
//     console.error("Graph Execution Error:", error);
//     return res.status(500).json({ error: "Error processing request: " + error.message });
//   }
// };

// module.exports = { handleChat };

// src/controllers/chatController.js
const { HumanMessage } = require("@langchain/core/messages");
const { graph } = require("../graph/index");
const { validateSession, updateSession, endSession } = require("../utils/sessionManager");
const {
  appendMessageToSession,
  saveAppointment,
  upsertSession,
  getSessionsByPhone,
  getSession,
  getAppointmentsByPhone,
  createPatient,
  updatePatientContact,
} = require("../utils/database");

const handleChat = async (req, res) => {
  const { message, threadId, userPhone } = req.body;

  if (!message || !threadId) {
    return res.status(400).json({ error: "Both 'message' and 'threadId' are required." });
  }

  const isValid = await validateSession(threadId);
  if (!isValid) {
    return res.json({
      response: "Session timed out due to inactivity. Please start a new conversation.",
      sessionStatus: "expired",
    });
  }

  await updateSession(threadId);

  await appendMessageToSession(threadId, {
    role:      "user",
    content:   message,
    timestamp: new Date(),
  });

  if (userPhone) {
    await upsertSession(threadId, { user_phone: userPhone });
  }

  try {
    const config  = { configurable: { thread_id: threadId } };
    const inputs  = { messages: [new HumanMessage(message)], userPhone: userPhone || null };
    const result  = await graph.invoke(inputs, config);

    const lastMessage  = result.messages[result.messages.length - 1];
    let responseText   = lastMessage.content;
    let sessionStatus  = "active";

    const isBooked =
      responseText.toLowerCase().includes("booked") ||
      responseText.toLowerCase().includes("confirmed");

    const isNewPatientRegistered = responseText
      .toLowerCase()
      .includes("saved your details as a new patient");

    if (isNewPatientRegistered && userPhone) {
      try {
        const regData = result.appointmentData || {};
        const newPatient = await createPatient({
          name:       regData.patientName,
          age:        regData.age,
          gender:     regData.gender,
          phone:      userPhone,
          email:      regData.email,
          city:       regData.city,
          conditions: regData.conditions,
        });

        // Mark registration complete AND set this new patient as the active
        // profile for the session (handles both first-time and new-family-member cases)
        await graph.updateState(config, {
          appointmentData: { patientRegistered: true, registeringNewFamilyMember: false },
          activePatientId: String(newPatient._id),
        });
      } catch (e) {
        console.error("[ChatController] Failed to save new patient:", e.message);
      }
    }

    if (isBooked) {
      responseText  += "\n\n(Session complete. Start a new session anytime!)";
      sessionStatus  = "completed";
      await endSession(threadId, "completed");

      try {
        const apptData = result.appointmentData || {};
        const patientName = apptData.patientName || (result.patientRecord && result.patientRecord.name) || null;

        if (patientName || apptData.email || apptData.date) {
          await saveAppointment({
            thread_id:   threadId,
            user_phone:  userPhone || null,
            name:        patientName,
            doctor_name: apptData.doctorName || null,
            doctor_id:   apptData.doctorId || null,
            email:       apptData.email || (result.patientRecord && result.patientRecord.email) || null,
            date:        apptData.date,
            time:        apptData.time,
            status:      "confirmed",
            response_text: responseText,
          });
        }

        if (userPhone && apptData.email) {
          await updatePatientContact(userPhone, { email: apptData.email });
        }
      } catch (e) {
        console.error("[ChatController] Failed to save appointment or backfill email:", e.message);
      }
    }

    await appendMessageToSession(threadId, {
      role:      "assistant",
      content:   responseText,
      agent:     result.nextAgent,
      timestamp: new Date(),
    });

    return res.json({ response: responseText, agentUsed: result.nextAgent, sessionStatus });
  } catch (error) {
    console.error("Graph Execution Error:", error);
    return res.status(500).json({ error: "Error processing request: " + error.message });
  }
};

const getSessions = async (req, res) => {
  try {
    const { userPhone } = req.query;
    if (!userPhone) return res.status(400).json({ error: "userPhone is required." });
    const sessions = await getSessionsByPhone(userPhone);
    res.json({ sessions });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const getSessionById = async (req, res) => {
  try {
    const { userPhone } = req.query;
    const session = await getSession(req.params.threadId);
    if (!session) return res.status(404).json({ error: "Session not found." });
    if (userPhone && session.user_phone && session.user_phone !== userPhone) {
      return res.status(403).json({ error: "Access denied." });
    }
    res.json({ session });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const getAppointments = async (req, res) => {
  try {
    const { userPhone } = req.query;
    if (!userPhone) return res.status(400).json({ error: "userPhone is required." });
    const appointments = await getAppointmentsByPhone(userPhone);
    res.json({ appointments });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { handleChat, getSessions, getSessionById, getAppointments };