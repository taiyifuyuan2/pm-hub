import type { AgentEvent, ChatRequest, HealthResponse } from "../../shared/agent";
import { API_BASE } from "./api";

export class ServerUnavailableError extends Error {
  constructor() {
    super(`ローカルサーバー（${API_BASE}）に接続できません。\`npm run server\` で起動してください。`);
  }
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * POST /api/chat を呼び、SSE で届く AgentEvent を順に onEvent へ渡す。
 * ストリームが閉じたら resolve する。
 */
export async function streamChat(req: ChatRequest, onEvent: (event: AgentEvent) => void, signal: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ServerUnavailableError();
  }

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of frame.split("\n")) {
        if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)) as AgentEvent);
      }
    }
  }
}
