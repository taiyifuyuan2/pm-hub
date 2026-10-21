import path from "node:path";

export type ToolInput = Record<string, unknown> | undefined;

/** 保存されるルール。pattern は ToolName ごとに意味が異なる */
export interface RuleSpec {
  toolName: string;
  pattern: string;
}

/** 「このセッション中すべて許可」を表す特別なツール名。どのツールの要求にも合致する */
export const ALLOW_ALL_TOOL = "*";

const isWindows = process.platform === "win32";

const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
const FILE_TOOLS: Record<string, string> = {
  Write: "file_path",
  Edit: "file_path",
  MultiEdit: "file_path",
  NotebookEdit: "notebook_path",
};

/** セッション単位でも自動許可してはいけないコマンド（削除・フォーマット・権限昇格など） */
const DANGEROUS_PROGRAMS = new Set([
  "rm", "rmdir", "rd", "del", "erase", "remove-item", "ri",
  "format", "mkfs", "dd", "shutdown", "reboot", "sudo", "su",
  "chmod", "chown", "icacls", "takeown", "reg", "net", "taskkill", "kill",
  "powershell", "pwsh", "cmd", "bash", "sh", "iex", "invoke-expression", "eval", "curl", "wget",
]);

/** コマンドの連結・リダイレクト・置換。これらを含むコマンドは先頭の語だけでは安全性を判断できない */
const SHELL_CONTROL = /[;&|`<>\n\r]|\$\(|\$\{/;

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

function normalizePath(p: string) {
  const resolved = path.resolve(p);
  return isWindows ? resolved.toLowerCase() : resolved;
}

function shellPrefix(command: string): string | undefined {
  if (SHELL_CONTROL.test(command)) return undefined;
  const tokens = command.trim().split(/\s+/);
  const program = tokens[0]?.toLowerCase();
  if (!program || DANGEROUS_PROGRAMS.has(program)) return undefined;
  // "git status" のようにサブコマンドまでを対象にする（"-" で始まる語はオプションなので含めない）
  const sub = tokens[1];
  return sub && !sub.startsWith("-") ? `${tokens[0]} ${sub}` : tokens[0];
}

/**
 * 「このセッションでは常に許可」で登録するルールを、許可要求の内容から導く。
 * 安全に一般化できない操作（連結されたコマンド、削除系など）は undefined を返し、毎回確認する。
 */
export function deriveRule(toolName: string, input: ToolInput): RuleSpec | undefined {
  if (SHELL_TOOLS.has(toolName)) {
    const command = str(input?.command);
    const prefix = command ? shellPrefix(command) : undefined;
    return prefix ? { toolName, pattern: prefix } : undefined;
  }

  const pathKey = FILE_TOOLS[toolName];
  if (pathKey) {
    const file = str(input?.[pathKey]);
    // 相対パスや空の値からは対象ディレクトリを特定できないため登録しない
    return file && path.isAbsolute(file) ? { toolName, pattern: path.dirname(path.resolve(file)) } : undefined;
  }

  // それ以外のツール（WebFetch など）はツール名単位
  return { toolName, pattern: "" };
}

/** 登録済みルールが、この許可要求に当てはまるか */
export function matchesRule(rule: RuleSpec, toolName: string, input: ToolInput): boolean {
  if (rule.toolName === ALLOW_ALL_TOOL) return true;
  if (rule.toolName !== toolName) return false;

  if (SHELL_TOOLS.has(toolName)) {
    const command = str(input?.command)?.trim();
    if (!command || !rule.pattern || SHELL_CONTROL.test(command)) return false;
    // 登録時と同じ規則で先頭部分を取り出して比較する（"git status" ルールが "git statusx" に合致しないように）
    return shellPrefix(command)?.toLowerCase() === rule.pattern.toLowerCase();
  }

  if (FILE_TOOLS[toolName]) {
    const file = str(input?.[FILE_TOOLS[toolName]]);
    if (!file || !path.isAbsolute(file) || !rule.pattern) return false;
    const dir = normalizePath(rule.pattern);
    const target = normalizePath(file); // path.resolve で ".." が解決された後に比較する
    return target.startsWith(dir + path.sep);
  }

  return rule.pattern === "";
}

/** 画面に出すルールの説明 */
export function ruleLabel(rule: RuleSpec): string {
  if (rule.toolName === ALLOW_ALL_TOOL) return "すべてのツール（確認なしで許可）";
  if (SHELL_TOOLS.has(rule.toolName)) return `${rule.toolName}: ${rule.pattern} …`;
  if (FILE_TOOLS[rule.toolName]) return `${rule.toolName}: ${rule.pattern} 配下のファイル`;
  return `${rule.toolName}（すべて）`;
}
