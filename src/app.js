// src/app.js
const express      = require("express");
const path         = require("path");
const cors         = require("cors");
const chatRoutes   = require("./routes/chatRoutes");
const authRoutes   = require("./routes/authRoutes");
const twilioRoutes = require("./routes/twilio.route");
const imageRoutes  = require("./routes/imageRoutes");
const adminRoutes  = require("./routes/adminRoutes");
const { getDb } = require("./utils/database");
const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Serve frontend UI
app.use(express.static(path.join(__dirname, "../public")));

// API routes
app.use("/", authRoutes);
app.use("/", chatRoutes);
app.use("/", imageRoutes);
app.use("/", adminRoutes);
app.use("/api/twilio", twilioRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status:    "UP",
    message:   "🧠 Amy AI Assistant is live!",
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
  });
});

// src/app.js - add at top with other requires
 

// Replace the broken /test-db route with this
app.get("/test-db", async (req, res) => {
  try {
    const db = await getDb();
    const doctors      = await db.collection("doctors").find({}).limit(3).toArray();
    const faqs         = await db.collection("faqs").find({}).limit(3).toArray();
    const appointments = await db.collection("appointments").find({}).limit(3).toArray();
    const sessions     = await db.collection("chat_sessions").find({}).limit(3).toArray();

    res.json({
      status: "✅ MongoDB Connected",
      collections: {
        doctors:      { count: doctors.length,      sample: doctors },
        faqs:         { count: faqs.length,          sample: faqs },
        appointments: { count: appointments.length,  sample: appointments },
        chat_sessions:{ count: sessions.length,      sample: sessions },
      }
    });
  } catch (err) {
    res.status(500).json({ status: "❌ DB Error", error: err.message });
  }
});

module.exports = app;
