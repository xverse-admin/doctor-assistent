const express = require('express');
const controller = require('../controllers/twilio.controller'); // Importing the new controller below

const router = express.Router();

// 1. Initial Endpoint: Twilio hits this when the call connects
router.post('/inbound-call', controller.handleInboundCall);

// 2. Loop Endpoint: Twilio hits this every time the user speaks
router.post('/handle-speech', controller.handleSpeechResult);

module.exports = router;