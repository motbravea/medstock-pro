import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Search } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { StockBadge } from "../ui/Badge";
import { productService } from "../../services/productService";
import { useDebounce } from "../../hooks/useDebounce";
import { toast } from "../../stores/toastStore";
import { ApiError } from "../../lib/api";
import { playSound } from "../../lib/sound";
import type { Product } from "../../types";

/**
 * Category-side counterpart of the product-drawer's CategoryAssigner.
 * The category is fixed (passed in); the user searches and picks a product
 * to add to it. Calls `productService.addCategory(productId, categoryId)`
 * — the same product-side endpoint used everywhere else, so audit and
 * permission rules apply uniformly.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  categoryId: number;
  categoryName: string;
  /** Products already in the category — hidden from the picker. */
  alreadyInCategoryProductIds: number[];
};

export function CategoryProductLinkDialog({
  open,
  onClose,
  categoryId,
  categoryName,
  alreadyInCategoryProductIds,
}: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState<number>(0);
  const debounced = useDebounce(search, 200);

  const allProducts = useQuery({
    queryKey: ["products"],
    queryFn: productService.list,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setProductId(0);
  }, [open]);

  const filtered = useMemo(() => {
    const linked = new Set(alreadyInCategoryProductIds);
    const q = debounced.toLowerCase().trim();
    return (allProducts.data ?? [])
      .filter(
        (p: Product) =>
          p.isActive &&
          !linked.has(p.id) &&
          (q === "" ||
            `${p.name} ${p.description} ${p.internalBarcode}`
              .toLowerCase()
              .includes(q)),
      )
      .slice(0, 50);
  }, [allProducts.data, alreadyInCategoryProductIds, debounced]);

  const mutation = useMutation({
    mutationFn: () => productService.addCategory(productId, categoryId),
    onSuccess: () => {
      toast.success("Product added to category");
      playSound("saveOk");
      queryClient.invalidateQueries({
        queryKey: ["category-products", categoryId],
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({
        queryKey: ["product-full-details", productId],
      });
      onClose();
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Could not add";
      toast.error("Failed", message);
      playSound("saveError");
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add a product to ${categoryName}`}
      description="Pick a product to include in this category."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={productId <= 0}
            onClick={() => mutation.mutate()}
          >
            Add product
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Find product"
          placeholder="Type to search by name, description, or internal barcode"
          leadingIcon={<Search size={14} />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <ul className="max-h-[260px] divide-y divide-[color:var(--border)] overflow-y-auto scroll-slim rounded-xl border border-subtle">
          {allProducts.isLoading ? (
            <li className="px-4 py-3 text-xs text-muted">Loading…</li>
          ) : filtered.length === 0 ? (
            <li className="px-4 py-3 text-xs text-muted">
              {alreadyInCategoryProductIds.length > 0
                ? "No more products to add, or no matches."
                : "No matches."}
            </li>
          ) : (
            filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setProductId(p.id)}
                  className={
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors " +
                    (productId === p.id
                      ? "bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-900)]/30"
                      : "hover:bg-muted")
                  }
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-[var(--color-brand-700)] shadow-card">
                    <Box size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-default">
                      {p.name}
                    </p>
                    <p className="truncate text-[11px] text-muted font-mono">
                      {p.internalBarcode || "no internal barcode"}
                    </p>
                  </div>
                  <StockBadge
                    current={p.currentStock}
                    minimum={p.minimumStock}
                  />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </Dialog>
  );
}
