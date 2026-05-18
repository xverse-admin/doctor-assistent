// // src/utils/database.js
// // MongoDB connection & collections for Amy Assistant

// const { MongoClient, ObjectId } = require("mongodb");

// let client = null;
// let db = null;

// const getDb = async () => {
//   if (db) return db;

//   const uri = process.env.MONGODB_URI;
//   if (!uri) throw new Error("MONGODB_URI is not set in environment variables.");

//   client = new MongoClient(uri, {
//     serverSelectionTimeoutMS: 5000,
//     connectTimeoutMS: 10000,
//   });

//   await client.connect();
//   db = client.db(process.env.MONGODB_DB_NAME || "amy_assistant");

//   // Create indexes
//   await db.collection("medical_reports").createIndex({ thread_id: 1 });
//   await db.collection("medical_reports").createIndex({ created_at: -1 });
//   await db.collection("chat_sessions").createIndex({ thread_id: 1 }, { unique: true });
//   await db.collection("chat_sessions").createIndex({ updated_at: -1 });
//   await db.collection("appointments").createIndex({ thread_id: 1 });
//   await db.collection("appointments").createIndex({ appointment_date: 1 });

//   // Indexes for knowledge base collections
//   await db.collection("doctors").createIndex({ specialization: 1 });
//   await db.collection("faqs").createIndex({ tags: 1 });
//   await db.collection("faqs").createIndex({ question: "text", answer: "text", tags: "text" });
//   await db.collection("services").createIndex({ department: 1 });
//   await db.collection("patients").createIndex({ email: 1 });
//   await db.collection("appointments").createIndex({ patient_email: 1 });

//   console.log(`[DB] Connected to MongoDB: ${process.env.MONGODB_DB_NAME || "amy_assistant"}`);
//   return db;
// };

// const closeDb = async () => {
//   if (client) { await client.close(); client = null; db = null; }
// };

// // ─── medical_reports ─────────────────────────────────────────────────────────
// const saveReport = async (data) => {
//   const database = await getDb();
//   const doc = { ...data, created_at: new Date() };
//   const result = await database.collection("medical_reports").insertOne(doc);
//   return { ...doc, _id: result.insertedId };
// };

// const getReportsByThread = async (threadId) => {
//   const database = await getDb();
//   return database.collection("medical_reports").find({ thread_id: threadId }).sort({ created_at: -1 }).toArray();
// };

// const getAllReports = async (limit = 50) => {
//   const database = await getDb();
//   return database
//     .collection("medical_reports")
//     .find({})
//     .project({
//       thread_id:      1,
//       filename:       1,
//       mime_type:      1,
//       created_at:     1,
//       extracted_text: 1,
//       image_url:      1,   // Cloudinary URL
//       image_base64:   1,   // fallback only
//     })
//     .sort({ created_at: -1 })
//     .limit(limit)
//     .toArray();
// };

// // ─── chat_sessions ────────────────────────────────────────────────────────────
// const upsertSession = async (threadId, update = {}) => {
//   const database = await getDb();
//   return database.collection("chat_sessions").findOneAndUpdate(
//     { thread_id: threadId },
//     { $set: { updated_at: new Date(), ...update }, $setOnInsert: { thread_id: threadId, created_at: new Date() } },
//     { upsert: true, returnDocument: "after" }
//   );
// };

// const appendMessageToSession = async (threadId, message) => {
//   const database = await getDb();
//   return database.collection("chat_sessions").updateOne(
//     { thread_id: threadId },
//     { $push: { messages: message }, $set: { updated_at: new Date() }, $setOnInsert: { thread_id: threadId, created_at: new Date() } },
//     { upsert: true }
//   );
// };

// const getSession = async (threadId) => {
//   const database = await getDb();
//   return database.collection("chat_sessions").findOne({ thread_id: threadId });
// };

// const getAllSessions = async (limit = 50) => {
//   const database = await getDb();
//   return database.collection("chat_sessions")
//     .find({}, { projection: { messages: 0 } })
//     .sort({ updated_at: -1 }).limit(limit).toArray();
// };

// // ─── appointments ─────────────────────────────────────────────────────────────
// const saveAppointment = async (data) => {
//   const database = await getDb();
//   const doc = { ...data, created_at: new Date() };
//   const result = await database.collection("appointments").insertOne(doc);
//   return { ...doc, _id: result.insertedId };
// };

// const getAppointmentsByThread = async (threadId) => {
//   const database = await getDb();
//   return database.collection("appointments").find({ thread_id: threadId }).sort({ created_at: -1 }).toArray();
// };

// const getAllAppointments = async (limit = 50) => {
//   const database = await getDb();
//   return database.collection("appointments").find({}).sort({ created_at: -1 }).limit(limit).toArray();
// };



// // ─── knowledge base queries (doctors / faqs / services / patients) ───────────

