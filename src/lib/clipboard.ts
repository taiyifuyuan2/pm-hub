import { toast } from "../store/toastStore";

/**
 * テキストをクリップボードへコピーする。成功すれば true。
 * 失敗（権限がない・フォーカスがない等）したときは、トーストで知らせて false を返す。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 古い環境向けの代替。一時的な入力欄にテキストを入れて選択し、コピーコマンドを使う
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (ok) return true;
    } catch {
      /* 下でまとめて通知する */
    }
    toast.error("コピーできませんでした。");
    return false;
  }
}
