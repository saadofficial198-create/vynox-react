/* Shared mapping for the WordPress Site Health-derived status
 * ('good' | 'warning' | 'critical') used across Dashboard, Sites, and Scans.
 * Reuses the same red/amber/blue-ish green palette as the rest of the app.
 */
const META = {
  good:     { label: 'Good',            color: '#22c55e', cls: 'hs-good' },
  warning:  { label: 'Needs Attention', color: '#f59e0b', cls: 'hs-warning' },
  critical: { label: 'Critical',        color: '#ef4444', cls: 'hs-critical' },
};

export function healthStatusMeta(status) {
  return META[status] || { label: '—', color: '#5a6480', cls: 'hs-unknown' };
}
