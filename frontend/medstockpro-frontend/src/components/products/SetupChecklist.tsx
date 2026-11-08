import { motion } from "framer-motion";
import { Check, Circle, X } from "lucide-react";
import type { SetupStatus } from "../../types";
import { cn } from "../../lib/cn";

type Props = {
  setup: Omit<SetupStatus, "productId" | "productName"> | SetupStatus;
};

const items: { key: keyof SetupStatus["missingItems"]; label: string }[] = [
  { key: "photo", label: "Photo uploaded" },
  { key: "internalBarcode", label: "Internal barcode generated" },
  { key: "category", label: "Category assigned" },
  { key: "supplier", label: "Supplier assigned" },
  { key: "minimumStock", label: "Minimum stock set" },
  { key: "expirySettings", label: "Expiry settings configured" },
];

export function SetupChecklist({ setup }: Props) {
  const total = items.length;
  const done = items.filter((item) => !setup.missingItems[item.key]).length;
  const ready = setup.isReady;

  return (
    <div className="rounded-2xl border border-subtle bg-muted p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Setup completeness
          </p>
          <p className="mt-0.5 text-sm font-semibold text-default">
            {done} of {total} steps done
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            ready
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
          )}
        >
          {ready ? "Complete" : "Incomplete"}
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(done / total) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            ready ? "bg-emerald-500" : "bg-[var(--color-brand-600)]",
          )}
        />
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => {
          const missing = setup.missingItems[item.key];
          return (
            <li key={item.key} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full",
                  missing
                    ? "bg-surface text-muted border border-subtle"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-200",
                )}
              >
                {missing ? <Circle size={10} /> : <Check size={12} />}
              </span>
              <span
                className={cn(
                  missing ? "text-muted" : "text-default font-medium",
                )}
              >
                {item.label}
              </span>
              {missing && (
                <span className="ml-auto text-[10px] uppercase tracking-wide text-amber-600">
                  <X size={11} className="inline" /> missing
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
