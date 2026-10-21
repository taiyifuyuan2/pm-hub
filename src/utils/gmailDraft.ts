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
