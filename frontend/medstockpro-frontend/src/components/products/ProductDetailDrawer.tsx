import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Barcode,
  Edit3,
  Plus,
  Printer,
  RotateCw,
  Star,
  Tag,
  Trash2,
  Truck,
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Button } from "../ui/Button";
import { Tabs } from "../ui/Tabs";
import { Badge, SeverityBadge, StockBadge } from "../ui/Badge";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import { Avatar } from "../ui/Avatar";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ProductFormDialog } from "./ProductFormDialog";
import { StockMovementDialog } from "./StockMovementDialog";
import { PhotoUploader } from "./PhotoUploader";
import { SetupChecklist } from "./SetupChecklist";
import { BarcodeLabelDialog } from "./BarcodeLabelDialog";
import { ProductSupplierDialog } from "./ProductSupplierDialog";
import { productService } from "../../services/productService";
import { categoryService } from "../../services/categoryService";
import { stockMovementService } from "../../services/stockMovementService";
import { useAuthStore } from "../../stores/authStore";
import { toast } from "../../stores/toastStore";
import { playSound } from "../../lib/sound";
import { ApiError } from "../../lib/api";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from "../../lib/format";
import type { Product, ProductSupplier } from "../../types";

type Props = {
  open: boolean;
  onClose: () => void;
  product: Product | null;
};

type Tab = "overview" | "suppliers" | "barcodes" | "history";

