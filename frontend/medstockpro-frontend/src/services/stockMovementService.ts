import { api } from "../lib/api";
import type {
  PendingMovement,
  ReceiveStockRequest,
  ReceiveStockResponse,
  ScanActionRequest,
  StockMovement,
  StockMovementRequest,
} from "../types";

export const stockMovementService = {
  list: () => api.get<StockMovement[]>("/StockMovements"),
  byProduct: (productId: number) =>
    api.get<StockMovement[]>(`/StockMovements/product/${productId}`),
  create: (data: StockMovementRequest) =>
    api.post<{ message: string; movement: StockMovement }>(
      "/StockMovements",
      data,
    ),
  // Receive shipment: StockIn + optional expiry refresh + optional supplier
  // LastPurchaseDate update, atomic.
  receive: (data: ReceiveStockRequest) =>
    api.post<ReceiveStockResponse>("/StockMovements/receive", data),
  // Scan workspace: instant StockOut.
  scanUse: (data: ScanActionRequest) =>
    api.post<{ message: string; movement: StockMovement }>(
      "/StockMovements/scan-use",
      data,
    ),
  // Scan workspace: queued return; CurrentStock is unchanged until Admin approves.
  scanReturn: (data: ScanActionRequest) =>
    api.post<{
      message: string;
      pending: Pick<
        PendingMovement,
        "id" | "quantity" | "status" | "createdAt" | "sourceMovementId"
      > & { product: string };
    }>("/StockMovements/scan-return", data),
};
