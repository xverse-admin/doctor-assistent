// src/utils/twilioOtp.js
// Sends and verifies OTP using Twilio Verify API
// No phone number purchase needed — Twilio Verify handles everything
// Setup: twilio.com → Verify → Services → Create → copy Service SID

const twilio = require("twilio");

const getClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing in .env");
  }
  return twilio(accountSid, authToken);
};

const getVerifySid = () => {
  const sid = process.env.TWILIO_VERIFY_SID;
  if (!sid) throw new Error("TWILIO_VERIFY_SID missing in .env");
  return sid;
};

// ── Send OTP ──────────────────────────────────────────────────────────────────
// phone must be in E.164 format: +919912021754
const sendOtp = async (phone) => {
  const client = getClient();
  const result = await client.verify.v2
    .services(getVerifySid())
    .verifications.create({
      to:      phone,
      channel: "sms",
    });
  console.log(`[Twilio] OTP sent to ${phone} | status: ${result.status}`);
  return result;
};

// ── Verify OTP ────────────────────────────────────────────────────────────────
const verifyOtp = async (phone, code) => {
  const client = getClient();
  const result = await client.verify.v2
    .services(getVerifySid())
    .verificationChecks.create({
      to:   phone,
      code: code.trim(),
    });
  console.log(`[Twilio] Verify ${phone} | status: ${result.status}`);
  return result.status === "approved";
};

module.exports = { sendOtp, verifyOtp };