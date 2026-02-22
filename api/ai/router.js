const express = require("express");
const { z } = require("zod");
const { runAiAction } = require("./registry");

const router = express.Router();

const aiRunRequestSchema = z.object({
  version: z.literal("1"),
  action: z.string(),
  payload: z.unknown(),
  context: z
    .object({
      timezone: z.string().optional(),
      view: z.enum(["day", "week", "month", "year"]).optional(),
      rangeStart: z.string().optional(),
      rangeEnd: z.string().optional(),
    })
    .optional(),
});

router.post("/run", async (req, res) => {
  const parsed = aiRunRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      version: "1",
      action: req.body?.action || "unknown",
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid AI request envelope",
      },
    });
  }

  try {
    const { action, payload, context } = parsed.data;
    const actionResult = await runAiAction(action, { payload, context });

    const meta = {
      provider: actionResult._meta?.provider || "gemini",
      model: actionResult._meta?.model || "unknown",
      fallback: !!actionResult._meta?.fallback,
      generatedAt: new Date().toISOString(),
    };

    if (!actionResult.ok) {
      return res.status(400).json({
        ok: false,
        version: "1",
        action,
        error: actionResult.error,
        meta,
      });
    }

    return res.json({
      ok: true,
      version: "1",
      action,
      result: actionResult.result,
      meta,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      version: "1",
      action: req.body?.action || "unknown",
      error: {
        code: "AI_RUN_FAILED",
        message: err instanceof Error ? err.message : "Unknown AI error",
        retryable: true,
      },
      meta: {
        provider: "gemini",
        model: "unknown",
        fallback: false,
        generatedAt: new Date().toISOString(),
      },
    });
  }
});

module.exports = router;