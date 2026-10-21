import type {
  BootstrapResponse,
  PermissionMode,
  PermissionResponseRequest,
  PermissionRulesResponse,
} from "../../shared/agent";
import type { InboxResponse, Memo, MessageSource, MessageThread, Task, WatchedChat } from "../types";

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  /** カレンダー（空き時間）の権限があるか。なければ、もう一度ログインが必要 */
  calendar: boolean;
}
export interface GmailThread {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
}

export interface BeeperStatus {
  running: boolean;
  hasToken: boolean;
  valid: boolean;
  networks: string[];
}
export interface BeeperChat {
  id: string;
  title: string;
  network: string;
  lastActivity: string;
  unreadCount: number;
}

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return (res.status === 204 ? undefined : res.json()) as Promise<T>;
}

export const api = {
  bootstrap: () => request<BootstrapResponse>("/api/bootstrap"),
  createTask: (task: Task) => request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(task) }),
  updateTask: (id: string, patch: Partial<Omit<Task, "id" | "createdAt">>) =>
    request<Task>(`/api/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTask: (id: string) => request<void>(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }),
  respondPermission: (body: PermissionResponseRequest) =>
    request<void>("/api/chat/permission", { method: "POST", body: JSON.stringify(body) }),
  /** taskId を渡すとそのタスクのルールだけ、省略すると全タスクのルール */
  permissionRules: (taskId?: string) =>
    request<PermissionRulesResponse>(`/api/permissions/rules${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ""}`),
  /** このタスクの権限モード。allow-all は、このセッション中の許可確認をすべて省略する */
  setPermissionMode: (taskId: string, mode: PermissionMode) =>
    request<{ mode: PermissionMode }>(`/api/tasks/${encodeURIComponent(taskId)}/permission-mode`, {
      method: "PUT",
      body: JSON.stringify({ mode }),
    }),
  deletePermissionRule: (id: number) => request<void>(`/api/permissions/rules/${id}`, { method: "DELETE" }),
  clearPermissionRules: (taskId?: string) =>
    request<{ removed: number }>(`/api/permissions/rules${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ""}`, {
      method: "DELETE",
    }),
  addMessage: (taskId: string, body: { source: MessageSource; sender: string; content: string }) =>
    request<MessageThread>(`/api/tasks/${encodeURIComponent(taskId)}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteMessage: (taskId: string, id: string) =>
    request<void>(`/api/tasks/${encodeURIComponent(taskId)}/messages/${encodeURIComponent(id)}`, { method: "DELETE" }),
  googleStatus: () => request<GoogleStatus>("/api/google/status"),
  googleLogin: () => request<{ url: string }>("/api/google/login", { method: "POST" }),
  googleLogout: () => request<void>("/api/google/logout", { method: "POST" }),
  gmailThreads: (q: string) => request<GmailThread[]>(`/api/gmail/threads?q=${encodeURIComponent(q)}`),
  gmailImport: (taskId: string, threadId: string) =>
    request<MessageThread[]>(`/api/tasks/${encodeURIComponent(taskId)}/gmail-import`, {
      method: "POST",
      body: JSON.stringify({ threadId }),
    }),
  gmailDraft: (body: { to: string; subject: string; body: string }) =>
    request<{ id: string; url: string }>("/api/gmail/drafts", { method: "POST", body: JSON.stringify(body) }),
  beeperStatus: () => request<BeeperStatus>("/api/beeper/status"),
  saveBeeperToken: (token: string) => request<void>("/api/beeper/token", { method: "PUT", body: JSON.stringify({ token }) }),
  deleteBeeperToken: () => request<void>("/api/beeper/token", { method: "DELETE" }),
  beeperChats: (q: string) => request<BeeperChat[]>(`/api/beeper/chats?q=${encodeURIComponent(q)}`),
  beeperImport: (taskId: string, chatID: string) =>
    request<MessageThread[]>(`/api/tasks/${encodeURIComponent(taskId)}/beeper-import`, {
      method: "POST",
      body: JSON.stringify({ chatID }),
    }),
  beeperDraft: (body: { chat: string; chatID?: string; text: string }) =>
    request<{ chatTitle: string; network: string }>("/api/beeper/draft", { method: "POST", body: JSON.stringify(body) }),
  inbox: (after?: number) => request<InboxResponse>(`/api/inbox${after === undefined ? "" : `?after=${after}`}`),
  inboxPaused: (paused: boolean) => request<InboxResponse>("/api/inbox/paused", { method: "PUT", body: JSON.stringify({ paused }) }),
  inboxWatch: (chat: WatchedChat, enabled: boolean) =>
    request<InboxResponse>("/api/inbox/watch", { method: "PUT", body: JSON.stringify({ ...chat, enabled }) }),
  beeperSend: (body: { chat: string; chatID?: string; text: string }) =>
    request<{ chatTitle: string; network: string }>("/api/beeper/send", { method: "POST", body: JSON.stringify(body) }),
  gmailSend: (body: { to: string; subject: string; body: string }) =>
    request<{ id: string }>("/api/gmail/send", { method: "POST", body: JSON.stringify(body) }),
  saveMemo: (taskId: string, content: string) =>
    request<Memo>(`/api/memos/${encodeURIComponent(taskId)}`, { method: "PUT", body: JSON.stringify({ content }) }),
};
