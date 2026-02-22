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
  meta?: {
    provider: string;
    model: string;
    generatedAt: string;
    cached?: boolean;
    fallback?: boolean;
  };
};

const API_BASE = "http://localhost:3001";

export async function runAiAction(body: AiRunRequest): Promise<AiRunResponse> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE}/ai/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error ? `Network error: ${error.message}` : "Network error"
    );
  }

  const rawText = await res.text();

  let parsed: AiRunResponse | null = null;
  try {
    parsed = rawText ? (JSON.parse(rawText) as AiRunResponse) : null;
  } catch (error: unknown) {
    throw new Error(
      `API returned non-JSON response (HTTP ${res.status}). Body: ${rawText.slice(0, 200)}`
    );
  }

  if (!parsed) {
    throw new Error(`Empty response from API (HTTP ${res.status})`);
  }

  // Return parsed JSON even on non-2xx so App.tsx can show server error message
  return parsed;
}