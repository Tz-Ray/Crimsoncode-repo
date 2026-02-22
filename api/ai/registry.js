const { summarizeTasksAction } = require("./actions/summarizeTasks");

const actionRegistry = {
  summarizeTasks: summarizeTasksAction,
  // later:
  // prioritizeTasks: prioritizeTasksAction,
  // weeklyReview: weeklyReviewAction,
};

async function runAiAction(action, args) {
  const handler = actionRegistry[action];

  if (!handler) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ACTION",
        message: `Unknown AI action: ${action}`,
      },
    };
  }

  return handler(args);
}

module.exports = {
  runAiAction,
};