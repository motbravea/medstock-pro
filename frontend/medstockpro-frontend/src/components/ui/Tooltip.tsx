import { useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type TooltipProps = {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "right" | "left";
};

const sideClasses: Record<string, string> = {
  top: "-top-2 left-1/2 -translate-x-1/2 -translate-y-full",
  bottom: "-bottom-2 left-1/2 -translate-x-1/2 translate-y-full",
  right: "-right-2 top-1/2 -translate-y-1/2 translate-x-full",
  left: "-left-2 top-1/2 -translate-y-1/2 -translate-x-full",
};

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12, delay: 0.05 }}
            className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg dark:bg-slate-800 ${sideClasses[side]}`}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
