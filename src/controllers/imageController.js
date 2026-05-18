// // src/controllers/imageController.js
// const { imageOcrAgent } = require("../agents/imageOcr");
// const { getReportsByThread, getAllReports } = require("../utils/database");

// /**
//  * Converts the first page of a PDF buffer → PNG base64 using pdf-to-img (sharp + pdfjs-dist).
//  * Falls back to sending the raw PDF bytes to GPT-4o as a document if conversion fails.
//  */
// const pdfToBase64Image = async (pdfBuffer) => {
//   try {
//     // Use pdftoppm via child_process if available (fastest, no extra npm deps)
//     const { execSync } = require("child_process");
//     const fs   = require("fs");
//     const path = require("path");
//     const os   = require("os");

//     const tmpDir  = os.tmpdir();
//     const tmpPdf  = path.join(tmpDir, `amy_${Date.now()}.pdf`);
//     const tmpBase = path.join(tmpDir, `amy_${Date.now()}_out`);

//     fs.writeFileSync(tmpPdf, pdfBuffer);

//     // pdftoppm converts PDF page → PPM image (part of poppler-utils)
//     execSync(`pdftoppm -r 200 -png -f 1 -l 1 "${tmpPdf}" "${tmpBase}"`, { timeout: 15000 });

//     // Find the generated file (pdftoppm adds -1.png suffix)
//     const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(path.basename(tmpBase)) && f.endsWith(".png"));
//     if (!files.length) throw new Error("pdftoppm produced no output");

//     const imgPath  = path.join(tmpDir, files[0]);
//     const imgBytes = fs.readFileSync(imgPath);

//     // Cleanup
//     fs.unlinkSync(tmpPdf);
//     fs.unlinkSync(imgPath);

//     return { base64: imgBytes.toString("base64"), mimeType: "image/png" };
//   } catch (err) {
//     console.warn("[ImageController] pdftoppm failed, sending PDF directly to GPT-4o:", err.message);
//     // Return raw PDF bytes — GPT-4o vision supports PDF documents via base64 too
//     return { base64: pdfBuffer.toString("base64"), mimeType: "application/pdf", isPdf: true };
//   }
// };

// /**
//  * POST /upload-image
//  * Accepts: multipart file (image/* or application/pdf) OR JSON { base64Image, mimeType, threadId, filename }
//  */
// const handleImageUpload = async (req, res) => {
//   try {
//     let base64Image, mimeType, threadId, filename;

//     // ── multipart file ──────────────────────────────────────────────────────
//     if (req.file) {
//       mimeType = req.file.mimetype;
//       filename = req.file.originalname;
//       threadId = req.body.threadId;

//       if (mimeType === "application/pdf") {
//         // Convert PDF → image for GPT-4o vision
//         const converted = await pdfToBase64Image(req.file.buffer);
//         base64Image = converted.base64;
//         mimeType    = converted.mimeType;
//       } else {
//         base64Image = req.file.buffer.toString("base64");
//       }
//     }
//     // ── JSON base64 body ────────────────────────────────────────────────────
//     else if (req.body && req.body.base64Image) {
//       base64Image = req.body.base64Image;
//       mimeType    = req.body.mimeType || "image/jpeg";
//       threadId    = req.body.threadId;
//       filename    = req.body.filename || "upload";

//       // Strip data-URL prefix  "data:image/jpeg;base64,..."
//       if (base64Image.includes(",")) {
//         const [prefix, data] = base64Image.split(",");
//         base64Image = data;
//         if (!req.body.mimeType && prefix.includes(":") && prefix.includes(";")) {
//           mimeType = prefix.split(":")[1].split(";")[0];
//         }
//       }

//       // PDF sent as base64 from frontend
//       if (mimeType === "application/pdf") {
//         const pdfBuf   = Buffer.from(base64Image, "base64");
//         const converted = await pdfToBase64Image(pdfBuf);
//         base64Image = converted.base64;
//         mimeType    = converted.mimeType;
//       }
//     }
//     // ── nothing provided ────────────────────────────────────────────────────
//     else {
//       return res.status(400).json({
//         error: "No file provided. Send an image or PDF as multipart 'image' field, or as JSON base64Image.",
//       });
//     }

//     if (!threadId) {
//       return res.status(400).json({ error: "'threadId' is required." });
//     }

//     // Run OCR agent
//     const result = await imageOcrAgent({ base64Image, mimeType, threadId, filename });

//     return res.status(200).json({
//       success:       true,
//       recordId:      result.recordId,
//       message:       result.message,
//       extractedText: result.extractedText,
//     });

//   } catch (err) {
//     console.error("[ImageController] Error:", err);
//     return res.status(500).json({ error: "Failed to process file: " + err.message });
//   }
// };

