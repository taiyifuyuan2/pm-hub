import { Modal } from "../Modal";
import { SHORTCUTS } from "../../lib/shortcuts";

/** キーボードショートカットの一覧 */
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} title="キーボードショートカット" width="max-w-md">
      <ul className="-mt-1 divide-y divide-line">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span className="text-muted">{s.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {s.keys.map((k, i) => (
                <span key={`${k}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <span className="text-xs text-subtle">+</span>}
                  <kbd className="min-w-6 rounded-md border border-line-strong bg-hover px-1.5 py-0.5 text-center font-sans text-xs font-medium text-fg shadow-[0_1px_0_var(--c-line-strong)]">
                    {k}
                  </kbd>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-subtle">Mac では Ctrl の代わりに ⌘ も使えます。</p>
    </Modal>
  );
}
