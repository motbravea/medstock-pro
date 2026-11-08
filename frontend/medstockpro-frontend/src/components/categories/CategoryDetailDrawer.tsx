import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Box,
  CalendarX,
  Clock,
  Plus,
  Tags,
  Trash2,
  XCircle,
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Button } from "../ui/Button";
import { Badge, StockBadge } from "../ui/Badge";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { CategoryProductLinkDialog } from "./CategoryProductLinkDialog";
import { categoryService } from "../../services/categoryService";
import { productService, resolvePhotoUrl } from "../../services/productService";
import { useAuthStore } from "../../stores/authStore";
import { toast } from "../../stores/toastStore";
import { ApiError } from "../../lib/api";
import { formatDate } from "../../lib/format";
import type { Category, CategoryProduct } from "../../types";

type Props = {
  open: boolean;
  onClose: () => void;
  category: Category | null;
};

/**
 * Detail view for a category: shows the products that belong to it with
 * stat tiles and per-row Remove. Add via the link dialog. Reuses the
 * existing product-side endpoints — no new mutation routes.
 */
export function CategoryDetailDrawer({ open, onClose, category }: Props) {
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === "Admin");
  const [linking, setLinking] = useState(false);
  const [removing, setRemoving] = useState<CategoryProduct | null>(null);

  const categoryId = category?.id ?? 0;

  const detail = useQuery({
    queryKey: ["category-products", categoryId],
    queryFn: () => categoryService.products(categoryId),
    enabled: open && categoryId > 0,
  });

  const removeMutation = useMutation({
    mutationFn: (product: CategoryProduct) =>
      productService.removeCategory(product.id, categoryId),
    onSuccess: (_, product) => {
      queryClient.invalidateQueries({
        queryKey: ["category-products", categoryId],
      });
      queryClient.invalidateQueries({
        queryKey: ["product-full-details", product.id],
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product removed from category");
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Could not remove";
      toast.error("Failed", message);
    },
  });

  if (!category) return null;

  const data = detail.data;
  const products = data?.products ?? [];

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={category.name}
        description={category.description || "Product category."}
        width={720}
        footer={
          isAdmin ? (
            <>
              <div className="flex-1" />
              <Button
                leadingIcon={<Plus size={16} />}
                onClick={() => setLinking(true)}
              >
                Add a product
              </Button>
            </>
          ) : null
        }
      >
        {/* Stat tiles */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat
            label="Products"
            value={String(data?.totalProducts ?? 0)}
            icon={<Tags size={14} />}
          />
          <Stat
            label="Low stock"
            tone="warning"
            value={String(data?.lowStockCount ?? 0)}
            icon={<AlertTriangle size={14} />}
          />
          <Stat
            label="Out of stock"
            tone="danger"
            value={String(data?.outOfStockCount ?? 0)}
            icon={<XCircle size={14} />}
          />
          <Stat
            label="Expiring"
            tone="warning"
            value={String(data?.expiringCount ?? 0)}
            icon={<Clock size={14} />}
          />
          <Stat
            label="Expired"
            tone="danger"
            value={String(data?.expiredCount ?? 0)}
            icon={<CalendarX size={14} />}
          />
        </div>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Products in this category
        </h3>

        {detail.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : detail.isError ? (
          <EmptyState
            icon={<XCircle size={20} />}
            title="Could not load products"
            description="Try refreshing in a moment."
            action={
              <Button size="sm" onClick={() => detail.refetch()}>
                Retry
              </Button>
            }
          />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Box size={20} />}
            title="No products in this category yet"
            description="Use Add a product to assign one."
            action={
              isAdmin ? (
                <Button
                  size="sm"
                  leadingIcon={<Plus size={14} />}
                  onClick={() => setLinking(true)}
                >
                  Add a product
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-2">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                canEdit={isAdmin}
                onRemove={() => setRemoving(product)}
              />
            ))}
          </ul>
        )}
      </Drawer>

      <CategoryProductLinkDialog
        open={linking}
        onClose={() => setLinking(false)}
        categoryId={category.id}
        categoryName={category.name}
        alreadyInCategoryProductIds={products.map((p) => p.id)}
      />

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing ? removeMutation.mutateAsync(removing) : Promise.resolve()
        }
        title="Remove from category?"
        description={
          removing
            ? `${removing.name} will no longer be in ${category.name}.`
            : ""
        }
        confirmLabel="Remove"
        tone="danger"
      />
    </>
  );
}

function ProductRow({
  product,
  canEdit,
  onRemove,
}: {
  product: CategoryProduct;
  canEdit: boolean;
  onRemove: () => void;
}) {
  const url = resolvePhotoUrl(product.photoPath);
  // Expiry inline state — same rules used elsewhere.
  let expiryBadge: { tone: "danger" | "warning"; label: string } | null = null;
  if (product.expiryDate) {
    const expiry = new Date(product.expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDay = new Date(expiry);
    expiryDay.setHours(0, 0, 0, 0);
    const days = Math.round(
      (expiryDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < 0) expiryBadge = { tone: "danger", label: "Expired" };
    else if (days <= product.expiryAlertDays)
      expiryBadge = { tone: "warning", label: "Expiring" };
  }

  return (
    <li className="flex items-start gap-3 rounded-xl border border-subtle bg-surface p-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-subtle bg-muted">
        {url ? (
          <img src={url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <Box size={18} strokeWidth={1.5} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-default">
            {product.name}
          </p>
          <StockBadge
            current={product.currentStock}
            minimum={product.minimumStock}
          />
          {expiryBadge && (
            <Badge tone={expiryBadge.tone}>{expiryBadge.label}</Badge>
          )}
        </div>
        {product.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">
            {product.description}
          </p>
        )}
        <div className="mt-1 grid grid-cols-3 gap-x-3 text-[11px] text-muted">
          <Field label="Stock" value={`${product.currentStock} / ${product.minimumStock}`} />
          <Field
            label="Expiry"
            value={product.expiryDate ? formatDate(product.expiryDate) : "—"}
          />
          <Field
            label="Internal barcode"
            value={product.internalBarcode || "—"}
            mono
          />
        </div>
      </div>

      {canEdit && (
        <Button
          size="sm"
          variant="ghost"
          leadingIcon={<Trash2 size={13} />}
          onClick={onRemove}
          aria-label="Remove product from category"
          className="text-red-600 hover:text-red-700"
        >
          Remove
        </Button>
      )}
    </li>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-700 dark:text-red-300"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-300"
        : "text-default";
  return (
    <div className="rounded-xl border border-subtle bg-muted p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        <span className="opacity-70">{icon}</span>
        {label}
      </div>
      <p className={`mt-1 text-base font-semibold tabular ${toneClass}`}>
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
    <div className="truncate">
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
