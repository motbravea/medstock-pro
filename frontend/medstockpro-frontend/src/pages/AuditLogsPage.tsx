import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserSearch,
} from "lucide-react";
import { auditLogService } from "../services/auditLogService";
import { userService } from "../services/userService";
import { useAuthStore } from "../stores/authStore";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { Badge, RoleBadge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Avatar } from "../components/ui/Avatar";
import { formatDateTime } from "../lib/format";
import { ApiError } from "../lib/api";
import type { AuditLog } from "../types";

type Filter = "all" | "user" | "entity" | "date";

/**
 * Admin-only activity log. Four query modes mapped to the four backend
 * endpoints: paginated all, filter by user, filter by entity, filter by
 * date range. JSON snapshots can be expanded per row.
 */
export function AuditLogsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === "Admin");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("Product");
  const [entityId, setEntityId] = useState<string>("");
  const [start, setStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );

  // Active query depends on filter mode. We disable the other queries so
  // React Query doesn't fetch them in the background.
  const all = useQuery({
    queryKey: ["audit-logs", "all", page, pageSize],
    queryFn: () => auditLogService.list(page, pageSize),
    enabled: isAdmin && filter === "all",
  });

  const byUser = useQuery({
    queryKey: ["audit-logs", "user", userId],
    queryFn: () => auditLogService.byUser(Number(userId)),
    enabled: isAdmin && filter === "user" && /^\d+$/.test(userId),
  });

  const byEntity = useQuery({
    queryKey: ["audit-logs", "entity", entityType, entityId],
    queryFn: () => auditLogService.byEntity(entityType, Number(entityId)),
    enabled:
      isAdmin && filter === "entity" && /^\d+$/.test(entityId) && !!entityType,
  });

  const byDate = useQuery({
    queryKey: ["audit-logs", "date", start, end],
    queryFn: () => auditLogService.byDateRange(start, end),
    enabled: isAdmin && filter === "date" && !!start && !!end,
  });

  // User picker source — load all users so we can show fullname/username
  // in the filter dropdown.
  const users = useQuery({
    queryKey: ["users"],
    queryFn: userService.list,
    enabled: isAdmin,
  });

  const active =
    filter === "all"
      ? all
      : filter === "user"
        ? byUser
        : filter === "entity"
          ? byEntity
          : byDate;

  const rows: AuditLog[] = useMemo(() => {
    if (filter === "all") return all.data?.items ?? [];
    return ((active.data as AuditLog[] | undefined) ?? []) as AuditLog[];
  }, [active.data, all.data, filter]);

  // Client-side text filter on top of whichever backend filter is active.
  // Useful for "find all Backup actions" without changing the filter mode.
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.action} ${row.entityType} ${row.entityName} ${row.description} ${row.userName} ${row.userRole}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<ShieldAlert size={22} />}
        title="Admins only"
        description="The activity log is restricted to clinic owners."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance"
        title="Activity log"
        description="Every important action performed in the system, who did it, and when."
        actions={
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw size={14} />}
            onClick={() => active.refetch()}
            loading={active.isFetching}
          >
            Refresh
          </Button>
        }
      />

      <Card padded={false}>
        <div className="space-y-3 border-b border-subtle p-4">
          <Tabs
            value={filter}
            onChange={(key) => {
              setFilter(key as Filter);
              setPage(1);
            }}
            tabs={[
              { key: "all", label: "All" },
              { key: "user", label: "By user" },
              { key: "entity", label: "By entity" },
              { key: "date", label: "Date range" },
            ]}
          />

          <div className="flex flex-wrap items-center gap-3">
            {filter === "user" && (
              <div className="md:w-72">
                <Select
                  leadingIcon={<UserSearch size={14} />}
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  options={[
                    { value: "", label: "— Pick a user —" },
                    ...(users.data ?? []).map((u) => ({
                      value: String(u.id),
                      label: `${u.fullName} (@${u.username})`,
                    })),
                  ]}
                />
              </div>
            )}

            {filter === "entity" && (
              <>
                <div className="md:w-44">
                  <Select
                    value={entityType}
                    onChange={(event) => setEntityType(event.target.value)}
                    options={[
                      { value: "Product", label: "Product" },
                      { value: "Category", label: "Category" },
                      { value: "Supplier", label: "Supplier" },
                      { value: "User", label: "User" },
                      { value: "Alert", label: "Alert" },
                      { value: "Backup", label: "Backup" },
                    ]}
                  />
                </div>
                <div className="md:w-36">
                  <Input
                    placeholder="Entity ID"
                    inputMode="numeric"
                    value={entityId}
                    onChange={(event) =>
                      setEntityId(event.target.value.replace(/\D/g, ""))
                    }
                  />
                </div>
              </>
            )}

            {filter === "date" && (
              <>
                <div className="md:w-44">
                  <Input
                    type="date"
                    label=""
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                  />
                </div>
                <div className="md:w-44">
                  <Input
                    type="date"
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                  />
                </div>
              </>
            )}

            <div className="ml-auto w-full md:w-72">
              <Input
                placeholder="Filter by action, entity, or description"
                leadingIcon={<Search size={14} />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {filter === "all" && all.data && (
            <p className="text-[11px] text-muted tabular">
              Showing {filteredRows.length} of {all.data.total} total entries ·
              page {all.data.page} · {pageSize}/page
            </p>
          )}
        </div>

        {active.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : active.isError ? (
          <div className="p-5">
            <EmptyState
              icon={<ShieldCheck size={22} />}
              title="Could not load activity"
              description={
                active.error instanceof ApiError
                  ? active.error.message
                  : "Try refreshing in a moment."
              }
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => active.refetch()}
                >
                  Retry
                </Button>
              }
            />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<History size={22} />}
              title="Nothing to show"
              description={
                filter === "user"
                  ? "Pick a user to see their actions."
                  : filter === "entity"
                    ? "Type an entity ID to see its history."
                    : "No matching entries for the chosen filters."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {filteredRows.map((row) => (
              <AuditRow key={row.id} row={row} />
            ))}
          </ul>
        )}

        {filter === "all" && all.data && (
          <div className="flex items-center justify-between gap-3 border-t border-subtle p-3">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1 || all.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <p className="text-xs text-muted tabular">
              Page {all.data.page} of{" "}
              {Math.max(1, Math.ceil(all.data.total / pageSize))}
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={
                all.isFetching ||
                page * pageSize >= all.data.total
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function AuditRow({ row }: { row: AuditLog }) {
  const [open, setOpen] = useState(false);
  const hasSnapshots =
    (row.oldValues && row.oldValues !== "" && row.oldValues !== "null") ||
    (row.newValues && row.newValues !== "" && row.newValues !== "null");

  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="px-5 py-3"
    >
      <button
        type="button"
        onClick={() => hasSnapshots && setOpen((v) => !v)}
        className={
          "flex w-full items-start gap-3 text-left " +
          (hasSnapshots ? "cursor-pointer" : "cursor-default")
        }
      >
        <div className="mt-0.5">
          {hasSnapshots ? (
            open ? (
              <ChevronDown size={14} className="text-muted" />
            ) : (
              <ChevronRight size={14} className="text-muted" />
            )
          ) : (
            <ChevronRight size={14} className="text-transparent" />
          )}
        </div>

        <Avatar name={row.userName || "system"} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{row.action}</Badge>
            <span className="text-xs text-muted">
              on{" "}
              <span className="text-default">
                {row.entityType}
                {row.entityId > 0 ? ` #${row.entityId}` : ""}
              </span>
              {row.entityName ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-default">{row.entityName}</span>
                </>
              ) : null}
            </span>
          </div>
          <p className="mt-1 text-sm text-default">
            {row.description || (
              <span className="italic text-muted">No description</span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span className="font-medium text-default">
              {row.userName || "system"}
            </span>
            {row.userRole && (
              <RoleBadge role={row.userRole as "Admin" | "Staff"} />
            )}
            <span>·</span>
            <span className="tabular">{formatDateTime(row.createdAt)}</span>
            {row.ipAddress && (
              <>
                <span>·</span>
                <span className="font-mono">{row.ipAddress}</span>
              </>
            )}
          </div>
        </div>
      </button>

      {open && hasSnapshots && (
        <div className="mt-3 grid grid-cols-1 gap-3 pl-9 md:grid-cols-2">
          <JsonBlock label="Before" raw={row.oldValues} />
          <JsonBlock label="After" raw={row.newValues} />
        </div>
      )}
    </motion.li>
  );
}

function JsonBlock({ label, raw }: { label: string; raw: string }) {
  let pretty = raw;
  try {
    if (raw && raw !== "" && raw !== "null") {
      pretty = JSON.stringify(JSON.parse(raw), null, 2);
    }
  } catch {
    // Leave as-is; the backend stores the JSON it produced.
  }
  if (!raw || raw === "" || raw === "null") {
    return (
      <Card padded className="border-dashed">
        <CardHeader title={label} description="—" className="mb-0" />
      </Card>
    );
  }
  return (
    <div className="rounded-xl border border-subtle bg-muted p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] font-mono leading-relaxed text-default">
        {pretty}
      </pre>
    </div>
  );
}
