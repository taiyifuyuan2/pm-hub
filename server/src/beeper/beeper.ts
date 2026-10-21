import fs from "node:fs";
import path from "node:path";
import type { MessageSource } from "../../../shared/types";
import { config } from "../config";

// Beeper Desktop のローカル API。読み取り専用で使い、メッセージの送信・編集・削除は呼ばない
const BASE = process.env.PMHUB_BEEPER_URL ?? "http://localhost:23373";
const tokenPath = () => path.join(config.dataDir, "beeper-token.json");

const loadToken = (): string | null => {
  try {
    const t = (JSON.parse(fs.readFileSync(tokenPath(), "utf8")) as { token?: string }).token;
    return t || null;
  } catch {
    return null;
  }
};

export const saveBeeperToken = (token: string) =>
  fs.writeFileSync(tokenPath(), JSON.stringify({ token }), { mode: 0o600 });
export const clearBeeperToken = () => fs.rmSync(tokenPath(), { force: true });

async function beeper<T>(pathAndQuery: string, init?: { method: string; body: unknown }): Promise<T> {
  const token = loadToken();
  if (!token) throw new Error("Beeper のアクセストークンが設定されていません");
  let res: Response;
  try {
    res = await fetch(`${BASE}${pathAndQuery}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(init ? { "Content-Type": "application/json" } : {}) },
      body: init ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("Beeper Desktop に接続できません。Beeper を起動してください");
  }
  if (res.status === 401) throw new Error("Beeper のトークンが無効です。作り直してください");
  if (res.status === 403) throw new Error("Beeper のトークンに、この操作の権限がありません（書き込み権限つきで作り直してください）");
  if (!res.ok) throw new Error(`Beeper API: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface BeeperAccount {
  accountID: string;
  network: string;
}

export async function beeperStatus(): Promise<{ running: boolean; hasToken: boolean; valid: boolean; networks: string[] }> {
  const hasToken = loadToken() !== null;
  try {
    const info = await fetch(`${BASE}/v1/info`, { signal: AbortSignal.timeout(2_000) });
    if (!info.ok) return { running: false, hasToken, valid: false, networks: [] };
  } catch {
    return { running: false, hasToken, valid: false, networks: [] };
  }
  if (!hasToken) return { running: true, hasToken, valid: false, networks: [] };
  try {
    const accounts = await beeper<BeeperAccount[]>("/v1/accounts");
    return { running: true, hasToken, valid: true, networks: [...new Set(accounts.map((a) => a.network))] };
  } catch {
    return { running: true, hasToken, valid: false, networks: [] };
  }
}

export interface ChatSummary {
  id: string;
  title: string;
  network: string;
  lastActivity: string;
  unreadCount: number;
}

interface RawChat extends ChatSummary {
  type?: string;
}

export async function listChats(q: string): Promise<ChatSummary[]> {
  const res = await beeper<{ items: RawChat[] }>("/v1/chats?limit=100");
  const needle = q.trim().toLowerCase();
  return res.items
    .filter((c) => !needle || `${c.title} ${c.network}`.toLowerCase().includes(needle))
    .slice(0, 30)
    .map((c) => ({ id: c.id, title: c.title, network: c.network, lastActivity: c.lastActivity, unreadCount: c.unreadCount }));
}

interface RawMessage {
  senderID?: string;
  senderName?: string;
  timestamp: string;
  text?: string;
  type?: string;
  isSender?: boolean;
  isDeleted?: boolean;
  attachments?: unknown[];
}

export interface ImportedMessage {
  source: MessageSource;
  sender: string;
  content: string;
  timestamp: string;
}

/** チャットの直近のメッセージ（古い順）。LINE は source = line、それ以外は beeper にする */
export async function readChat(chatID: string, limit = 30): Promise<{ title: string; messages: ImportedMessage[] }> {
  const id = encodeURIComponent(chatID);
  const [chat, list] = await Promise.all([
    beeper<RawChat>(`/v1/chats/${id}`),
    beeper<{ items: RawMessage[] }>(`/v1/chats/${id}/messages`),
  ]);
  const source: MessageSource = /line/i.test(chat.network) ? "line" : "beeper";
  const messages = list.items
    .filter((m) => !m.isDeleted && (m.text?.trim() || m.attachments?.length))
    .map((m) => ({
      source,
      sender: m.isSender ? "自分" : (m.senderName ?? m.senderID ?? "(不明)"),
      content: `【${chat.title}】\n${m.text?.trim() || "(添付ファイル)"}`.slice(0, 20_000),
      timestamp: new Date(m.timestamp).toISOString(),
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-limit);
  return { title: chat.title, messages };
}

/**
 * チャットの入力欄に下書きを入れる。送信はしない（送信の API は呼ばない）。
 * すでに下書きがあるチャットには入れない（ユーザーが書きかけの文を消さないため）。
 * タイトルが完全一致するチャットが 1 つだけのときに限る。
 */
export async function setChatDraft(title: string, text: string): Promise<{ chatTitle: string; network: string }> {
  const res = await beeper<{ items: (RawChat & { draft?: { text?: string } | null })[] }>("/v1/chats?limit=100");
  const hits = res.items.filter((c) => c.title === title);
  if (hits.length === 0) throw new Error(`「${title}」のチャットが見つかりません`);
  if (hits.length > 1) throw new Error(`「${title}」という名前のチャットが複数あります。Beeper で直接入力してください`);
  const chat = hits[0];
  if (chat.draft?.text?.trim()) throw new Error("このチャットにはすでに下書きがあります。Beeper で確認してください");
  await beeper(`/v1/chats/${encodeURIComponent(chat.id)}`, { method: "PATCH", body: { draft: { text } } });
  return { chatTitle: chat.title, network: chat.network };
}
