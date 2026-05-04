const { AVAILABILITY_RULES } = require("../constants/prompts");
const { checkAvailabilityTool } = require("../tools/calendar");
const { ChatOpenAI } = require("@langchain/openai");

const availabilityNode = async (state) => {
  // 1. Guardrail: Check Business Logic manually (Optional but faster/cheaper)
  // If we have a time, we can check if it's after 4:30 PM using standard JS code 
  // before even asking the LLM.
  
  // 2. Call LLM with the Specific Rules
  const llm = new ChatOpenAI({ temperature: 0 }).bindTools([checkAvailabilityTool]);
  
  const response = await llm.invoke([
    { role: "system", content: AVAILABILITY_RULES }, // <--- Injects the rules
    ...state.messages
  ]);
  
  return { messages: [response] };
};


module.exports = { availabilityNode };