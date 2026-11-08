import { api, getServerOrigin } from "../lib/api";
import type {
  BarcodeLabel,
  Category,
  CreateProductRequest,
  Product,
  ProductBarcode,
  ProductBarcodeRequest,
  ProductFullDetails,
  ProductSupplier,
  ProductSupplierRequest,
  ScanResult,
  SetupStatus,
  UpdateProductRequest,
} from "../types";

/** Turn a /uploads/... path into a fully-qualified URL for <img src=...>. */
export function resolvePhotoUrl(photoPath: string | null | undefined): string {
  if (!photoPath) return "";
  if (photoPath.startsWith("http")) return photoPath;
  // Photos are served by the same backend host, minus the "/api" suffix, so a
  // client PC loads them from the main computer (not localhost).
  const root = getServerOrigin();
  return `${root}${photoPath.startsWith("/") ? "" : "/"}${photoPath}`;
}

export const productService = {
  list: () => api.get<Product[]>("/Products"),

  get: (id: number) => api.get<Product>(`/Products/${id}`),

  search: (query: string) =>
    api.get<Product[]>("/Products/search", { query: { query } }),

  create: (data: CreateProductRequest) =>
    api.post<{ message: string; product: Product }>("/Products", data),

  update: (id: number, data: UpdateProductRequest) =>
    api.put<{ message: string; product: Product }>(`/Products/${id}`, data),

  remove: (id: number) =>
    api.delete<{ message: string }>(`/Products/${id}`),

  byBarcode: (barcode: string) =>
    api.get<ScanResult>(`/Products/by-barcode/${encodeURIComponent(barcode)}`),

  /* ── Categories ────────────────────────────────────────────────────── */

  getCategories: (productId: number) =>
    api.get<Pick<Category, "id" | "name" | "description">[]>(
      `/Products/${productId}/categories`,
    ),

  addCategory: (productId: number, categoryId: number) =>
    api.post<{ message: string }>(
      `/Products/${productId}/categories/${categoryId}`,
    ),

  removeCategory: (productId: number, categoryId: number) =>
    api.delete<{ message: string }>(
      `/Products/${productId}/categories/${categoryId}`,
    ),

  /* ── Suppliers ─────────────────────────────────────────────────────── */

  getSuppliers: (productId: number) =>
    api.get<ProductSupplier[]>(`/Products/${productId}/suppliers`),

  addSupplier: (productId: number, data: ProductSupplierRequest) =>
    api.post<{ message: string }>(`/Products/${productId}/suppliers`, data),

  updateSupplier: (
    productId: number,
    productSupplierId: number,
    data: ProductSupplierRequest,
  ) =>
    api.put<{ message: string }>(
      `/Products/${productId}/suppliers/${productSupplierId}`,
      data,
    ),

  removeSupplier: (productId: number, productSupplierId: number) =>
    api.delete<{ message: string }>(
      `/Products/${productId}/suppliers/${productSupplierId}`,
    ),

  /* ── Barcodes ──────────────────────────────────────────────────────── */

  getBarcodes: (productId: number) =>
    api.get<ProductBarcode[]>(`/Products/${productId}/barcodes`),

  addBarcode: (productId: number, data: ProductBarcodeRequest) =>
    api.post<{ message: string; barcode: ProductBarcode }>(
      `/Products/${productId}/barcodes`,
      data,
    ),

  generateInternalBarcode: (productId: number) =>
    api.post<{
      message: string;
      product: string;
      barcodeValue: string;
      barcodeType: string;
    }>(`/Products/${productId}/generate-barcode`),

  removeBarcode: (productId: number, barcodeId: number) =>
    api.delete<{ message: string }>(
      `/Products/${productId}/barcodes/${barcodeId}`,
    ),

  /* ── New endpoints (added in latest backend) ──────────────────────── */

  uploadPhoto: (productId: number, file: File) =>
    api.upload<{
      message: string;
      productId: number;
      productName: string;
      photoPath: string;
      photoUrl: string;
    }>(`/Products/${productId}/photo`, "photo", file),

  fullDetails: (productId: number) =>
    api.get<ProductFullDetails>(`/Products/${productId}/full-details`),

  setupStatus: (productId: number) =>
    api.get<SetupStatus>(`/Products/${productId}/setup-status`),

  barcodeLabel: (productId: number) =>
    api.get<BarcodeLabel>(`/Products/${productId}/barcode-label`),

  // Bulk: one label payload per active product that has an internal
  // barcode. Optional categoryId restricts the batch to a single section.
  allBarcodeLabels: (categoryId?: number | null) =>
    api.get<{
      total: number;
      categoryId: number | null;
      categoryName: string | null;
      generatedAt: string;
      labels: BarcodeLabel[];
    }>(
      "/Products/barcode-labels",
      categoryId
        ? { query: { categoryId } }
        : undefined,
    ),
};
