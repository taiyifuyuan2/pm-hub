export interface ViceTaskProposal {
  title: string;
  category: string;
  description: string;
  /** YYYY-MM-DD。期限未定なら省略 */
  scheduledOn?: string;
}

const MAX_PROPOSALS = 5;
const MAX_FIELD_LENGTH = 500;

/** Vice が返す ```vice-tasks JSON を、安全にローカルのタスク候補へ変換する。 */
export function parseViceTaskProposals(source: string): ViceTaskProposal[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.trim());
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_PROPOSALS) return null;

  const proposals: ViceTaskProposal[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    const category = typeof candidate.category === "string" ? candidate.category.trim() : "";
    const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
    const scheduledOn = typeof candidate.scheduledOn === "string" ? candidate.scheduledOn.trim() : undefined;
    if (!title || title.length > MAX_FIELD_LENGTH || category.length > MAX_FIELD_LENGTH || description.length > MAX_FIELD_LENGTH) return null;
    if (scheduledOn && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledOn)) return null;
    proposals.push({ title, category: category || "未分類", description, ...(scheduledOn ? { scheduledOn } : {}) });
  }
  return proposals;
}
