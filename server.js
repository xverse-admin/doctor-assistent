// server.js
require("dotenv").config();
const app = require("./src/app");
const { getDb } = require("./src/utils/database");

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    // Connect to MongoDB before listening
    await getDb();
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Chat UI: http://localhost:${PORT}`);
      console.log(`🏥 Health:  http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

start();
