import { useEffect } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  hideClose?: boolean;
};

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              className={cn(
                "relative w-full overflow-hidden rounded-2xl border border-subtle bg-surface shadow-pop",
                sizeClasses[size],
              )}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {(title || description || !hideClose) && (
                <div className="flex items-start justify-between gap-4 border-b border-subtle px-5 py-4">
                  <div className="min-w-0">
                    {title && (
                      <h3 className="text-sm font-semibold text-default">
                        {title}
                      </h3>
                    )}
                    {description && (
                      <p className="mt-1 text-xs text-muted">{description}</p>
                    )}
                  </div>
                  {!hideClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-muted hover:text-default transition"
                      aria-label="Close"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
              <div className="max-h-[70vh] overflow-y-auto px-5 py-4 scroll-slim">
                {children}
              </div>
              {footer && (
                <div className="flex justify-end gap-2 border-t border-subtle bg-muted px-5 py-3">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
