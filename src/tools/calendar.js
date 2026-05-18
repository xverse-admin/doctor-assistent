// const { tool } = require("@langchain/core/tools");
// const { z } = require("zod");

// const checkAvailabilityTool = tool(
//   async ({ date }) => {
//     console.log(`[TOOL] Checking Google Calendar for ${date}...`);
//     // REAL LOGIC: google.calendar.events.list(...)
//     return "Available slots: 10:00 AM, 2:00 PM, 4:00 PM"; 
//   },
//   {
//     name: "check_availability",
//     description: "Checks calendar availability for a specific date",
//     schema: z.object({ date: z.string() }),
//   }
// );

// const bookAppointmentTool = tool(
//   async ({ date, time, email }) => {
//     console.log(`[TOOL] Booking for ${email} on ${date} at ${time}...`);
//     // REAL LOGIC: google.calendar.events.insert(...)
//     return "SUCCESS: Appointment confirmed."; 
//   },
//   {
//     name: "book_appointment",
//     description: "Books an appointment on the calendar",
//     schema: z.object({
//       date: z.string(),
//       time: z.string(),
//       email: z.string(),
//     }),
//   }
// );

// module.exports = { checkAvailabilityTool, bookAppointmentTool };


const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { google } = require("googleapis");
const chrono = require("chrono-node");
const nodemailer = require('nodemailer');
require("dotenv").config();


// --- CONFIGURATION ---
const CALENDAR_ID = process.env.CALENDAR_ID;
const doctors = require('../agents/doctors');
const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const TIMEZONE = "Asia/Kolkata";
const SLOT_DURATION = 30; // 30 minutes slots

