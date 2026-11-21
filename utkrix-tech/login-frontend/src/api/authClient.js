const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

async function requestApi(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.body);
  }

  const csrfToken = getCsrfToken();
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function getCsrfToken() {
  const match = document.cookie.match(/(^|;)\s*csrf_token\s*=\s*([^;]+)/);
  return match ? match[2] : null;
}

export async function postApi(path, body) {
  return requestApi(path, { method: 'POST', body });
}

export async function getApi(path) {
  return requestApi(path);
}

export function getRedirectUrl(role) {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  const mainSiteUrl = import.meta.env.VITE_MAIN_SITE_URL || 'http://localhost:5173';
  const employeesUrl = import.meta.env.VITE_EMPLOYEES_URL || 'http://employees.lvh.me:5173';
  const adminUrl = import.meta.env.VITE_ADMIN_URL || 'http://admin.lvh.me:5173';

  const allowedRedirects = [mainSiteUrl, employeesUrl, adminUrl];

  if (redirect && allowedRedirects.some(url => redirect.startsWith(url))) {
    return redirect;
  }

  if (role === 'admin') {
    return adminUrl;
  }

  return employeesUrl || mainSiteUrl;
}
