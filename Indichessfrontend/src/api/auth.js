import { apiFetch } from "./client";

export async function apiMe() {
  return await apiFetch("/api/auth/me", { method: "GET" });
}

export async function apiLogin({ username, password }) {
  return await apiFetch("/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export async function apiSignup({ username, emailId, password }) {
  return await apiFetch("/signup", {
    method: "POST",
    body: JSON.stringify({ username, emailId, password })
  });
}

export async function apiLogout() {
  return await apiFetch("/logout", { method: "POST" });
}


