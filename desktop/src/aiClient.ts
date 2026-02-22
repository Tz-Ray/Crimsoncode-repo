export type AiRunRequest = {
  version: "1";
  action: string;
  payload: unknown;
  context?: {
    timezone?: string;
    view?: "day" | "week" | "month" | "year";
    rangeStart?: string;
    rangeEnd?: string;
  };
};

export type AiRunResponse = {
  ok: boolean;
  version: "1";
  action: string;
  result?: any;
  error?: { code: string; message: string; retryable?: boolean };
  meta?: { provider: string; model: string; generatedAt: string; cached?: boolean };
};

const API_BASE = "http://localhost:3001";

export async function runAiAction(body: AiRunRequest): Promise<AiRunResponse> {
  const res = await fetch(`${API_BASE}/ai/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return res.json();
}