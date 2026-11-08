import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Button } from "../ui/Button";
import { Badge, StockBadge } from "../ui/Badge";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import { Avatar } from "../ui/Avatar";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SupplierProductLinkDialog } from "./SupplierProductLinkDialog";
import { supplierService } from "../../services/supplierService";
import { productService, resolvePhotoUrl } from "../../services/productService";
import { useAuthStore } from "../../stores/authStore";
import { toast } from "../../stores/toastStore";
import { ApiError } from "../../lib/api";
import { formatCurrency, formatDate } from "../../lib/format";
import type { Supplier, SupplierProduct } from "../../types";

type Props = {
  open: boolean;
  onClose: () => void;
  supplier: Supplier | null;
};

/**
 * Supplier detail view: contact info + linked-products table with inline
 * add/edit/remove. Mutations call the existing product-side endpoints so
 * the same audit/permission code paths are exercised.
 */
export function SupplierDetailDrawer({ open, onClose, supplier }: Props) {
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === "Admin");
  const [linking, setLinking] = useState(false);
  const [editingRow, setEditingRow] = useState<SupplierProduct | null>(null);
  const [removing, setRemoving] = useState<SupplierProduct | null>(null);

  const supplierId = supplier?.id ?? 0;

  const products = useQuery({
    queryKey: ["supplier-products", supplierId],
    queryFn: () => supplierService.products(supplierId),
    enabled: open && supplierId > 0,
  });

  const removeMutation = useMutation({
    mutationFn: (row: SupplierProduct) =>
      productService.removeSupplier(row.productId, row.productSupplierId),
    onSuccess: (_, row) => {
      queryClient.invalidateQueries({ queryKey: ["supplier-products", supplierId] });
      queryClient.invalidateQueries({
        queryKey: ["product-full-details", row.productId],
      });
      toast.success("Product unlinked from supplier");
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Could not remove";
      toast.error("Failed", message);
    },
  });

  if (!supplier) return null;

  const rows = products.data ?? [];

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={supplier.name}
        description={supplier.notes || "Supplier directory entry."}
        width={720}
        footer={
          isAdmin ? (
            <>
              <div className="flex-1" />
              <Button
                leadingIcon={<Plus size={16} />}
                onClick={() => setLinking(true)}
              >
                Link a product
              </Button>
            </>
          ) : null
        }
      >
        {/* Contact header */}
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-subtle bg-muted p-4">
          <Avatar name={supplier.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-default">{supplier.name}</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs md:grid-cols-2">
              {supplier.phoneNumber && (
                <div className="flex items-center gap-2 text-muted">
                  <Phone size={13} />
                  <span className="tabular text-default">
                    {supplier.phoneNumber}
                  </span>
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-2 text-muted">
                  <Mail size={13} />
                  <span className="text-default truncate">{supplier.email}</span>
                </div>
              )}
              {supplier.address && (
                <div className="flex items-center gap-2 text-muted md:col-span-2">
                  <MapPin size={13} />
                  <span className="text-default truncate">
                    {supplier.address}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Products" value={String(rows.length)} />
          <Stat
            label="Preferred for"
            value={String(rows.filter((r) => r.isPreferredSupplier).length)}
          />
          <Stat
            label="Avg price"
            value={
              rows.length > 0
                ? formatCurrency(
                    rows.reduce((sum, r) => sum + r.price, 0) / rows.length,
                  )
                : "—"
            }
          />
        </div>

        {/* Products list */}
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Linked products
        </h3>

        {products.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Box size={20} />}
            title="No products linked yet"
            description="Click 'Link a product' to add the first one."
            action={
              isAdmin ? (
                <Button
                  size="sm"
                  leadingIcon={<Plus size={14} />}
                  onClick={() => setLinking(true)}
                >
                  Link a product
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.productSupplierId}
                className="flex items-start gap-3 rounded-xl border border-subtle bg-surface p-3"
              >
                <Thumbnail photoPath={row.photoPath} name={row.productName} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-default">
                      {row.productName}
                    </p>
                    {row.isPreferredSupplier && (
                      <Badge tone="brand">
                        <Star size={10} className="opacity-70" />
                        Preferred
                      </Badge>
                    )}
                    <StockBadge
                      current={row.currentStock}
                      minimum={row.minimumStock}
                    />
                  </div>

                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted md:grid-cols-4">
                    <Field
                      label="Price"
                      value={
                        row.price > 0 ? formatCurrency(row.price) : "—"
                      }
                    />
                    <Field
                      label="Supplier barcode"
                      value={row.supplierBarcode || "—"}
                      mono
                    />
                    <Field
                      label="Last purchase"
                      value={
                        row.lastPurchaseDate
                          ? formatDate(row.lastPurchaseDate)
                          : "—"
                      }
                    />
                    <Field
                      label="Internal barcode"
                      value={row.internalBarcode || "—"}
                      mono
                    />
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      leadingIcon={<Edit3 size={13} />}
                      onClick={() => setEditingRow(row)}
                      aria-label="Edit price and barcode"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      leadingIcon={<Trash2 size={13} />}
                      onClick={() => setRemoving(row)}
                      aria-label="Unlink product"
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
      </Drawer>

      <SupplierProductLinkDialog
        open={linking || editingRow !== null}
        onClose={() => {
          setLinking(false);
          setEditingRow(null);
        }}
        supplierId={supplier.id}
        supplierName={supplier.name}
        editing={editingRow}
        alreadyLinkedProductIds={rows.map((r) => r.productId)}
      />

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing ? removeMutation.mutateAsync(removing) : Promise.resolve()
        }
        title="Unlink this product?"
        description={
          removing
            ? `${removing.productName} will no longer be sold by ${supplier.name}.`
            : ""
        }
        confirmLabel="Unlink"
        tone="danger"
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-subtle bg-muted p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular text-default">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}:
      </span>{" "}
      <span
        className={
          "text-[11px] text-default" + (mono ? " font-mono" : " tabular")
        }
      >
        {value}
      </span>
    </div>
  );
}

function Thumbnail({
  photoPath,
  name,
}: {
  photoPath: string;
  name: string;
}) {
  const url = resolvePhotoUrl(photoPath);
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-subtle bg-muted">
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted">
          <Box size={18} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
