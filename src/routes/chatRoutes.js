// src/routes/chatRoutes.js
const express = require("express");
const {
  handleChat,
  getSessions,
  getSessionById,
  getAppointments,
} = require("../controllers/chatController");

const router = express.Router();

// Chat
router.post("/chat", handleChat);

// Appointments — filtered by userPhone
router.get("/appointments", getAppointments);

// Sessions — filtered by userPhone
router.get("/sessions",          getSessions);
router.get("/sessions/:threadId", getSessionById);

module.exports = router;