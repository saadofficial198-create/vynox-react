const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// The dashboard's login session token (see routes/auth.js /
// middleware/requireAuth.js on the backend, AuthGate.jsx on the frontend).
// Deliberately sessionStorage, not localStorage or a cookie — sessionStorage
// is wiped automatically when the browser/tab closes, which is exactly the
// "logout on browser close" behavior that was asked for, with no extra code
// needed to enforce it.
const TOKEN_KEY = 'vynox_session_token';
export const getAuthToken   = () => sessionStorage.getItem(TOKEN_KEY);
export const setAuthToken   = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearAuthToken = () => sessionStorage.removeItem(TOKEN_KEY);

async function request(path, opts = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  // A 401 here means the session is gone (expired, logged out elsewhere, or
  // the backend restarted and never had it) — drop the dead token and tell
  // AuthGate to show the login screen again, from wherever in the app this
  // call happened to fire. Login itself intentionally returns 401 for a
  // wrong password, which must NOT trigger this (there's no session to lose).
  if (res.status === 401 && path !== '/api/auth/login') {
    clearAuthToken();
    window.dispatchEvent(new Event('vynox:unauthorized'));
  }

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
  latestSnap:  (id)               => request(`/api/sites/${id}/latest`),
  // Manual "Sync Now" row action — pulls this one site's data right now
  // instead of waiting for the next automated hourly scan. Synchronous
  // (awaits the actual fetch), unlike the background-style checks below.
  syncSite:    (id)               => request(`/api/sites/${id}/sync`, { method: 'POST' }),
  siteHistory: (id, days = 7)    => request(`/api/sites/${id}/history?days=${days}`),
  listAlerts:  ()                 => request('/api/alerts'),
  listUpdates: ()                 => request('/api/updates'),
  listScans:   ()                 => request('/api/scans'),
  listBackups: ()                 => request('/api/backups'),

  // Real PageSpeed (Google) score + Core Web Vitals, per monitored page.
  // pageSpeedCheck kicks off a BACKGROUND run and returns immediately (202) —
  // it does not wait for the check to finish. With retries, a full check can
  // take several minutes per page, which used to keep the HTTP request open
  // long enough for cPanel's proxy to time it out and drop the response
  // (the browser then misreports that as a CORS error). Poll
  // pageSpeedStatus/pageSpeedLatest afterwards to see progress/results.
  pageSpeedLatest:  (id, strategy = 'mobile') => request(`/api/pagespeed/${id}/latest?strategy=${strategy}`),
  pageSpeedHistory: (id, page, days = 30, strategy = 'mobile') => request(`/api/pagespeed/${id}/history?page=${encodeURIComponent(page)}&days=${days}&strategy=${strategy}`),
  pageSpeedCheck:   (id, strategy = 'mobile') => request(`/api/pagespeed/${id}/check?strategy=${strategy}`, { method: 'POST' }),
  pageSpeedStatus:  (id, strategy = 'mobile') => request(`/api/pagespeed/${id}/status?strategy=${strategy}`),

  // Hourly/3x-daily screenshots, per monitored page
  screenshotsLatest:  (id)        => request(`/api/screenshots/${id}/latest`),
  screenshotsHistory: (id, page, limit = 24) => request(`/api/screenshots/${id}/history?page=${encodeURIComponent(page)}&limit=${limit}`),
  screenshotsCapture: (id)        => request(`/api/screenshots/${id}/capture`, { method: 'POST' }),

  // Re-scan sitemap for real Shop/Contact Us/Track Order slugs (legacy —
  // overwrites monitoredPages with a best-guess; kept for backward compat)
  detectPages: (id)               => request(`/api/sites/${id}/detect-pages`, { method: 'POST' }),

  // Page selection: fetch every page the live sitemap lists (for the
  // checklist), and save the user's chosen selection. Saving flips
  // Site.pagesConfigured to true server-side, which is what un-pauses
  // screenshot/PageSpeed capture for this site (see routes/sites.js).
  pageCandidates:     (id)         => request(`/api/sites/${id}/page-candidates`),
  saveMonitoredPages: (id, pages)  => request(`/api/sites/${id}/monitored-pages`, { method: 'PUT', body: JSON.stringify({ pages }) }),

  // OTP email delivery monitor (any site's OTP plugin -> WP Mail SMTP -> inbox)
  // Returns one row per registered site — not tied to any single site.
  otpCheckLatest:  ()                        => request('/api/otp-check/latest'),
  otpCheckHistory: (days = 30, siteId = null) => request(`/api/otp-check/history?days=${days}${siteId ? `&siteId=${siteId}` : ''}`),

  // Domain-migration reference checker: finds every live page (home,
  // contact, about, categories, single products, ...) still referencing an
  // old domain (see routes/urlCheck.js). urlCheckRun starts a BACKGROUND run
  // and returns immediately (202) — poll urlCheckLatest for progress/result,
  // same reasoning as pageSpeedCheck above.
  urlCheckRun:    (id, oldDomain) => request(`/api/url-check/${id}/run`, { method: 'POST', body: JSON.stringify({ oldDomain }) }),
  urlCheckLatest: (id)            => request(`/api/url-check/${id}/latest`),

  // Imunify360 allowlist tracking (per-site, see models/Site.js's
  // imunify360Status). scripts/runOtpCheck.js auto-sets 'blocked'; the user
  // manually confirms 'allowlisted' here after fixing it in that site's own
  // cPanel — see Imunify360_Allowlist_Guide.md.
  setImunify360Status: (id, status) => request(`/api/sites/${id}/imunify360-status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Dashboard login gate (see AuthGate.jsx). login() deliberately does NOT
  // send an Authorization header (there's no token yet) — request() above
  // already knows not to treat *this* path's 401 as "session died".
  login:        (password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout:       ()         => request('/api/auth/logout', { method: 'POST' }),
  loginHistory: ()         => request('/api/auth/logins'),
};
