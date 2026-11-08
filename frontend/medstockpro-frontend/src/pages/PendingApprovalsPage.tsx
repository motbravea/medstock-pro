import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Clock, RefreshCw, ShieldCheck, X } from "lucide-react";
import { pendingMovementService } from "../services/pendingMovementService";
import { toast } from "../stores/toastStore";
import { playSound } from "../lib/sound";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { ApiError } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { PendingMovement, PendingStatus } from "../types";

type Filter = PendingStatus | "All";

/**
 * Admin queue for stock changes that require approval.
 * Currently only "Return" goes through this queue.
 */
export function PendingApprovalsPage() {
  const [filter, setFilter] = useState<Filter>("Pending");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pendingMovements", filter],
    queryFn: () => pendingMovementService.list(filter),
    // Refresh the queue every 20 seconds so a busy Admin doesn't have to
    // hit the browser refresh button.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  // Track previous pending count so we can chime on truly-new arrivals.
  const previousPending = useRef<number | null>(null);
  useEffect(() => {
    if (filter !== "Pending") return;
    const count = query.data?.length ?? 0;
    if (previousPending.current !== null && count > previousPending.current) {
      playSound("notify");
    }
    previousPending.current = count;
  }, [query.data, filter]);

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      pendingMovementService.approve(id, { notes: "" }),
    onSuccess: (data) => {
      playSound("saveOk");
      toast.success(
        "Return approved",
        `Stock restored. New stock: ${data.pending.newStock}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["pendingMovements"] });
      queryClient.invalidateQueries({ queryKey: ["pendingMovementCount"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (err) => {
      playSound("saveError");
      toast.error(
        "Approve failed",
        err instanceof ApiError ? err.message : "Could not approve",
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      pendingMovementService.reject(id, { notes: "" }),
    onSuccess: () => {
      playSound("saveOk");
      toast.info("Return rejected", "No stock change.");
      queryClient.invalidateQueries({ queryKey: ["pendingMovements"] });
      queryClient.invalidateQueries({ queryKey: ["pendingMovementCount"] });
    },
    onError: (err) => {
      playSound("saveError");
      toast.error(
        "Reject failed",
        err instanceof ApiError ? err.message : "Could not reject",
      );
    },
  });

  const rows = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pending approvals"
        title="Stock returns awaiting your review"
        description="Staff submit returns by scanning. Stock does not change until you approve."
        actions={
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw size={16} />}
            onClick={() => query.refetch()}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {(["Pending", "Approved", "Rejected", "All"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium transition " +
              (filter === f
                ? "bg-[var(--color-brand-700)] text-white"
                : "bg-surface text-muted border border-subtle hover:bg-muted")
            }
          >
            {f}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader
          title={`${filter} returns`}
          description={
            filter === "Pending"
              ? "Approve to restore stock. Reject to discard the request."
              : "History view — no actions available."
          }
          className="border-b border-subtle px-5 py-4"
        />

        {query.isLoading ? (
          <div className="p-5 text-sm text-muted">Loading…</div>
        ) : query.isError ? (
          <div className="p-5">
            <EmptyState
              icon={<ShieldCheck size={22} />}
              title="Failed to load queue"
              description={
                query.error instanceof ApiError
                  ? query.error.message
                  : "Try refreshing in a moment."
              }
              action={
                <Button
                  variant="secondary"
                  leadingIcon={<RefreshCw size={14} />}
                  onClick={() => query.refetch()}
                >
                  Retry
                </Button>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Clock size={22} />}
              title={
                filter === "Pending"
                  ? "Nothing waiting"
                  : `No ${filter.toLowerCase()} entries`
              }
              description={
                filter === "Pending"
                  ? "When staff scan a return, it will appear here."
                  : "Once you start approving or rejecting, history will populate."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {rows.map((row) => (
              <PendingRow
                key={row.id}
                row={row}
                onApprove={() => approveMutation.mutate(row.id)}
                onReject={() => rejectMutation.mutate(row.id)}
                busy={
                  (approveMutation.isPending &&
                    approveMutation.variables === row.id) ||
                  (rejectMutation.isPending &&
                    rejectMutation.variables === row.id)
                }
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PendingRow({
  row,
  onApprove,
  onReject,
  busy,
}: {
  row: PendingMovement;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const isPending = row.status === "Pending";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-wrap items-center gap-4 px-5 py-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-default">
            {row.productName}
          </p>
          <StatusBadge status={row.status} />
        </div>
        <p className="mt-0.5 text-[11px] text-muted">
          Requested by{" "}
          <span className="font-medium text-default">{row.requestedBy}</span>{" "}
          · {formatDateTime(row.createdAt)} · qty{" "}
          <span className="font-mono">{row.quantity}</span> · source movement
          #{row.sourceMovementId}
        </p>
        {row.requesterNotes && (
          <p className="mt-1 text-xs text-muted italic">
            "{row.requesterNotes}"
          </p>
        )}
        {row.reviewedAt && (
          <p className="mt-1 text-[11px] text-muted">
            Reviewed by{" "}
            <span className="font-medium text-default">
              {row.reviewedBy ?? "—"}
            </span>{" "}
            on {formatDateTime(row.reviewedAt)}
            {row.reviewerNotes ? ` — "${row.reviewerNotes}"` : ""}
          </p>
        )}
      </div>

      {isPending && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<X size={14} />}
            disabled={busy}
            onClick={onReject}
          >
            Reject
          </Button>
          <Button
            size="sm"
            leadingIcon={<Check size={14} />}
            disabled={busy}
            loading={busy}
            onClick={onApprove}
          >
            Approve
          </Button>
        </div>
      )}
    </motion.li>
  );
}

function StatusBadge({ status }: { status: PendingStatus }) {
  if (status === "Pending") return <Badge tone="warning">Pending</Badge>;
  if (status === "Approved") return <Badge tone="success">Approved</Badge>;
  return <Badge tone="neutral">Rejected</Badge>;
}
