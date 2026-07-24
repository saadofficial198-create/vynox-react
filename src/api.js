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
  syncStatus:  (id)               => request(`/api/sites/${id}/sync/status`),
  latestSnap:  (id)               => request(`/api/sites/${id}/latest`),
  siteHistory: (id, days = 7)    => request(`/api/sites/${id}/history?days=${days}`),
  listAlerts:  ()                 => request('/api/alerts'),
  listUpdates: ()                 => request('/api/updates'),
  listScans:   ()                 => request('/api/scans'),
  listBackups: ()                 => request('/api/backups'),

  // Real PageSpeed (Google) score + Core Web Vitals, per monitored page
  pageSpeedLatest:  (id)          => request(`/api/pagespeed/${id}/latest`),
  pageSpeedHistory: (id, page, days = 30) => request(`/api/pagespeed/${id}/history?page=${encodeURIComponent(page)}&days=${days}`),
  pageSpeedCheck:   (id)          => request(`/api/pagespeed/${id}/check`, { method: 'POST' }),

  // Hourly/3x-daily screenshots, per monitored page
  screenshotsLatest:  (id)        => request(`/api/screenshots/${id}/latest`),
  screenshotsHistory: (id, page, limit = 24) => request(`/api/screenshots/${id}/history?page=${encodeURIComponent(page)}&limit=${limit}`),
  screenshotsCapture: (id)        => request(`/api/screenshots/${id}/capture`, { method: 'POST' }),

  // Re-scan sitemap for real Shop/Contact Us/Track Order slugs
  detectPages: (id)               => request(`/api/sites/${id}/detect-pages`, { method: 'POST' }),
};
