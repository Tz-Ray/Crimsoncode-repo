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
  You are a High-Performance Productivity Coach. 
  TASK: Create a 7-day "Plan of Attack" based on the provided JSON.

  CRITICAL INSTRUCTION: 
  - Your 'headline' must mention the specific date range (Next 7 Days).
  - Your 'summary' should focus ONLY on the most urgent 3 tasks.
  - Your 'suggestedWorkflow' must be a 3-step actionable sequence. 
    Step 1: What to finish in the next 24 hours.
    Step 2: What to prepare for mid-week.
    Step 3: What to delegate or defer to the weekend.

  Current Date context: ${context?.rangeStart}
  Tasks:
  ${JSON.stringify(tasks, null, 2)}
  `.trim();

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING },
      summary: { type: Type.STRING },
      suggestedWorkflow: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "A 3-step prioritized plan based on the next 7 days"
      },
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
      suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["headline", "summary", "stats", "upcoming", "suggestions", "suggestedWorkflow", "warnings"],
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