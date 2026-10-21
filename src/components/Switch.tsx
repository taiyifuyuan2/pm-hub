interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** オン / オフの切り替え。色だけでなく、つまみの位置でも状態が分かる */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${checked ? "bg-ink" : "bg-line-strong"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-canvas shadow-sm transition-transform duration-150 ${checked ? "translate-x-4" : ""}`}
      />
    </button>
  );
}
