// フロントエンドとローカルサーバーで共有するドメイン型。
// 日時はすべて ISO 8601 文字列で保持する（SQLite / JSON への永続化を想定）

export type TaskStatus = "unread" | "active" | "scheduled" | "done";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  category: string;
  createdAt: string;
  scheduledAt?: string;
  /** ピン留め。タスク一覧の最上部の「Pinned」セクションに独立して表示される */
  isPinned: boolean;
}

export interface Memo {
  taskId: string;
  /** Markdown 文字列 */
  content: string;
  updatedAt: string;
}

export type AiLogSender = "user" | "ai";
export type AiLogStatus = "pending" | "running" | "done" | "error";
/** text: 通常の発言 / tool: エージェントのツール実行ログ / permission: ツール実行の許可確認 */
export type AiLogKind = "text" | "tool" | "permission";

export type PermissionDecision = "allow" | "deny";

/** kind = "permission" のログに付く情報 */
export interface PermissionInfo {
  /** 応答時に POST /api/chat/permission へ渡すID */
  requestId: string;
  toolName: string;
  /** 実行コマンドやファイル内容などの詳細（長い場合は省略される） */
  detail?: string;
  /** 「このセッションでは常に許可」で登録される予定のルール（ラベル）。登録できない操作では undefined */
  suggestedRule?: string;
  /** 未回答なら undefined */
  decision?: PermissionDecision;
  /** 既存のルールに合致して自動で許可した */
  auto?: boolean;
  /** 自動許可に使った、または今回新しく登録したルール（ラベル） */
  rule?: string;
  /** 今回の回答で「常に許可」ルールを新規登録した */
  remembered?: boolean;
}

/** タスク（セッション）単位の許可ルール */
export interface PermissionRule {
  id: number;
  taskId: string;
  /** 一覧表示用。タスクが見つからない場合は空文字 */
  taskTitle: string;
  toolName: string;
  /** 対象の絞り込み（Bash: コマンドの先頭部分 / ファイル編集: ディレクトリ / 空文字: そのツールすべて） */
  pattern: string;
  /** 画面に出すルールの説明 */
  label: string;
  /** 登録日時（ISO 8601） */
  createdAt: string;
}

export interface AiLog {
  id: string;
  taskId: string;
  sender: AiLogSender;
  message: string;
  timestamp: string;
  status?: AiLogStatus;
  kind?: AiLogKind;
  permission?: PermissionInfo;
}

export type MessageSource = "slack" | "email" | "beeper" | "line" | "manual";

export interface MessageThread {
  id: string;
  taskId: string;
  source: MessageSource;
  sender: string;
  content: string;
  timestamp: string;
}

export type ContextTab = "memo" | "browser" | "messages";

/** Beeper 側で照合済みの送信先。名前だけでなく ID とサービス名も確認に使う。 */
export interface BeeperRecipient {
  id: string;
  title: string;
  network: string;
}

export interface BeeperRecipientInput {
  chat: string;
  chatID?: string;
  network?: string;
}

// ---------- 新着メッセージの自動タスク化 ----------

export interface WatchedChat {
  chatID: string;
  title: string;
  network: string;
}

/** サーバーが自動でやったこと。画面は、これを見て一覧を更新し、新着を知らせる */
export interface AutoTaskEvent {
  id: number;
  /** created: 新しいタスク / updated: 既存のタスクに新着 / draft: 返信案ができた */
  kind: "created" | "updated" | "draft";
  taskId: string;
  title: string;
}

export interface InboxResponse {
  events: AutoTaskEvent[];
  lastEventId: number;
  watched: WatchedChat[];
  paused: boolean;
}
