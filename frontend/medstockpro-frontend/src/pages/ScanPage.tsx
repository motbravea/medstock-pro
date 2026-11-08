import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Barcode,
  Box,
  CheckCircle2,
  History,
  Minus,
  RotateCw,
  ScanBarcode,
  Undo2,
} from "lucide-react";
import { productService, resolvePhotoUrl } from "../services/productService";
import { stockMovementService } from "../services/stockMovementService";
import { playSound } from "../lib/sound";
import { ApiError } from "../lib/api";
import { toast } from "../stores/toastStore";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge, StockBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { StockMovementDialog } from "../components/products/StockMovementDialog";
import { formatTime, formatDate } from "../lib/format";
import type { Product, ScanResult } from "../types";

type ScanEntry = {
  id: string;
  barcode: string;
  product: ScanResult | null;
  error?: string;
  at: string;
};

export function ScanPage() {
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<ScanEntry[]>([]);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [movementOpen, setMovementOpen] = useState(false);
  // Quantity input shared by the Used/Return buttons. Editable per spec.
  const [actionQty, setActionQty] = useState(1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  // Reset qty back to 1 whenever a new scan happens — most scans are 1-off.
  function resetActionQty() {
    setActionQty(1);
  }

  const useMutation_scanUse = useMutation({
    mutationFn: (vars: { productId: number; quantity: number }) =>
      stockMovementService.scanUse({
        productId: vars.productId,
        quantity: vars.quantity,
        notes: "",
      }),
    onSuccess: (data) => {
      playSound("saveOk");
      toast.success(
        "Marked as used",
        `${data.movement.quantity} × ${data.movement.productName ?? "product"}. New stock: ${data.movement.newStock}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      resetActionQty();
    },
    onError: (error) => {
      playSound("saveError");
      const message =
        error instanceof ApiError ? error.message : "Could not mark as used";
      toast.error("Use failed", message);
    },
  });

  const useMutation_scanReturn = useMutation({
    mutationFn: (vars: { productId: number; quantity: number }) =>
      stockMovementService.scanReturn({
        productId: vars.productId,
        quantity: vars.quantity,
        notes: "",
      }),
    onSuccess: (data) => {
      playSound("saveOk");
      toast.info(
        "Return submitted",
        `Waiting for admin approval — ${data.pending.quantity} × ${data.pending.product}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["pendingMovements"] });
      queryClient.invalidateQueries({ queryKey: ["pendingMovementCount"] });
      resetActionQty();
    },
    onError: (error) => {
      playSound("saveError");
      const message =
        error instanceof ApiError ? error.message : "Could not submit return";
      toast.error("Return failed", message);
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const lookup = useMutation({
    mutationFn: (barcode: string) => productService.byBarcode(barcode),
    onSuccess: (product, barcode) => {
      setRecent((prev) =>
        [
          {
            id: crypto.randomUUID(),
            barcode,
            product,
            at: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 12),
      );
      queryClient.invalidateQueries({ queryKey: ["products"] });
      playSound("scanOk");
    },
    onError: (error, barcode) => {
      const message =
        error instanceof ApiError ? error.message : "Not found";
      setRecent((prev) =>
        [
          {
            id: crypto.randomUUID(),
            barcode,
            product: null,
            error: message,
            at: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 12),
      );
      playSound("scanError");
    },
  });

  const latestHit = recent.find((entry) => entry.product);
  const latest = recent[0];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    lookup.mutate(value.trim());
    setValue("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Scan workspace"
        title="Scan a product"
        description="Point a barcode scanner here or paste a code. Result appears instantly."
        actions={
          <Button
            variant="secondary"
            leadingIcon={<RotateCw size={16} />}
            onClick={() => {
              setRecent([]);
              inputRef.current?.focus();
            }}
          >
            Clear history
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Scan area */}
        <Card className="overflow-hidden p-0">
          <div className="border-b border-subtle bg-gradient-to-br from-[var(--color-brand-50)] to-transparent px-6 py-5 dark:from-[var(--color-brand-900)]/30">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-800)] dark:text-[var(--color-brand-300)]">
              Ready
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-default">
              Scan or type a barcode
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Press <kbd className="rounded border border-subtle bg-surface px-1 py-px text-[10px]">Enter</kbd> to look up.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3 px-6 py-5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)]/40 dark:text-[var(--color-brand-300)]">
              <ScanBarcode size={22} />
            </div>
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Awaiting barcode input…"
              className="h-14 flex-1 rounded-xl border border-subtle bg-surface px-4 font-mono text-lg tabular tracking-wide text-default placeholder:text-subtle outline-none transition focus:border-[var(--color-brand-700)] focus:ring-brand"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="submit"
              size="lg"
              loading={lookup.isPending}
              disabled={!value.trim()}
            >
              Look up
            </Button>
          </form>

          <AnimatePresence mode="wait">
            {latest && (
              <motion.div
                key={latest.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="border-t border-subtle px-6 py-5"
              >
                {latest.product ? (
                  <FoundCard
                    product={latest.product}
                    qty={actionQty}
                    onQtyChange={setActionQty}
                    onUse={() =>
                      useMutation_scanUse.mutate({
                        productId: latest.product!.id,
                        quantity: actionQty,
                      })
                    }
                    onReturn={() =>
                      useMutation_scanReturn.mutate({
                        productId: latest.product!.id,
                        quantity: actionQty,
                      })
                    }
                    useLoading={useMutation_scanUse.isPending}
                    returnLoading={useMutation_scanReturn.isPending}
                    onAdvanced={() => {
                      setActiveProduct(latest.product);
                      setMovementOpen(true);
                    }}
                  />
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/15">
                    <AlertCircle size={18} className="mt-0.5 text-red-600 dark:text-red-300" />
                    <div>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-200">
                        No product found
                      </p>
                      <p className="text-xs text-red-700/80 dark:text-red-200/80">
                        Barcode <span className="font-mono">{latest.barcode}</span>{" "}
                        is not linked to any product.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
            {!latest && (
              <div className="px-6 pb-6">
                <EmptyState
                  icon={<Barcode size={22} />}
                  title="Awaiting first scan"
                  description="Use a USB barcode scanner or type a code manually."
                />
              </div>
            )}
          </AnimatePresence>
        </Card>

        {/* Recent scans */}
        <Card className="overflow-hidden p-0">
          <CardHeader
            title="Recent scans"
            description="Latest lookups in this session."
            className="border-b border-subtle px-5 py-4"
          />
          {recent.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<History size={20} />}
                title="No scans yet"
                description="Each lookup will appear here."
              />
            </div>
          ) : (
            <ul className="max-h-[480px] overflow-y-auto scroll-slim divide-y divide-[color:var(--border)]">
              {recent.map((entry) => (
                <li key={entry.id} className="px-5 py-3">
                  {entry.product ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        size={16}
                        className="mt-0.5 text-emerald-600 dark:text-emerald-400"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-default">
                          {entry.product.name}
                        </p>
                        <p className="text-[11px] text-muted">
                          <span className="font-mono">{entry.barcode}</span> ·
                          stock {entry.product.currentStock}
                        </p>
                      </div>
                      <span className="text-[11px] text-subtle">
                        {formatTime(entry.at)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <AlertCircle
                        size={16}
                        className="mt-0.5 text-red-500 dark:text-red-400"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-default">
                          Not found
                        </p>
                        <p className="text-[11px] text-muted font-mono truncate">
                          {entry.barcode}
                        </p>
                      </div>
                      <span className="text-[11px] text-subtle">
                        {formatTime(entry.at)}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Last successful — quick action shortcut */}
      {latestHit && latestHit.product && (
        <Card className="bg-gradient-to-br from-surface to-muted">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Last successful scan
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-default">
                {latestHit.product.name}
              </p>
              <p className="text-xs text-muted font-mono">
                {latestHit.barcode}
              </p>
            </div>
            <Button
              leadingIcon={<RotateCw size={14} />}
              onClick={() => {
                setActiveProduct(latestHit.product as Product);
                setMovementOpen(true);
              }}
            >
              Record movement
            </Button>
          </div>
        </Card>
      )}

      {activeProduct && (
        <StockMovementDialog
          open={movementOpen}
          onClose={() => setMovementOpen(false)}
          product={activeProduct}
        />
      )}
    </div>
  );
}

function FoundCard({
  product,
  qty,
  onQtyChange,
  onUse,
  onReturn,
  useLoading,
  returnLoading,
  onAdvanced,
}: {
  product: ScanResult;
  qty: number;
  onQtyChange: (next: number) => void;
  onUse: () => void;
  onReturn: () => void;
  useLoading: boolean;
  returnLoading: boolean;
  onAdvanced: () => void;
}) {
  const insufficient = qty > product.currentStock;
  const photoUrl = resolvePhotoUrl(product.photoPath);
  return (
    <div className="flex items-start gap-4 rounded-xl border border-[var(--color-brand-200)] bg-[var(--color-brand-50)]/60 p-4 dark:border-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)]/30">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-subtle bg-surface shadow-card">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--color-brand-700)]">
            <Box size={26} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold text-default">{product.name}</p>
          <StockBadge
            current={product.currentStock}
            minimum={product.minimumStock}
          />
        </div>
        <p className="text-xs text-muted">{product.description || "—"}</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <Field label="Stock" value={String(product.currentStock)} />
          <Field label="Min" value={String(product.minimumStock)} />
          <Field
            label="Expiry"
            value={product.expiryDate ? formatDate(product.expiryDate) : "—"}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            Scanned: <span className="font-mono">{product.scannedBarcode}</span>
          </Badge>
          <Badge tone="brand">{product.barcodeType}</Badge>
        </div>

        {/* Scan-use / scan-return action bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-subtle pt-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            <span className="font-semibold uppercase tracking-[0.14em]">
              Qty
            </span>
            <input
              type="number"
              min={1}
              max={1000}
              value={qty}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next) && next >= 1)
                  onQtyChange(Math.min(1000, Math.floor(next)));
              }}
              className="h-9 w-20 rounded-lg border border-subtle bg-surface px-2 text-center font-mono text-sm text-default outline-none focus:border-[var(--color-brand-700)] focus:ring-brand"
            />
          </label>
          <Button
            size="sm"
            variant="danger"
            leadingIcon={<Minus size={14} />}
            disabled={insufficient}
            loading={useLoading}
            onClick={onUse}
          >
            Used (−{qty})
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<Undo2 size={14} />}
            loading={returnLoading}
            onClick={onReturn}
          >
            Return (needs approval)
          </Button>
          <button
            type="button"
            onClick={onAdvanced}
            className="text-[11px] text-muted underline-offset-2 hover:underline"
          >
            Advanced…
          </button>
        </div>
        {insufficient && (
          <p className="mt-2 text-[11px] text-red-600 dark:text-red-300">
            Not enough stock to use {qty}. Available: {product.currentStock}.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-semibold tabular text-default">{value}</p>
    </div>
  );
}