// const getDoctors = async (filter = {}) => {
//   const database = await getDb();
//   return database.collection("doctors").find(filter).toArray();
// };

// const getDoctorBySpecialization = async (specialization) => {
//   const database = await getDb();
//   return database.collection("doctors").find({
//     specialization: { $regex: specialization, $options: "i" }
//   }).toArray();
// };

// const getFaqs = async (tags = []) => {
//   const database = await getDb();
//   const filter = tags.length ? { tags: { $in: tags } } : {};
//   return database.collection("faqs").find(filter).toArray();
// };

// const searchFaqs = async (keywords) => {
//   const database = await getDb();
//   // Search across question, answer, tags and category
//   return database.collection("faqs").find({
//     $or: [
//       { question: { $regex: keywords, $options: "i" } },
//       { answer:   { $regex: keywords, $options: "i" } },
//       { tags:     { $regex: keywords, $options: "i" } },
//       { category: { $regex: keywords, $options: "i" } },
//     ]
//   }).limit(5).toArray();
// };

// const getServices = async (department = null) => {
//   const database = await getDb();
//   const filter = department ? { department: { $regex: department, $options: "i" } } : {};
//   return database.collection("services").find(filter).toArray();
// };

// const getPatientByEmail = async (email) => {
//   const database = await getDb();
//   return database.collection("patients").findOne({ email: { $regex: email, $options: "i" } });
// };

// const getAppointmentsByPatientEmail = async (email) => {
//   const database = await getDb();
//   return database.collection("appointments")
//     .find({ patient_email: { $regex: email, $options: "i" } })
//     .sort({ appointment_date: -1 }).limit(10).toArray();
// };

// module.exports = {
//   getDb, closeDb,
//   saveReport, getReportsByThread, getAllReports,
//   upsertSession, appendMessageToSession, getSession, getAllSessions,
//   saveAppointment, getAppointmentsByThread, getAllAppointments,
//   // knowledge base
//   getDoctors, getDoctorBySpecialization,
//   getFaqs, searchFaqs,
//   getServices,
//   getPatientByEmail, getAppointmentsByPatientEmail,
// };

// src/utils/database.js
// MongoDB connection & collections for Amy Assistant

const { MongoClient, ObjectId } = require("mongodb");

let client = null;
let db = null;

const getDb = async () => {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set in environment variables.");

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  await client.connect();
  db = client.db(process.env.MONGODB_DB_NAME || "amy_assistant");

  // Indexes
  await db.collection("medical_reports").createIndex({ thread_id: 1 });
  await db.collection("medical_reports").createIndex({ user_phone: 1 });   // ← NEW
  await db.collection("medical_reports").createIndex({ created_at: -1 });
  await db.collection("chat_sessions").createIndex({ thread_id: 1 }, { unique: true });
  await db.collection("chat_sessions").createIndex({ user_phone: 1 });     // ← NEW
  await db.collection("chat_sessions").createIndex({ updated_at: -1 });
  await db.collection("appointments").createIndex({ thread_id: 1 });
  await db.collection("appointments").createIndex({ user_phone: 1 });      // ← NEW
  await db.collection("appointments").createIndex({ appointment_date: 1 });

  // Knowledge base indexes
  await db.collection("doctors").createIndex({ specialization: 1 });
  await db.collection("faqs").createIndex({ tags: 1 });
  await db.collection("faqs").createIndex({ question: "text", answer: "text", tags: "text" });
  await db.collection("services").createIndex({ department: 1 });
  await db.collection("patients").createIndex({ email: 1 });
  await db.collection("appointments").createIndex({ patient_email: 1 });

  console.log(`[DB] Connected to MongoDB: ${process.env.MONGODB_DB_NAME || "amy_assistant"}`);
  return db;
};

const closeDb = async () => {
  if (client) { await client.close(); client = null; db = null; }
};

// ─── medical_reports ──────────────────────────────────────────────────────────
const saveReport = async (data) => {
  const database = await getDb();
  const doc = { ...data, created_at: new Date() };
  const result = await database.collection("medical_reports").insertOne(doc);
  return { ...doc, _id: result.insertedId };
};

const getReportsByThread = async (threadId) => {
  const database = await getDb();
  return database.collection("medical_reports")
    .find({ thread_id: threadId })
    .sort({ created_at: -1 })
    .toArray();
};

// ── NEW: get reports by phone (only this user's reports) ──────────────────────
const getReportsByPhone = async (userPhone, limit = 50) => {
  const database = await getDb();
  return database.collection("medical_reports")
    .find({ user_phone: userPhone })
    .project({
      thread_id:      1,
      filename:       1,
      mime_type:      1,
      created_at:     1,
      extracted_text: 1,
      image_url:      1,
      image_base64:   1,
      user_phone:     1,
    })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
};

