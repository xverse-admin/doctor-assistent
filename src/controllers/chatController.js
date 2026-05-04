// src/controllers/chatController.js
const { HumanMessage } = require("@langchain/core/messages");
const { graph } = require("../graph/index");
const { validateSession, updateSession, endSession } = require("../utils/sessionManager");
const { appendMessageToSession, saveAppointment, upsertSession } = require("../utils/database");

const handleChat = async (req, res) => {
  const { message, threadId } = req.body;

  if (!message || !threadId) {
    return res.status(400).json({ error: "Both 'message' and 'threadId' are required." });
  }

  // Check session timeout
  const isValid = await validateSession(threadId);
  if (!isValid) {
    return res.json({
      response: "Session timed out due to inactivity. Please start a new conversation.",
      sessionStatus: "expired",
    });
  }

  // Update activity
  await updateSession(threadId);

  // Persist user message
  await appendMessageToSession(threadId, {
    role: "user",
    content: message,
    timestamp: new Date(),
  });

  try {
    const config = { configurable: { thread_id: threadId } };
    const inputs = { messages: [new HumanMessage(message)] };
    const result = await graph.invoke(inputs, config);

    const lastMessage = result.messages[result.messages.length - 1];
    let responseText = lastMessage.content;
    let sessionStatus = "active";

    // Detect booking completion
    const isBooked =
      responseText.toLowerCase().includes("booked") ||
      responseText.toLowerCase().includes("confirmed");

    if (isBooked) {
      responseText += "\n\n(Session complete. Start a new session anytime!)";
      sessionStatus = "completed";
      await endSession(threadId, "completed");

      // Try to save appointment data
      try {
        const apptData = result.appointmentData || {};
        if (apptData.name || apptData.email || apptData.date) {
          await saveAppointment({
            thread_id: threadId,
            name: apptData.name,
            email: apptData.email,
            date: apptData.date,
            time: apptData.time,
            status: "confirmed",
            response_text: responseText,
          });
        }
      } catch (e) {
        console.error("[ChatController] Failed to save appointment:", e.message);
      }
    }

    // Persist assistant response
    await appendMessageToSession(threadId, {
      role: "assistant",
      content: responseText,
      agent: result.nextAgent,
      timestamp: new Date(),
    });

    return res.json({
      response: responseText,
      agentUsed: result.nextAgent,
      sessionStatus,
    });
  } catch (error) {
    console.error("Graph Execution Error:", error);
    return res.status(500).json({ error: "Error processing request: " + error.message });
  }
};

module.exports = { handleChat };
