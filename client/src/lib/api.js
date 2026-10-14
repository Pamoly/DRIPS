// Thin API client. The workspace token is kept in localStorage so a browser
// session maps to exactly one server-side workspace (no password friction).
const TOKEN_KEY = 'drips.workspace.token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};
export const setToken = (t) => {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* private mode */
  }
};
export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
};

async function request(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    ...opts,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(data?.error || `${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  bootstrap: () => request('POST', '/api/bootstrap', { token: getToken() }),
  state: () => request('GET', '/api/state'),
  saveSettings: (patch) => request('PUT', '/api/settings', patch),

  create: (collection, record) => request('POST', `/api/${collection}`, record),
  update: (collection, id, record) => request('PUT', `/api/${collection}/${id}`, record),
  patch: (collection, id, record) => request('PATCH', `/api/${collection}/${id}`, record),
  remove: (collection, id) => request('DELETE', `/api/${collection}/${id}`),
  replaceAll: (collection, rows) => request('PUT', `/api/${collection}`, { rows }),

  duplicateProposal: (id) => request('POST', `/api/proposals/${id}/duplicate`),
  convertProposal: (id) => request('POST', `/api/proposals/${id}/convert`),
  addPayment: (id, payment) => request('POST', `/api/invoices/${id}/payments`, payment),

  demo: () => request('POST', '/api/demo', {}),
  reset: () => request('POST', '/api/reset', {}),
  backup: (payload) => request('POST', '/api/backup', payload),

  // public (token-free) endpoints used by shared proposal links
  publicProposal: (shareToken) => request('GET', `/api/public/proposal/${shareToken}`),
  publicView: (shareToken) => request('POST', `/api/public/proposal/${shareToken}/view`),
  publicDecision: (shareToken, payload) =>
    request('POST', `/api/public/proposal/${shareToken}/decision`, payload),
};

export const shareUrl = (publicToken) =>
  `${window.location.origin}/p/${publicToken}`;
