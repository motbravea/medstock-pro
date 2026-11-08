import { api } from "../lib/api";
import type { BackupInfo } from "../types";

export const backupService = {
  info: () => api.get<BackupInfo>("/Backup/database-info"),
  create: () =>
    api.post<{
      message: string;
      backupFileName: string;
      backupPath: string;
      fileSizeKb: number;
      createdAt: string;
    }>("/Backup/create"),
};
