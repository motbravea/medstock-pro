import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import JsBarcode from "jsbarcode";
import { Loader2, Printer, Tags } from "lucide-react";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Select } from "../ui/Input";
import { productService } from "../../services/productService";
import { categoryService } from "../../services/categoryService";
import { toast } from "../../stores/toastStore";
import { ApiError } from "../../lib/api";
import type { BarcodeLabel } from "../../types";

/**
 * Bulk label printer with a "Print by section" workflow.
 *
 * Click "Print labels" → dialog opens → pick a category (or "All") →
 * click Print → backend returns just the labels for that section → an
 * in-page hidden iframe is built, the OS print dialog opens targeting
 * the Zebra ZD410.
 *
 * Using an iframe (not a new window) is what makes this work in Tauri's
 * WebView, where window.open() returns null.
 */
export function PrintAllLabelsButton() {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        leadingIcon={<Printer size={14} />}
        onClick={() => setDialogOpen(true)}
      >
        Print labels
      </Button>
      <PrintLabelsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}

function PrintLabelsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // "" means "All categories" — sent to the backend as no categoryId.
  const [categoryId, setCategoryId] = useState<string>("");

  useEffect(() => {
    if (open) setCategoryId("");
  }, [open]);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: categoryService.list,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      productService.allBarcodeLabels(
        categoryId ? Number(categoryId) : undefined,
      ),
    onSuccess: (data) => {
      if (data.total === 0) {
        toast.warning(
          "Nothing to print",
          data.categoryName
            ? `No product in "${data.categoryName}" has an internal barcode yet.`
            : "No active product has an internal barcode. Generate barcodes first from the product detail drawer.",
        );
        return;
      }
      try {
        renderBulkPrintFrame(data.labels, data.categoryName);
        // Close the dialog so the print preview takes focus.
        onClose();
      } catch (err) {
        toast.error(
          "Could not open print dialog",
          err instanceof Error ? err.message : "Unknown error",
        );
      }
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : "Could not load labels";
      toast.error("Print failed", message);
    },
  });

  const activeCategories = (categories.data ?? []).filter((c) => c.isActive);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Print barcode labels"
      description="Pick which section to print. Each label has the product name, barcode, and current stock."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            leadingIcon={
              mutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Printer size={14} />
              )
            }
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {categoryId ? "Print this section" : "Print all"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select
          label="Section (category)"
          leadingIcon={<Tags size={14} />}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          options={[
            { value: "", label: "All categories" },
            ...activeCategories.map((c) => ({
              value: String(c.id),
              label: c.name,
            })),
          ]}
          hint={
            categoryId
              ? "Only products in this category that already have an internal barcode will print."
              : "Every active product with an internal barcode will print."
          }
        />
        <p className="text-[11px] text-muted">
          Once the print dialog opens, pick <strong>Zebra ZD410</strong> as
          destination, paper <strong>2" × 1"</strong>, margins{" "}
          <strong>None</strong>, scale <strong>100%</strong>.
        </p>
      </div>
    </Dialog>
  );
}

/**
 * Build the print HTML in-memory, mount it into a hidden iframe inside
 * the current document, then trigger the iframe's window.print(). This
 * works in both Tauri (where window.open returns null) and browsers.
 *
 * We render each barcode SVG with JsBarcode in the parent window first,
 * then serialise it to a string so the print iframe is fully self-
 * contained — no network deps.
 */
function renderBulkPrintFrame(
  labels: BarcodeLabel[],
  categoryName: string | null,
) {
  const serializer = new XMLSerializer();
  const scratchHost = document.createElement("div");
  scratchHost.style.position = "absolute";
  scratchHost.style.left = "-9999px";
  scratchHost.style.top = "0";
  document.body.appendChild(scratchHost);

  const labelHtmls: string[] = [];

  try {
    for (const label of labels) {
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

      const svgString = serializer.serializeToString(svg);
      labelHtmls.push(renderLabelHtml(label, svgString));
    }
  } finally {
    scratchHost.remove();
  }

  const totalLabels = labels.length;
  const titleSuffix = categoryName ? ` — ${categoryName}` : "";

  const doc = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MedStock Pro — ${totalLabels} labels${escapeHtml(titleSuffix)}</title>
  <style>
    @page {
      size: 2in 1in;
      margin: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: Inter, "Segoe UI", system-ui, sans-serif;
      color: #0f172a;
    }
    .label {
      box-sizing: border-box;
      width: 2in;
      height: 1in;
      padding: 0.06in 0.08in;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 0.02in;
      page-break-after: always;
    }
    .label:last-child {
      page-break-after: auto;
    }
    .name {
      font-size: 9pt;
      font-weight: 600;
      line-height: 1.1;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .barcode {
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .barcode svg {
      max-width: 100%;
      height: 100%;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      line-height: 1;
    }
    .meta .qty {
      font-weight: 700;
    }
  </style>
</head>
<body>
  ${labelHtmls.join("\n")}
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
    throw new Error(
      "Could not create the print frame. Try restarting the app.",
    );
  }

  let cleanedUp = false;
  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    iframe.remove();
  }
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

function renderLabelHtml(label: BarcodeLabel, svgString: string): string {
  return `
  <div class="label">
    <div class="name">${escapeHtml(label.labelTitle ?? label.productName ?? "")}</div>
    <div class="barcode">${svgString}</div>
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
