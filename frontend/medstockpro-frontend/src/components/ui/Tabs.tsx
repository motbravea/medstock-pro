import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

type Tab = {
  key: string;
  label: ReactNode;
  count?: number;
};

type TabsProps = {
  tabs: Tab[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
};

export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-subtle bg-muted p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "text-default"
                : "text-muted hover:text-default",
            )}
          >
            {active && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-lg bg-surface shadow-card"
                transition={{ duration: 0.18, ease: "easeOut" }}
              />
            )}
            <span className="relative">{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "relative inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular",
                  active
                    ? "bg-[var(--color-brand-700)] text-white"
                    : "bg-surface text-muted",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
