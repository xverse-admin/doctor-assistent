// src/routes/chatRoutes.js
const express = require("express");
const { handleChat } = require("../controllers/chatController");

const router = express.Router();

router.post("/chat", handleChat);

module.exports = router;
