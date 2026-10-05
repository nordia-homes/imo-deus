// Stored commands can contain a larger batch; each worker pass is bounded.
// This is independent of the model's token/tool-call budget.
export const MAX_PLAN_ACTIONS = 100;
export const PLAN_WORKER_STEPS = 10;
export const PLAN_EXECUTION_MS = 120000;
