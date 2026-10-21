export interface BeeperDraft {
  chat: string;
  /** チャットの ID（自動で作った返信案にだけ入る）。あれば名前より優先して使う */
  id?: string;
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
  let id: string | undefined;
  for (const line of lines.slice(0, sep)) {
    const m = /^\s*(chat|id)\s*[:：]\s*(.*)$/i.exec(line);
    if (!m) continue;
    if (m[1].toLowerCase() === "chat") chat = m[2].trim();
    else id = m[2].trim() || undefined;
  }
  const body = lines.slice(sep + 1).join("\n").trim();
  return chat && body ? { chat, ...(id ? { id } : {}), text: body } : null;
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
