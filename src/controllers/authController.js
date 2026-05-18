// src/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { sendOtp, verifyOtp }               = require("../utils/acsotp");
const { createUser, verifyUser, findUser,
        findByPhone, findByEmail }          = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "amy_secret_change_in_production";
const JWT_EXPIRY = "7d";

// Normalize to E.164 format: +91XXXXXXXXXX
const normalizePhone = (phone) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  if (phone.startsWith("+")) return phone.trim();
  return "+" + digits;
};

const issueToken = (user) => jwt.sign(
  { userId: user._id.toString(), phone: user.phone,
    email: user.email, name: user.name },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRY }
);

// ── POST /auth/register ───────────────────────────────────────────────────────
// Step 1 of registration: validate + save user + send OTP via Twilio
// Body: { name, email, phone, password }
const register = async (req, res) => {
  try {
    let { name, email, phone, password } = req.body;

    // Validate
    if (!name || !email || !phone || !password)
      return res.status(400).json({ error: "All fields required: name, email, phone, password." });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: "Invalid email address." });

    phone = normalizePhone(phone);
    if (!/^\+\d{10,15}$/.test(phone))
      return res.status(400).json({ error: "Invalid phone number." });

    // Check duplicates
    const existingEmail = await findByEmail(email);
    if (existingEmail && existingEmail.isVerified)
      return res.status(409).json({ error: "Email already registered. Please login." });

    const existingPhone = await findByPhone(phone);
    if (existingPhone && existingPhone.isVerified)
      return res.status(409).json({ error: "Phone already registered. Please login." });

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Save or update user (unverified)
    if (!existingPhone) {
      await createUser({ name: name.trim(), email, phone, passwordHash });
    } else {
      // Update existing unverified account with new details
      const { getDb } = require("../utils/database");
      const db = await getDb();
      await db.collection("users").updateOne(
        { phone },
        { $set: { name: name.trim(), email, passwordHash, updatedAt: new Date() } }
      );
    }

    // Send OTP via ACS OTP
    await sendOtp(phone);

    return res.json({
      success: true,
      step:    "otp",
      message: "OTP sent to your mobile number.",
      phone,
    });
  } catch (err) {
    console.error("[Auth] register error:", err.message);
    return res.status(500).json({ error: "Registration failed: " + err.message });
  }
};

// ── POST /auth/verify-otp ─────────────────────────────────────────────────────
// Step 2: Verify OTP via Twilio → activate user → issue JWT
// Body: { phone, otp }
const verifyOtpAndActivate = async (req, res) => {
  try {
    let { phone, otp } = req.body;
    if (!phone || !otp)
      return res.status(400).json({ error: "Phone and OTP are required." });

    phone = normalizePhone(phone);

    // ACS OTP verifies OTP
    const approved = await verifyOtp(phone, otp);
    if (!approved)
      return res.status(400).json({ error: "Invalid or expired OTP. Please try again." });

    // Mark user as verified
    await verifyUser(phone);
    const user  = await findByPhone(phone);
    const token = issueToken(user);

    console.log(`[Auth] Registered & verified: ${phone}`);
    return res.json({
      success: true,
      message: "Phone verified! Registration complete.",
      token,
      user: { name: user.name, email: user.email, phone: user.phone },
    });
  } catch (err) {
    console.error("[Auth] verifyOtp error:", err.message);
    return res.status(500).json({ error: "Verification failed: " + err.message });
  }
};

// ── POST /auth/login ──────────────────────────────────────────────────────────
// Login with phone + password only — NO OTP
// Body: { phone, password }
const login = async (req, res) => {
  try {
    let { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ error: "Phone and password are required." });

    phone = normalizePhone(phone);
    const user = await findByPhone(phone);

    if (!user)
      return res.status(401).json({ error: "No account found. Please register first." });
    if (!user.isVerified)
      return res.status(401).json({ error: "Phone not verified. Please complete registration." });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(401).json({ error: "Incorrect password. Please try again." });

    const token = issueToken(user);
    console.log(`[Auth] Login: ${phone}`);

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: { name: user.name, email: user.email, phone: user.phone },
    });
  } catch (err) {
    console.error("[Auth] login error:", err.message);
    return res.status(500).json({ error: "Login failed: " + err.message });
  }
};

// ── POST /auth/resend-otp ─────────────────────────────────────────────────────
// Body: { phone }
const resendOtp = async (req, res) => {
  try {
    let { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone is required." });
    phone = normalizePhone(phone);
    const user = await findByPhone(phone);
    if (!user)           return res.status(404).json({ error: "Phone not registered." });
    if (user.isVerified) return res.status(400).json({ error: "Phone already verified." });
    await sendOtp(phone);
    return res.json({ success: true, message: "OTP resent successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to resend OTP: " + err.message });
  }
};

module.exports = { register, verifyOtpAndActivate, login, resendOtp };