// --- AUTHENTICATION ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: SCOPES,
});
const calendar = google.calendar({ version: "v3", auth });


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS
  }
});
// Helper: Normalize Date (Same as before)
const normalizeDate = (inputDate) => {
  const parsedDate = chrono.parseDate(inputDate);
  if (!parsedDate) {
    const directDate = new Date(inputDate);
    if (!isNaN(directDate.getTime())) return directDate.toISOString().split('T')[0];
    throw new Error(`Could not understand date: "${inputDate}"`);
  }
  let targetDate = parsedDate;
  // const today = new Date();
  // New Code: Force "Today" to be India Time, regardless of server location
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  if (targetDate < today && inputDate.toLowerCase().indexOf("year") === -1) {
    targetDate.setFullYear(today.getFullYear() + 1);
  }
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- TOOL 1: CHECK AVAILABILITY (30 Minute Intervals) ---
const checkAvailabilityTool = tool(
  async ({ date, doctorId, calendarId }) => {
    try {
      const formattedDate = normalizeDate(date);
      let calId = calendarId;
      if (!calId && doctorId) {
        const doc = doctors.find(d => d.id === doctorId);
        if (!doc) throw new Error(`Unknown doctorId: ${doctorId}`);
        calId = doc.calendarId;
      }
      if (!calId) calId = CALENDAR_ID;
      console.log(`[TOOL] Checking 30-min slots for ${formattedDate} on calendar ${calId}...`);

      const timeMin = new Date(`${formattedDate}T00:00:00`).toISOString();
      const timeMax = new Date(`${formattedDate}T23:59:59`).toISOString();

      const response = await calendar.events.list({
        calendarId: calId,
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items;
      const busyTimes = events.map(event => ({
        start: new Date(event.start.dateTime || event.start.date),
        end: new Date(event.end.dateTime || event.end.date)
      }));

      // --- NEW LOGIC: 30 Minute Steps ---
      const availableSlots = [];

      // Define Working Hours (e.g., 9:00 AM to 5:00 PM)
      let currentSlot = new Date(`${formattedDate}T09:00:00`);
      const endOfDay = new Date(`${formattedDate}T17:00:00`);

      // Loop until we reach the end of the day
      while (currentSlot < endOfDay) {
        // Define the end of THIS specific slot (current + 30 mins)
        const slotEnd = new Date(currentSlot.getTime() + SLOT_DURATION * 60 * 1000);

        // Check for overlap
        const isBusy = busyTimes.some(busy => {
          return (currentSlot < busy.end && slotEnd > busy.start);
        });

        if (!isBusy) {
          availableSlots.push(
            currentSlot.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })
          );
        }

        // Increment loop by 30 minutes
        currentSlot = new Date(currentSlot.getTime() + SLOT_DURATION * 60 * 1000);
      }

      if (availableSlots.length === 0) return "No slots available.";
      return `Available slots on ${formattedDate}: ${availableSlots.join(", ")}`;

    } catch (error) {
      console.error("Calendar Error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "check_availability",
    description: "Checks availability in 30-minute intervals for a specific doctor.",
    schema: z.object({ 
      date: z.string().describe("Date (e.g. 'tomorrow', '2025-01-10')"),
      doctorId: z.string().describe("Doctor ID (e.g. 'arjun-mehta')"),
      calendarId: z.string().optional().describe("Google Calendar ID (optional, overrides doctorId)")
    }),
  }
);

// --- TOOL 2: BOOK APPOINTMENT (Same as before) ---

const bookAppointmentTool = tool(
  async ({ date, time, email, name, doctorId, calendarId }) => {
    // 🔒 FIXED DURATION: 30 Minutes
    const DURATION_MINUTES = 30; 

    try {
      const formattedDate = normalizeDate(date);
      let calId = calendarId;
      let doctorName = "";
      if (!calId && doctorId) {
        const doc = doctors.find(d => d.id === doctorId);
        if (!doc) throw new Error(`Unknown doctorId: ${doctorId}`);
        calId = doc.calendarId;
        doctorName = doc.name;
      }
      if (!calId) calId = CALENDAR_ID;

      // --- FIX: Normalize Time (Handle "9:30 AM" -> "09:30") ---
      let cleanTime = time.trim().toUpperCase();
      if (cleanTime.includes("PM") || cleanTime.includes("AM")) {
         const [timePart, modifier] = cleanTime.split(" ");
         let [hours, minutes] = timePart.split(":");
         if (hours === "12") {
            hours = "00";
         }
         if (modifier === "PM") {
            hours = parseInt(hours, 10) + 12;
         }
         cleanTime = `${hours}:${minutes}`;
      }
      console.log(`[TOOL] Booking for ${email} on ${formattedDate} at ${cleanTime} (Orig: ${time}) on calendar ${calId}...`);

      // Now create the Date object using the clean 24h time
      const startDate = new Date(`${formattedDate}T${cleanTime}:00`);
      if (isNaN(startDate.getTime())) {
         throw new Error(`Invalid time format. Received: ${time}`);
      }
      const endDate = new Date(startDate.getTime() + DURATION_MINUTES * 60 * 1000); 

      const event = {
        summary: `Appointment with ${name || email}`,
        description: `Booked via Amy Assistant for ${doctorName || 'the doctor'}`,
        start: { dateTime: startDate.toISOString(), timeZone: TIMEZONE },
        end: { dateTime: endDate.toISOString(), timeZone: TIMEZONE },
        //attendees: [{ email: email }], 
      };

      await calendar.events.insert({
        calendarId: calId,
        resource: event,
      });

      // 2. 📧 Send Confirmation Email Manually (Nodemailer)
      try {
        console.log(`[TOOL] Sending confirmation email to ${email}...`);
        const mailOptions = {
          from: `"Amy Assistant" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: '✅ Appointment Confirmed',
          text: `Hi ${name || 'there'},\n\nYour appointment has been successfully booked with ${doctorName || 'the doctor'}.\n\n📅 Date: ${formattedDate}\n🕒 Time: ${time}\n\nSee you then!\n\nBest,\nAmy Assistant`
        };
        await transporter.sendMail(mailOptions);
        console.log(`[TOOL] Email sent successfully.`);
      } catch (emailError) {
        console.error("⚠️ Failed to send confirmation email:", emailError.message);
        // Don't throw error here, so the booking remains "Success"
      }
      return `SUCCESS: Appointment confirmed for ${formattedDate} at ${time}.`;
    } catch (error) {
      console.error("Booking Error:", error);
      return `Failed to book: ${error.message}`;
    }
  },
  {
    name: "book_appointment",
    description: "Books an appointment for a specific doctor.",
    schema: z.object({
      date: z.string(),
      time: z.string().describe("Time (e.g., '09:30' or '09:30 AM')"),
      email: z.string().email(),
      name: z.string().optional(),
      doctorId: z.string().describe("Doctor ID (e.g. 'arjun-mehta')"),
      calendarId: z.string().optional().describe("Google Calendar ID (optional, overrides doctorId)")
    }),
  }
);


module.exports = { checkAvailabilityTool, bookAppointmentTool };