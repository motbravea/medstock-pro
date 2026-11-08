import { api } from "../lib/api";
import type { LoginRequest, LoginResponse } from "../types";

export const authService = {
  login: (data: LoginRequest) => api.post<LoginResponse>("/Auth/login", data),
};
