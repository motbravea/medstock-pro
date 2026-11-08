import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import JsBarcode from "jsbarcode";
import { Minus, Plus, Printer } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input, Select, Textarea } from "../ui/Input";
import { Skeleton } from "../ui/Skeleton";
import { productService } from "../../services/productService";
import { toast } from "../../stores/toastStore";
import { formatDate } from "../../lib/format";
import type { BarcodeLabel } from "../../types";

type Props = {
  open: boolean;
  onClose: () => void;
  productId: number;
};

type NotePlacement = "end" | "each";

export function BarcodeLabelDialog({ open, onClose, productId }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Print controls.
  const [copies, setCopies] = useState(1);
  const [note, setNote] = useState("");
  const [notePlacement, setNotePlacement] = useState<NotePlacement>("end");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["barcode-label", productId],
    queryFn: () => productService.barcodeLabel(productId),
    enabled: open && productId > 0,
  });

  // Reset the controls whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setCopies(1);
      setNote("");
      setNotePlacement("end");
    }
  }, [open, productId]);

  // Preview barcode.
  useEffect(() => {
    if (!data || !svgRef.current) return;
    JsBarcode(svgRef.current, data.barcodeValue, {
      format: "CODE128",
      lineColor: "#0f172a",
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 13,
      margin: 6,
    });
  }, [data]);

  function handlePrint() {
    if (!data) return;
    try {
      printLabels(data, copies, note.trim(), notePlacement);
      onClose();
    } catch (err) {
      toast.error(
        "Could not open print dialog",
        err instanceof Error ? err.message : "Unknown error",
      );
    }
  }

  const totalStickers =
    copies + (note.trim() ? (notePlacement === "each" ? copies : 1) : 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Barcode label"
      description="Designed for 2 × 1 inch direct-thermal label stock."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            leadingIcon={<Printer size={16} />}
            onClick={handlePrint}
            disabled={!data}
          >
            Print {totalStickers} sticker{totalStickers === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      {isLoading && <Skeleton className="h-40 rounded-xl" />}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
          Could not load the label. Make sure the product has an internal barcode.
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-2 underline"
          >
            Retry
          </button>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* WYSIWYG preview at roughly 2× scale for readability. */}
          <div className="mx-auto w-fit rounded-xl border border-subtle bg-white p-4 shadow-card">
            <div>
              <div
                className="name"
                style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.15 }}
              >
                {data.labelTitle}
              </div>
              <svg ref={svgRef} />
            </div>
          </div>

          {/* Print controls */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-default">
                Copies
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setCopies((c) => Math.max(1, c - 1))}
                  disabled={copies <= 1}
                  aria-label="Fewer copies"
                >
                  <Minus size={16} />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={copies}
                  onChange={(event) =>
                    setCopies(
                      Math.min(500, Math.max(1, Number(event.target.value) || 1)),
                    )
                  }
                  className="text-center"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setCopies((c) => Math.min(500, c + 1))}
                  disabled={copies >= 500}
                  aria-label="More copies"
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            <Select
              label="Note placement"
              value={notePlacement}
              onChange={(event) =>
                setNotePlacement(event.target.value as NotePlacement)
              }
              disabled={!note.trim()}
              options={[
                { value: "end", label: "One note sticker at the end" },
                { value: "each", label: "A note sticker after every label" },
              ]}
              hint={
                note.trim()
                  ? undefined
                  : "Add a note below to enable this."
              }
            />
          </div>

          <Textarea
            label="Note (optional second sticker)"
            rows={2}
            placeholder="e.g. Store in fridge · Lot #1234 · Opened 2026-06-04"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />

          <dl className="grid grid-cols-2 gap-y-1 text-xs">
            <dt className="text-muted">Barcode</dt>
            <dd className="text-right font-mono text-default">
              {data.barcodeValue}
            </dd>
            <dt className="text-muted">Type</dt>
            <dd className="text-right text-default">{data.barcodeType}</dd>
            <dt className="text-muted">Stock</dt>
            <dd className="text-right tabular text-default">
              {data.currentStock} / {data.minimumStock} min
            </dd>
            <dt className="text-muted">Expiry</dt>
            <dd className="text-right text-default">
              {data.expiryDate ? formatDate(data.expiryDate) : "—"}
            </dd>
          </dl>
        </div>
      )}
    </Dialog>
  );
}

