// src/controllers/twilio.controller.js
const twilio = require('twilio');
const { VoiceResponse } = twilio.twiml;
const { HumanMessage } = require("@langchain/core/messages");
const { graph } = require("../graph/index"); 
const { validateSession, updateSession, endSession } = require("../utils/sessionManager");

const handleInboundCall = (req, res) => {
  const twiml = new VoiceResponse();

  twiml.say('Hello. I am your Doctor Assistant. How can I help you today?');

  // Start listening immediately
  twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    action: '/api/twilio/handle-speech', 
    method: 'POST'
  });

  res.type('text/xml');
  res.send(twiml.toString());
};

// HANDLE SPEECH RESULT

const handleSpeechResult = async (req, res) => {
  const twiml = new VoiceResponse();

  const threadId = req.body.CallSid;
  const userInput = req.body.SpeechResult;

  console.log(`[Twilio] Received speech input from CallSid: ${threadId}`);
  console.log(`[Twilio] User Input: ${userInput}`);

  if (!userInput) {
    twiml.say("I didn't hear anything. Please say that again.");
    twiml.gather({
      input: 'speech',
      speechTimeout: 'auto',
      action: '/api/twilio/handle-speech',
    });
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  try {
    const isValid = validateSession(threadId);
    updateSession(threadId);

    const config = { configurable: { thread_id: threadId } };
    const inputs = { messages: [new HumanMessage(userInput)] };
    const result = await graph.invoke(inputs, config);

    const lastMessage = result.messages[result.messages.length - 1];
    let aiResponse = lastMessage.content;

    twiml.say(aiResponse);

    if (aiResponse.toLowerCase().includes("booked") || aiResponse.toLowerCase().includes("confirmed")) {
      twiml.say("Have a great day. Goodbye!");
      twiml.hangup();
      endSession(threadId); 
    } else {
      
      twiml.gather({
        input: 'speech',
        speechTimeout: 'auto',
        action: '/api/twilio/handle-speech',
      });
    }

  } catch (error) {
    console.error("Twilio Graph Error:", error);
    twiml.say("I am having trouble connecting to the server. Please try again later.");
    twiml.hangup();
  }

  res.type('text/xml');
  res.send(twiml.toString());
};

module.exports = { handleInboundCall, handleSpeechResult };