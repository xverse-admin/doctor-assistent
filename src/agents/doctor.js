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
  const { messages } = state;

  const response = await modelWithTools.invoke([
    { role: "system", content: DOCTOR_RULES },
    ...messages
  ]);

  return { messages: [response] };
};

module.exports = { doctorNode };
