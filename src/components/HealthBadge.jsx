import { healthStatusMeta } from '../healthStatus';

/* Small colored pill showing WP Site Health-derived status (good/warning/critical). */
export default function HealthBadge({ status, label }) {
  const meta = healthStatusMeta(status);
  return (
    <span className={`health-badge ${meta.cls}`}>
      <span className="health-dot" />
      {label || meta.label}
    </span>
  );
}
