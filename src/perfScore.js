// Shared "Health Status" performance-score resolution, used by Dashboard.jsx,
// Sites.jsx, and Scans.jsx — all three render the same ScoreRing for a
// site's Home page performance score in their list table, and all three need
// the exact same fallback behavior:
//
//   1. Prefer the 'desktop' score — desktop is the strategy kept fresh
//      automatically (6-hourly internal job + daily pagespeed-desktop.yml
//      workflow), so it's usually available without anyone clicking "Check
//      Now".
//   2. If desktop has no successful result (never checked yet, OR checked
//      and failed — e.g. FAILED_DOCUMENT_REQUEST from the target site's own
//      server being overloaded), fall back to the 'mobile' score instead of
//      immediately giving up.
//   3. Only if BOTH strategies have no successful result do we report a
//      real numeric 0 (not null) — this is a deliberate signal meant to look
//      different from "not checked yet" in the UI. ScoreRing renders null as
//      a blank "—" ring (ambiguous: could mean "no check has run"), whereas 0
//      renders as a full red ring with "0" in it — an unmistakable "this
//      site's health check has been failing" signal, exactly as requested.
//
// IMPORTANT: 0 is only returned when we can positively confirm at least one
// check was attempted (a PageSpeedResult document exists for that strategy,
// successful or not) for either strategy — a site that has literally never
// been checked at all (no documents for desktop OR mobile) still resolves to
// null, so brand-new sites don't immediately show an alarming 0 before their
// first scheduled check has even had a chance to run.
//
// Resolved for every site in ONE batched call per strategy (GET
// /api/pagespeed/latest-all), not one GET /:siteId/latest per site per
// strategy — that per-site pattern used to send 2N requests every 30s (94
// for 47 sites), each needing its own CORS preflight, which overwhelmed the
// browser's ~6-connections-per-origin limit and made every request queue
// for 10+ seconds (confirmed live in the Network tab). See
// routes/pagespeed.js's /latest-all for the backend half.

/**
 * @param {string[]} siteIds
 * @param {Record<string, any>} desktopScores - api.pageSpeedLatestAll('desktop').scores, keyed by siteId
 * @param {Record<string, any>} mobileScores - api.pageSpeedLatestAll('mobile').scores, keyed by siteId
 * @returns {Record<string, number|null>}
 */
export function resolveHomePerfScoresBatch(siteIds, desktopScores, mobileScores) {
  const out = {};
  for (const id of siteIds) {
    const d = desktopScores?.[id];
    const m = mobileScores?.[id];

    const desktopScore = d?.ok ? d.scores?.performance ?? null : null;
    if (desktopScore != null) { out[id] = desktopScore; continue; }

    const mobileScore = m?.ok ? m.scores?.performance ?? null : null;
    if (mobileScore != null) { out[id] = mobileScore; continue; }

    out[id] = (d != null || m != null) ? 0 : null;
  }
  return out;
}
