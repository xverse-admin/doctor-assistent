// src/routes/adminRoutes.js
// Admin API for viewing sessions, appointments, reports from the frontend
const express = require("express");
const { getAllSessions, getSession, getAllAppointments, getAppointmentsByThread, getAllReports } = require("../utils/database");

const router = express.Router();

// All sessions (summary, no messages)
router.get("/admin/sessions", async (req, res) => {
  try {
    const sessions = await getAllSessions(100);
    res.json({ sessions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Single session with full message history
router.get("/admin/sessions/:threadId", async (req, res) => {
  try {
    const session = await getSession(req.params.threadId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({ session });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All appointments
router.get("/admin/appointments", async (req, res) => {
  try {
    const { threadId } = req.query;
    const appointments = threadId
      ? await getAppointmentsByThread(threadId)
      : await getAllAppointments(100);
    res.json({ appointments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All reports
router.get("/admin/reports", async (req, res) => {
  try {
    const reports = await getAllReports(100);
    res.json({ reports });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
