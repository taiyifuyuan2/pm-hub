import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { memosRepo, messagesRepo, tasksRepo } from "../db/repositories";
import { describeNow } from "../google/calendar";
import { getFreeSlots } from "../google/google";

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

## LINE・Slack など（Beeper）への返事を頼まれたとき

次の書式で出力してください。「Beeper の下書きに入れる」ボタンが出て、押すと相手とのチャットの入力欄に文面が入ります（送信はされません）。

\`\`\`beeper-draft
chat: チャットの名前（上のメッセージにある【】の中の名前）
---
送る文面
\`\`\`

- 文面は、これまでのやり取りの口調に合わせる。
- 「いつ空いてる？」のように日程を聞かれたら、上の「空き時間」から具体的な候補を 2〜3 個挙げる。カレンダー未接続のときは、本文に書かず、先にユーザーへ質問する。
- 日時以外でも、金額など事実の確認が必要な点があれば、本文には書かず、先にユーザーへ質問する。
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

  let availability: string | null = null;
  try {
    availability = await getFreeSlots();
  } catch {
    // カレンダーを読めなくても、ほかの文脈は渡す
  }

  const lines = [
    `# タスク: ${task.title}`,
    "",
    `状態: ${task.status} / カテゴリ: ${task.category}${task.project ? ` / プロジェクト: ${task.project}` : ""}`,
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
    `## 空き時間（Google カレンダー・現在 ${describeNow(Date.now())}）`,
    availability ?? "(カレンダー未接続、または読めませんでした)",
    "",
    DRAFT_RULES,
  ];

  const dir = path.join(cwd, "context");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "pm-hub.md"), lines.join("\n"), "utf8");
  return "（PM Hub: このタスクのメモ・メッセージ・返信文の書式は context/pm-hub.md にあります。必要なときに読んでください）";
}
