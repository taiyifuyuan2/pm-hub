import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config";

// 読み取りと、下書きの作成。送信・削除の API は呼ばない（gmail.compose は送信も許す権限だが、使わない）
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
];
const AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

const tokenPath = () => path.join(config.dataDir, "google-token.json");

interface ClientInfo {
  client_id: string;
  client_secret: string;
}
interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email?: string;
}

/** google-client.json、またはダウンロードしたままの client_secret_*.json を読む */
function loadClient(): ClientInfo | null {
  let file = path.join(config.dataDir, "google-client.json");
  if (!fs.existsSync(file)) {
    const found = fs.existsSync(config.dataDir)
      ? fs.readdirSync(config.dataDir).find((f) => /^client_secret_.*\.json$/.test(f))
      : undefined;
    if (!found) return null;
    file = path.join(config.dataDir, found);
  }
  try {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    const c = json.installed ?? json.web;
    return c?.client_id && c?.client_secret ? { client_id: c.client_id, client_secret: c.client_secret } : null;
  } catch {
    return null;
  }
}

function loadTokens(): Tokens | null {
  try {
    return JSON.parse(fs.readFileSync(tokenPath(), "utf8")) as Tokens;
  } catch {
    return null;
  }
}

function saveTokens(t: Tokens) {
  fs.writeFileSync(tokenPath(), JSON.stringify(t), { mode: 0o600 });
}

export const redirectUri = () => `http://127.0.0.1:${config.port}/api/google/callback`;

export function googleStatus() {
  const tokens = loadTokens();
  return { configured: loadClient() !== null, connected: tokens !== null, email: tokens?.email ?? null };
}

export function googleLogout() {
  fs.rmSync(tokenPath(), { force: true });
}

// ---------- ログイン（PKCE 付きの認可コードフロー） ----------

const pending = new Map<string, { verifier: string; createdAt: number }>();

export function startLogin(): string {
  const client = loadClient();
  if (!client) throw new Error("google-client.json が見つかりません（~/.pm-hub に置いてください）");
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(16).toString("base64url");
  const now = Date.now();
  for (const [k, v] of pending) if (now - v.createdAt > 10 * 60_000) pending.delete(k);
  pending.set(state, { verifier, createdAt: now });
  const params = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return `${AUTH_URI}?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(json.error_description ?? json.error ?? `HTTP ${res.status}`));
  return json;
}

export async function finishLogin(code: string, state: string) {
  const client = loadClient();
  const entry = pending.get(state);
  if (!client || !entry) throw new Error("ログインの手順が無効です。もう一度やり直してください");
  pending.delete(state);
  const json = await tokenRequest({
    code,
    client_id: client.client_id,
    client_secret: client.client_secret,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
    code_verifier: entry.verifier,
  });
  if (!json.refresh_token) throw new Error("リフレッシュトークンを受け取れませんでした");
  const tokens: Tokens = {
    access_token: String(json.access_token),
    refresh_token: String(json.refresh_token),
    expires_at: Date.now() + Number(json.expires_in) * 1000,
  };
  try {
    const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    tokens.email = ((await me.json()) as { email?: string }).email;
  } catch {
    // メールアドレスは表示用なので、取れなくても続ける
  }
  saveTokens(tokens);
}

async function accessToken(): Promise<string> {
  const client = loadClient();
  const tokens = loadTokens();
  if (!client || !tokens) throw new Error("Google にログインしていません");
  if (tokens.expires_at - 60_000 > Date.now()) return tokens.access_token;
  const json = await tokenRequest({
    client_id: client.client_id,
    client_secret: client.client_secret,
    refresh_token: tokens.refresh_token,
    grant_type: "refresh_token",
  });
  const next = { ...tokens, access_token: String(json.access_token), expires_at: Date.now() + Number(json.expires_in) * 1000 };
  saveTokens(next);
  return next.access_token;
}

async function gmail<T>(pathAndQuery: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GMAIL}${pathAndQuery}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Gmail API: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

// ---------- Gmail ----------

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
}
interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

const header = (m: GmailMessage, name: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

const decode = (data?: string) => (data ? Buffer.from(data, "base64url").toString("utf8") : "");

/** text/plain を優先して本文を取り出す。なければ HTML のタグを落とす */
function bodyText(part: GmailPart | undefined): string {
  if (!part) return "";
  const find = (p: GmailPart, type: string): string | undefined => {
    if (p.mimeType === type && p.body?.data) return decode(p.body.data);
    for (const c of p.parts ?? []) {
      const r = find(c, type);
      if (r) return r;
    }
    return undefined;
  };
  const plain = find(part, "text/plain");
  if (plain) return plain;
  const html = find(part, "text/html");
  return html
    ? html
        .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

export interface ThreadSummary {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
}

export async function searchThreads(q: string): Promise<ThreadSummary[]> {
  const list = await gmail<{ threads?: { id: string }[] }>(`/threads?maxResults=15&q=${encodeURIComponent(q)}`);
  return Promise.all(
    (list.threads ?? []).map(async ({ id }) => {
      const t = await gmail<{ messages?: GmailMessage[] }>(
        `/threads/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
      );
      const last = t.messages?.[t.messages.length - 1];
      return {
        id,
        subject: (last && header(last, "Subject")) || "(件名なし)",
        from: (last && header(last, "From")) || "",
        snippet: last?.snippet ?? "",
        date: last?.internalDate ? new Date(Number(last.internalDate)).toISOString() : new Date().toISOString(),
      };
    }),
  );
}

export interface ThreadMessage {
  sender: string;
  content: string;
  timestamp: string;
}

export async function readThread(id: string): Promise<{ subject: string; messages: ThreadMessage[] }> {
  const t = await gmail<{ messages?: GmailMessage[] }>(`/threads/${encodeURIComponent(id)}?format=full`);
  const msgs = t.messages ?? [];
  return {
    subject: (msgs[0] && header(msgs[0], "Subject")) || "(件名なし)",
    messages: msgs.map((m) => ({
      sender: header(m, "From"),
      content: bodyText(m.payload).trim() || m.snippet || "",
      timestamp: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
    })),
  };
}

const encodeHeader = (v: string) => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v).toString("base64")}?=`);

interface MailInput {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

function mimeMessage(input: MailInput) {
  if (/[\r\n]/.test(input.to + input.subject)) throw new Error("宛先と件名に改行は使えません");
  const raw = [
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.body).toString("base64"),
  ].join("\r\n");
  return { raw: Buffer.from(raw).toString("base64url"), ...(input.threadId ? { threadId: input.threadId } : {}) };
}

/** 下書きを作る（送信はしない）。threadId を渡すとそのスレッドへの返信の下書きになる */
export async function createDraft(input: MailInput) {
  const draft = await gmail<{ id: string }>("/drafts", { method: "POST", body: JSON.stringify({ message: mimeMessage(input) }) });
  return { id: draft.id, url: "https://mail.google.com/mail/u/0/#drafts" };
}

/** メールを送信する。呼び出し元は、ユーザーが画面で明示的に「送信」を押したときだけ呼ぶこと */
export async function sendMail(input: MailInput) {
  const sent = await gmail<{ id: string }>("/messages/send", { method: "POST", body: JSON.stringify(mimeMessage(input)) });
  return { id: sent.id };
}
