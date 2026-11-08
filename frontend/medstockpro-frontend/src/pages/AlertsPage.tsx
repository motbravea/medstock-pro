import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { alertService } from "../services/alertService";
import { useAuthStore } from "../stores/authStore";
import { toast } from "../stores/toastStore";
import { ApiError } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { SeverityBadge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { relativeFromNow } from "../lib/format";
import type { Alert, Severity } from "../types";

type View = "active" | "all";

export function AlertsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === "Admin");
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("active");

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts", view],
    queryFn: () => (view === "active" ? alertService.active() : alertService.all()),
    enabled: view === "active" || isAdmin,
  });

  const grouped = useMemo(() => {
    const groups: Record<Severity, Alert[]> = {
      Critical: [],
      Warning: [],
      Info: [],
    };
    for (const alert of alerts) {
      (groups[alert.severity] ?? groups.Info).push(alert);
    }
    return groups;
  }, [alerts]);

  const markRead = useMutation({
    mutationFn: (id: number) => alertService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const resolve = useMutation({
    mutationFn: (id: number) => alertService.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Alert resolved");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Failed";
      toast.error("Failed", message);
    },
  });

  const triggerScan = useMutation({
    mutationFn: () => alertService.checkAll(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      const parts: string[] = [`Scanned ${data.productsScanned} products`];
      if (data.lowStockCreated > 0)
        parts.push(`${data.lowStockCreated} new low-stock`);
      if (data.lowStockResolved > 0)
        parts.push(`${data.lowStockResolved} resolved`);
      toast.success("Alert scan complete", parts.join(" · "));
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Scan failed";
      toast.error("Scan failed", message);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="Alerts"
        description="Low stock and expiry alerts grouped by severity."
        actions={
          <div className="flex items-center gap-2">
            <Tabs
              value={view}
              onChange={(key) => setView(key as View)}
              tabs={[
                { key: "active", label: "Active" },
                { key: "all", label: "All", count: 0 },
              ]}
            />
            {isAdmin && (
              <Button
                variant="secondary"
                leadingIcon={<RefreshCw size={14} />}
                onClick={() => triggerScan.mutate()}
                loading={triggerScan.isPending}
              >
                Check alerts now
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={20} />}
          title={view === "active" ? "Nothing to action" : "No alerts on file"}
          description="The inventory is in a stable state."
        />
      ) : (
        <div className="space-y-6">
          <AlertGroup
            title="Critical"
            description="Expired stock — handle immediately."
            severity="Critical"
            icon={AlertTriangle}
            alerts={grouped.Critical}
            isAdmin={isAdmin}
            onRead={(id) => markRead.mutate(id)}
            onResolve={(id) => resolve.mutate(id)}
          />
          <AlertGroup
            title="Warning"
            description="Low stock and items expiring soon."
            severity="Warning"
            icon={Clock}
            alerts={grouped.Warning}
            isAdmin={isAdmin}
            onRead={(id) => markRead.mutate(id)}
            onResolve={(id) => resolve.mutate(id)}
          />
          <AlertGroup
            title="Info"
            description="Reference notifications."
            severity="Info"
            icon={Bell}
            alerts={grouped.Info}
            isAdmin={isAdmin}
            onRead={(id) => markRead.mutate(id)}
            onResolve={(id) => resolve.mutate(id)}
          />
        </div>
      )}
    </div>
  );
}

function AlertGroup({
  title,
  description,
  severity,
  icon: Icon,
  alerts,
  isAdmin,
  onRead,
  onResolve,
}: {
  title: string;
  description: string;
  severity: Severity;
  icon: ComponentType<{ size?: number; className?: string }>;
  alerts: Alert[];
  isAdmin: boolean;
  onRead: (id: number) => void;
  onResolve: (id: number) => void;
}) {
  if (alerts.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={15} className="text-muted" />
        <h2 className="text-sm font-semibold text-default">{title}</h2>
        <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium tabular text-muted">
          {alerts.length}
        </span>
        <p className="ml-1 text-xs text-muted">· {description}</p>
      </div>

      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: i * 0.02 }}
          >
            <Card padded={false} hoverable>
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-default">
                      {alert.productName || "Product alert"}
                    </p>
                    <SeverityBadge severity={severity} />
                    {alert.isResolved && (
                      <span className="rounded-full border border-subtle bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                        Resolved
                      </span>
                    )}
                    {!alert.isRead && (
                      <span className="rounded-full bg-[var(--color-brand-700)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {alert.message}
                  </p>
                  <p className="mt-1 text-[11px] text-subtle">
                    {relativeFromNow(alert.createdAt)} · {alert.alertType}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!alert.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Check size={13} />}
                      onClick={() => onRead(alert.id)}
                    >
                      Read
                    </Button>
                  )}
                  {isAdmin && !alert.isResolved && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onResolve(alert.id)}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
