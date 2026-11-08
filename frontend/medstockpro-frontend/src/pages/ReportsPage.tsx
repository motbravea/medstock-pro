import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
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
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Coins,
  Package,
  PackageMinus,
  PackagePlus,
  RotateCw,
  TrendingUp,
  Users2,
} from "lucide-react";
import { reportService } from "../services/reportService";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { StatCard } from "../components/ui/StatCard";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Avatar } from "../components/ui/Avatar";
import { formatCurrency, formatDate } from "../lib/format";

const palette = ["#0F766E", "#14B8A6", "#0EA5E9", "#6366F1", "#F59E0B", "#EF4444", "#10B981"];

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">Reports unavailable</p>
        <p className="text-xs text-red-700/80 dark:text-red-200/80">{message}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<RotateCw size={14} />}
        onClick={onRetry}
      >
        Retry
      </Button>
    </div>
  );
}

function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">Could not load this section.</p>
        <p className="text-xs text-red-700/80 dark:text-red-200/80">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-500/20"
      >
        Retry
      </button>
    </div>
  );
}

export function ReportsPage() {
  const today = new Date();
  const [period, setPeriod] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });

  function shiftMonth(delta: number) {
    const date = new Date(period.year, period.month - 1 + delta, 1);
    setPeriod({ year: date.getFullYear(), month: date.getMonth() + 1 });
  }

  const monthLabel = new Date(period.year, period.month - 1, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );

  const [summary, productUsage, categoryUsage, staffUsage] = useQueries({
    queries: [
      {
        queryKey: ["reports", "monthly", period],
        queryFn: () => reportService.monthlySummary(period),
      },
      {
        queryKey: ["reports", "products", period],
        queryFn: () => reportService.productUsage(period),
      },
      {
        queryKey: ["reports", "categories", period],
        queryFn: () => reportService.categoryUsage(period),
      },
      {
        queryKey: ["reports", "staff", period],
        queryFn: () => reportService.staffUsage(period),
      },
    ],
  });

  const restock = useQuery({
    queryKey: ["reports", "restock"],
    queryFn: reportService.restockEstimate,
  });

  const isLoading = summary.isLoading || productUsage.isLoading;

  const hasAnyError =
    summary.isError ||
    productUsage.isError ||
    categoryUsage.isError ||
    staffUsage.isError ||
    restock.isError;

  function retryAll() {
    summary.refetch();
    productUsage.refetch();
    categoryUsage.refetch();
    staffUsage.refetch();
    restock.refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Monthly consumption, alerts, restock estimate."
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-subtle bg-surface p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </Button>
            <div className="px-3 text-sm font-medium text-default min-w-[140px] text-center">
              {monthLabel}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        }
      />

      {hasAnyError && (
        <ErrorBanner
          message="One or more reports failed to load."
          onRetry={retryAll}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : summary.isError ? (
        <ErrorBanner
          message={
            summary.error instanceof Error
              ? summary.error.message
              : "Monthly summary failed to load."
          }
          onRetry={() => summary.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            index={0}
            label="Stock out"
            value={summary.data?.stockOutQuantity ?? 0}
            tone="brand"
            icon={PackageMinus}
            helper="Used this month"
          />
          <StatCard
            index={1}
            label="Stock in"
            value={summary.data?.stockInQuantity ?? 0}
            tone="success"
            icon={PackagePlus}
            helper="Received this month"
          />
          <StatCard
            index={2}
            label="Damaged + expired"
            value={
              (summary.data?.damagedQuantity ?? 0) +
              (summary.data?.expiredQuantity ?? 0)
            }
            tone="danger"
            icon={AlertTriangle}
            helper={`Alerts: ${summary.data?.alertsCreated ?? 0}`}
          />
          <StatCard
            index={3}
            label="Active products"
            value={summary.data?.activeProducts ?? 0}
            tone="neutral"
            icon={Package}
            helper={`${summary.data?.lowStockProducts ?? 0} below minimum`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Top products"
            description={`Highest stock-out in ${monthLabel}.`}
          />
          {productUsage.isLoading ? (
            <Skeleton className="h-72 rounded-xl" />
          ) : productUsage.isError ? (
            <InlineError
              message={
                productUsage.error instanceof Error
                  ? productUsage.error.message
                  : "Could not load top products."
              }
              onRetry={() => productUsage.refetch()}
            />
          ) : (productUsage.data ?? []).length === 0 ? (
            <EmptyState
              icon={<TrendingUp size={20} />}
              title="No usage in this month"
            />
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={productUsage.data!.slice(0, 8)}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
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
          <CardHeader title="Categories" description="Share of total usage." />
          {categoryUsage.isLoading ? (
            <Skeleton className="h-72 rounded-xl" />
          ) : categoryUsage.isError ? (
            <InlineError
              message={
                categoryUsage.error instanceof Error
                  ? categoryUsage.error.message
                  : "Could not load categories."
              }
              onRetry={() => categoryUsage.refetch()}
            />
          ) : (categoryUsage.data ?? []).length === 0 ? (
            <EmptyState icon={<Activity size={20} />} title="No data" />
          ) : (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryUsage.data}
                      dataKey="totalUsed"
                      nameKey="categoryName"
                      innerRadius={48}
                      outerRadius={84}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {categoryUsage.data!.map((_, i) => (
                        <Cell key={i} fill={palette[i % palette.length]} />
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
              </div>
              <ul className="mt-3 space-y-1.5 text-xs">
                {categoryUsage.data!.map((entry, i) => (
                  <li
                    key={entry.categoryId}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: palette[i % palette.length] }}
                      />
                      <span className="truncate text-muted">
                        {entry.categoryName}
                      </span>
                    </div>
                    <span className="tabular font-medium text-default">
                      {entry.totalUsed}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Staff usage */}
        <Card>
          <CardHeader
            title="Staff usage"
            description="Who recorded the most stock movements."
          />
          {staffUsage.isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : staffUsage.isError ? (
            <InlineError
              message={
                staffUsage.error instanceof Error
                  ? staffUsage.error.message
                  : "Could not load staff usage."
              }
              onRetry={() => staffUsage.refetch()}
            />
          ) : (staffUsage.data ?? []).length === 0 ? (
            <EmptyState icon={<Users2 size={20} />} title="No activity" />
          ) : (
            <ul className="space-y-2">
              {staffUsage.data!.map((entry) => {
                const max = Math.max(...staffUsage.data!.map((e) => e.totalUsed));
                const pct = (entry.totalUsed / max) * 100;
                return (
                  <li
                    key={entry.userId}
                    className="flex items-center gap-3 rounded-xl border border-subtle bg-surface p-3"
                  >
                    <Avatar name={entry.userName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-default">
                        {entry.userName}
                      </p>
                      <p className="text-[11px] text-muted">
                        {entry.actionsCount} actions · {entry.totalUsed} units
                      </p>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="h-full rounded-full bg-[var(--color-brand-600)]"
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Restock estimate */}
        <Card>
          <CardHeader
            title="Restock estimate"
            description="Cost to bring everything back above minimum."
            action={
              <Badge tone="brand">
                <Coins size={11} />
                {formatCurrency(restock.data?.totalEstimatedCost ?? 0)}
              </Badge>
            }
          />
          {restock.isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : restock.isError ? (
            <InlineError
              message={
                restock.error instanceof Error
                  ? restock.error.message
                  : "Could not load restock estimate."
              }
              onRetry={() => restock.refetch()}
            />
          ) : !restock.data || restock.data.items.length === 0 ? (
            <EmptyState
              icon={<Package size={20} />}
              title="Nothing to restock"
              description="All items are at or above their minimum."
            />
          ) : (
            <div className="max-h-[320px] overflow-y-auto scroll-slim">
              <ul className="space-y-2">
                {restock.data.items.map((item) => (
                  <li
                    key={item.productId}
                    className="rounded-xl border border-subtle bg-surface p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-default">
                          {item.productName}
                        </p>
                        <p className="text-[11px] text-muted">
                          Need {item.suggestedRestockQuantity} ·{" "}
                          {item.supplier ? item.supplier.supplierName : "no supplier"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold tabular text-default">
                        {formatCurrency(item.estimatedCost)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <SupplierCostOverview />
    </div>
  );
}

function SupplierCostOverview() {
  const query = useQuery({
    queryKey: ["reports", "supplierCost"],
    queryFn: reportService.supplierCostOverview,
  });
  const { data, isLoading, isError, error, refetch } = query;

  return (
    <Card>
      <CardHeader
        title="Supplier cost overview"
        description="Cheapest and preferred supplier per product."
      />
      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : isError ? (
        <InlineError
          message={
            error instanceof Error
              ? error.message
              : "Could not load supplier costs."
          }
          onRetry={() => refetch()}
        />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={<Coins size={20} />}
          title="No supplier prices on file"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-subtle">
          <table className="w-full text-sm">
            <thead className="border-b border-subtle bg-muted">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Product
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Cheapest
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Preferred
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Last purchase
                </th>
              </tr>
            </thead>
            <tbody>
              {data!.map((item) => (
                <tr
                  key={item.productId}
                  className="border-b border-subtle last:border-0"
                >
                  <td className="px-4 py-3 text-default font-medium">
                    {item.productName}
                  </td>
                  <td className="px-4 py-3">
                    {item.cheapestSupplier ? (
                      <div>
                        <p className="text-sm text-default">
                          {item.cheapestSupplier.supplierName}
                        </p>
                        <p className="text-[11px] tabular text-muted">
                          {formatCurrency(item.cheapestSupplier.price)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.preferredSupplier ? (
                      <div className="flex items-center gap-2">
                        <Badge tone="brand">Preferred</Badge>
                        <span className="text-sm text-default">
                          {item.preferredSupplier.supplierName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted">
                    {item.suppliers[0]?.lastPurchaseDate
                      ? formatDate(item.suppliers[0].lastPurchaseDate)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