export function ProductDetailDrawer({ open, onClose, product }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [movement, setMovement] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [supplierDialog, setSupplierDialog] = useState<{
    open: boolean;
    existing: ProductSupplier | null;
  }>({ open: false, existing: null });

  const isAdmin = useAuthStore((s) => s.user?.role === "Admin");
  const queryClient = useQueryClient();
  const productId = product?.id ?? 0;

  // ONE consolidated call instead of 4 — F3 fix.
  const {
    data: details,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["product-full-details", productId],
    queryFn: () => productService.fullDetails(productId),
    enabled: open && productId > 0,
  });

  const { data: history } = useQuery({
    queryKey: ["product-movements", productId],
    queryFn: () => stockMovementService.byProduct(productId),
    enabled: open && productId > 0,
  });

  const generateBarcode = useMutation({
    mutationFn: () => productService.generateInternalBarcode(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-full-details", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Internal barcode generated");
      playSound("saveOk");
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Could not generate";
      toast.error("Failed", message);
      playSound("saveError");
    },
  });

  const removeSupplier = useMutation({
    mutationFn: (productSupplierId: number) =>
      productService.removeSupplier(productId, productSupplierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-full-details", productId] });
      toast.success("Supplier removed");
    },
  });

  const deleteProduct = useMutation({
    mutationFn: () => productService.remove(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Product deactivated");
      onClose();
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Could not deactivate";
      toast.error("Failed", message);
    },
  });

  if (!product) return null;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={details?.product.name ?? product.name}
        description={
          details?.product.description ?? product.description ?? "No description provided."
        }
        width={640}
        footer={
          <>
            {/* Deactivate stays Admin-only. Edit is available to everyone. */}
            {isAdmin && (
              <Button
                variant="ghost"
                leadingIcon={<Trash2 size={16} />}
                onClick={() => setDeleting(true)}
              >
                Deactivate
              </Button>
            )}
            <div className="flex-1" />
            <Button
              variant="secondary"
              leadingIcon={<Printer size={16} />}
              onClick={() => setLabelOpen(true)}
            >
              Label
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<Edit3 size={16} />}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            <Button
              leadingIcon={<RotateCw size={16} />}
              onClick={() => setMovement(true)}
            >
              Record movement
            </Button>
          </>
        }
      >
        {isLoading && <Skeleton className="h-64 rounded-2xl" />}

        {isError && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
            <AlertCircle size={16} className="mt-0.5" />
            <div>
              <p className="font-semibold">Could not load product details.</p>
              <button onClick={() => refetch()} className="mt-1 underline">
                Retry
              </button>
            </div>
          </div>
        )}

        {details && (
          <>
            {/* Photo + key stats */}
            <div className="mb-5 grid gap-4 md:grid-cols-[200px_1fr]">
              <PhotoUploader
                productId={productId}
                currentPhotoPath={details.product.photoPath}
                canEdit={isAdmin}
              />

              <div className="rounded-2xl border border-subtle bg-muted p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StockBadge
                    current={details.product.currentStock}
                    minimum={details.product.minimumStock}
                  />
                  <Badge
                    tone={
                      details.product.expiryStatus === "Expired"
                        ? "danger"
                        : details.product.expiryStatus === "Expiring soon"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {details.product.expiryStatus}
                  </Badge>
                  <Badge tone="neutral">
                    <Barcode size={11} className="opacity-70" />
                    {details.product.internalBarcode || "no code"}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Stat label="Stock" value={String(details.product.currentStock)} />
                  <Stat label="Min" value={String(details.product.minimumStock)} />
                  <Stat
                    label="Expiry"
                    value={
                      details.product.expiryDate
                        ? formatDate(details.product.expiryDate)
                        : "—"
                    }
                  />
                </div>
              </div>
            </div>

            <SetupChecklist setup={details.setupStatus} />

            <div className="mt-5">
              <Tabs
                value={tab}
                onChange={(key) => setTab(key as Tab)}
                tabs={[
                  { key: "overview", label: "Overview" },
                  {
                    key: "suppliers",
                    label: "Suppliers",
                    count: details.suppliers.length,
                  },
                  {
                    key: "barcodes",
                    label: "Barcodes",
                    count: details.barcodes.length,
                  },
                  {
                    key: "history",
                    label: "History",
                    count: history?.length ?? 0,
                  },
                ]}
              />
            </div>

            <div className="mt-5">
              {tab === "overview" && (
                <div className="space-y-5">
                  <Section title="Categories">
                    <CategoryAssigner
                      productId={productId}
                      assigned={details.categories.map((c) => ({
                        id: c.id,
                        name: c.name,
                      }))}
                      canEdit={isAdmin}
                    />
                  </Section>

                  {details.activeAlerts.length > 0 && (
                    <Section title="Active alerts">
                      <ul className="space-y-2">
                        {details.activeAlerts.map((alert) => (
                          <li
                            key={alert.id}
                            className="flex items-start gap-2 rounded-xl border border-subtle bg-surface p-3"
                          >
                            <SeverityBadge severity={alert.severity} />
                            <div>
                              <p className="text-sm text-default">{alert.message}</p>
                              <p className="text-[11px] text-subtle">
                                {formatDateTime(alert.createdAt)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  <Section title="Metadata">
                    <dl className="grid grid-cols-2 gap-y-2 text-xs">
                      <dt className="text-muted">Expiry alert window</dt>
                      <dd className="text-default tabular">
                        {details.product.expiryAlertDays} days
                      </dd>
                      <dt className="text-muted">Created</dt>
                      <dd className="text-default">{formatDate(details.product.createdAt)}</dd>
                      <dt className="text-muted">Last updated</dt>
                      <dd className="text-default">{formatDate(details.product.updatedAt)}</dd>
                    </dl>
                  </Section>
                </div>
              )}

              {tab === "suppliers" && (
                <SuppliersPanel
                  suppliers={details.suppliers}
                  canEdit={isAdmin}
                  onAdd={() => setSupplierDialog({ open: true, existing: null })}
                  onEdit={(s) => setSupplierDialog({ open: true, existing: s })}
                  onRemove={(id) => removeSupplier.mutate(id)}
                />
              )}

              {tab === "barcodes" && (
                <BarcodesPanel
                  barcodes={details.barcodes}
                  hasInternal={details.setupStatus.hasInternalBarcode}
                  canEdit={isAdmin}
                  generating={generateBarcode.isPending}
                  onGenerate={() => generateBarcode.mutate()}
                  onShowLabel={() => setLabelOpen(true)}
                />
              )}

              {tab === "history" && <HistoryPanel movements={history ?? []} />}
            </div>
          </>
        )}
      </Drawer>

      <ProductFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        product={product}
      />
      <StockMovementDialog
        open={movement}
        onClose={() => setMovement(false)}
        product={product}
      />
      <BarcodeLabelDialog
        open={labelOpen}
        onClose={() => setLabelOpen(false)}
        productId={productId}
      />
      <ProductSupplierDialog
        open={supplierDialog.open}
        onClose={() => setSupplierDialog({ open: false, existing: null })}
        productId={productId}
        existing={supplierDialog.existing}
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => deleteProduct.mutateAsync()}
        title="Deactivate this product?"
        description="It will be hidden from the inventory list but stays in history."
        confirmLabel="Deactivate"
        tone="danger"
      />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular text-default">{value}</p>
    </div>
  );
}

function SuppliersPanel({
  suppliers,
  canEdit,
  onAdd,
  onEdit,
  onRemove,
}: {
  suppliers: ProductSupplier[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (s: ProductSupplier) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="space-y-3">
      {canEdit && (
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Plus size={14} />}
          onClick={onAdd}
        >
          Link supplier
        </Button>
      )}

      {suppliers.length === 0 ? (
        <EmptyState
          icon={<Truck size={20} />}
          title="No suppliers linked"
          description="Link suppliers to enable restock-cost calculation."
        />
      ) : (
        <ul className="space-y-2">
          {suppliers.map((supplier) => (
            <li
              key={supplier.id}
              className="rounded-xl border border-subtle bg-surface p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-default">
                      {supplier.supplierName}
                    </p>
                    {supplier.isPreferredSupplier && (
                      <Badge tone="brand">
                        <Star size={10} /> Preferred
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    {supplier.phoneNumber || "no phone"} ·{" "}
                    {supplier.email || "no email"}
                  </p>
                  {supplier.supplierBarcode && (
                    <p className="text-[11px] text-subtle font-mono">
                      {supplier.supplierBarcode}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular text-default">
                    {formatCurrency(supplier.price)}
                  </p>
                  <p className="text-[11px] text-subtle">
                    {supplier.lastPurchaseDate
                      ? formatDate(supplier.lastPurchaseDate)
                      : "no purchase yet"}
                  </p>
                </div>
              </div>

              {canEdit && (
                <div className="mt-2 flex justify-end gap-1 border-t border-subtle pt-2">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(supplier)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Trash2 size={12} />}
                    onClick={() => onRemove(supplier.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BarcodesPanel({
  barcodes,
  hasInternal,
  canEdit,
  generating,
  onGenerate,
  onShowLabel,
}: {
  barcodes: import("../../types").ProductBarcode[];
  hasInternal: boolean;
  canEdit: boolean;
  generating: boolean;
  onGenerate: () => void;
  onShowLabel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canEdit && !hasInternal && (
          <Button
            variant="secondary"
            leadingIcon={<Plus size={16} />}
            onClick={onGenerate}
            loading={generating}
          >
            Generate internal barcode
          </Button>
        )}
        {hasInternal && (
          <Button
            variant="secondary"
            leadingIcon={<Printer size={16} />}
            onClick={onShowLabel}
          >
            Print label
          </Button>
        )}
      </div>

      {barcodes.length === 0 ? (
        <EmptyState
          icon={<Barcode size={20} />}
          title="No barcodes yet"
          description="Generate an internal one or scan a supplier code."
        />
      ) : (
        <ul className="space-y-2">
          {barcodes.map((barcode) => (
            <li
              key={barcode.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-surface p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-default">
                  {barcode.barcodeValue}
                </p>
                <p className="text-[11px] text-subtle">
                  {barcode.barcodeType} · {formatDate(barcode.createdAt)}
                </p>
              </div>
              <Badge tone={barcode.barcodeType === "Internal" ? "brand" : "neutral"}>
                {barcode.barcodeType}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryPanel({
  movements,
}: {
  movements: import("../../types").StockMovement[];
}) {
  if (movements.length === 0) {
    return (
      <EmptyState
        icon={<Activity size={20} />}
        title="No movements yet"
        description="Stock in / out will show up here."
      />
    );
  }
  return (
    <ol className="relative space-y-3 border-l border-subtle pl-5">
      {movements.map((movement) => (
        <li key={movement.id} className="relative">
          <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-brand-600)] ring-4 ring-[var(--bg)]" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-default">
                {movement.movementType}{" "}
                <span className="text-muted">· qty {movement.quantity}</span>
              </p>
              {movement.notes && (
                <p className="text-xs text-muted leading-relaxed">{movement.notes}</p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <Avatar name={movement.userName} size="sm" />
                <span className="text-[11px] text-muted">{movement.userName}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular text-default">
                {movement.oldStock} → {movement.newStock}
              </p>
              <p className="text-[11px] text-subtle">
                {formatDateTime(movement.createdAt)}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Inline category management used on the product drawer's Overview tab.
 * Admin-only edit: shows assigned categories as chips with an X to remove,
 * plus a select+add button row. Staff sees the chips read-only.
 */
function CategoryAssigner({
  productId,
  assigned,
  canEdit,
}: {
  productId: number;
  assigned: { id: number; name: string }[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string>("");

  // Load full catalog only when the editor is visible (Admin) — avoid an
  // extra request for Staff who can't change anything anyway.
  const catalog = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
    enabled: canEdit,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["product-full-details", productId] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const addMutation = useMutation({
    mutationFn: (categoryId: number) =>
      productService.addCategory(productId, categoryId),
    onSuccess: () => {
      toast.success("Category assigned");
      playSound("saveOk");
      setPendingId("");
      refresh();
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Could not assign";
      toast.error("Failed", message);
      playSound("saveError");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (categoryId: number) =>
      productService.removeCategory(productId, categoryId),
    onSuccess: () => {
      toast.success("Category removed");
      playSound("saveOk");
      refresh();
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Could not remove";
      toast.error("Failed", message);
      playSound("saveError");
    },
  });

  // Categories the catalog offers minus the ones already on this product.
  const assignedIds = new Set(assigned.map((c) => c.id));
  const available = (catalog.data ?? [])
    .filter((c) => c.isActive && !assignedIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      {assigned.length === 0 ? (
        <p className="text-xs text-muted">No categories yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {assigned.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand-100)] bg-[var(--color-brand-50)] px-2 py-0.5 text-xs font-medium text-[var(--color-brand-800)] dark:border-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)]/40 dark:text-[var(--color-brand-200)]"
            >
              <Tag size={10} className="opacity-70" />
              {c.name}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(c.id)}
                  disabled={
                    removeMutation.isPending &&
                    removeMutation.variables === c.id
                  }
                  aria-label={`Remove ${c.name}`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-[var(--color-brand-100)]/70 disabled:opacity-50 dark:hover:bg-[var(--color-brand-800)]/60"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-2">
          <select
            value={pendingId}
            onChange={(e) => setPendingId(e.target.value)}
            disabled={catalog.isLoading || addMutation.isPending}
            className="h-9 flex-1 rounded-lg border border-subtle bg-surface px-2 text-sm text-default outline-none focus:border-[var(--color-brand-700)] focus:ring-brand disabled:opacity-50"
          >
            <option value="">
              {available.length === 0
                ? "No more categories available"
                : "Select a category…"}
            </option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            leadingIcon={<Plus size={14} />}
            disabled={!pendingId || addMutation.isPending}
            loading={addMutation.isPending}
            onClick={() => {
              const id = Number(pendingId);
              if (Number.isFinite(id) && id > 0) addMutation.mutate(id);
            }}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
