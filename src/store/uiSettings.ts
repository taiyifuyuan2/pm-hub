import { CHAT_MODELS, type ChatModelId } from "../../shared/agent";
import { SORT_OPTIONS, type SortBy, type StatusFilter } from "../features/tasks/filterTasks";
import type { ContextTab } from "../types";
import { PANEL_WIDTH, clampWidth } from "../utils/layout";

/** localStorage に保存するキー */
export const UI_SETTINGS_KEY = "pm-hub-ui-settings";
/** 保存形式を変えたときに上げる。古い形式は migrate で捨てる（UI 設定なので失っても困らない） */
export const UI_SETTINGS_VERSION = 1;

/** アプリを再起動しても保持する画面の状態。タスクやメモなどの DB のデータは含めない */
export interface UiSettings {
  /** タスク一覧の検索キーワード */
  searchQuery: string;
  sortBy: SortBy;
  statusFilter: StatusFilter;
  /** 右パネルのアクティブなタブ */
  activeContextTab: ContextTab;
  /** 選択中のタスクの ID。復元時に DB に存在しなければ、起動時に別のタスクへ切り替える（selection.ts） */
  selectedTaskId: string | null;
  /** チャットで使うモデル。null は Claude Code の既定 */
  chatModel: ChatModelId | null;
  /** テーマ。auto は OS の設定に従う */
  theme: ThemePreference;
  /** 上部バーのカテゴリタブで選んだカテゴリ。null はすべて */
  categoryFilter: string | null;
  /** 左右パネルの幅（px） */
  leftWidth: number;
  rightWidth: number;
  /** 折りたたんでいる一覧のセクション */
  collapsedSections: SectionKey[];
}

export type ThemePreference = "auto" | "light" | "dark";
export type SectionKey = "pinned" | "unread" | "active" | "scheduled" | "done";

export const DEFAULT_UI_SETTINGS: UiSettings = {
  searchQuery: "",
  sortBy: "created-desc",
  statusFilter: "all",
  activeContextTab: "memo",
  selectedTaskId: null,
  chatModel: null,
  theme: "auto",
  categoryFilter: null,
  leftWidth: PANEL_WIDTH.left.default,
  rightWidth: PANEL_WIDTH.right.default,
  // 完了したタスクは、普段は見えなくてよいので畳んでおく
  collapsedSections: ["done"],
};

const THEMES: readonly ThemePreference[] = ["auto", "light", "dark"];
const SECTION_KEYS: readonly SectionKey[] = ["pinned", "unread", "active", "scheduled", "done"];
const MAX_CATEGORY_LENGTH = 100;

const STATUS_FILTERS: readonly StatusFilter[] = ["all", "unread", "active", "scheduled", "done"];
const CONTEXT_TABS: readonly ContextTab[] = ["memo", "browser", "messages"];
/** 極端に長い値で localStorage や画面を圧迫しない */
const MAX_QUERY_LENGTH = 200;

/** サーバー側の taskId の規則（server/src/validation.ts）と同じ。これに合わない値は保存データの異常として捨てる */
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const oneOf = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/**
 * 保存されていた値（localStorage は誰でも書き換えられ、古い版の形式も残りうる）を検証して UI 設定に直す。
 * 項目ごとに検証し、不正な項目だけ既定値に戻す。
 */
export function sanitizeUiSettings(raw: unknown): UiSettings {
  const value = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    searchQuery:
      typeof value.searchQuery === "string"
        ? value.searchQuery.slice(0, MAX_QUERY_LENGTH)
        : DEFAULT_UI_SETTINGS.searchQuery,
    sortBy: oneOf(
      SORT_OPTIONS.map((o) => o.value),
      value.sortBy,
      DEFAULT_UI_SETTINGS.sortBy,
    ),
    statusFilter: oneOf(STATUS_FILTERS, value.statusFilter, DEFAULT_UI_SETTINGS.statusFilter),
    activeContextTab: oneOf(CONTEXT_TABS, value.activeContextTab, DEFAULT_UI_SETTINGS.activeContextTab),
    selectedTaskId:
      typeof value.selectedTaskId === "string" && TASK_ID_PATTERN.test(value.selectedTaskId)
        ? value.selectedTaskId
        : DEFAULT_UI_SETTINGS.selectedTaskId,
    // 許可リストにないモデル ID（古い版で保存された廃止モデルなど）は、既定に戻す
    chatModel: CHAT_MODELS.find((m) => m.id === value.chatModel)?.id ?? DEFAULT_UI_SETTINGS.chatModel,
    theme: oneOf(THEMES, value.theme, DEFAULT_UI_SETTINGS.theme),
    categoryFilter:
      typeof value.categoryFilter === "string" && value.categoryFilter.trim() !== ""
        ? value.categoryFilter.slice(0, MAX_CATEGORY_LENGTH)
        : DEFAULT_UI_SETTINGS.categoryFilter,
    leftWidth: clampWidth(value.leftWidth, PANEL_WIDTH.left.min, PANEL_WIDTH.left.max, DEFAULT_UI_SETTINGS.leftWidth),
    rightWidth: clampWidth(value.rightWidth, PANEL_WIDTH.right.min, PANEL_WIDTH.right.max, DEFAULT_UI_SETTINGS.rightWidth),
    // 配列でなければ既定、配列なら正しい項目だけを重複なく残す
    collapsedSections: Array.isArray(value.collapsedSections)
      ? SECTION_KEYS.filter((k) => (value.collapsedSections as unknown[]).includes(k))
      : DEFAULT_UI_SETTINGS.collapsedSections,
  };
}
