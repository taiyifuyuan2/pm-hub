import type {
  BootstrapResponse,
  PermissionMode,
  PermissionResponseRequest,
  PermissionRulesResponse,
} from "../../shared/agent";
import type { Memo, MessageSource, MessageThread, Task } from "../types";

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
  saveMemo: (taskId: string, content: string) =>
    request<Memo>(`/api/memos/${encodeURIComponent(taskId)}`, { method: "PUT", body: JSON.stringify({ content }) }),
};
