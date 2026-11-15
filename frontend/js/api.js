import { API_BASE } from './config.js';

export class ApiError extends Error {
  constructor(status, message, retryAfter = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export const authEvents = new EventTarget();

async function request(method, path, { query, body, signal, silent401 = false } = {}) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-Requested-With'] = 'vault-web'; // defensa CSRF: el servidor la exige

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
  }
  if (!res.ok) {
    if (res.status === 401 && !silent401) authEvents.dispatchEvent(new Event('unauthorized'));
    throw new ApiError(res.status, (data && data.error) || 'Ocurrió un error inesperado.', Number(res.headers.get('Retry-After')) || 0);
  }
  return data;
}

const enc = encodeURIComponent;

export const api = {
  login: (password) => request('POST', '/api/login', { body: { password }, silent401: true }),
  logout: () => request('POST', '/api/logout', { silent401: true }),
  me: ({ silent = false } = {}) => request('GET', '/api/me', { silent401: silent }),

  files: (query, signal) => request('GET', '/api/files', { query, signal }),
  categories: () => request('GET', '/api/categories'),
  ticket: (id) => request('POST', `/api/files/${enc(id)}/ticket`),

  admin: {
    files: (query, signal) => request('GET', '/api/admin/files', { query, signal }),
    updateFile: (id, body) => request('PATCH', `/api/admin/files/${enc(id)}`, { body }),
    deleteFile: (id) => request('DELETE', `/api/admin/files/${enc(id)}`),
    reorderFiles: (ids) => request('POST', '/api/admin/files/reorder', { body: { ids } }),
    uploadInit: (body) => request('POST', '/api/admin/uploads/init', { body }),
    uploadComplete: (fileId) => request('POST', '/api/admin/uploads/complete', { body: { fileId } }),
    uploadAbort: (fileId) => request('POST', '/api/admin/uploads/abort', { body: { fileId } }),
    categories: () => request('GET', '/api/admin/categories'),
    createCategory: (body) => request('POST', '/api/admin/categories', { body }),
    updateCategory: (id, body) => request('PATCH', `/api/admin/categories/${enc(id)}`, { body }),
    deleteCategory: (id) => request('DELETE', `/api/admin/categories/${enc(id)}`),
    sessions: () => request('GET', '/api/admin/sessions'),
    revokeSession: (id) => request('DELETE', `/api/admin/sessions/${enc(id)}`),
    revokeAllSessions: (includeCurrent) => request('POST', '/api/admin/sessions/revoke-all', { body: { includeCurrent } }),
    audit: (query) => request('GET', '/api/admin/audit', { query }),
    downloads: (query) => request('GET', '/api/admin/downloads', { query }),
  },
};

export async function downloadFile(id) {
  const data = await api.ticket(id);
  const target = new URL(data.url);
  if (target.origin !== new URL(API_BASE).origin) throw new ApiError(0, 'Respuesta inesperada del servidor.');
  const a = document.createElement('a');
  a.href = target.href;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  return data.fileName;
}
