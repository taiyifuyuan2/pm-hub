export interface ViceTaskProposal {
  title: string;
  category: string;
  description: string;
  project?: string;
  assignee?: "me" | "ai" | "vice";
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
    const project = typeof candidate.project === "string" ? candidate.project.trim() : undefined;
    const assignee = candidate.assignee;
    if (!title || title.length > MAX_FIELD_LENGTH || category.length > MAX_FIELD_LENGTH || description.length > MAX_FIELD_LENGTH) return null;
    if (scheduledOn && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledOn)) return null;
    if (project && project.length > MAX_FIELD_LENGTH) return null;
    if (assignee !== undefined && assignee !== "me" && assignee !== "ai" && assignee !== "vice") return null;
    proposals.push({ title, category: category || "未分類", description, ...(project ? { project } : {}), ...(assignee ? { assignee } : {}), ...(scheduledOn ? { scheduledOn } : {}) });
  }
  return proposals;
}
