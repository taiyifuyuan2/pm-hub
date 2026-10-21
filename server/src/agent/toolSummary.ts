type ToolInput = Record<string, unknown> | undefined;

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** ツール入力の1行要約（対象ファイル・コマンドなど） */
export function summarizeToolInput(input: ToolInput): string {
  if (!input) return "";
  const value =
    input.file_path ?? input.command ?? input.pattern ?? input.url ?? input.query ?? input.description ?? input.path;
  return truncate(typeof value === "string" ? value : JSON.stringify(input), 160);
}

/** 許可確認カードに出す詳細（何が実行・変更されるのかを判断できる内容） */
export function describeToolInput(toolName: string, input: ToolInput): string | undefined {
  if (!input) return undefined;
  switch (toolName) {
    case "Bash":
    case "PowerShell":
      return str(input.command);
    case "Write":
      return str(input.content) !== undefined ? truncate(str(input.content)!, 2000) : undefined;
    case "Edit":
      return `- ${truncate(str(input.old_string) ?? "", 1000)}\n+ ${truncate(str(input.new_string) ?? "", 1000)}`;
    default:
      return truncate(JSON.stringify(input, null, 2), 2000);
  }
}
