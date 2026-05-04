// src/utils/sessionManager.js
// Session management backed by MongoDB

const { upsertSession, getSession } = require("./database");

const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const validateSession = async (threadId) => {
  try {
    const session = await getSession(threadId);
    if (!session) return true; // new session - valid
    const lastActive = session.updated_at ? new Date(session.updated_at).getTime() : Date.now();
    if (Date.now() - lastActive > SESSION_TIMEOUT_MS) return false;
    return true;
  } catch (e) {
    console.error("[Session] validateSession error:", e.message);
    return true; // fail open
  }
};

const updateSession = async (threadId) => {
  try {
    await upsertSession(threadId, { status: "active", updated_at: new Date() });
  } catch (e) {
    console.error("[Session] updateSession error:", e.message);
  }
};

const endSession = async (threadId, status = "completed") => {
  try {
    await upsertSession(threadId, { status, ended_at: new Date() });
  } catch (e) {
    console.error("[Session] endSession error:", e.message);
  }
};

module.exports = { validateSession, updateSession, endSession };
