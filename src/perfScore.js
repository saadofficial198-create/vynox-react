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

/**
 * @param {(strategy: 'desktop'|'mobile') => Promise<any>} fetchLatest — should
 *   resolve to the same shape api.pageSpeedLatest() returns: { pages: [{ pageLabel, latest }] }
 * @returns {Promise<number|null>} resolved performance score for the Home
 *   page: desktop if available, else mobile, else 0 if both were attempted
 *   and failed/missing, else null if neither strategy has ever been checked.
 */
export async function resolveHomePerfScore(fetchLatest) {
  const [desktopRes, mobileRes] = await Promise.all([
    fetchLatest('desktop').catch(() => null),
    fetchLatest('mobile').catch(() => null),
  ]);

  const homeOf = (res) => (res?.pages || []).find((p) => p.pageLabel === 'Home') || null;
  const desktopHome = homeOf(desktopRes);
  const mobileHome = homeOf(mobileRes);

  const desktopScore = desktopHome?.latest?.ok ? desktopHome.latest.scores?.performance ?? null : null;
  if (desktopScore != null) return desktopScore;

  const mobileScore = mobileHome?.latest?.ok ? mobileHome.latest.scores?.performance ?? null : null;
  if (mobileScore != null) return mobileScore;

  // Neither strategy currently has a successful score. Distinguish "checked
  // and failed" from "never checked at all": `latest` is only non-null once
  // at least one PageSpeedResult document (ok:true or ok:false) exists for
  // that strategy.
  const desktopAttempted = desktopHome?.latest != null;
  const mobileAttempted = mobileHome?.latest != null;
  if (desktopAttempted || mobileAttempted) return 0;

  return null; // truly never checked yet — keep showing '—', not an alarming 0
}
