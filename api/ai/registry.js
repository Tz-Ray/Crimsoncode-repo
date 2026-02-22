const { summarizeTasksAction } = require("./actions/summarizeTasks");
const { generatePlanTasksAction } = require("./actions/generatePlanTasks");

const actionRegistry = {
  summarizeTasks: summarizeTasksAction,
  generatePlanTasks: generatePlanTasksAction,
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