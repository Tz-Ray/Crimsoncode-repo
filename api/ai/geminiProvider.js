const { GoogleGenAI, Type } = require("@google/genai");

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

async function generateStructuredTaskSummary({ tasks, rangeLabel, context }) {
  const ai = getGeminiClient();

  const prompt = `
You are a productivity assistant. Summarize the provided tasks.
Rules:
- Use only the provided task data.
- Do not invent tasks or dates.
- Be concise and actionable.
- Keep suggestions generic and practical.

Input context:
- rangeLabel: ${rangeLabel || "Task Summary"}
- view: ${context?.view || "unknown"}
- rangeStart: ${context?.rangeStart || "unknown"}
- rangeEnd: ${context?.rangeEnd || "unknown"}

Tasks JSON:
${JSON.stringify(tasks, null, 2)}
  `.trim();

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING },
      summary: { type: Type.STRING },
      stats: {
        type: Type.OBJECT,
        properties: {
          total: { type: Type.NUMBER },
          completed: { type: Type.NUMBER },
          pending: { type: Type.NUMBER },
          withTime: { type: Type.NUMBER },
        },
        required: ["total", "completed", "pending", "withTime"],
      },
      upcoming: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            time: { type: Type.STRING },
          },
          required: ["title", "date"],
        },
      },
      suggestions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      warnings: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: ["headline", "summary", "stats", "upcoming", "suggestions", "warnings"],
  };

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const text = result.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return {
    parsed: JSON.parse(text),
    model: GEMINI_MODEL,
  };
}

module.exports = {
  generateStructuredTaskSummary,
};