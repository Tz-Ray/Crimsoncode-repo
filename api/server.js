const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { z } = require("zod");
const aiRouter = require("./ai/router");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});