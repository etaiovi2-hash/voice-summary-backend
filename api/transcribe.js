// api/transcribe.js - Vercel Serverless Function
import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import FormData from "form-data";
import fetch from "node-fetch";

const app = express();

// ─── Multer: זיכרון זמני, מקסימום 5MB ─────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm",
      "audio/ogg", "audio/flac", "audio/x-m4a", "video/mp4",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
});

// ─── Helper: המרה ל-MP3 דרך ffmpeg ────────────────────────────────────────
function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat("mp3")
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .on("error", reject)
      .on("end", resolve)
      .save(outputPath);
  });
}

// ─── Helper: Whisper API ────────────────────────────────────────────────────
async function transcribeWithWhisper(mp3Path) {
  const form = new FormData();
  form.append("file", fs.createReadStream(mp3Path), {
    filename: "audio.mp3",
    contentType: "audio/mpeg",
  });
  form.append("model", "whisper-1");
  form.append("response_format", "json");

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
    throw new Error(`Whisper API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.text;
}

// ─── Helper: GPT-4o-mini סיכום ─────────────────────────────────────────────
async function summarizeWithGPT(transcript) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You are a concise summarizer. Given a transcript, extract exactly 3 bullet points: " +
            "1) WHO is involved, 2) WHAT happened or was discussed, 3) WHEN (time references or deadlines). " +
            "Reply in the same language as the transcript. Format: JSON array of 3 strings.",
        },
        { role: "user", content: transcript },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GPT-4o-mini error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.choices[0].message.content.trim();

  try {
    // נסה לפרסר JSON מהתשובה
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    // fallback: החזר כטקסט
    return raw;
  }
}

// ─── Route: POST /api/transcribe ───────────────────────────────────────────
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
  }

  // יצירת קבצים זמניים ב-/tmp (זמין ב-Vercel)
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input_${Date.now()}_${req.file.originalname}`);
  const outputPath = path.join(tmpDir, `output_${Date.now()}.mp3`);

  try {
    // שמור קובץ קלט מה-buffer
    fs.writeFileSync(inputPath, req.file.buffer);

    // המר ל-MP3
    await convertToMp3(inputPath, outputPath);

    // תמלול עם Whisper
    const transcript = await transcribeWithWhisper(outputPath);

    // בנה תשובה בסיסית
    const response = { transcript };

    // סיכום רק אם מעל 40 מילים
    const wordCount = transcript.trim().split(/\s+/).length;
    if (wordCount > 40) {
      const summary = await summarizeWithGPT(transcript);
      response.summary = summary;
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error("transcribe error:", err);

    // טיפול בשגיאות multer
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File exceeds 5MB limit." });
    }

    return res.status(500).json({ error: err.message || "Internal server error." });
  } finally {
    // ניקוי קבצים זמניים
    [inputPath, outputPath].forEach((p) => {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    });
  }
});

// ─── Health check ──────────────────────────────────────────────────────────
app.get("/api/transcribe", (_req, res) => {
  res.json({ status: "ok", message: "Audio transcription service is running." });
});

// ─── Export for Vercel ─────────────────────────────────────────────────────
export default app;
