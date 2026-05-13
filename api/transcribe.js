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
          content: `אתה עוזר אישי חכם שכותב בגובה העיניים. התפקיד שלך הוא לסכם הקלטות קוליות בצורה זורמת ואנושית.
          הנחיות לכתיבה:
          1. אל תשתמש בכותרות רשמיות ונוקשות כמו "בשורה התחתונה".
          2. תכתוב פסקה קצרה ותכל'סית שמסבירה מה קרה בהקלטה כאילו אתה מספר לחבר מה הוא פספס.
          3. אם יש פרטים קריטיים (כמו תאריכים או משימות), תציין אותם בסוף בצורה חברית (למשל: "אה, וצריך לזכור ש...").
          4. השתמש בשפה יומיומית וקלילה, אבל עדיין ברורה ומקצועית. בלי חפירות מיותרות.`
        },
        { role: "user", content: `זה מה שנאמר בהקלטה: ${transcript}` },
      ],
      temperature: 0.8, // העליתי קצת כדי שיהיה פחות מקובע
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
