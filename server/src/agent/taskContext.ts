import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { memosRepo, messagesRepo, tasksRepo } from "../db/repositories";

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 2000;

const SOURCE_LABEL: Record<string, string> = {
  slack: "Slack",
  email: "メール",
  beeper: "Beeper",
  line: "LINE",
  manual: "手入力",
};

const DRAFT_RULES = `## メールの返信・下書きを頼まれたとき

返信文を書くときは、次の書式のコードブロックで出力してください。
PM Hub の画面に「Gmail の下書きに保存」ボタンが出ます。送信はされません（ユーザーが Gmail で確認して送ります）。

\`\`\`gmail-draft
to: 宛先のメールアドレス
subject: 件名
---
本文
\`\`\`

- to は上のメッセージにある相手のメールアドレスを使う。分からなければ空にして、ユーザーに確認する。
- 返信なら subject は「Re: 元の件名」にする。
- LINE などメール以外への返事は、コードブロックを使わず、そのまま貼れる文面だけを書く。
- 下書きの内容に事実の確認が必要な点（日時・金額など）があれば、本文には書かず、先にユーザーへ質問する。
`;

/**
 * このタスクのメモ・メッセージを作業フォルダの context/pm-hub.md に書き出す。
 * エージェントはこれを読んで、メールや LINE の内容を踏まえた返信文を作る。
 * 返り値は、ユーザーの指示の前に付けるヒント（ファイルの場所を知らせる 1 行）。
 */
export async function writeTaskContext(taskId: string, cwd: string): Promise<string | null> {
  const task = tasksRepo.get(taskId);
  if (!task) return null;
  const memo = memosRepo.all()[taskId]?.content?.trim();
  const messages = (messagesRepo.allByTask()[taskId] ?? []).slice(-MAX_MESSAGES);

  const lines = [
    `# タスク: ${task.title}`,
    "",
    `状態: ${task.status} / カテゴリ: ${task.category}`,
    task.description ? `\n${task.description}` : "",
    "",
    "## メモ",
    memo || "(なし)",
    "",
    `## メッセージ（新しい順ではなく古い順・最大 ${MAX_MESSAGES} 件）`,
    ...(messages.length === 0
      ? ["(なし)"]
      : messages.map(
          (m) =>
            `### ${SOURCE_LABEL[m.source] ?? m.source} / ${m.sender} / ${m.timestamp}\n${m.content.slice(0, MAX_MESSAGE_CHARS)}`,
        )),
    "",
    DRAFT_RULES,
  ];

  const dir = path.join(cwd, "context");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "pm-hub.md"), lines.join("\n"), "utf8");
  return "（PM Hub: このタスクのメモ・メッセージ・返信文の書式は context/pm-hub.md にあります。必要なときに読んでください）";
}
