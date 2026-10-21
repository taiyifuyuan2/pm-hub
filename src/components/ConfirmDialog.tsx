import { useState, type ReactNode } from "react";
import { Modal, buttonClass } from "./Modal";

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** 失敗時は例外を投げる。メッセージをダイアログ内に表示する */
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  danger?: boolean;
}

export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose, danger }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title={title} width="max-w-sm">
      <div className="text-sm leading-relaxed text-muted">{children}</div>
      {error && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={buttonClass.ghost}>
          キャンセル
        </button>
        <button
          type="button"
          data-autofocus
          disabled={busy}
          onClick={confirm}
          className={danger ? buttonClass.danger : buttonClass.primary}
        >
          {busy ? "処理中…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
