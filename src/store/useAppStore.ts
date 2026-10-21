import { create } from "zustand";
// このファイルには DB への保存を指す persist() ヘルパーがあるため、ミドルウェアは別名で取り込む
import { createJSONStorage, persist as persistMiddleware } from "zustand/middleware";
import type { ChatModelId } from "../../shared/agent";
import type { SortBy, StatusFilter } from "../features/tasks/filterTasks";
import { api } from "../lib/api";
import { toast } from "./toastStore";
import { resolveSelectedTaskId } from "./selection";
import type { AiLog, ContextTab, Memo, MessageThread, Task, TaskStatus } from "../types";
import {
  DEFAULT_UI_SETTINGS,
  UI_SETTINGS_KEY,
  UI_SETTINGS_VERSION,
  sanitizeUiSettings,
  type SectionKey,
  type ThemePreference,
  type UiSettings,
} from "./uiSettings";

/** メモの保存状態。dirty: 入力済みで未送信 / saving: 送信中 / saved: 保存済み / error: 失敗 */
export type MemoSaveState = "dirty" | "saving" | "saved" | "error";

export type NewTaskInput = Omit<Task, "id" | "createdAt" | "isPinned"> & { isPinned?: boolean };
export type TaskPatch = Partial<NewTaskInput>;

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

/** DB のデータ（tasks など）とは別に、画面の状態（UiSettings）を持つ。後者だけが localStorage に保存される */
interface AppState extends UiSettings {
  load: LoadState;
  tasks: Task[];
  /** taskId → メモ */
  memos: Record<string, Memo>;
  /** taskId → AIログ（時系列順） */
  aiLogs: Record<string, AiLog[]>;
  /** taskId → メッセージ（時系列順） */
  messages: Record<string, MessageThread[]>;

  // ---- 画面の一時的な状態（保存しない） ----
  /** taskId → 送信前の入力（下書き）。タスクを切り替えても消えない */
  drafts: Record<string, string>;
  /** エージェントを実行中のタスク */
  runningTaskIds: string[];
  /** taskId → メモの保存状態 */
  memoSaveState: Record<string, MemoSaveState>;
  /** 新規タスクのダイアログを開く要求（ショートカットや上部ボタンから） */
  newTaskRequested: boolean;

  setTheme: (theme: ThemePreference) => void;
  setCategoryFilter: (category: string | null) => void;
  setLeftWidth: (width: number) => void;
  setRightWidth: (width: number) => void;
  toggleSection: (section: SectionKey) => void;
  setDraft: (taskId: string, text: string) => void;
  setTaskRunning: (taskId: string, running: boolean) => void;
  requestNewTask: () => void;
  clearNewTaskRequest: () => void;
  /** スワイプ操作のボタンを開いているタスク（同時に1つだけ開く） */
  swipeOpenId: string | null;
  setSwipeOpen: (taskId: string | null) => void;
  /** 概要（インフォグラフィック）・ショートカット一覧の表示 */
  insightsOpen: boolean;
  shortcutsOpen: boolean;
  setInsightsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  /** 更新中か（上部バーの更新ボタンを回す） */
  refreshing: boolean;
  /**
   * サーバーの最新の状態を取り込む（引っ張って更新・更新ボタン）。
   * 画面を読み込み中に戻さず、実行中のエージェントのログと、入力途中のメモは上書きしない。
   */
  refresh: () => Promise<void>;
  /** 一覧の上の入力欄から、タイトルだけで素早く追加する。カテゴリの絞り込み中は、そのカテゴリで作る */
  quickAddTask: (title: string) => void;
  /** 完了にする（すでに完了なら Active に戻す）。「元に戻す」付きのトーストを出す */
  completeTask: (taskId: string) => void;

