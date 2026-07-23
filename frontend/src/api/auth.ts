import { apiClient } from "./client";
import type { Token, User } from "../types/api";

export function register(name: string, email: string, password: string) {
  return apiClient
    .post<User>("/api/auth/register", { name, email, password })
    .then((r) => r.data);
}

export function login(email: string, password: string) {
  return apiClient
    .post<Token>("/api/auth/login", { email, password })
    .then((r) => r.data);
}

export function getMe() {
  return apiClient.get<User>("/api/auth/me").then((r) => r.data);
}
