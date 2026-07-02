const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  let body = null;
  try { body = await res.json(); } catch { /* empty */ }
  if (!res.ok || (body && body.ok === false)) {
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const api = {
  health:      ()                 => request('/api/health'),
  listSites:   ()                 => request('/api/sites'),
  getSite:     (id)               => request(`/api/sites/${id}`),
  testConnect: ({ url, apiKey })  => request('/api/sites/test', { method: 'POST', body: JSON.stringify({ url, apiKey }) }),
  addSite:     (payload)          => request('/api/sites', { method: 'POST', body: JSON.stringify(payload) }),
  deleteSite:  (id)               => request(`/api/sites/${id}`, { method: 'DELETE' }),
  syncSite:    (id)               => request(`/api/sites/${id}/sync`, { method: 'POST' }),
  latestSnap:  (id)               => request(`/api/sites/${id}/latest`),
  siteHistory: (id, days = 7)    => request(`/api/sites/${id}/history?days=${days}`),
  listAlerts:  ()                 => request('/api/alerts'),
  listUpdates: ()                 => request('/api/updates'),
  listScans:   ()                 => request('/api/scans'),
  listBackups: ()                 => request('/api/backups'),
};
