import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { Switch } from "../ui/Switch";
import { productService } from "../../services/productService";
import { supplierService } from "../../services/supplierService";
import { toast } from "../../stores/toastStore";
import { ApiError } from "../../lib/api";
import { playSound } from "../../lib/sound";
import type { ProductSupplier, ProductSupplierRequest } from "../../types";

type Props = {
  open: boolean;
  onClose: () => void;
  productId: number;
  existing?: ProductSupplier | null;
};

export function ProductSupplierDialog({
  open,
  onClose,
  productId,
  existing,
}: Props) {
  const queryClient = useQueryClient();
  const editing = Boolean(existing);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: supplierService.list,
  });

  const [form, setForm] = useState<ProductSupplierRequest>({
    supplierId: 0,
    supplierBarcode: "",
    price: 0,
    lastPurchaseDate: null,
    isPreferredSupplier: false,
  });

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({
        supplierId: existing.supplierId,
        supplierBarcode: existing.supplierBarcode,
        price: existing.price,
        lastPurchaseDate: existing.lastPurchaseDate
          ? existing.lastPurchaseDate.slice(0, 10)
          : null,
        isPreferredSupplier: existing.isPreferredSupplier,
      });
    } else {
      setForm({
        supplierId: suppliers[0]?.id ?? 0,
        supplierBarcode: "",
        price: 0,
        lastPurchaseDate: null,
        isPreferredSupplier: false,
      });
    }
  }, [open, existing, suppliers]);

  const mutation = useMutation({
    mutationFn: () => {
      if (editing && existing) {
        return productService.updateSupplier(productId, existing.id, form);
      }
      return productService.addSupplier(productId, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-full-details", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-suppliers", productId] });
      toast.success(editing ? "Supplier updated" : "Supplier linked");
      playSound("saveOk");
      onClose();
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Could not save";
      toast.error("Failed", message);
      playSound("saveError");
    },
  });

  const valid = form.supplierId > 0 && form.price >= 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit supplier price" : "Link a supplier"}
      description={
        editing
          ? "Adjust price, barcode, or preferred status."
          : "Connect a supplier to this product."
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!valid}
            onClick={() => mutation.mutate()}
          >
            {editing ? "Save" : "Link supplier"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Supplier"
          value={String(form.supplierId)}
          onChange={(event) =>
            setForm({ ...form, supplierId: Number(event.target.value) })
          }
          disabled={editing}
          options={
            suppliers.length === 0
              ? [{ value: "0", label: "No suppliers — create one first" }]
              : suppliers.map((s) => ({ value: String(s.id), label: s.name }))
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            type="number"
            step="0.01"
            min={0}
            label="Unit price"
            value={form.price}
            onChange={(event) =>
              setForm({ ...form, price: Math.max(0, Number(event.target.value)) })
            }
          />
          <Input
            label="Supplier barcode"
            placeholder="EAN-13, UPC, etc."
            value={form.supplierBarcode}
            onChange={(event) =>
              setForm({ ...form, supplierBarcode: event.target.value })
            }
          />
        </div>

        <Input
          type="date"
          label="Last purchase date"
          value={form.lastPurchaseDate ?? ""}
          onChange={(event) =>
            setForm({
              ...form,
              lastPurchaseDate: event.target.value ? event.target.value : null,
            })
          }
        />

        <Switch
          checked={form.isPreferredSupplier}
          onChange={(value) => setForm({ ...form, isPreferredSupplier: value })}
          label="Preferred supplier"
          description="Restock estimate will pick this supplier first."
        />
      </div>
    </Dialog>
  );
}
