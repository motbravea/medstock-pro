import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Search } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Switch } from "../ui/Switch";
import { Badge, StockBadge } from "../ui/Badge";
import { productService } from "../../services/productService";
import { useDebounce } from "../../hooks/useDebounce";
import { toast } from "../../stores/toastStore";
import { ApiError } from "../../lib/api";
import { playSound } from "../../lib/sound";
import type { Product, SupplierProduct } from "../../types";

/**
 * Supplier-side counterpart of ProductSupplierDialog. The supplier is fixed
 * (provided as a prop); the user searches/picks a product, then sets the
 * link metadata (price, supplier barcode, preferred flag, last purchase
 * date). Reuses `productService.addSupplier` / `updateSupplier` — no new
 * backend mutation is needed.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  supplierId: number;
  supplierName: string;
  /** Pass an existing supplier-product row to enter edit mode. */
  editing: SupplierProduct | null;
  /** Products already linked to this supplier — hidden from the search. */
  alreadyLinkedProductIds: number[];
};

export function SupplierProductLinkDialog({
  open,
  onClose,
  supplierId,
  supplierName,
  editing,
  alreadyLinkedProductIds,
}: Props) {
  const queryClient = useQueryClient();
  const isEdit = editing !== null;

  const [productId, setProductId] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [supplierBarcode, setSupplierBarcode] = useState("");
  const [lastPurchaseDate, setLastPurchaseDate] = useState<string>("");
  const [preferred, setPreferred] = useState(false);

  const debounced = useDebounce(search, 200);

  // Load product list once for the picker. Cheap — the table is tiny on a
  // single-clinic install.
  const allProducts = useQuery({
    queryKey: ["products"],
    queryFn: productService.list,
    enabled: open && !isEdit,
  });

  // Reset form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setProductId(editing.productId);
      setSearch("");
      setPrice(editing.price);
      setSupplierBarcode(editing.supplierBarcode);
      setLastPurchaseDate(
        editing.lastPurchaseDate
          ? editing.lastPurchaseDate.slice(0, 10)
          : "",
      );
      setPreferred(editing.isPreferredSupplier);
    } else {
      setProductId(0);
      setSearch("");
      setPrice(0);
      setSupplierBarcode("");
      setLastPurchaseDate("");
      setPreferred(false);
    }
  }, [open, editing]);

  // Filter the catalog: active products, not already linked, matching search.
  const filtered = useMemo(() => {
    if (isEdit) return [];
    const linked = new Set(alreadyLinkedProductIds);
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
  }, [allProducts.data, alreadyLinkedProductIds, debounced, isEdit]);

  const selectedProduct = useMemo(
    () => (allProducts.data ?? []).find((p) => p.id === productId) ?? null,
    [allProducts.data, productId],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        supplierId,
        supplierBarcode,
        price,
        lastPurchaseDate: lastPurchaseDate || null,
        isPreferredSupplier: preferred,
      };
      if (isEdit && editing) {
        return productService.updateSupplier(
          editing.productId,
          editing.productSupplierId,
          payload,
        );
      }
      return productService.addSupplier(productId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["supplier-products", supplierId],
      });
      queryClient.invalidateQueries({
        queryKey: ["product-full-details", editing?.productId ?? productId],
      });
      toast.success(isEdit ? "Link updated" : "Product linked");
      playSound("saveOk");
      onClose();
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Could not save";
      toast.error("Failed", message);
      playSound("saveError");
    },
  });

  const canSubmit = isEdit ? price >= 0 : productId > 0 && price >= 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit price & barcode" : `Link a product to ${supplierName}`}
      description={
        isEdit
          ? `Update what ${supplierName} charges for this product.`
          : "Pick a product to add to this supplier's catalog."
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
          >
            {isEdit ? "Save" : "Link product"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Product picker — hidden in edit mode (the row already references a product). */}
        {!isEdit && (
          <>
            <Input
              label="Find product"
              placeholder="Type to search by name, description, or barcode"
              leadingIcon={<Search size={14} />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <ul className="max-h-[240px] divide-y divide-[color:var(--border)] overflow-y-auto scroll-slim rounded-xl border border-subtle">
              {allProducts.isLoading ? (
                <li className="px-4 py-3 text-xs text-muted">Loading…</li>
              ) : filtered.length === 0 ? (
                <li className="px-4 py-3 text-xs text-muted">
                  {alreadyLinkedProductIds.length > 0
                    ? "No more products to link, or no matches."
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
          </>
        )}

        {isEdit && editing && (
          <div className="rounded-xl border border-subtle bg-muted/40 px-3 py-2 text-sm text-default">
            <Badge tone="brand">{editing.productName}</Badge>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            type="number"
            step="0.01"
            min={0}
            label="Unit price"
            value={price}
            onChange={(event) =>
              setPrice(Math.max(0, Number(event.target.value)))
            }
          />
          <Input
            label="Supplier barcode"
            placeholder="EAN-13, UPC, etc."
            value={supplierBarcode}
            onChange={(event) => setSupplierBarcode(event.target.value)}
          />
        </div>

        <Input
          type="date"
          label="Last purchase date (optional)"
          value={lastPurchaseDate}
          onChange={(event) => setLastPurchaseDate(event.target.value)}
        />

        <Switch
          checked={preferred}
          onChange={setPreferred}
          label="Preferred supplier for this product"
          description="Restock estimate picks this supplier first."
        />

        {!isEdit && selectedProduct && (
          <p className="text-[11px] text-muted">
            You're linking{" "}
            <span className="font-semibold text-default">
              {selectedProduct.name}
            </span>{" "}
            to <span className="font-semibold text-default">{supplierName}</span>.
          </p>
        )}
      </div>
    </Dialog>
  );
}