/**
 * Build a print job for a single product: `copies` barcode stickers, plus
 * an optional note sticker (once at the end, or after every barcode). Uses
 * a hidden iframe so it works inside Tauri's WebView (where window.open
 * returns null).
 */
function printLabels(
  label: BarcodeLabel,
  copies: number,
  note: string,
  notePlacement: NotePlacement,
) {
  // Render the barcode SVG once and reuse the string for every copy.
  const serializer = new XMLSerializer();
  const scratchHost = document.createElement("div");
  scratchHost.style.position = "absolute";
  scratchHost.style.left = "-9999px";
  document.body.appendChild(scratchHost);

  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg") as SVGSVGElement;
  scratchHost.appendChild(svg);
  try {
    JsBarcode(svg, label.barcodeValue, {
      format: "CODE128",
      lineColor: "#000000",
      width: 2,
      height: 50,
      displayValue: true,
      fontSize: 11,
      margin: 4,
    });
  } catch {
    svg.outerHTML = `<svg xmlns="${svgNs}"><text>${escapeHtml(
      label.barcodeValue,
    )}</text></svg>`;
  }
  const barcodeSvg = serializer.serializeToString(svg);
  scratchHost.remove();

  const barcodeHtml = renderBarcodeLabel(label, barcodeSvg);
  const noteHtml = note ? renderNoteLabel(label, note) : "";

  // Assemble the sticker sequence.
  const stickers: string[] = [];
  for (let i = 0; i < copies; i++) {
    stickers.push(barcodeHtml);
    if (note && notePlacement === "each") {
      stickers.push(noteHtml);
    }
  }
  if (note && notePlacement === "end") {
    stickers.push(noteHtml);
  }

  const doc = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MedStock Pro — ${escapeHtml(label.labelTitle ?? label.productName ?? "")}</title>
  <style>
    @page { size: 2in 1in; margin: 0; }
    html, body {
      margin: 0; padding: 0; background: #ffffff;
      font-family: Inter, "Segoe UI", system-ui, sans-serif; color: #0f172a;
    }
    .label {
      box-sizing: border-box;
      width: 2in; height: 1in;
      padding: 0.06in 0.08in;
      display: grid; grid-template-rows: auto 1fr auto; gap: 0.02in;
      page-break-after: always;
    }
    .label:last-child { page-break-after: auto; }
    .name {
      font-size: 9pt; font-weight: 600; line-height: 1.1;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .barcode { display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .barcode svg { max-width: 100%; height: 100%; }
    .meta { display: flex; justify-content: space-between; font-size: 8pt; line-height: 1; }
    .meta .qty { font-weight: 700; }
    /* Note sticker: product name small at top, the note big and centered. */
    .note-label {
      box-sizing: border-box;
      width: 2in; height: 1in;
      padding: 0.08in;
      display: flex; flex-direction: column; gap: 0.04in;
      page-break-after: always;
    }
    .note-label:last-child { page-break-after: auto; }
    .note-head { font-size: 7pt; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }
    .note-body {
      flex: 1; display: flex; align-items: center;
      font-size: 11pt; font-weight: 600; line-height: 1.2;
      overflow: hidden;
      word-break: break-word;
    }
  </style>
</head>
<body>
  ${stickers.join("\n")}
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const innerDoc = iframe.contentDocument;
  const innerWin = iframe.contentWindow;
  if (!innerDoc || !innerWin) {
    iframe.remove();
    throw new Error("Could not create the print frame. Try restarting the app.");
  }

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    iframe.remove();
  };
  innerWin.addEventListener("afterprint", cleanup);
  setTimeout(cleanup, 60_000);

  innerDoc.open();
  innerDoc.write(doc);
  innerDoc.close();

  setTimeout(() => {
    try {
      innerWin.focus();
      innerWin.print();
    } catch (err) {
      cleanup();
      toast.error(
        "Could not open print dialog",
        err instanceof Error ? err.message : "Unknown error",
      );
    }
  }, 200);
}

function renderBarcodeLabel(label: BarcodeLabel, svgString: string): string {
  return `
  <div class="label">
    <div class="name">${escapeHtml(label.labelTitle ?? label.productName ?? "")}</div>
    <div class="barcode">${svgString}</div>
  </div>`;
}

function renderNoteLabel(label: BarcodeLabel, note: string): string {
  return `
  <div class="note-label">
    <div class="note-head">${escapeHtml(label.labelTitle ?? label.productName ?? "Note")}</div>
    <div class="note-body">${escapeHtml(note)}</div>
  </div>`;
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
