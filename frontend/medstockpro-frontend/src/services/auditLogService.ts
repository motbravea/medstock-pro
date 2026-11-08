import { api } from "../lib/api";
import type { AuditLog, AuditLogPage } from "../types";

export const auditLogService = {
  list: (page = 1, pageSize = 100) =>
    api.get<AuditLogPage>("/AuditLogs", { query: { page, pageSize } }),

  byUser: (userId: number) =>
    api.get<AuditLog[]>(`/AuditLogs/user/${userId}`),

  byEntity: (entityType: string, entityId: number) =>
    api.get<AuditLog[]>(`/AuditLogs/entity/${entityType}/${entityId}`),

  byDateRange: (start: string, end: string) =>
    api.get<AuditLog[]>("/AuditLogs/date-range", { query: { start, end } }),

  summary: () =>
    api.get<{
      todayCount: number;
      weekCount: number;
      byAction: { action: string; count: number }[];
    }>("/AuditLogs/summary"),
};
