import { useToastStore, type Toast } from "../store/toastStore";
import { Icon, type IconName } from "./Icon";

const KIND_STYLE: Record<Toast["kind"], { icon: IconName; tone: string }> = {
  info: { icon: "info", tone: "text-info" },
  success: { icon: "check", tone: "text-new" },
  error: { icon: "alert", tone: "text-bad" },
};

/** 画面の右下に積まれるトースト。操作を邪魔せず、数秒で消える。エラーは読み上げツールにも即座に伝える */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed bottom-12 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      aria-label="通知"
    >
      {toasts.map((t) => {
        const { icon, tone } = KIND_STYLE[t.kind];
        return (
          <div
            key={t.id}
            // エラーは assertive（すぐ読み上げ）、それ以外は polite（今の読み上げを待って）
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex animate-pop items-start gap-2.5 rounded-lg border border-line-strong bg-raised px-3 py-2.5 text-sm text-fg shadow-pop"
          >
            <Icon name={icon} size={16} className={`mt-0.5 shrink-0 ${tone}`} />
            <p className="min-w-0 flex-1 break-words leading-snug">{t.message}</p>
            {t.action && (
              <button
                onClick={() => {
                  dismiss(t.id);
                  t.action?.onClick();
                }}
                className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-info hover:bg-hover"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="通知を閉じる"
              className="shrink-0 rounded p-0.5 text-subtle hover:bg-hover hover:text-fg"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
