import { api } from "../lib/api";
import type {
  CategoryConsumption,
  DashboardSummary,
  StockMovement,
  TopUsedProduct,
  UrgentAlert,
} from "../types";

export const dashboardService = {
  summary: () => api.get<DashboardSummary>("/Dashboard/summary"),
  urgent: () => api.get<UrgentAlert[]>("/Dashboard/urgent"),
  todayUsage: () => api.get<StockMovement[]>("/Dashboard/today-usage"),
  weekUsage: () => api.get<StockMovement[]>("/Dashboard/week-usage"),
  recentMovements: () =>
    api.get<StockMovement[]>("/Dashboard/recent-movements"),
  topUsedProducts: () =>
    api.get<TopUsedProduct[]>("/Dashboard/top-used-products"),
  categoryConsumption: () =>
    api.get<CategoryConsumption[]>("/Dashboard/category-consumption"),
};
