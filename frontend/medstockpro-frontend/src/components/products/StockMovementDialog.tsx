import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../ui/Dialog";
import { Input, Select, Textarea } from "../ui/Input";
import { Button } from "../ui/Button";
import { stockMovementService } from "../../services/stockMovementService";
import { toast } from "../../stores/toastStore";
import { ApiError } from "../../lib/api";
import type { MovementType, Product } from "../../types";

const movementOptions: { value: MovementType; label: string; helper: string }[] = [
  { value: "StockIn", label: "Stock in", helper: "Add to inventory" },
  { value: "StockOut", label: "Stock out", helper: "Use during treatment" },
  { value: "Adjustment", label: "Adjustment", helper: "Set absolute count" },
  { value: "Damaged", label: "Damaged", helper: "Mark and remove" },
  { value: "Expired", label: "Expired", helper: "Mark and remove" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  product: Product;
};

export function StockMovementDialog({ open, onClose, product }: Props) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<MovementType>("StockOut");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      stockMovementService.create({
        productId: product.id,
        movementType: type,
        quantity,
        notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({
        queryKey: ["product-movements", product.id],
      });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Movement recorded", `${type} · qty ${quantity}`);
      setQuantity(1);
      setNotes("");
      onClose();
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : "Movement failed";
      toast.error("Could not record movement", message);
    },
  });

  const previewStock =
    type === "StockIn"
      ? product.currentStock + quantity
      : type === "Adjustment"
        ? quantity
        : Math.max(0, product.currentStock - quantity);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record stock movement"
      description={product.name}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
            disabled={quantity <= 0}
          >
            Save movement
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Type"
          value={type}
          onChange={(event) => setType(event.target.value as MovementType)}
          options={movementOptions.map((option) => ({
            value: option.value,
            label: `${option.label} — ${option.helper}`,
          }))}
        />

        <Input
          type="number"
          min={1}
          label={type === "Adjustment" ? "New stock level" : "Quantity"}
          value={quantity}
          onChange={(event) => setQuantity(Math.max(0, Number(event.target.value)))}
        />

        <Textarea
          label="Notes"
          placeholder="Optional context (e.g. patient, supplier delivery, batch)"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />

        <div className="rounded-xl border border-subtle bg-muted p-3 text-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Preview</p>
          <p className="mt-1 text-default">
            <span className="tabular font-semibold">
              {product.currentStock}
            </span>{" "}
            <span className="text-muted">→</span>{" "}
            <span className="tabular font-semibold">{previewStock}</span>
          </p>
        </div>
      </div>
    </Dialog>
  );
}
