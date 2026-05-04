// src/utils/cloudinary.js
// Uploads base64 images to Cloudinary and returns a secure URL
// Requires: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env

const https = require("https");
const http  = require("http");

/**
 * Uploads a base64 image to Cloudinary.
 * Returns the secure_url string.
 */
const uploadToCloudinary = async (base64Image, mimeType, filename) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env");
  }

  // Build data URI
  const dataUri = `data:${mimeType};base64,${base64Image}`;

  // Generate SHA-1 signature
  const timestamp  = Math.floor(Date.now() / 1000);
  const folder     = "amy_medical_reports";
  const publicId   = `${folder}/${Date.now()}_${(filename || "report").replace(/\s+/g, "_").replace(/\.[^.]+$/, "")}`;
  const sigString  = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;

  const crypto = require("crypto");
  const signature = crypto.createHash("sha1").update(sigString).digest("hex");

  // Build multipart form body manually (no extra deps needed)
  const boundary = "----CloudinaryBoundary" + Date.now();
  const CRLF     = "\r\n";

  const addField = (name, value) =>
    `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

  let body = "";
  body += addField("file",       dataUri);
  body += addField("api_key",    apiKey);
  body += addField("timestamp",  String(timestamp));
  body += addField("signature",  signature);
  body += addField("folder",     folder);
  body += addField("public_id",  publicId);
  body += `--${boundary}--${CRLF}`;

  const bodyBuffer = Buffer.from(body, "utf-8");

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.cloudinary.com",
      path:     `/v1_1/${cloudName}/image/upload`,
      method:   "POST",
      headers: {
        "Content-Type":   `multipart/form-data; boundary=${boundary}`,
        "Content-Length": bodyBuffer.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.secure_url) {
            console.log(`[Cloudinary] Uploaded: ${json.secure_url}`);
            resolve(json.secure_url);
          } else {
            reject(new Error(`Cloudinary error: ${json.error?.message || data}`));
          }
        } catch (e) {
          reject(new Error("Failed to parse Cloudinary response: " + data));
        }
      });
    });

    req.on("error", reject);
    req.write(bodyBuffer);
    req.end();
  });
};

module.exports = { uploadToCloudinary };
