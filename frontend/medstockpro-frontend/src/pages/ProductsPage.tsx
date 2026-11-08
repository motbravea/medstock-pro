import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  PackageSearch,
  Plus,
  Search,
  Truck,
} from "lucide-react";
import { productService, resolvePhotoUrl } from "../services/productService";
import { categoryService } from "../services/categoryService";
import { useAuthStore } from "../stores/authStore";
import { useDebounce } from "../hooks/useDebounce";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge, StockBadge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Tabs } from "../components/ui/Tabs";
import { DataTable } from "../components/ui/DataTable";
import { ProductFormDialog } from "../components/products/ProductFormDialog";
import { ProductDetailDrawer } from "../components/products/ProductDetailDrawer";
import { PrintAllLabelsButton } from "../components/products/PrintAllLabelsButton";
import { formatDate } from "../lib/format";
import type { Product } from "../types";

type FilterKey =
  | "all"
  | "low"
  | "out"
  | "expiring"
  | "expired"
  | "incomplete";

/**
 * Day-count helper that matches the rules in AlertService:
 *   expired         = expiry date strictly before today
 *   expiring soon   = today >= (expiry - alertDays) and not yet expired
 */
function expiryState(product: Product): "expired" | "expiring" | "ok" | "none" {
  if (!product.expiryDate) return "none";
  const expiry = new Date(product.expiryDate);
  if (Number.isNaN(expiry.getTime())) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDay = new Date(expiry);
  expiryDay.setHours(0, 0, 0, 0);
  const days = Math.round(
    (expiryDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return "expired";
  if (days <= (product.expiryAlertDays || 30)) return "expiring";
  return "ok";
}

/**
 * Stock state mirrors the alert rules:
 *   out   = current <= 0
 *   low   = (min > 0 && current <= min)  OR  (min == 0 && current == 1)
 *   ok    = anything else
 */
function stockState(product: Product): "out" | "low" | "ok" {
  if (product.currentStock <= 0) return "out";
  if (product.minimumStock > 0 && product.currentStock <= product.minimumStock)
    return "low";
  if (product.minimumStock === 0 && product.currentStock === 1) return "low";
  return "ok";
}

export function ProductsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === "Admin");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [categoryId, setCategoryId] = useState<string>("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const debouncedSearch = useDebounce(search, 200);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productService.list,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryService.list,
  });

  const counts = useMemo(() => {
    let low = 0,
      out = 0,
      expiring = 0,
      expired = 0,
      incomplete = 0;
    for (const product of products) {
      const stock = stockState(product);
      if (stock === "out") out++;
      else if (stock === "low") low++;

      const expiry = expiryState(product);
      if (expiry === "expired") expired++;
      else if (expiry === "expiring") expiring++;

      if (product.isSetupReady === false) incomplete++;
    }
    return { low, out, expiring, expired, incomplete };
  }, [products]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return products.filter((product) => {
      // Status filter
      if (filter !== "all") {
        const stock = stockState(product);
        const expiry = expiryState(product);
        if (filter === "low" && stock !== "low") return false;
        if (filter === "out" && stock !== "out") return false;
        if (filter === "expiring" && expiry !== "expiring") return false;
        if (filter === "expired" && expiry !== "expired") return false;
        if (filter === "incomplete" && product.isSetupReady !== false)
          return false;
      }
      // Category filter
      if (categoryId) {
        const wanted = Number(categoryId);
        const hasCat = (product.categories ?? []).some((c) => c.id === wanted);
        if (!hasCat) return false;
      }
      // Free-text search across name, description, internal barcode,
      // supplier barcodes (the new enrichment) and category names.
      if (q) {
        const haystack = [
          product.name,
          product.description,
          product.internalBarcode,
          ...(product.supplierBarcodes ?? []),
          ...(product.categories ?? []).map((c) => c.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [products, debouncedSearch, filter, categoryId]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Products"
        description="Browse, search and manage every item in stock."
        actions={
          <div className="flex items-center gap-2">
            <PrintAllLabelsButton />
            {isAdmin && (
              <Button
                leadingIcon={<Plus size={16} />}
                onClick={() => setCreating(true)}
              >
                New product
              </Button>
            )}
          </div>
        }
      />

      <Card padded={false}>
        <div className="space-y-3 border-b border-subtle p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full md:max-w-sm">
              <Input
                placeholder="Search name, description, internal or supplier barcode"
                leadingIcon={<Search size={16} />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="md:w-56">
              <Select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                options={[
                  { value: "", label: "All categories" },
                  ...categories
                    .filter((c) => c.isActive)
                    .map((c) => ({
                      value: String(c.id),
                      label: c.name,
                    })),
                ]}
              />
            </div>
            <p className="ml-auto text-xs text-muted tabular">
              {filtered.length} of {products.length}
            </p>
          </div>

          <Tabs
            value={filter}
            onChange={(key) => setFilter(key as FilterKey)}
            tabs={[
              { key: "all", label: "All", count: products.length },
              { key: "low", label: "Low stock", count: counts.low },
              { key: "out", label: "Out", count: counts.out },
              { key: "expiring", label: "Expiring", count: counts.expiring },
              { key: "expired", label: "Expired", count: counts.expired },
              {
                key: "incomplete",
                label: "Incomplete",
                count: counts.incomplete,
              },
            ]}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<PackageSearch size={20} />}
              title={products.length === 0 ? "No products yet" : "No matches"}
              description={
                products.length === 0
                  ? "Add a product to get started."
                  : "Try a different search or filter."
              }
              action={
                isAdmin && products.length === 0 ? (
                  <Button onClick={() => setCreating(true)}>Add product</Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ProductsTable
            products={filtered}
            onSelect={(product) => setSelected(product)}
          />
        )}
      </Card>

      <ProductFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        product={null}
      />
      <ProductDetailDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        product={selected}
      />
    </div>
  );
}

function ProductsTable({
  products,
  onSelect,
}: {
  products: Product[];
  onSelect: (product: Product) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <DataTable
        rows={products}
        rowKey={(product) => product.id}
        onRowClick={onSelect}
        columns={[
          {
            key: "product",
            header: "Product",
            cell: (product) => (
              <div className="flex items-center gap-3">
                <ProductThumb product={product} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-default">
                    {product.name}
                  </p>
                  <p className="line-clamp-1 text-xs text-muted">
                    {product.description || (
                      <span className="italic text-subtle">No description</span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-mono text-subtle">
                    {product.internalBarcode || "no internal barcode"}
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: "stock",
            header: "Stock",
            align: "right",
            cell: (product) => (
              <div className="flex items-center justify-end gap-2">
                <StockBadge
                  current={product.currentStock}
                  minimum={product.minimumStock}
                />
                <span className="text-sm font-semibold tabular text-default">
                  {product.currentStock}
                </span>
                <span className="text-xs text-muted">
                  / {product.minimumStock} min
                </span>
              </div>
            ),
          },
          {
            key: "expiry",
            header: "Expiry",
            cell: (product) => {
              const state = expiryState(product);
              if (state === "none") {
                return <span className="text-xs text-subtle">—</span>;
              }
              return (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-default tabular">
                    {formatDate(product.expiryDate)}
                  </span>
                  {state === "expired" && (
                    <Badge tone="danger">Expired</Badge>
                  )}
                  {state === "expiring" && (
                    <Badge tone="warning">Expiring</Badge>
                  )}
                </div>
              );
            },
          },
          {
            key: "categories",
            header: "Categories",
            cell: (product) => {
              const cats = product.categories ?? [];
              if (cats.length === 0) {
                return <span className="text-xs text-subtle">—</span>;
              }
              const visible = cats.slice(0, 2);
              const extra = cats.length - visible.length;
              return (
                <div className="flex flex-wrap items-center gap-1">
                  {visible.map((c) => (
                    <Badge key={c.id} tone="brand">
                      {c.name}
                    </Badge>
                  ))}
                  {extra > 0 && <Badge tone="neutral">+{extra}</Badge>}
                </div>
              );
            },
          },
          {
            key: "suppliers",
            header: "Suppliers",
            align: "right",
            cell: (product) => (
              <div className="flex items-center justify-end gap-1.5 text-xs text-muted">
                <Truck size={13} />
                <span className="font-semibold text-default tabular">
                  {product.supplierCount ?? 0}
                </span>
              </div>
            ),
          },
          {
            key: "setup",
            header: "Setup",
            cell: (product) => {
              const ready = product.isSetupReady !== false; // undefined = treat as ready (older shape)
              return ready ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} />
                  Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={13} />
                  Incomplete
                </span>
              );
            },
          },
        ]}
      />
    </motion.div>
  );
}

function ProductThumb({ product }: { product: Product }) {
  const url = resolvePhotoUrl(product.photoPath);
  if (url) {
    return (
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-subtle bg-surface">
        <img
          src={url}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)]/40 dark:text-[var(--color-brand-300)]">
      <Box size={16} strokeWidth={1.6} />
    </div>
  );
}