// /**
//  * GET /reports?threadId=xxx
//  */
// const getReports = async (req, res) => {
//   try {
//     const { threadId } = req.query;
//     const reports = threadId
//       ? await getReportsByThread(threadId)
//       : await getAllReports();
//     return res.json({ reports });
//   } catch (err) {
//     console.error("[ImageController] getReports error:", err);
//     return res.status(500).json({ error: err.message });
//   }
// };

// module.exports = { handleImageUpload, getReports };

// src/controllers/imageController.js
const { imageOcrAgent } = require("../agents/imageOcr");
const { getReportsByThread, getReportsByPhone } = require("../utils/database");

const pdfToBase64Image = async (pdfBuffer) => {
  try {
    const { execSync } = require("child_process");
    const fs   = require("fs");
    const path = require("path");
    const os   = require("os");
    const tmpDir  = os.tmpdir();
    const tmpPdf  = path.join(tmpDir, `amy_${Date.now()}.pdf`);
    const tmpBase = path.join(tmpDir, `amy_${Date.now()}_out`);
    fs.writeFileSync(tmpPdf, pdfBuffer);
    execSync(`pdftoppm -r 200 -png -f 1 -l 1 "${tmpPdf}" "${tmpBase}"`, { timeout: 15000 });
    const files = fs.readdirSync(tmpDir).filter(
      f => f.startsWith(path.basename(tmpBase)) && f.endsWith(".png")
    );
    if (!files.length) throw new Error("pdftoppm produced no output");
    const imgPath  = path.join(tmpDir, files[0]);
    const imgBytes = fs.readFileSync(imgPath);
    fs.unlinkSync(tmpPdf);
    fs.unlinkSync(imgPath);
    return { base64: imgBytes.toString("base64"), mimeType: "image/png" };
  } catch (err) {
    console.warn("[ImageController] pdftoppm failed:", err.message);
    return { base64: pdfBuffer.toString("base64"), mimeType: "application/pdf", isPdf: true };
  }
};

// ── POST /upload-image ────────────────────────────────────────────────────────
const handleImageUpload = async (req, res) => {
  try {
    let base64Image, mimeType, threadId, filename, userPhone;

    if (req.file) {
      mimeType  = req.file.mimetype;
      filename  = req.file.originalname;
      threadId  = req.body.threadId;
      userPhone = req.body.userPhone || null;   // ← read phone from form field
      if (mimeType === "application/pdf") {
        const converted = await pdfToBase64Image(req.file.buffer);
        base64Image = converted.base64;
        mimeType    = converted.mimeType;
      } else {
        base64Image = req.file.buffer.toString("base64");
      }
    } else if (req.body && req.body.base64Image) {
      base64Image = req.body.base64Image;
      mimeType    = req.body.mimeType || "image/jpeg";
      threadId    = req.body.threadId;
      filename    = req.body.filename || "upload";
      userPhone   = req.body.userPhone || null;  // ← read phone from JSON body
      if (base64Image.includes(",")) {
        const [prefix, data] = base64Image.split(",");
        base64Image = data;
        if (!req.body.mimeType && prefix.includes(":") && prefix.includes(";")) {
          mimeType = prefix.split(":")[1].split(";")[0];
        }
      }
      if (mimeType === "application/pdf") {
        const pdfBuf    = Buffer.from(base64Image, "base64");
        const converted = await pdfToBase64Image(pdfBuf);
        base64Image = converted.base64;
        mimeType    = converted.mimeType;
      }
    } else {
      return res.status(400).json({ error: "No file provided." });
    }

    if (!threadId) return res.status(400).json({ error: "'threadId' is required." });

    // Pass userPhone into OCR agent so it gets saved with the report
    const result = await imageOcrAgent({ base64Image, mimeType, threadId, filename, userPhone });

    return res.status(200).json({
      success:       true,
      recordId:      result.recordId,
      message:       result.message,
      extractedText: result.extractedText,
    });

  } catch (err) {
    console.error("[ImageController] Error:", err);
    return res.status(500).json({ error: "Failed to process file: " + err.message });
  }
};

// ── GET /reports — returns only THIS user's reports ───────────────────────────
const getReports = async (req, res) => {
  try {
    const { userPhone, threadId } = req.query;

    // If phone is provided — return only this user's reports
    if (userPhone) {
      const reports = await getReportsByPhone(userPhone);
      return res.json({ reports });
    }
    // Fallback: filter by threadId (for backward compatibility)
    if (threadId) {
      const reports = await getReportsByThread(threadId);
      return res.json({ reports });
    }

    return res.status(400).json({ error: "userPhone is required." });
  } catch (err) {
    console.error("[ImageController] getReports error:", err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { handleImageUpload, getReports };