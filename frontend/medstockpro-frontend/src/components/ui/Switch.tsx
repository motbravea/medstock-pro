import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  description?: string;
  disabled?: boolean;
  id?: string;
};

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: SwitchProps) {
  const inputId = id ?? `switch-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex items-start gap-3",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-brand",
          checked
            ? "bg-[var(--color-brand-700)]"
            : "bg-[var(--border-strong)]",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow transition-transform duration-150",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
      {(label || description) && (
        <div className="-mt-0.5">
          {label && (
            <div className="text-sm font-medium text-default">{label}</div>
          )}
          {description && (
            <p className="text-xs text-muted">{description}</p>
          )}
        </div>
      )}
    </label>
  );
}