  /** ローカルサーバー（SQLite）から全データを読み込む */
  hydrate: () => Promise<void>;
  selectTask: (taskId: string | null) => void;
  setActiveContextTab: (tab: ContextTab) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: SortBy) => void;
  setStatusFilter: (status: StatusFilter) => void;
  setChatModel: (model: ChatModelId | null) => void;
  /** ピン留めの切り替え。ピン留めしたタスクは一覧の最上部の Pinned セクションに表示される */
  togglePin: (taskId: string) => void;
  /** タスクを追加して選択状態にする。追加したタスクの id を返す */
  addTask: (input: NewTaskInput) => string;
  updateTask: (taskId: string, patch: TaskPatch) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  /** サーバーで削除できてから画面から消す。失敗時は例外を投げる */
  deleteTask: (taskId: string) => Promise<void>;
  updateMemo: (taskId: string, content: string) => void;
  addMessage: (taskId: string, input: { sender: string; content: string }) => Promise<void>;
  deleteMessage: (taskId: string, id: string) => Promise<void>;
  importGmailThread: (taskId: string, threadId: string) => Promise<number>;
  importBeeperChat: (taskId: string, chatID: string) => Promise<number>;
  // AIログはサーバー側（/api/chat）で保存されるため、以下は画面表示用のローカル更新のみ
  addAiLog: (log: Omit<AiLog, "id" | "timestamp">) => string;
  updateAiLog: (taskId: string, logId: string, patch: Partial<Pick<AiLog, "message" | "status" | "permission">>) => void;
  /** ストリーミング受信したテキストを追記する */
  appendAiLogText: (taskId: string, logId: string, text: string) => void;
  removeAiLog: (taskId: string, logId: string) => void;
}

const now = () => new Date().toISOString();

const mapLogs = (logs: Record<string, AiLog[]>, taskId: string, fn: (logs: AiLog[]) => AiLog[]) => ({
  ...logs,
  [taskId]: fn(logs[taskId] ?? []),
});

/** 画面は先に更新し、保存に失敗したらトーストで知らせる（楽観的更新） */
const persist = (label: string, promise: Promise<unknown>) =>
  promise.catch((err) => {
    console.error(`[persist] ${label} の保存に失敗しました`, err);
    toast.error(`${label}を保存できませんでした。ローカルサーバーの状態を確認してください。`);
  });

// メモは入力のたびに保存せず、入力が止まってから送る
const MEMO_SAVE_DELAY_MS = 500;
const memoTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * localStorage が使えない環境（プライベートモード、容量超過、無効化など）でも、状態の更新自体は失敗させない。
 * 保存できなかった場合は、その実行中だけ設定が保持される。
 */
const safeStorage = createJSONStorage<UiSettings>(() => ({
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* 保存できなくても動作は続ける */
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* 同上 */
    }
  },
}));

