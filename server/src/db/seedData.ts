// 初回起動時に DB へ投入するサンプルデータ
import type { AiLog, Memo, MessageThread, Task } from "../../../shared/types";

export const mockTasks: Task[] = [
  {
    id: "task-1",
    title: "Q4ロードマップのドラフト作成",
    description: "経営会議向けにQ4のプロダクトロードマップ案をまとめる。",
    status: "active",
    category: "企画",
    createdAt: "2026-10-18T09:00:00+09:00",
    isPinned: false,
  },
  {
    id: "task-2",
    title: "ログイン画面のバグ調査",
    description: "Slackで報告された、Safariでログインできない問題を調査する。",
    status: "unread",
    category: "開発",
    createdAt: "2026-10-21T08:30:00+09:00",
    isPinned: false,
  },
  {
    id: "task-3",
    title: "週次定例のアジェンダ準備",
    description: "金曜の週次定例で話すトピックを整理して共有する。",
    status: "scheduled",
    category: "運用",
    createdAt: "2026-10-20T15:00:00+09:00",
    scheduledAt: "2026-10-24T10:00:00+09:00",
    isPinned: false,
  },
];

export const mockMemos: Record<string, Memo> = {
  "task-1": {
    taskId: "task-1",
    content: "## 方針\n- 新規ユーザー獲得よりも継続率の改善を優先\n- AI機能は2本に絞る\n\n## TODO\n- [ ] 競合調査の結果を反映",
    updatedAt: "2026-10-20T18:00:00+09:00",
  },
  "task-2": {
    taskId: "task-2",
    content: "再現環境: Safari 18 / macOS\nCookieのSameSite設定が怪しい？",
    updatedAt: "2026-10-21T08:45:00+09:00",
  },
};

export const mockAiLogs: Record<string, AiLog[]> = {
  "task-1": [
    {
      id: "log-1",
      taskId: "task-1",
      sender: "user",
      message: "メモの方針をもとに、ロードマップの章立てを作って",
      timestamp: "2026-10-20T18:05:00+09:00",
    },
    {
      id: "log-2",
      taskId: "task-1",
      sender: "ai",
      message: "以下の章立てを提案します。\n1. 現状の振り返り\n2. Q4の重点テーマ（継続率改善）\n3. AI機能2本の概要\n4. マイルストーン",
      timestamp: "2026-10-20T18:05:30+09:00",
      status: "done",
    },
  ],
  "task-2": [],
  "task-3": [
    {
      id: "log-3",
      taskId: "task-3",
      sender: "ai",
      message: "先週の議事録から未完了の項目を3件見つけました。アジェンダに追加しますか？",
      timestamp: "2026-10-20T15:10:00+09:00",
      status: "done",
    },
  ],
};

export const mockMessages: Record<string, MessageThread[]> = {
  "task-2": [
    {
      id: "msg-1",
      taskId: "task-2",
      source: "slack",
      sender: "佐藤",
      content: "Safariからログインしようとするとトップに戻されてしまいます…",
      timestamp: "2026-10-21T08:20:00+09:00",
    },
    {
      id: "msg-2",
      taskId: "task-2",
      source: "email",
      sender: "support@example.com",
      content: "同様の問い合わせが2件届いています。",
      timestamp: "2026-10-21T08:28:00+09:00",
    },
  ],
  "task-3": [
    {
      id: "msg-3",
      taskId: "task-3",
      source: "beeper",
      sender: "田中",
      content: "定例でリリース日程の件も話したいです",
      timestamp: "2026-10-20T14:50:00+09:00",
    },
  ],
};
