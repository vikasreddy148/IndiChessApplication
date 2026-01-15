import { API_BASE_URL } from "../config/api";

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (res.ok) {
    return await parseJsonSafe(res);
  }

  const body = await parseJsonSafe(res);
  const message =
    body?.message || body?.error?.message || body?.error || "Request failed";
  const err = new Error(message);
  err.status = res.status;
  err.body = body;
  throw err;
}


