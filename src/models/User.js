// src/models/User.js
// User model for MongoDB — handles register, login, verify

const { getDb } = require("../utils/database");

const COLLECTION = "users";

const getCollection = async () => {
  const db = await getDb();
  await db.collection(COLLECTION).createIndex({ email: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ phone: 1 }, { unique: true });
  return db.collection(COLLECTION);
};

// Create new unverified user
const createUser = async ({ name, email, phone, passwordHash }) => {
  const col = await getCollection();
  const doc = {
    name,
    email:        email.toLowerCase().trim(),
    phone,
    passwordHash,
    isVerified:   false,
    createdAt:    new Date(),
    updatedAt:    new Date(),
  };
  const result = await col.insertOne(doc);
  return { ...doc, _id: result.insertedId };
};

// Mark user phone as verified after OTP
const verifyUser = async (phone) => {
  const col = await getCollection();
  return col.updateOne(
    { phone },
    { $set: { isVerified: true, updatedAt: new Date() } }
  );
};

// Find by email OR phone (for login)
const findUser = async (identifier) => {
  const col  = await getCollection();
  const clean = identifier.trim().toLowerCase();
  return col.findOne({
    $or: [
      { email: clean },
      { phone: identifier.trim() },
    ],
  });
};

const findByPhone = async (phone) => {
  const col = await getCollection();
  return col.findOne({ phone });
};

const findByEmail = async (email) => {
  const col = await getCollection();
  return col.findOne({ email: email.toLowerCase().trim() });
};

module.exports = { createUser, verifyUser, findUser, findByPhone, findByEmail };