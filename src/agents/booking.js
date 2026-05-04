const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage } = require("@langchain/core/messages");
const { bookAppointmentTool } = require("../tools/calendar");
const { BOOKING_RULES } = require("../constants/prompts");

const bookingNode = async (state) => {
  const { appointmentData } = state;
  const missingFields = [];

  // --- GUARDRAIL START ---
  // 1. Check for required fields explicitly
  if (!appointmentData.date) missingFields.push("Date");
  if (!appointmentData.time) missingFields.push("Time");
  if (!appointmentData.email) missingFields.push("Email");
  if (!appointmentData.name) missingFields.push("Name");
  //if (!appointmentData.phone) missingFields.push("Phone Number");
  //if (!appointmentData.reason) missingFields.push("Reason for Visit");

  // 2. If information is missing, STOP here.
  // We return a message directly to the user without invoking the booking tool.
  if (missingFields.length > 0) {
    const responseText = `I need a little more information to complete your booking. Please provide your: ${missingFields.join(", ")}.`;
    
    return {
      messages: [new HumanMessage(responseText)],
      // We do NOT call the tool here.
    };
  }
  // --- GUARDRAIL END ---

  // 3. If we are here, we have ALL data. Now we authorize the LLM to use the tool.
  const llm = new ChatOpenAI({ temperature: 0 }).bindTools([bookAppointmentTool]);

  // We explicitly tell the LLM that the data is ready in the system prompt
  const systemMessage = `
    You are the Booking Agent. 
    You have all the required details:
    - Name: ${appointmentData.name}
    - Email: ${appointmentData.email}
    - Date: ${appointmentData.date}
    - Time: ${appointmentData.time}
    
    Proceed to use the 'book_appointment' tool immediately.
  `;

  const response = await llm.invoke([
    { role: "system", content: BOOKING_RULES },
    //{ role: "system", content: systemMessage },
    ...state.messages
  ]);

  return { messages: [response] };
};

module.exports = { bookingNode };