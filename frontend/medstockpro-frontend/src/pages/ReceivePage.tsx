import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Box,
  CalendarPlus,
  CheckCircle2,
  PackagePlus,
  Search,
  Truck,
} from "lucide-react";
import { productService, resolvePhotoUrl } from "../services/productService";
import { stockMovementService } from "../services/stockMovementService";
import { useDebounce } from "../hooks/useDebounce";
import { toast } from "../stores/toastStore";
import { playSound } from "../lib/sound";
import { ApiError } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge, StockBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { formatDate } from "../lib/format";
import type { ProductFullDetails } from "../types";

/**
 * Receive shipment workflow.
 *
 * Lookup left (search by name OR scan a barcode → autoload),
 * receive form right (qty, supplier dropdown driven by linked suppliers,
 * optional new expiry, notes). Submit calls POST /StockMovements/receive
 * which is atomic backend-side.
 */
export function ReceivePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const debouncedSearch = useDebounce(search, 200);
  const scanRef = useRef<HTMLInputElement | null>(null);

  // Search results panel — list of matching products.
  const searchQuery = useQuery({
    queryKey: ["product-search", debouncedSearch],
    queryFn: () => productService.search(debouncedSearch),
    enabled: debouncedSearch.trim().length >= 2,
  });

  // Full details for the currently-selected product (gives suppliers + photo).
  const details = useQuery({
    queryKey: ["product-full-details", selectedId],
    queryFn: () => productService.fullDetails(selectedId!),
    enabled: selectedId !== null,
  });

  // Barcode scan: looks up the product by exact barcode and selects it.
  const scanLookup = useMutation({
    mutationFn: (barcode: string) => productService.byBarcode(barcode),
    onSuccess: (product) => {
      setSelectedId(product.id);
      playSound("scanOk");
      toast.success("Product found", product.name);
      setScanInput("");
      // Focus stays on scan input for the next scan/lookup.
      requestAnimationFrame(() => scanRef.current?.focus());
    },
    onError: (err) => {
      playSound("scanError");
      const message = err instanceof ApiError ? err.message : "Not found";
      toast.error("No product for that barcode", message);
    },
  });

  function handleScanSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!scanInput.trim()) return;
    scanLookup.mutate(scanInput.trim());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbound"
        title="Receive shipment"
        description="Find a product, then record what arrived. Stock and expiry update together."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
        {/* LEFT: lookup */}
        <div className="space-y-4">
          <Card padded={false}>
            <CardHeader
              title="Scan barcode"
              description="Point your scanner here, or type a barcode."
              className="border-b border-subtle px-5 py-4"
            />
            <form onSubmit={handleScanSubmit} className="flex items-center gap-3 p-4">
              <input
                ref={scanRef}
                value={scanInput}
                onChange={(event) => setScanInput(event.target.value)}
                placeholder="Awaiting barcode…"
                className="h-12 flex-1 rounded-xl border border-subtle bg-surface px-4 font-mono text-base tracking-wide text-default placeholder:text-subtle outline-none focus:border-[var(--color-brand-700)] focus:ring-brand"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="submit"
                disabled={!scanInput.trim()}
                loading={scanLookup.isPending}
              >
                Find
              </Button>
            </form>
          </Card>

          <Card padded={false}>
            <CardHeader
              title="Search by name"
              description="Type at least 2 letters."
              className="border-b border-subtle px-5 py-4"
            />
            <div className="space-y-3 p-4">
              <Input
                placeholder="e.g. gloves, syringe…"
                leadingIcon={<Search size={15} />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {searchQuery.isLoading && debouncedSearch.trim().length >= 2 && (
                <Skeleton className="h-10" />
              )}
              {!searchQuery.isLoading && searchQuery.data && (
                <ul className="max-h-[260px] divide-y divide-[color:var(--border)] overflow-y-auto scroll-slim rounded-xl border border-subtle">
                  {searchQuery.data.length === 0 ? (
                    <li className="px-4 py-3 text-xs text-muted">
                      No products match "{debouncedSearch}".
                    </li>
                  ) : (
                    searchQuery.data.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(product.id)}
                          className={
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors " +
                            (selectedId === product.id
                              ? "bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-900)]/30"
                              : "hover:bg-muted")
                          }
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-[var(--color-brand-700)] shadow-card">
                            <Box size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-default">
                              {product.name}
                            </p>
                            <p className="truncate text-[11px] text-muted font-mono">
                              {product.internalBarcode || "no internal barcode"}
                            </p>
                          </div>
                          <StockBadge
                            current={product.currentStock}
                            minimum={product.minimumStock}
                          />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT: receive form */}
        <Card padded={false}>
          <CardHeader
            title="Receive"
            description="Quantity, supplier, expiry, notes."
            className="border-b border-subtle px-5 py-4"
          />
          {selectedId === null ? (
            <div className="p-6">
              <EmptyState
                icon={<PackagePlus size={22} />}
                title="Pick a product to receive"
                description="Scan its barcode or search by name on the left."
              />
            </div>
          ) : details.isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
          ) : details.isError || !details.data ? (
            <div className="p-5">
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/15">
                <AlertCircle
                  size={16}
                  className="mt-0.5 text-red-600 dark:text-red-300"
                />
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-200">
                    Could not load product
                  </p>
                  <button
                    type="button"
                    onClick={() => details.refetch()}
                    className="mt-1 text-xs underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <ReceiveForm
              details={details.data}
              onReceived={() => {
                // Invalidate everything that depends on stock/movements/alerts.
                queryClient.invalidateQueries({ queryKey: ["products"] });
                queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                queryClient.invalidateQueries({ queryKey: ["alerts"] });
                queryClient.invalidateQueries({
                  queryKey: ["product-full-details", selectedId],
                });
                queryClient.invalidateQueries({
                  queryKey: ["product-movements", selectedId],
                });
              }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function ReceiveForm({
  details,
  onReceived,
}: {
  details: ProductFullDetails;
  onReceived: () => void;
}) {
  const product = details.product;
  const [quantity, setQuantity] = useState<number>(1);
  const [supplierId, setSupplierId] = useState<string>("");
  const [expiry, setExpiry] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Reset form when the selected product changes.
  useEffect(() => {
    setQuantity(1);
    setSupplierId("");
    setExpiry("");
    setNotes("");
  }, [product.id]);

  // Suppliers eligible: only those already linked to this product.
  // Preferred first, then by name.
  const eligibleSuppliers = useMemo(
    () =>
      [...details.suppliers].sort((a, b) => {
        if (a.isPreferredSupplier !== b.isPreferredSupplier) {
          return a.isPreferredSupplier ? -1 : 1;
        }
        return a.supplierName.localeCompare(b.supplierName);
      }),
    [details.suppliers],
  );

  const mutation = useMutation({
    mutationFn: () =>
      stockMovementService.receive({
        productId: product.id,
        quantity,
        supplierId: supplierId ? Number(supplierId) : null,
        expiryDate: expiry || null,
        notes,
      }),
    onSuccess: (data) => {
      playSound("saveOk");
      toast.success(
        "Shipment received",
        `+${data.movement.quantity} ${product.name}. Stock ${data.movement.oldStock} → ${data.movement.newStock}.`,
      );
      onReceived();
      // Reset for the next receive on the same product.
      setQuantity(1);
      setExpiry("");
      setNotes("");
    },
    onError: (err) => {
      playSound("saveError");
      const message =
        err instanceof ApiError ? err.message : "Could not receive shipment";
      toast.error("Receive failed", message);
    },
  });

  const previewStock = product.currentStock + (quantity > 0 ? quantity : 0);
  const photoUrl = resolvePhotoUrl(product.photoPath);

  return (
    <div className="space-y-5 p-5">
      {/* Product summary */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-start gap-4 rounded-xl border border-subtle bg-muted/40 p-4"
      >
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-subtle bg-surface">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              <Box size={26} strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-default">
              {product.name}
            </p>
            <StockBadge
              current={product.currentStock}
              minimum={product.minimumStock}
            />
          </div>
          <p className="text-xs text-muted">{product.description || "—"}</p>
          <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
            <Field label="Stock" value={String(product.currentStock)} />
            <Field label="Min" value={String(product.minimumStock)} />
            <Field
              label="Expiry"
              value={
                product.expiryDate ? formatDate(product.expiryDate) : "—"
              }
            />
          </div>
          {details.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {details.categories.map((c) => (
                <Badge key={c.id} tone="brand">
                  {c.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Form */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          type="number"
          label="Quantity received"
          min={1}
          value={quantity}
          onChange={(event) =>
            setQuantity(Math.max(1, Number(event.target.value) || 1))
          }
          leadingIcon={<PackagePlus size={14} />}
        />
        <Select
          label="From supplier (optional)"
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
          options={[
            {
              value: "",
              label:
                eligibleSuppliers.length === 0
                  ? "No suppliers linked to this product"
                  : "— pick a supplier —",
            },
            ...eligibleSuppliers.map((s) => ({
              value: String(s.supplierId),
              label: `${s.supplierName}${s.isPreferredSupplier ? " · preferred" : ""}`,
            })),
          ]}
          disabled={eligibleSuppliers.length === 0}
          hint={
            eligibleSuppliers.length === 0
              ? "Link a supplier from the product detail drawer to record the source."
              : "Optional — used only to update last purchase date."
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          type="date"
          label="New expiry date (optional)"
          value={expiry}
          onChange={(event) => setExpiry(event.target.value)}
          leadingIcon={<CalendarPlus size={14} />}
          hint="Only set if this batch has a different expiry than the current one."
        />
        <div className="flex flex-col justify-end rounded-xl border border-subtle bg-muted p-3 text-sm">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
            Stock preview
          </p>
          <p className="mt-1 text-default">
            <span className="tabular font-semibold">{product.currentStock}</span>{" "}
            <span className="text-muted">→</span>{" "}
            <span className="tabular font-semibold text-emerald-600 dark:text-emerald-400">
              {previewStock}
            </span>
          </p>
        </div>
      </div>

      <Textarea
        label="Notes (optional)"
        rows={3}
        placeholder="Batch number, invoice ref, delivery person, etc."
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      <div className="flex items-center justify-end gap-2 border-t border-subtle pt-4">
        {mutation.isSuccess && (
          <p className="mr-auto inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} />
            Last receive saved successfully.
          </p>
        )}
        <Button
          variant="secondary"
          leadingIcon={<Truck size={14} />}
          onClick={() => {
            setQuantity(1);
            setSupplierId("");
            setExpiry("");
            setNotes("");
          }}
        >
          Reset
        </Button>
        <Button
          disabled={quantity < 1}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Confirm receive
        </Button>
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
