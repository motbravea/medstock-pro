import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import { CountUp } from "./CountUp";

export type StatTone = "neutral" | "success" | "warning" | "danger" | "brand";

const toneRing: Record<StatTone, string> = {
  neutral: "text-slate-700 dark:text-slate-200",
  brand: "text-[var(--color-brand-700)] dark:text-[var(--color-brand-300)]",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
};

const iconBg: Record<StatTone, string> = {
  neutral: "bg-muted text-muted",
  brand:
    "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)]/40 dark:text-[var(--color-brand-300)]",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

type StatCardProps = {
  label: string;
  value: number;
  tone?: StatTone;
  icon?: LucideIcon;
  helper?: string;
  delta?: { value: number; positive: boolean } | null;
  index?: number;
};

export function StatCard({
  label,
  value,
  tone = "neutral",
  icon: Icon,
  helper,
  delta,
  index = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay: index * 0.04 }}
      className="group rounded-xl border border-subtle bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-px hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {label}
          </p>
          <div
            className={cn(
              "mt-2 text-3xl font-semibold tabular tracking-tight",
              toneRing[tone],
            )}
          >
            <CountUp value={value} />
          </div>
        </div>

        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              iconBg[tone],
            )}
          >
            <Icon size={18} strokeWidth={1.6} />
          </div>
        )}
      </div>

      {(helper || delta) && (
        <div className="mt-3 flex items-center justify-between text-xs">
          {helper && <p className="text-muted">{helper}</p>}
          {delta && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium tabular",
                delta.positive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
              )}
            >
              {delta.positive ? "+" : ""}
              {delta.value}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
