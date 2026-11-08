import { api } from "../lib/api";
import type { Alert } from "../types";

export type AlertScanResult = {
  message: string;
  productsScanned: number;
  lowStockCreated: number;
  lowStockResolved: number;
};

export const alertService = {
  active: () => api.get<Alert[]>("/Alerts"),
  unread: () => api.get<Alert[]>("/Alerts/unread"),
  all: () => api.get<Alert[]>("/Alerts/all"),
  markRead: (id: number) =>
    api.put<{ message: string }>(`/Alerts/${id}/read`),
  resolve: (id: number) =>
    api.put<{ message: string }>(`/Alerts/${id}/resolve`),
  // Runs only the expiry rule (kept for backwards compat / future tooling).
  checkExpiry: () =>
    api.post<{ message: string }>("/Alerts/check-expiry"),
  // Runs only the low-stock rule across every active product.
  checkLowStock: () =>
    api.post<AlertScanResult>("/Alerts/check-low-stock"),
  // One-click full scan: low-stock + expiry. This is what the "Check alerts
  // now" button on the AlertsPage calls.
  checkAll: () => api.post<AlertScanResult>("/Alerts/check-all"),
};
