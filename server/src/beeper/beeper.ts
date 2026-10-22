import fs from "node:fs";
import path from "node:path";
import type { BeeperRecipient, BeeperRecipientInput, MessageSource } from "../../../shared/types";
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
  draft?: { text?: string } | null;
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

/** タイトルが完全一致するチャットが 1 つだけのときに限って返す（別の人に届かないようにするため） */
async function findChatByTitle(title: string): Promise<RawChat> {
  const res = await beeper<{ items: RawChat[] }>("/v1/chats?limit=100");
  const hits = res.items.filter((c) => c.title === title);
  if (hits.length === 0) throw new Error(`「${title}」のチャットが見つかりません`);
  if (hits.length > 1) throw new Error(`「${title}」という名前のチャットが複数あります。Beeper で直接操作してください`);
  return hits[0];
}

/** 表示名と実際の宛先を同じ境界で照合する。変更操作の直前にも必ず呼ぶ。 */
async function resolveChat(input: BeeperRecipientInput): Promise<RawChat> {
  if (typeof input?.chat !== "string" || !input.chat.trim()
    || (input.chatID !== undefined && (typeof input.chatID !== "string" || !input.chatID.trim()))
    || (input.network !== undefined && typeof input.network !== "string")) {
    throw new Error("送信先が不正です。チャットを選び直してください");
  }
  const id = input.chatID ?? (await findChatByTitle(input.chat)).id;
  if (typeof id !== "string" || !id.trim()) throw new Error("Beeper の送信先 ID が不正です");
  const chat = await beeper<RawChat>(`/v1/chats/${encodeURIComponent(id)}`);
  if (!chat || chat.id !== id || chat.title !== input.chat || typeof chat.network !== "string"
    || (input.network !== undefined && chat.network !== input.network)) {
    throw new Error("表示された送信先と Beeper の情報が一致しません。チャットを選び直してください");
  }
  return chat;
}

export async function resolveChatRecipient(input: BeeperRecipientInput): Promise<BeeperRecipient> {
  const { id, title, network } = await resolveChat(input);
  return { id, title, network };
}

/** 下書きは照合済みの相手にだけ入れ、既存の下書きは上書きしない。 */
export async function setChatDraft(input: BeeperRecipientInput, text: string): Promise<{ chatTitle: string; network: string }> {
  const chat = await resolveChat(input);
  if (chat.draft?.text?.trim()) throw new Error("このチャットにはすでに下書きがあります。Beeper で確認してください");
  await beeper(`/v1/chats/${encodeURIComponent(chat.id)}`, { method: "PATCH", body: { draft: { text } } });
  return { chatTitle: chat.title, network: chat.network };
}

/**
 * メッセージを送信する。呼び出し元は、ユーザーが画面で明示的に「送信」を押したときだけ呼ぶこと
 * （自動処理からは呼ばない）。
 */
export async function sendChatMessage(input: BeeperRecipientInput, text: string): Promise<{ chatTitle: string; network: string }> {
  const chat = await resolveChat(input);
  await beeper(`/v1/chats/${encodeURIComponent(chat.id)}/messages`, { method: "POST", body: { text } });
  return { chatTitle: chat.title, network: chat.network };
}

export interface RecentMessage {
  id: string;
  sender: string;
  isSender: boolean;
  text: string;
  timestamp: string;
}

/** チャットの直近のメッセージ（古い順）。テキストのないもの・削除済みは除く */
export async function recentMessages(chatID: string, limit = 15): Promise<{ title: string; network: string; messages: RecentMessage[] }> {
  const id = encodeURIComponent(chatID);
  const [chat, list] = await Promise.all([
    beeper<RawChat>(`/v1/chats/${id}`),
    beeper<{ items: (RawMessage & { id: string })[] }>(`/v1/chats/${id}/messages`),
  ]);
  const messages = list.items
    .filter((m) => !m.isDeleted && m.text?.trim())
    .map((m) => ({
      id: m.id,
      sender: m.isSender ? "自分" : (m.senderName ?? m.senderID ?? "(不明)"),
      isSender: Boolean(m.isSender),
      text: m.text!.trim(),
      timestamp: new Date(m.timestamp).toISOString(),
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-limit);
  return { title: chat.title, network: chat.network, messages };
}

export const beeperReady = async (): Promise<boolean> => (await beeperStatus()).valid;
