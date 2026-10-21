export interface BeeperDraft {
  chat: string;
  text: string;
}

/**
 * ```beeper-draft ブロックの中身を読む。
 *   chat: チャットの名前
 *   ---
 *   文面
 */
export function parseBeeperDraft(text: string): BeeperDraft | null {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  if (sep === -1) return null;
  let chat = "";
  for (const line of lines.slice(0, sep)) {
    const m = /^\s*chat\s*[:：]\s*(.*)$/i.exec(line);
    if (m) chat = m[1].trim();
  }
  const body = lines.slice(sep + 1).join("\n").trim();
  return chat && body ? { chat, text: body } : null;
}

export interface GmailDraft {
  to: string;
  subject: string;
  body: string;
}

/**
 * AI が出力する ```gmail-draft ブロックの中身を読む。
 *   to: ...
 *   subject: ...
 *   ---
 *   本文
 * 区切り（---）がなければ null（下書きとして扱わない）
 */
export function parseGmailDraft(text: string): GmailDraft | null {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  if (sep === -1) return null;
  const header: Record<string, string> = {};
  for (const line of lines.slice(0, sep)) {
    const m = /^\s*(to|subject)\s*[:：]\s*(.*)$/i.exec(line);
    if (m) header[m[1].toLowerCase()] = m[2].trim();
  }
  const body = lines.slice(sep + 1).join("\n").trim();
  if (!body) return null;
  return { to: header.to ?? "", subject: header.subject ?? "", body };
}