export const useAppStore = create<AppState>()(
  persistMiddleware(
    (set, get) => ({
      ...DEFAULT_UI_SETTINGS,
      load: { status: "loading" },
      tasks: [],
      memos: {},
      aiLogs: {},
      messages: {},
      drafts: {},
      runningTaskIds: [],
      memoSaveState: {},
      newTaskRequested: false,
      swipeOpenId: null,
      insightsOpen: false,
      shortcutsOpen: false,
      refreshing: false,

      setTheme: (theme) => set({ theme }),
      setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
      setLeftWidth: (leftWidth) => set({ leftWidth }),
      setRightWidth: (rightWidth) => set({ rightWidth }),
      toggleSection: (section) =>
        set((s) => ({
          collapsedSections: s.collapsedSections.includes(section)
            ? s.collapsedSections.filter((k) => k !== section)
            : [...s.collapsedSections, section],
        })),
      setDraft: (taskId, text) =>
        set((s) => {
          if (text === "") {
            const { [taskId]: _removed, ...rest } = s.drafts;
            return { drafts: rest };
          }
          return { drafts: { ...s.drafts, [taskId]: text } };
        }),
      setTaskRunning: (taskId, running) =>
        set((s) => ({
          runningTaskIds: running
            ? s.runningTaskIds.includes(taskId)
              ? s.runningTaskIds
              : [...s.runningTaskIds, taskId]
            : s.runningTaskIds.filter((id) => id !== taskId),
        })),
      requestNewTask: () => set({ newTaskRequested: true }),
      clearNewTaskRequest: () => set({ newTaskRequested: false }),
      setSwipeOpen: (swipeOpenId) => set({ swipeOpenId }),
      setInsightsOpen: (insightsOpen) => set({ insightsOpen }),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

      refresh: async () => {
        if (get().refreshing) return;
        set({ refreshing: true });
        try {
          const data = await api.bootstrap();
          set((s) => {
            // 実行中のタスクのログは、画面にしかない途中経過を含むので、サーバーの内容で置き換えない
            const aiLogs = { ...data.aiLogs };
            for (const id of s.runningTaskIds) if (s.aiLogs[id]) aiLogs[id] = s.aiLogs[id];
            // 入力してまだ保存していないメモも、置き換えない
            const memos = { ...data.memos };
            for (const id of memoTimers.keys()) if (s.memos[id]) memos[id] = s.memos[id];
            return {
              tasks: data.tasks,
              memos,
              aiLogs,
              messages: data.messages,
              selectedTaskId: resolveSelectedTaskId(data.tasks, s.selectedTaskId),
              load: { status: "ready" },
            };
          });
        } catch (err) {
          console.error("[refresh] 更新に失敗しました", err);
          toast.error("更新できませんでした。ローカルサーバーの状態を確認してください。");
          throw err;
        } finally {
          set({ refreshing: false });
        }
      },

      quickAddTask: (title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        const { categoryFilter } = get();
        const id = get().addTask({
          title: trimmed,
          description: "",
          category: categoryFilter ?? "未分類",
          status: "active",
        });
        toast.success(`「${trimmed}」を追加しました`, {
          action: { label: "元に戻す", onClick: () => void get().deleteTask(id).catch(() => toast.error("取り消せませんでした")) },
        });
      },

      completeTask: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;
        const before = task.status;
        const next = before === "done" ? "active" : "done";
        get().updateTaskStatus(taskId, next);
        toast.success(next === "done" ? `「${task.title}」を完了にしました` : `「${task.title}」を再開しました`, {
          action: { label: "元に戻す", onClick: () => get().updateTaskStatus(taskId, before) },
        });
      },

      hydrate: async () => {
        set({ load: { status: "loading" } });
        try {
          const data = await api.bootstrap();
          set((s) => ({
            ...data,
            load: { status: "ready" },
            // 復元された選択（再起動前の選択）を維持する。そのタスクが DB になければ（削除された等）、
            // 先頭の未完了タスク → 先頭のタスク → 選択なし の順に安全に切り替える
            selectedTaskId: resolveSelectedTaskId(data.tasks, s.selectedTaskId),
          }));
        } catch (err) {
          set({ load: { status: "error", message: err instanceof Error ? err.message : String(err) } });
        }
      },

      // 未読タスクを開いたら Active に移す
      selectTask: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        set({ selectedTaskId: taskId });
        if (task?.status === "unread") get().updateTaskStatus(task.id, "active");
      },

      setActiveContextTab: (tab) => set({ activeContextTab: tab }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSortBy: (sortBy) => set({ sortBy }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      setChatModel: (chatModel) => set({ chatModel }),
      togglePin: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;
        const next = !task.isPinned;
        get().updateTask(taskId, { isPinned: next });
        toast.info(next ? `「${task.title}」をピン留めしました` : `「${task.title}」のピン留めを解除しました`, {
          action: { label: "元に戻す", onClick: () => get().updateTask(taskId, { isPinned: task.isPinned }) },
        });
      },

      // 作成直後に未読→Active へ変わらないよう、selectTask は通さず直接選択する
      addTask: (input) => {
        const task: Task = { ...input, isPinned: input.isPinned ?? false, id: crypto.randomUUID(), createdAt: now() };
        set((s) => ({ tasks: [task, ...s.tasks], selectedTaskId: task.id }));
        persist("タスク", api.createTask(task));
        return task.id;
      },

      updateTask: (taskId, patch) => {
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }));
        // undefined は JSON で消えるため、予定日時の解除は null で送る
        const body = "scheduledAt" in patch ? { ...patch, scheduledAt: patch.scheduledAt ?? null } : patch;
        persist("タスク", api.updateTask(taskId, body as TaskPatch));
      },

      updateTaskStatus: (taskId, status) => get().updateTask(taskId, { status }),

      deleteTask: async (taskId) => {
        await api.deleteTask(taskId);
        clearTimeout(memoTimers.get(taskId));
        memoTimers.delete(taskId);
        set((s) => {
          const tasks = s.tasks.filter((t) => t.id !== taskId);
          const omit = <T>(record: Record<string, T>) => {
            const { [taskId]: _removed, ...rest } = record;
            return rest;
          };
          return {
            tasks,
            memos: omit(s.memos),
            aiLogs: omit(s.aiLogs),
            messages: omit(s.messages),
            selectedTaskId: s.selectedTaskId === taskId ? resolveSelectedTaskId(tasks, null) : s.selectedTaskId,
          };
        });
      },

      addMessage: async (taskId, input) => {
        const m = await api.addMessage(taskId, { source: "manual", ...input });
        set((s) => ({ messages: { ...s.messages, [taskId]: [...(s.messages[taskId] ?? []), m] } }));
      },

      importGmailThread: async (taskId, threadId) => {
        const added = await api.gmailImport(taskId, threadId);
        set((s) => ({ messages: { ...s.messages, [taskId]: [...(s.messages[taskId] ?? []), ...added] } }));
        return added.length;
      },

      importBeeperChat: async (taskId, chatID) => {
        const added = await api.beeperImport(taskId, chatID);
        set((s) => ({ messages: { ...s.messages, [taskId]: [...(s.messages[taskId] ?? []), ...added] } }));
        return added.length;
      },

      deleteMessage: async (taskId, id) => {
        await api.deleteMessage(taskId, id);
        set((s) => ({ messages: { ...s.messages, [taskId]: (s.messages[taskId] ?? []).filter((m) => m.id !== id) } }));
      },

      updateMemo: (taskId, content) => {
        const setSaveState = (state: MemoSaveState) =>
          set((s) => ({ memoSaveState: { ...s.memoSaveState, [taskId]: state } }));
        set((s) => ({
          memos: { ...s.memos, [taskId]: { taskId, content, updatedAt: now() } },
          memoSaveState: { ...s.memoSaveState, [taskId]: "dirty" },
        }));
        clearTimeout(memoTimers.get(taskId));
        memoTimers.set(
          taskId,
          setTimeout(() => {
            memoTimers.delete(taskId);
            setSaveState("saving");
            api
              .saveMemo(taskId, content)
              // 保存中に更に入力があった場合は、その入力の保存結果で状態を決める（古い結果で上書きしない）
              .then(() => memoTimers.has(taskId) || setSaveState("saved"))
              .catch((err) => {
                console.error("[persist] メモの保存に失敗しました", err);
                setSaveState("error");
                toast.error("メモを保存できませんでした。入力は画面に残っています。");
              });
          }, MEMO_SAVE_DELAY_MS),
        );
      },

      addAiLog: (log) => {
        const id = crypto.randomUUID();
        set((s) => ({ aiLogs: mapLogs(s.aiLogs, log.taskId, (logs) => [...logs, { ...log, id, timestamp: now() }]) }));
        return id;
      },

      updateAiLog: (taskId, logId, patch) =>
        set((s) => ({
          aiLogs: mapLogs(s.aiLogs, taskId, (logs) => logs.map((l) => (l.id === logId ? { ...l, ...patch } : l))),
        })),

      appendAiLogText: (taskId, logId, text) =>
        set((s) => ({
          aiLogs: mapLogs(s.aiLogs, taskId, (logs) =>
            logs.map((l) => (l.id === logId ? { ...l, message: l.message + text } : l)),
          ),
        })),

      removeAiLog: (taskId, logId) =>
        set((s) => ({ aiLogs: mapLogs(s.aiLogs, taskId, (logs) => logs.filter((l) => l.id !== logId)) })),
    }),
    {
      name: UI_SETTINGS_KEY,
      version: UI_SETTINGS_VERSION,
      storage: safeStorage,
      // 保存するのは UI の設定だけ。タスク・メモ・ログ・メッセージなど DB で管理しているデータは含めない
      partialize: (state): UiSettings => ({
        searchQuery: state.searchQuery,
        sortBy: state.sortBy,
        statusFilter: state.statusFilter,
        activeContextTab: state.activeContextTab,
        selectedTaskId: state.selectedTaskId,
        chatModel: state.chatModel,
        theme: state.theme,
        categoryFilter: state.categoryFilter,
        leftWidth: state.leftWidth,
        rightWidth: state.rightWidth,
        collapsedSections: state.collapsedSections,
      }),
      // 保存されていた値は項目ごとに検証してから取り込む（壊れた値・古い形式で画面が壊れないように）
      merge: (persisted, current) => ({ ...current, ...sanitizeUiSettings(persisted) }),
      // 形式を変えたときの移行。UI 設定は失っても困らないので、古い版の値は捨てて既定値から始める
      migrate: () => DEFAULT_UI_SETTINGS,
    },
  ),
);

/** 選択中のタスク（未選択なら null） */
export const useSelectedTask = () =>
  useAppStore((s) => s.tasks.find((t) => t.id === s.selectedTaskId) ?? null);
