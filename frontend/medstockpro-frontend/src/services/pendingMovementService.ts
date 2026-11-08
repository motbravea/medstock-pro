import { api } from "../lib/api";
import type {
  PendingMovement,
  PendingMovementCount,
  PendingMovementReviewRequest,
  PendingStatus,
} from "../types";

export const pendingMovementService = {
  list: (status: PendingStatus | "All" = "Pending") =>
    api.get<PendingMovement[]>(`/PendingMovements?status=${status}`),

  count: () => api.get<PendingMovementCount>("/PendingMovements/count"),

  approve: (id: number, data: PendingMovementReviewRequest) =>
    api.post<{
      message: string;
      pending: {
        id: number;
        status: PendingStatus;
        reviewedAt: string;
        restoredMovementId: number;
        newStock: number;
      };
    }>(`/PendingMovements/${id}/approve`, data),

  reject: (id: number, data: PendingMovementReviewRequest) =>
    api.post<{
      message: string;
      pending: {
        id: number;
        status: PendingStatus;
        reviewedAt: string;
      };
    }>(`/PendingMovements/${id}/reject`, data),
};
