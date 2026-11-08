import { api } from "../lib/api";
import type { Supplier, SupplierProduct, SupplierRequest } from "../types";

export const supplierService = {
  list: () => api.get<Supplier[]>("/Suppliers"),
  get: (id: number) => api.get<Supplier>(`/Suppliers/${id}`),
  create: (data: SupplierRequest) =>
    api.post<{ message: string; supplier: Supplier }>("/Suppliers", data),
  update: (id: number, data: SupplierRequest) =>
    api.put<{ message: string; supplier: Supplier }>(`/Suppliers/${id}`, data),
  remove: (id: number) =>
    api.delete<{ message: string }>(`/Suppliers/${id}`),
  // Supplier-side view of product-supplier links.
  products: (supplierId: number) =>
    api.get<SupplierProduct[]>(`/Suppliers/${supplierId}/products`),
};
