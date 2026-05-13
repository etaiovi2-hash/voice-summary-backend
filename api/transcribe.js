import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import FormData from "form-data";
import fetch from "node-fetch";

const app = express();

// ─── Multer: זיכרון זמני ─────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // הגדלתי ל-10MB ליתר ביטחון
});

// ─── Helper: Whisper API ────────────────────────────────────────────────────
async function transcribeWithWhisper(fileBuffer, originalName, mimeType) {
  const form = new FormData();
  
  // אנחנו שולחים את ה-buffer ישירות בלי המרה
  form.append("file", fileBuffer, {
    filename: originalName || "audio.mp3",
    contentType: mimeType || "audio/mpeg",
  });
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper API error: ${err}`);
  }

  const data = await res.json();
  return data.text;
}

// ─── Helper: GPT-4o-mini סיכום משודרג וחכם ─────────────────────────────────────────────
async function summarizeWithGPT(transcript) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // אפשר לשנות ל-gpt-4o אם רוצים רמה עוד יותר גבוהה (ויקר יותר)
      messages: [
        {
          role: "system",
          content: `אתה עוזר אישי אינטליגנטי. תפקידך לסכם תמלול של הקלטה קולית בעברית.
          הסיכום צריך להיות:
          1. כותרת קולעת ומקצועית.
          2. תקציר של "בשורה התחתונה" (2-3 משפטים).
          3. רשימת בולטים של נקודות המפתח החשובות ביותר.
          4. אם נאמרו משימות לביצוע או תאריכים - ציין אותם בנפרד.
          השתמש בשפה עשירה, רשמית וברורה. אל תחזור על מילים מיותרות מהתמלול.`
        },
        { role: "user", content: `זה התמלול: ${transcript}` },
      ],
      temperature: 0.7, // מוסיף קצת "יצירתיות" וזרימה לטקסט
    }),
  });

  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── Route: POST /api/transcribe ───────────────────────────────────────────
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
  }

  try {
    // שלב 1: תמלול ישיר מה-Buffer (בלי ffmpeg!)
    const transcript = await transcribeWithWhisper(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // שלב 2: סיכום
    const summary = await summarizeWithGPT(transcript);

    // שלב 3: החזרת תשובה
    return res.status(200).json({ 
      transcript: transcript,
      summary: summary 
    });

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Health check
app.get("/api/transcribe", (req, res) => res.json({ status: "ok" }));

export default app;
