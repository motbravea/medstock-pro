import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../ui/Dialog";
import { Input, Textarea } from "../ui/Input";
import { Button } from "../ui/Button";
import { productService } from "../../services/productService";
import { toast } from "../../stores/toastStore";
import { playSound } from "../../lib/sound";
import { ApiError } from "../../lib/api";
import type { Product } from "../../types";

type FormState = {
  name: string;
  description: string;
  photoPath: string;
  currentStock: number;
  minimumStock: number;
  expiryDate: string;
  expiryAlertDays: number;
  internalBarcode: string;
  isActive: boolean;
};

const blank: FormState = {
  name: "",
  description: "",
  photoPath: "",
  currentStock: 0,
  minimumStock: 0,
  expiryDate: "",
  expiryAlertDays: 30,
  internalBarcode: "",
  isActive: true,
};

type ProductFormDialogProps = {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
};

export function ProductFormDialog({
  open,
  onClose,
  product,
}: ProductFormDialogProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(product);
  const [form, setForm] = useState<FormState>(blank);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      product
        ? {
            name: product.name,
            description: product.description,
            photoPath: product.photoPath,
            currentStock: product.currentStock,
            minimumStock: product.minimumStock,
            expiryDate: product.expiryDate ? product.expiryDate.slice(0, 10) : "",
            expiryAlertDays: product.expiryAlertDays,
            internalBarcode: product.internalBarcode,
            isActive: product.isActive,
          }
        : blank,
    );
  }, [open, product]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const expiryDate = form.expiryDate ? form.expiryDate : null;
      if (editing && product) {
        return productService.update(product.id, {
          name: form.name.trim(),
          description: form.description,
          photoPath: form.photoPath,
          currentStock: form.currentStock,
          minimumStock: form.minimumStock,
          expiryDate,
          expiryAlertDays: form.expiryAlertDays,
          internalBarcode: form.internalBarcode.trim(),
          isActive: form.isActive,
        });
      }
      return productService.create({
        name: form.name.trim(),
        description: form.description,
        photoPath: form.photoPath,
        currentStock: form.currentStock,
        minimumStock: form.minimumStock,
        expiryDate,
        expiryAlertDays: form.expiryAlertDays,
        internalBarcode: form.internalBarcode.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(
        editing ? "Product updated" : "Product created",
        editing ? "Changes saved." : "Added to inventory.",
      );
      playSound("saveOk");
      onClose();
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : "Could not save product";
      setError(message);
      toast.error("Save failed", message);
      playSound("saveError");
    },
  });

  function submit() {
    setError("");
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (form.currentStock < 0 || form.minimumStock < 0) {
      setError("Stock values must be 0 or higher.");
      return;
    }
    if (form.expiryAlertDays < 1 || form.expiryAlertDays > 365) {
      setError("Expiry alert window must be between 1 and 365 days.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit product" : "New product"}
      description={
        editing
          ? "Update product details, stock, and expiry."
          : "Add a new product to inventory."
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} onClick={submit}>
            {editing ? "Save changes" : "Create product"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Product name"
            placeholder="e.g. Nitrile gloves (M)"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
          />
          <Input
            label="Internal barcode"
            placeholder="MSP-000123 or scan…"
            hint="Optional — you can generate one later."
            value={form.internalBarcode}
            onChange={(event) => update("internalBarcode", event.target.value)}
          />
        </div>

        <Textarea
          label="Description"
          placeholder="Notes the team should see when this product appears"
          rows={3}
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            type="number"
            label="Current stock"
            min={0}
            value={form.currentStock}
            onChange={(event) =>
              update("currentStock", Math.max(0, Number(event.target.value)))
            }
          />
          <Input
            type="number"
            label="Minimum stock"
            min={0}
            hint={
              form.minimumStock === 0
                ? "Stock will be marked as warning when only 1 remains, and critical when it reaches 0."
                : "Minimum stock controls the warning level. Products at 0 are always critical."
            }
            value={form.minimumStock}
            onChange={(event) =>
              update("minimumStock", Math.max(0, Number(event.target.value)))
            }
          />
          <Input
            type="number"
            label="Expiry alert (days)"
            min={1}
            max={365}
            value={form.expiryAlertDays}
            onChange={(event) =>
              update("expiryAlertDays", Math.max(1, Number(event.target.value)))
            }
          />
        </div>

        <Input
          type="date"
          label="Expiry date"
          hint="Leave empty for non-perishable items"
          value={form.expiryDate}
          onChange={(event) => update("expiryDate", event.target.value)}
        />

        {editing && (
          <p className="rounded-xl border border-subtle bg-muted px-3 py-2 text-xs text-muted">
            Use the photo uploader inside the product details drawer to add or
            replace a product photo.
          </p>
        )}

        {editing && (
          <label className="flex items-center gap-2 text-sm text-default">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-subtle accent-[var(--color-brand-700)]"
              checked={form.isActive}
              onChange={(event) => update("isActive", event.target.checked)}
            />
            Active in inventory
          </label>
        )}
      </form>
    </Dialog>
  );
}
