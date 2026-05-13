import express from "express";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";

const app = express();

// תמיכה בקבלת JSON (בשביל ה-AI Agent)
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// --- Helper: Whisper API ---
async function transcribeWithWhisper(fileBuffer, originalName, mimeType) {
  const form = new FormData();
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

// --- Helper: GPT-4o-mini (סוכן חכם שמשמש גם לסיכום וגם למשימות) ---
async function askGPT(transcript, task = "summarize") {
  let systemPrompt = "";
  
  if (task === "summarize") {
    systemPrompt = `אתה עוזר אישי חכם שכותב בגובה העיניים. סכם את ההקלטה בצורה זורמת, אנושית וקלילה.`;
  } else {
    systemPrompt = `אתה AI Agent מקצועי. השתמש בתמלול המצורף כדי לבצע את המשימה שהמשתמש ביקש: ${task}. תענה בצורה ישירה ומדויקת.`;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `הנה הטקסט: ${transcript}` },
      ],
      temperature: 0.7,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

// --- Route: POST /api/transcribe ---
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  // בדיקה אם קיבלנו קובץ או פקודת טקסט (AI Agent)
  const isAgentTask = req.body && req.body.text && req.body.task;

  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("API Key missing");

    // מוד 1: AI Agent (משימה על טקסט קיים)
    if (isAgentTask) {
      const answer = await askGPT(req.body.text, req.body.task);
      return res.status(200).json({ answer });
    }

    // מוד 2: העלאת קובץ ותמלול (מה שהיה קודם)
    if (!req.file) return res.status(400).json({ error: "No audio file provided." });

    const transcript = await transcribeWithWhisper(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const summary = await askGPT(transcript, "summarize");

    return res.status(200).json({ 
      transcript: transcript,
      summary: summary 
    });

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/transcribe", (req, res) => res.json({ status: "Agent Ready" }));

export default app;