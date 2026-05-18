// src/routes/authRoutes.js
const express = require("express");
const {
  register,
  verifyOtpAndActivate,
  login,
  resendOtp,
} = require("../controllers/authController");

const router = express.Router();

router.post("/auth/register",   register);           // Register + send OTP
router.post("/auth/verify-otp", verifyOtpAndActivate); // Verify OTP → activate
router.post("/auth/login",      login);              // Login (phone + password)
router.post("/auth/resend-otp", resendOtp);          // Resend OTP

module.exports = router;