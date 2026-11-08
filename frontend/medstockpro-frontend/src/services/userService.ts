import { api } from "../lib/api";
import type {
  ChangePasswordRequest,
  CreateUserRequest,
  UpdateUserRequest,
  UserSummary,
} from "../types";

export const userService = {
  list: () => api.get<UserSummary[]>("/Users"),
  get: (id: number) => api.get<UserSummary>(`/Users/${id}`),
  create: (data: CreateUserRequest) =>
    api.post<{ message: string; user: UserSummary }>("/Users", data),
  update: (id: number, data: UpdateUserRequest) =>
    api.put<{ message: string; user: UserSummary }>(`/Users/${id}`, data),
  changePassword: (id: number, data: ChangePasswordRequest) =>
    api.post<{ message: string }>(`/Users/${id}/change-password`, data),
  activate: (id: number) =>
    api.put<{ message: string }>(`/Users/${id}/activate`),
  deactivate: (id: number) =>
    api.put<{ message: string }>(`/Users/${id}/deactivate`),
};
