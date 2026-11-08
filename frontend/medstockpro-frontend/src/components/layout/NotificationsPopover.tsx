import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { alertService } from "../../services/alertService";
import { useUIStore } from "../../stores/uiStore";
import { Badge, SeverityBadge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { relativeFromNow } from "../../lib/format";
import { playSound } from "../../lib/sound";

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const setRoute = useUIStore((s) => s.setRoute);

  const { data: unread = [] } = useQuery({
    queryKey: ["alerts", "unread"],
    queryFn: alertService.unread,
    refetchInterval: 30_000,
  });

  // Track the previous unread count so we only beep when a NEW alert arrives,
  // not when the user clears one. The first observation is recorded without
  // playing (otherwise login would always beep on hydration).
  const lastSeenCount = useRef<number | null>(null);
  useEffect(() => {
    const current = unread.length;
    if (lastSeenCount.current === null) {
      lastSeenCount.current = current;
      return;
    }
    if (current > lastSeenCount.current) {
      playSound("notify");
    }
    lastSeenCount.current = current;
  }, [unread.length]);

  const markRead = useMutation({
    mutationFn: (id: number) => alertService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-subtle bg-surface text-muted transition hover:bg-muted hover:text-default"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-12 z-40 w-[380px] overflow-hidden rounded-xl border border-subtle bg-surface shadow-pop"
          >
            <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-default">
                  Notifications
                </p>
                <p className="text-xs text-muted">
                  {unread.length === 0
                    ? "You're all caught up"
                    : `${unread.length} unread alert${unread.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <Badge tone="brand">{unread.length}</Badge>
            </div>

            <div className="max-h-[420px] overflow-y-auto scroll-slim">
              {unread.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-muted">No unread alerts</p>
                  <p className="mt-1 text-xs text-subtle">
                    Active alerts will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[color:var(--border)]">
                  {unread.map((alert) => (
                    <li key={alert.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-default">
                              {alert.productName || "Product alert"}
                            </p>
                            <SeverityBadge severity={alert.severity} />
                          </div>
                          <p className="mt-1 text-xs text-muted leading-relaxed">
                            {alert.message}
                          </p>
                          <p className="mt-1 text-[11px] text-subtle">
                            {relativeFromNow(alert.createdAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => markRead.mutate(alert.id)}
                          className="shrink-0 rounded-md p-1 text-subtle hover:bg-muted hover:text-default transition"
                          aria-label="Mark as read"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-subtle px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setRoute("alerts");
                }}
                className="w-full justify-center"
              >
                View all alerts
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
