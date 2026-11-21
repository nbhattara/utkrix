const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");

function getCsrfToken() {
  const match = document.cookie.match(/(^|;)\s*csrf_token\s*=\s*([^;]+)/);
  return match ? match[2] : null;
}

async function requestApi(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = sessionStorage.getItem("utkrix-auth-token");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const method = (options.method || "GET").toUpperCase();
  const csrfToken = getCsrfToken();
  if (csrfToken && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include" });
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


const PRESIGN_THRESHOLD = 4 * 1024 * 1024;

export async function prepareFormDataForUpload(formData) {
  const entries = [...formData.entries()];
  for (const [name, value] of entries) {
    if (!(value instanceof File) || value.size <= PRESIGN_THRESHOLD) continue;
    const category = /video/i.test(value.type) ? 'video' : 'classroom';
    const presign = await postApi('/uploads/presign', {
      category,
      filename: value.name,
      contentType: value.type || 'application/octet-stream',
      sizeBytes: value.size,
    });
    const put = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': value.type || 'application/octet-stream' },
      body: value,
    });
    if (!put.ok) throw new Error('Direct upload to storage failed.');
    await postApi('/uploads/complete', { key: presign.key, category, filename: value.name, contentType: value.type });
    formData.delete(name);
    formData.set('attachmentKey', presign.key);
    formData.set('originalFileName', value.name);
  }
  return formData;
}

export async function postApi(path, body, options = {}) {
  const { payload } = await requestApi(path, { ...options, method: "POST", body });
  return payload;
}

export async function putApi(path, body, options = {}) {
  const { payload } = await requestApi(path, { ...options, method: "PUT", body });
  return payload;
}

export async function deleteApi(path) {
  const { payload } = await requestApi(path, { method: "DELETE" });
  return payload;
}

export async function getApi(path, options = {}) {
  const { payload } = await requestApi(path, options);
  return payload;
}

export async function getApiFile(path) {
  const headers = new Headers();
  const token = sessionStorage.getItem("utkrix-auth-token");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("utkrix:unauthorized"));
  }
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      message = response.statusText || message;
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.blob();
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
