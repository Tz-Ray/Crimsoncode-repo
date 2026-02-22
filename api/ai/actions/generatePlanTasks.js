const { z } = require("zod");
const { generatePlanTasks } = require("../geminiProvider");

const planInputSchema = z.object({
  goalTitle: z.string().min(1),
  goalDetails: z.string().optional(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),   // YYYY-MM-DD
  constraints: z.string().optional(),
  existingTasks: z
    .array(
      z.object({
        title: z.string(),
        date: z.string(),
        time: z.string().optional(),
        completed: z.boolean().optional(),
      })
    )
    .optional(),
});

const planOutputSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.string(),
      time: z.string().optional(),
      priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    })
  ),
  warnings: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
});

function parseConstraintHints(constraints = "") {
  const lower = constraints.toLowerCase();

  // very light parsing for fallback behavior
  const weekdaysOnly = lower.includes("weekday");
  const noSundays = lower.includes("no sunday") || lower.includes("no sundays");

  let cadenceDays = 1;
  const cadenceMatch = lower.match(/every\s+(\d+)\s+day/);
  if (cadenceMatch) {
    cadenceDays = Math.max(1, Number(cadenceMatch[1]) || 1);
  }

  // Parse "5-7 pm", "5pm-7pm", "17:00-19:00"
  let startTime;
  const timeMatch = lower.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/
  );
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || "0");
    const meridiem = timeMatch[3]; // am/pm on start
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return { weekdaysOnly, noSundays, cadenceDays, startTime };
}

function buildFallbackPlan(payload, warningMessage) {
  const {
    goalTitle,
    goalDetails,
    startDate,
    endDate,
    constraints,
  } = payload;

  const hints = parseConstraintHints(constraints);
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return {
      ok: false,
      error: {
        code: "INVALID_PLAN_DATES",
        message: "Invalid start or end date for plan generation",
      },
      _meta: {
        provider: "local",
        model: "stub",
        fallback: true,
      },
    };
  }

  const generated = [];
  const current = new Date(start);
  let stepIndex = 1;

  while (current <= end && generated.length < 12) {
    const day = current.getDay(); // 0=Sun ... 6=Sat

    const isSunday = day === 0;
    const isWeekend = day === 0 || day === 6;

    if (hints.weekdaysOnly && isWeekend) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    if (hints.noSundays && isSunday) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    const date = current.toISOString().slice(0, 10);

    generated.push({
      title: `${goalTitle} — Session ${stepIndex}`,
      description:
        stepIndex === 1
          ? `Start with setup + outline for the goal. ${goalDetails || ""}`.trim()
          : stepIndex % 3 === 0
          ? `Practice/review checkpoint for progress. ${goalDetails || ""}`.trim()
          : `Focused work session toward "${goalTitle}". ${goalDetails || ""}`.trim(),
      date,
      time: hints.startTime,
      priority: stepIndex <= 2 ? 1 : stepIndex <= 5 ? 2 : 3,
    });

    stepIndex += 1;
    current.setDate(current.getDate() + hints.cadenceDays);
  }

  return {
    ok: true,
    result: {
      headline: `Plan for ${goalTitle}`,
      summary: `Created ${generated.length} scheduled step${generated.length === 1 ? "" : "s"} from ${startDate} to ${endDate}.`,
      tasks: generated,
      warnings: warningMessage ? [warningMessage] : [],
      suggestions: [
        "Review the generated sessions before adding them to your calendar.",
        "Adjust the constraints text if you want fewer or more frequent sessions.",
      ],
    },
    _meta: {
      provider: "local",
      model: "stub",
      fallback: true,
    },
  };
}

async function generatePlanTasksAction({ payload, context }) {
  const parsed = planInputSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid generatePlanTasks payload",
      },
      _meta: {
        provider: "local",
        model: "stub",
        fallback: true,
      },
    };
  }

  const input = parsed.data;

  try {
    const gemini = await generatePlanTasks({ ...input, context });

    const validated = planOutputSchema.safeParse(gemini.parsed);
    if (!validated.success) {
      return buildFallbackPlan(input, "Gemini output format was invalid. Using fallback plan.");
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
    console.warn("[generatePlanTasks] Gemini failed, using fallback:", err);
    return buildFallbackPlan(input, "Using local fallback plan (AI unavailable).");
  }
}

module.exports = {
  generatePlanTasksAction,
};