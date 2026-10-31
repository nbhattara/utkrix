const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");

async function requestApi(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = sessionStorage.getItem("utkrix-auth-token");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  let payload;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("utkrix:unauthorized"));
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return { payload, response };
}

export async function postApi(path, body) {
  const { payload } = await requestApi(path, { method: "POST", body });
  return payload;
}

export async function putApi(path, body) {
  const { payload } = await requestApi(path, { method: "PUT", body });
  return payload;
}

export async function deleteApi(path) {
  const { payload } = await requestApi(path, { method: "DELETE" });
  return payload;
}

export async function getApi(path) {
  const { payload } = await requestApi(path);
  return payload;
}

export async function getApiList(path, { signal } = {}) {
  const { payload, response } = await requestApi(path, { signal });

  if (!Array.isArray(payload)) {
    throw new Error(payload?.message || "The server returned an unexpected response.");
  }

  return {
    items: payload,
    totalPages: Number(response.headers.get("X-Total-Pages")) || 1,
  };
}

export function startOAuth(provider) {
  window.location.assign(`${API_BASE_URL}/auth/oauth/${provider}`);
}

export function getMediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;

  const apiOrigin = /^https?:\/\//i.test(API_BASE_URL)
    ? new URL(API_BASE_URL).origin
    : window.location.origin;
  return new URL(path, `${apiOrigin}/`).toString();
}
