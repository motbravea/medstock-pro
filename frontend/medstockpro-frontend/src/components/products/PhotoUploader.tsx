import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { productService, resolvePhotoUrl } from "../../services/productService";
import { toast } from "../../stores/toastStore";
import { playSound } from "../../lib/sound";
import { ApiError } from "../../lib/api";
import { Button } from "../ui/Button";

type Props = {
  productId: number;
  currentPhotoPath: string;
  canEdit: boolean;
};

const ALLOWED = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function PhotoUploader({ productId, currentPhotoPath, canEdit }: Props) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const upload = useMutation({
    mutationFn: (file: File) => productService.uploadPhoto(productId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-full-details", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Photo uploaded");
      playSound("saveOk");
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Upload failed";
      toast.error("Photo upload failed", message);
      playSound("saveError");
    },
  });

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED.includes(ext)) {
      toast.error("Only JPG, PNG, or WEBP images are allowed.");
      playSound("saveError");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Photo must be smaller than 5 MB.");
      playSound("saveError");
      return;
    }
    upload.mutate(file);
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
    if (event.target) event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!canEdit) return;
    handleFile(event.dataTransfer.files?.[0]);
  }

  const photoUrl = resolvePhotoUrl(currentPhotoPath);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (canEdit) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex h-44 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
          dragging
            ? "border-[var(--color-brand-700)] bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-900)]/30"
            : "border-subtle bg-muted"
        }`}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Product"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted">
            <Camera size={24} strokeWidth={1.5} />
            <p className="text-xs">No photo yet</p>
          </div>
        )}

        {upload.isPending && (
          <div className="absolute inset-0 grid place-items-center bg-slate-900/40 text-white">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={onPick}
          />
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={photoUrl ? <Upload size={14} /> : <ImagePlus size={14} />}
            onClick={() => fileInput.current?.click()}
            loading={upload.isPending}
          >
            {photoUrl ? "Replace photo" : "Browse photo"}
          </Button>
          {photoUrl && (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<X size={14} />}
              onClick={() => {
                // Frontend-only "clear": upload an empty file is not allowed; the
                // proper way is to PUT the product with photoPath="". We do that
                // by re-saving the product through the form — for now just tell
                // the user.
                toast.info("Edit the product and clear the photo path to remove.");
              }}
            >
              Remove
            </Button>
          )}
          <p className="ml-auto text-[11px] text-subtle">
            JPG / PNG / WEBP · max 5 MB
          </p>
        </div>
      )}
    </div>
  );
}