const getAllReports = async (limit = 50) => {
  const database = await getDb();
  return database.collection("medical_reports")
    .find({})
    .project({
      thread_id:      1,
      filename:       1,
      mime_type:      1,
      created_at:     1,
      extracted_text: 1,
      image_url:      1,
      image_base64:   1,
      user_phone:     1,
    })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
};

// ─── chat_sessions ────────────────────────────────────────────────────────────
const upsertSession = async (threadId, update = {}) => {
  const database = await getDb();
  return database.collection("chat_sessions").findOneAndUpdate(
    { thread_id: threadId },
    {
      $set:         { updated_at: new Date(), ...update },
      $setOnInsert: { thread_id: threadId, created_at: new Date() },
    },
    { upsert: true, returnDocument: "after" }
  );
};

const appendMessageToSession = async (threadId, message) => {
  const database = await getDb();
  return database.collection("chat_sessions").updateOne(
    { thread_id: threadId },
    {
      $push:        { messages: message },
      $set:         { updated_at: new Date() },
      $setOnInsert: { thread_id: threadId, created_at: new Date() },
    },
    { upsert: true }
  );
};

const getSession = async (threadId) => {
  const database = await getDb();
  return database.collection("chat_sessions").findOne({ thread_id: threadId });
};

const getAllSessions = async (limit = 50) => {
  const database = await getDb();
  return database.collection("chat_sessions")
    .find({}, { projection: { messages: 0 } })
    .sort({ updated_at: -1 })
    .limit(limit)
    .toArray();
};

// ── NEW: get sessions by phone (only this user's sessions) ────────────────────
const getSessionsByPhone = async (userPhone, limit = 50) => {
  const database = await getDb();
  return database.collection("chat_sessions")
    .find({ user_phone: userPhone }, { projection: { messages: 0 } })
    .sort({ updated_at: -1 })
    .limit(limit)
    .toArray();
};

// ─── appointments ─────────────────────────────────────────────────────────────
const saveAppointment = async (data) => {
  const database = await getDb();
  const doc = { ...data, created_at: new Date() };
  const result = await database.collection("appointments").insertOne(doc);
  return { ...doc, _id: result.insertedId };
};

const getAppointmentsByThread = async (threadId) => {
  const database = await getDb();
  return database.collection("appointments")
    .find({ thread_id: threadId })
    .sort({ created_at: -1 })
    .toArray();
};

const getAllAppointments = async (limit = 50) => {
  const database = await getDb();
  return database.collection("appointments")
    .find({})
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
};

// ── NEW: get appointments by phone (only this user's appointments) ─────────────
const getAppointmentsByPhone = async (userPhone, limit = 50) => {
  const database = await getDb();
  return database.collection("appointments")
    .find({ user_phone: userPhone })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
};

// ─── knowledge base ───────────────────────────────────────────────────────────
const getDoctors = async (filter = {}) => {
  const database = await getDb();
  return database.collection("doctors").find(filter).toArray();
};

const getDoctorBySpecialization = async (specialization) => {
  const database = await getDb();
  return database.collection("doctors").find({
    specialization: { $regex: specialization, $options: "i" }
  }).toArray();
};

const getFaqs = async (tags = []) => {
  const database = await getDb();
  const filter = tags.length ? { tags: { $in: tags } } : {};
  return database.collection("faqs").find(filter).toArray();
};

const searchFaqs = async (keywords) => {
  const database = await getDb();
  return database.collection("faqs").find({
    $or: [
      { question: { $regex: keywords, $options: "i" } },
      { answer:   { $regex: keywords, $options: "i" } },
      { tags:     { $regex: keywords, $options: "i" } },
      { category: { $regex: keywords, $options: "i" } },
    ]
  }).limit(5).toArray();
};

const getServices = async (department = null) => {
  const database = await getDb();
  const filter = department ? { department: { $regex: department, $options: "i" } } : {};
  return database.collection("services").find(filter).toArray();
};

const getPatientByEmail = async (email) => {
  const database = await getDb();
  return database.collection("patients").findOne({
    email: { $regex: email, $options: "i" }
  });
};

const getAppointmentsByPatientEmail = async (email) => {
  const database = await getDb();
  return database.collection("appointments")
    .find({ patient_email: { $regex: email, $options: "i" } })
    .sort({ appointment_date: -1 })
    .limit(10)
    .toArray();
};

module.exports = {
  getDb, closeDb,
  saveReport, getReportsByThread, getReportsByPhone, getAllReports,
  upsertSession, appendMessageToSession, getSession, getAllSessions, getSessionsByPhone,
  saveAppointment, getAppointmentsByThread, getAppointmentsByPhone, getAllAppointments,
  getDoctors, getDoctorBySpecialization,
  getFaqs, searchFaqs,
  getServices,
  getPatientByEmail, getAppointmentsByPatientEmail,
};