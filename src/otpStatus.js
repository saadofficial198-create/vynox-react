// Shared OTP-check status/badge logic — used by both Dashboard.jsx (the
// "OTP Email Delivery" panel) and Sites.jsx (the per-site "OTP Checker"
// tab), so both places describe the exact same check result the exact same
// way instead of drifting apart.

// Detects the specific Imunify360 "Access denied" message inside a check's
// popupError. This is the same detection scripts/runOtpCheck.js uses
// server-side to auto-set Site.imunify360Status = 'blocked'. Surfacing it
// as its OWN badge (instead of the generic "Failed") makes clear this is
// the hosting server's firewall blocking the monitor, not a real site/
// plugin problem — see Imunify360_Allowlist_Guide.md for the fix.
export function isImunify360Block(errorMessage) {
  return typeof errorMessage === 'string' && /imunify360/i.test(errorMessage);
}

const OTP_STATUS_META = {
  pass:                     { label: 'Working',   cls: 'hs-good',     reason: null },
  not_applicable:           { label: 'N/A',        cls: 'hs-unknown',  reason: 'OTP plugin not active on this site' },
  fail_plugin_inactive:     { label: 'Failed',     cls: 'hs-critical', reason: 'OTP or WP Mail SMTP plugin is inactive' },
  fail_smtp_not_configured: { label: 'Failed',     cls: 'hs-critical', reason: 'WP Mail SMTP is not configured' },
  fail_checkout_trigger:    { label: 'Failed',     cls: 'hs-critical', reason: 'Checkout did not trigger the OTP popup' },
  fail_email_not_received: { label: 'Failed',     cls: 'hs-critical', reason: 'Email not received (checkout works)' },
  error:                    { label: 'Error',      cls: 'hs-warning',  reason: 'Check could not complete — see logs' },
};

/** Takes a full OtpCheck document (not just overallStatus) so it can
 * special-case the Imunify360 block via popupError. */
export function otpStatusMeta(check) {
  if (!check) return { label: 'Not yet checked', cls: 'hs-unknown', reason: null };
  if (isImunify360Block(check.popupError)) {
    return { label: 'Blocked (Imunify360)', cls: 'hs-warning', reason: "This site's hosting firewall is blocking our monitor — see the Imunify360 status below to resolve" };
  }
  return OTP_STATUS_META[check.overallStatus] || { label: 'Not yet checked', cls: 'hs-unknown', reason: null };
}
