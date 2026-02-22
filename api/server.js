const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const { z } = require("zod");
const aiRouter = require("./ai/router");

const app = express();
const PORT = process.env.PORT || 3001;

console.log("[env] GEMINI_API_KEY loaded:", !!process.env.GEMINI_API_KEY);
console.log("[env] GEMINI_MODEL:", process.env.GEMINI_MODEL || "(default)");
console.log("[env] GEMINI_API_KEY length:", process.env.GEMINI_API_KEY?.length || 0);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/ai", aiRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/ai/chat", (req, res) => {
  const schema = z.object({
    prompt: z.string().min(1)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  res.json({ reply: `Demo response: ${parsed.data.prompt}` });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on http://localhost:${PORT}`);
});

app.get("/", (_req, res) => {
  res.send("API is running. Use /health or POST /ai/run");
});