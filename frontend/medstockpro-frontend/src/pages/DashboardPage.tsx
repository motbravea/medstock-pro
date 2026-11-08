import { useState } from "react";
import type { FormEvent } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock,
  PackageSearch,
  ScanBarcode,
  TrendingDown,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { dashboardService } from "../services/dashboardService";
import { productService } from "../services/productService";
import { ApiError } from "../lib/api";
import { useUIStore } from "../stores/uiStore";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { Skeleton } from "../components/ui/Skeleton";
import { Badge, SeverityBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Avatar } from "../components/ui/Avatar";
import { Input } from "../components/ui/Input";
import { formatTime, relativeFromNow } from "../lib/format";
import type { ScanResult } from "../types";

const chartColors = ["#0F766E", "#14B8A6", "#0EA5E9", "#6366F1", "#F59E0B", "#EF4444"];

export function DashboardPage() {
  const setRoute = useUIStore((s) => s.setRoute);

  const [summary, urgent, recent, topUsed, categoryConsumption] = useQueries({
    queries: [
      { queryKey: ["dashboard", "summary"], queryFn: dashboardService.summary },
      { queryKey: ["dashboard", "urgent"], queryFn: dashboardService.urgent },
      {
        queryKey: ["dashboard", "recent"],
        queryFn: dashboardService.recentMovements,
      },
      {
        queryKey: ["dashboard", "topUsed"],
        queryFn: dashboardService.topUsedProducts,
      },
      {
        queryKey: ["dashboard", "categoryConsumption"],
        queryFn: dashboardService.categoryConsumption,
      },
    ],
  });

  const isLoading = summary.isLoading || urgent.isLoading || recent.isLoading;
  const hasError = summary.error;

  if (hasError) {
    const message =
      hasError instanceof ApiError ? hasError.message : "Failed to load.";
    return (
      <Card>
        <div className="flex items-start gap-3 text-red-700 dark:text-red-300">
          <AlertTriangle size={18} />
          <div>
            <p className="text-sm font-semibold">Couldn't load dashboard</p>
            <p className="text-xs text-muted">{message}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinic overview"
        title="Inventory dashboard"
        description="A quick view of stock, alerts, usage, and urgent actions."
        actions={
          <Button
            variant="primary"
            leadingIcon={<ScanBarcode size={16} />}
            onClick={() => setRoute("scan")}
          >
            Scan a product
          </Button>
        }
      />

      {/* Stat grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            index={0}
            label="Total products"
            value={summary.data?.totalProducts ?? 0}
            tone="brand"
            icon={Boxes}
            helper="Active inventory items"
          />
          <StatCard
            index={1}
            label="Low stock"
            value={summary.data?.lowStockCount ?? 0}
            tone={summary.data?.lowStockCount ? "warning" : "success"}
            icon={TrendingDown}
            helper="At or below minimum"
          />
          <StatCard
            index={2}
            label="Expiring soon"
            value={summary.data?.expiringSoonCount ?? 0}
            tone={summary.data?.expiringSoonCount ? "warning" : "success"}
            icon={Clock}
            helper={`+${summary.data?.expiredCount ?? 0} already expired`}
          />
          <StatCard
            index={3}
            label="Used today"
            value={summary.data?.usedTodayCount ?? 0}
            tone="brand"
            icon={Activity}
            helper={`${summary.data?.usedThisMonthCount ?? 0} this month`}
          />
        </div>
      )}

      {/* Main grid: urgent + quick scan */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Urgent actions"
            description="Critical and warning alerts that need attention."
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRoute("alerts")}
                trailingIcon={<ArrowRight size={14} />}
              >
                View all
              </Button>
            }
          />

          {urgent.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (urgent.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Activity size={20} />}
              title="All clear"
              description="No urgent items. Inventory is stable."
            />
          ) : (
            <ul className="space-y-2">
              {urgent.data!.slice(0, 5).map((alert, i) => (
                <motion.li
                  key={alert.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  className="flex items-start gap-3 rounded-xl border border-subtle bg-surface px-4 py-3 hover:bg-muted transition-colors"
                >
                  <div className="mt-0.5">
                    <SeverityBadge severity={alert.severity} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-default">
                      {alert.productName || "Product alert"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                  <p className="text-[11px] text-subtle whitespace-nowrap">
                    {relativeFromNow(alert.createdAt)}
                  </p>
                </motion.li>
              ))}
            </ul>
          )}
        </Card>

        <QuickScanCard />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Top used products"
            description="Highest consumption this month."
          />
          {topUsed.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (topUsed.data ?? []).length === 0 ? (
            <EmptyState
              icon={<PackageSearch size={20} />}
              title="No usage yet"
              description="Stock movements will appear here as they happen."
            />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topUsed.data}
                  margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="productName"
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RTooltip
                    cursor={{ fill: "var(--bg-muted)" }}
                    contentStyle={{
                      background: "var(--bg-elev)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="totalUsed"
                    fill="#0F766E"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="By category"
            description="Consumption distribution."
          />
          {categoryConsumption.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (categoryConsumption.data ?? []).length === 0 ? (
            <EmptyState
              icon={<PackageSearch size={20} />}
              title="No category data"
            />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryConsumption.data}
                    dataKey="totalUsed"
                    nameKey="categoryName"
                    innerRadius={48}
                    outerRadius={84}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {categoryConsumption.data!.map((_, i) => (
                      <Cell
                        key={i}
                        fill={chartColors[i % chartColors.length]}
                      />
                    ))}
                  </Pie>
                  <RTooltip
                    contentStyle={{
                      background: "var(--bg-elev)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {categoryConsumption.data!.slice(0, 6).map((entry, i) => (
                  <div key={entry.categoryName} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: chartColors[i % chartColors.length] }}
                    />
                    <span className="truncate text-muted">{entry.categoryName}</span>
                    <span className="ml-auto tabular text-default">{entry.totalUsed}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader
          title="Recent activity"
          description="Latest stock movements from your team."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRoute("products")}
              trailingIcon={<ArrowRight size={14} />}
            >
              See products
            </Button>
          }
        />

        {recent.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : (recent.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Activity size={20} />}
            title="No movements yet"
            description="Stock activity will show up here once recorded."
          />
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {recent.data!.slice(0, 8).map((movement) => (
              <li
                key={movement.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={movement.userName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-default">
                      {movement.productName}
                    </p>
                    <p className="text-xs text-muted">
                      {movement.userName} · {movement.movementType} · qty{" "}
                      {movement.quantity}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular text-default">
                    {movement.oldStock} → {movement.newStock}
                  </p>
                  <p className="text-[11px] text-subtle">
                    {formatTime(movement.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function QuickScanCard() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setRoute = useUIStore((s) => s.setRoute);
  const queryClient = useQueryClient();

  // Also pull the count of products for the side-stat
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: productService.list,
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!value.trim()) return;
    try {
      setLoading(true);
      const data = await productService.byBarcode(value.trim());
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Product not found";
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Quick scan"
        description="Find a product by its barcode."
        action={<Badge tone="brand">⌨ enter</Badge>}
      />

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Scan or paste a barcode..."
          leadingIcon={<ScanBarcode size={16} />}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
        />

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {result && (
          <motion.div
            key={result.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-[var(--color-brand-200)] bg-[var(--color-brand-50)] px-3 py-3 dark:border-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)]/30"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-800)] dark:text-[var(--color-brand-300)]">
              Found
            </p>
            <p className="mt-1 text-sm font-semibold text-default">
              {result.name}
            </p>
            <p className="text-xs text-muted">
              Stock {result.currentStock} · min {result.minimumStock}
            </p>
          </motion.div>
        )}

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full justify-center"
        >
          Look up
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-xs">
        <span className="text-muted">Full scan workspace</span>
        <button
          type="button"
          onClick={() => setRoute("scan")}
          className="font-medium text-[var(--color-brand-700)] hover:underline dark:text-[var(--color-brand-300)]"
        >
          Open →
        </button>
      </div>

      <p className="mt-3 text-[11px] text-subtle">
        {products?.length ?? 0} products available
      </p>
    </Card>
  );
}
