import { api } from "../lib/api";
import type { ActivateLicenseRequest, LicenseStatus } from "../types";

export const licenseService = {
  status: () => api.get<LicenseStatus>("/license/status"),
  activate: (data: ActivateLicenseRequest) =>
    api.post<
      LicenseStatus & { message: string }
    >("/license/activate", data),
};
