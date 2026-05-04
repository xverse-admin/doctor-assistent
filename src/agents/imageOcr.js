// src/agents/imageOcr.js
const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage } = require("@langchain/core/messages");
const { saveReport, appendMessageToSession } = require("../utils/database");
const { uploadToCloudinary } = require("../utils/cloudinary");

const visionModel = new ChatOpenAI({ model: "gpt-4o", temperature: 0, maxTokens: 3000 });

const extractTextFromImage = async (base64Image, mimeType = "image/jpeg") => {
  const message = new HumanMessage({
    content: [
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`,
          detail: "high",
        },
      },
      {
        type: "text",
        text: `You are a medical document OCR specialist.
Extract ALL text from this medical report image.
Preserve the layout: headings, table values, labels, numbers, units.
Return only the raw extracted text. Do not add commentary or explanations.`,
      },
    ],
  });
  const response = await visionModel.invoke([message]);
  return response.content;
};

/**
 * Full OCR pipeline:
 * 1. Upload image to Cloudinary -> get a clean URL
 * 2. Extract text via GPT-4o vision
 * 3. Save report to medical_reports (Cloudinary URL + extracted text)
 * 4. Append image message + OCR result to chat_sessions
 */
const imageOcrAgent = async ({ base64Image, mimeType, threadId, filename }) => {
  console.log(`[ImageOCR] Processing "${filename}" (${mimeType}) for thread: ${threadId}`);

  // Step 1: Upload to Cloudinary
  let imageUrl = null;
  try {
    imageUrl = await uploadToCloudinary(base64Image, mimeType, filename);
    console.log(`[ImageOCR] Cloudinary URL: ${imageUrl}`);
  } catch (err) {
    console.warn(`[ImageOCR] Cloudinary upload failed: ${err.message} — falling back to base64`);
  }

  // Step 2: Extract text via GPT-4o vision
  const extractedText = await extractTextFromImage(base64Image, mimeType);
  console.log(`[ImageOCR] Extracted ${extractedText.length} characters`);

  // Step 3: Save to medical_reports — store URL not raw base64
  const saved = await saveReport({
    thread_id:      threadId,
    filename:       filename || "upload",
    extracted_text: extractedText,
    mime_type:      mimeType,
    image_url:      imageUrl,
    image_base64:   imageUrl ? null : base64Image,  // fallback only if Cloudinary failed
  });
  console.log(`[ImageOCR] Saved to MongoDB _id: ${saved._id}`);

  // Step 4a: Image message in chat_sessions
  await appendMessageToSession(threadId, {
    role:         "user",
    type:         "image",
    content:      `[Uploaded medical report: ${filename || "upload"}]`,
    image_url:    imageUrl,
    image_base64: imageUrl ? null : base64Image,
    mime_type:    mimeType,
    filename:     filename || "upload",
    report_id:    saved._id.toString(),
    timestamp:    new Date(),
  });

  // Step 4b: OCR result as assistant reply in chat_sessions
  await appendMessageToSession(threadId, {
    role:      "assistant",
    type:      "ocr_result",
    content:   `Medical report "${filename || "upload"}" processed.\n\nExtracted text:\n${extractedText}`,
    report_id: saved._id.toString(),
    timestamp: new Date(),
  });

  return {
    success:       true,
    recordId:      saved._id,
    imageUrl,
    extractedText,
    message:       "Medical report uploaded to Cloudinary and stored in MongoDB.",
  };
};

module.exports = { imageOcrAgent, extractTextFromImage };
