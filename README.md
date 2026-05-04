# 🩺 Amy – Doc's AI Assistant

Amy is a multi-agent AI assistant for Dr. Smith's practice. It handles appointment booking, availability checking, and — now — **medical report image analysis with database storage**.

---

## 🆕 What's New (v1.1)

| Feature | Description |
|---|---|
| 🖼️ **Image OCR Agent** | Upload doctor report images (JPG/PNG/etc). GPT-4o vision extracts all text |
| 🗄️ **SQLite Database** | Extracted report text is saved to `data/amy_assistant.db` — persists across restarts |
| 💬 **Chat Frontend** | Full web UI at `http://localhost:PORT` — test without Postman |
| 📋 **Reports API** | `GET /reports?threadId=xxx` to retrieve stored reports per session |

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in your keys
cp .env.example .env
# Edit .env with your OPENAI_API_KEY, calendar ID, etc.

# 3. Start the server
npm run dev        # development (nodemon)
npm start          # production

# 4. Open the chat UI
# Navigate to http://localhost:3000
```

---

## 📡 API Endpoints

### Chat
```
POST /chat
Body: { "message": "Hello", "threadId": "thread_abc123" }
```

### Upload Medical Report Image
```
POST /upload-image

# Option A: JSON body (base64)
Body: {
  "base64Image": "<base64 string or data URL>",
  "mimeType": "image/jpeg",
  "threadId": "thread_abc123",
  "filename": "report.jpg"
}

# Option B: Multipart form-data
Field "image": <file>
Field "threadId": "thread_abc123"
```

Response:
```json
{
  "success": true,
  "recordId": 1,
  "message": "Medical report processed and stored successfully.",
  "extractedText": "Patient: John Doe\nHeart Rate: 72 bpm\n..."
}
```

### Get Stored Reports
```
GET /reports?threadId=thread_abc123
```

### Health
```
GET /health
```

---

## 🗂️ Project Structure

```
amy-assistant/
├── public/
│   └── index.html              # ← NEW: Chat frontend UI
├── src/
│   ├── agents/
│   │   ├── orchestrator.js     # Routes messages to correct agent
│   │   ├── doctor.js           # Main doctor assistant (GPT-4o + tools)
│   │   ├── booking.js          # Appointment booking logic
│   │   ├── availability.js     # Calendar availability
│   │   └── imageOcr.js         # ← NEW: Image OCR agent
│   ├── controllers/
│   │   ├── chatController.js   # Chat endpoint handler
│   │   └── imageController.js  # ← NEW: Image upload handler
│   ├── routes/
│   │   ├── chatRoutes.js
│   │   └── imageRoutes.js      # ← NEW: /upload-image + /reports
│   ├── tools/
│   │   └── calendar.js         # Google Calendar tools
│   ├── utils/
│   │   ├── sessionManager.js
│   │   └── database.js         # ← NEW: SQLite setup + helpers
│   ├── constants/
│   │   └── prompts.js
│   ├── graph/
│   │   ├── index.js            # LangGraph workflow
│   │   └── state.js
│   └── app.js
├── data/                       # ← NEW: SQLite DB lives here (auto-created)
│   └── amy_assistant.db
├── server.js
├── package.json
├── .env.example
└── service-account.json        # Google service account credentials
```

---

## 📱 WhatsApp Integration (Coming Soon)

The Twilio infrastructure is already in place (`src/controllers/twilio.controller.js`, `src/routes/twilio.route.js`). To activate WhatsApp:
1. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` in `.env`
2. Point your Twilio WhatsApp sandbox webhook to `POST /api/twilio/whatsapp`
3. Images sent via WhatsApp will be downloadable via Twilio Media URLs — pass them to the image OCR agent the same way

---

## 🗄️ Database Schema

```sql
CREATE TABLE medical_reports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id     TEXT NOT NULL,       -- session identifier
  filename      TEXT,                -- original filename
  extracted_text TEXT NOT NULL,      -- full OCR output
  mime_type     TEXT,                -- image/jpeg etc
  created_at    TEXT                 -- ISO timestamp
);
```

Stored at: `data/amy_assistant.db`
