import { api } from "../lib/api";
import type {
  Alert,
  CategoryUsage,
  MonthlySummary,
  ProductUsage,
  RestockEstimate,
  StaffUsage,
  StockMovement,
  SupplierCostOverviewItem,
} from "../types";

type Period = { year: number; month: number };

export const reportService = {
  monthlySummary: ({ year, month }: Period) =>
    api.get<MonthlySummary>("/Reports/monthly-summary", { query: { year, month } }),

  productUsage: ({ year, month }: Period) =>
    api.get<ProductUsage[]>("/Reports/product-usage", { query: { year, month } }),

  categoryUsage: ({ year, month }: Period) =>
    api.get<CategoryUsage[]>("/Reports/category-usage", {
      query: { year, month },
    }),

  staffUsage: ({ year, month }: Period) =>
    api.get<StaffUsage[]>("/Reports/staff-usage", { query: { year, month } }),

  stockMovements: ({ year, month }: Period) =>
    api.get<StockMovement[]>("/Reports/stock-movements", {
      query: { year, month },
    }),

  alerts: ({ year, month }: Period) =>
    api.get<Alert[]>("/Reports/alerts", { query: { year, month } }),

  supplierCostOverview: () =>
    api.get<SupplierCostOverviewItem[]>("/Reports/supplier-cost-overview"),

  restockEstimate: () => api.get<RestockEstimate>("/Reports/restock-estimate"),
};
