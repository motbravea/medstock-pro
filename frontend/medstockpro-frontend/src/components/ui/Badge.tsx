import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { Severity } from "../../types";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "brand";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted border-subtle",
  brand:
    "bg-[var(--color-brand-50)] text-[var(--color-brand-800)] border-[var(--color-brand-100)] " +
    "dark:bg-[var(--color-brand-900)]/40 dark:text-[var(--color-brand-200)] dark:border-[var(--color-brand-700)]",
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  warning:
    "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  danger:
    "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  info: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      )}
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone: BadgeTone =
    severity === "Critical"
      ? "danger"
      : severity === "Warning"
        ? "warning"
        : "info";
  return (
    <Badge tone={tone} dot>
      {severity}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: "Admin" | "Staff" }) {
  return (
    <Badge tone={role === "Admin" ? "brand" : "neutral"}>{role}</Badge>
  );
}

export function StockBadge({
  current,
  minimum,
}: {
  current: number;
  minimum: number;
}) {
  let tone: BadgeTone = "success";
  let label = "Healthy";
  if (current <= 0) {
    tone = "danger";
    label = "Out";
  } else if (current <= minimum) {
    tone = "warning";
    label = "Low";
  }
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
