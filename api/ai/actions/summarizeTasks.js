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

            // Support both current frontend style and older aliases
            description: z.string().optional(),
            priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
            notes: z.string().optional(),
            tags: z.array(z.string()).optional(),
        })
    ),
    rangeLabel: z.string().optional(),
});

const summarizeTasksOutputSchema = z.object({
    headline: z.string(),
    summary: z.string(),
    suggestedWorkflow: z.array(z.string()).optional(),
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

function buildFallbackSummary(tasks, rangeLabel, warningMessage) {
    const completed = tasks.filter((t) => t.completed).length;
    const pending = tasks.length - completed;
    const withTime = tasks.filter((t) => !!t.time).length;

    const result = {
        headline: rangeLabel || "Task Summary",
        summary: `You have ${tasks.length} task${tasks.length === 1 ? "" : "s"}, ${completed} completed, ${pending} pending.`,
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
            pending > 0
                ? "Pick one pending task and complete it first."
                : "Great job — all tasks in this view are completed.",
            withTime === 0
                ? "Add times to important tasks so your schedule is easier to plan."
                : "Timed tasks are already helping your schedule stay structured.",
        ],
        warnings: warningMessage ? [warningMessage] : [],
    };

    return {
        ok: true,
        result,
        _meta: {
            provider: "local",
            model: "stub",
            fallback: true,
        },
    };
}

async function summarizeTasksAction({ payload, context }) {
    const parsed = summarizeTasksInputSchema.safeParse(payload);

    if (!parsed.success) {
        return {
            ok: false,
            error: {
                code: "INVALID_PAYLOAD",
                message: "Invalid summarizeTasks payload",
            },
            _meta: {
                provider: "local",
                model: "stub",
                fallback: true,
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
            return buildFallbackSummary(
                tasks,
                rangeLabel,
                "Gemini output format was invalid. Using fallback summary."
            );
        }

        return {
            ok: true,
            result: validated.data,
            _meta: {
                provider: "gemini",
                model: gemini.model,
                fallback: false,
            },
        };
    } catch (err) {
        console.warn("[summarizeTasks] Gemini failed, using fallback:", err);

        const debugMessage =
            err instanceof Error ? err.message : "Unknown Gemini error";

        return buildFallbackSummary(
            tasks,
            rangeLabel,
            `Using local fallback summary (AI unavailable). ${debugMessage}`
        );
    }
}


module.exports = {
    summarizeTasksAction,
};