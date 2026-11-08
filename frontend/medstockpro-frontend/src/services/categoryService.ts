import { api } from "../lib/api";
import type { Category, CategoryDetails, CategoryRequest } from "../types";

export const categoryService = {
  list: () => api.get<Category[]>("/Categories"),
  get: (id: number) => api.get<Category>(`/Categories/${id}`),
  create: (data: CategoryRequest) =>
    api.post<{ message: string; category: Category }>("/Categories", data),
  update: (id: number, data: CategoryRequest) =>
    api.put<{ message: string; category: Category }>(`/Categories/${id}`, data),
  remove: (id: number) =>
    api.delete<{ message: string }>(`/Categories/${id}`),
  // Category-side view: products that belong to this category + stat counts.
  products: (categoryId: number) =>
    api.get<CategoryDetails>(`/Categories/${categoryId}/products`),
};
