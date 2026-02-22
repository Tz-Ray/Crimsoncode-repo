const { z } = require("zod");
const { generateStructuredTaskSummary } = require("../geminiProvider");

const summarizeTasksInputSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      date: z.string(),
      time: z.string().optional(),
      completed: z.boolean(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
  ),
  rangeLabel: z.string().optional(),
});

const summarizeTasksOutputSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  stats: z.object({
    total: z.number(),
    completed: z.number(),
    pending: z.number(),
    withTime: z.number(),
  }),
  upcoming: z.array(
    z.object({
      title: z.string(),
      date: z.string(),
      time: z.string().optional(),
    })
  ),
  suggestions: z.array(z.string()),
  warnings: z.array(z.string()),
});

async function summarizeTasksAction({ payload, context }) {
  const parsed = summarizeTasksInputSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid summarizeTasks payload",
      },
    };
  }

  const { tasks, rangeLabel } = parsed.data;

  try {
    const gemini = await generateStructuredTaskSummary({
      tasks,
      rangeLabel,
      context,
    });

    const validated = summarizeTasksOutputSchema.safeParse(gemini.parsed);

    if (!validated.success) {
      return {
        ok: false,
        error: {
          code: "INVALID_MODEL_OUTPUT",
          message: "Gemini returned invalid summary format",
        },
      };
    }

    return {
      ok: true,
      result: validated.data,
      _meta: {
        model: gemini.model,
      },
    };
  } catch (err) {
    // Fallback stub (great for free-tier failures / quota issues)
    const completed = tasks.filter((t) => t.completed).length;
    const pending = tasks.length - completed;
    const withTime = tasks.filter((t) => !!t.time).length;

    return {
      ok: true,
      result: {
        headline: rangeLabel || "Task Summary",
        summary: `You have ${tasks.length} tasks, ${completed} completed, ${pending} pending.`,
        stats: {
          total: tasks.length,
          completed,
          pending,
          withTime,
        },
        upcoming: tasks
          .filter((t) => !t.completed)
          .sort((a, b) =>
            `${a.date} ${a.time || "99:99"}`.localeCompare(
              `${b.date} ${b.time || "99:99"}`
            )
          )
          .slice(0, 5)
          .map((t) => ({
            title: t.title,
            date: t.date,
            time: t.time,
          })),
        suggestions: [
          "Complete one pending task today.",
          "Add times to important tasks.",
        ],
        warnings: ["Using local fallback summary (AI unavailable)."],
      },
    };
  }
}

module.exports = {
  summarizeTasksAction,
};