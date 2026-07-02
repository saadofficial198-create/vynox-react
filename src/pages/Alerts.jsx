import { useEffect, useMemo, useState } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import Sparkline from '../components/Sparkline';
import CustomSelect from '../components/CustomSelect';
import { api } from '../api';
import '../styles/alerts.css';

const TYPE_ICONS = {
  Malware:          { cls: 'ac-red',   d: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> },
  'Core Update':    { cls: 'ac-amber', d: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
  Plugin:           { cls: 'ac-amber', d: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
  SSL:              { cls: 'ac-blue',  d: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> },
  'Login Security': { cls: 'ac-red',   d: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
  Server:           { cls: 'ac-teal',  d: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></> },
};

function fmtDateParts(iso) {
  if (!iso) return ['—', ''];
  const d = new Date(iso);
  return [
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  ];
}

const SOLUTIONS = {
  'Malware Detected': {
    summary: 'Malicious or suspicious files were found in your site. This likely means your site has been compromised and needs immediate attention.',
    steps: [
      'Install a malware scanner plugin and run a full scan',
      'Remove or quarantine all identified suspicious files',
      'Change all passwords: WordPress admin, cPanel, FTP, and database',
      'Update all plugins, themes, and WordPress core immediately',
      'Restore from a clean backup if one is available',
      'Contact your hosting provider to request a server-side scan',
    ],
    plugins: [
      { name: 'Wordfence Security', desc: 'Free malware scanner + firewall with real-time threat detection', url: 'https://wordpress.org/plugins/wordfence/' },
      { name: 'MalCare Security', desc: 'One-click malware removal with deep file scanning', url: 'https://wordpress.org/plugins/malcare-security/' },
      { name: 'Sucuri Security', desc: 'Cloud-based malware scanner and site firewall', url: 'https://wordpress.org/plugins/sucuri-scanner/' },
    ],
    links: [
      { label: 'Google: WordPress malware removal guide', url: 'https://www.google.com/search?q=wordpress+malware+removal+guide+step+by+step' },
      { label: 'Google: How to clean a hacked WordPress site', url: 'https://www.google.com/search?q=how+to+clean+hacked+wordpress+site' },
    ],
  },
  'PHP Files in Uploads': {
    summary: 'PHP files were found in the uploads directory. Only media files (images, PDFs) should exist there — PHP files may be backdoors left by attackers.',
    steps: [
      'Open cPanel File Manager or connect via FTP',
      'Navigate to wp-content/uploads/ and search for any .php files',
      'Delete all .php files found in the uploads folder',
      'Add an .htaccess file to block PHP execution there (see code below)',
    ],
    code: `# Add this as wp-content/uploads/.htaccess\n<Files *.php>\n  deny from all\n</Files>`,
    plugins: [
      { name: 'WP Cerber Security', desc: 'Automatically blocks PHP execution in uploads', url: 'https://wordpress.org/plugins/wp-cerber/' },
    ],
    links: [
      { label: 'Google: Block PHP execution in WordPress uploads', url: 'https://www.google.com/search?q=block+php+execution+wordpress+uploads+htaccess' },
    ],
  },
  'WordPress Core Update Available': {
    summary: 'A new version of WordPress is available. Keeping core updated protects against known security vulnerabilities.',
    steps: [
      'Go to WordPress Admin → Dashboard → Updates',
      'Click "Update Now" for the WordPress core update',
      'Take a backup first using WPvivid or UpdraftPlus',
      'After updating, verify your site looks and works correctly',
    ],
    code: `// Optionally enable auto core updates in wp-config.php\ndefine('WP_AUTO_UPDATE_CORE', true);`,
    links: [
      { label: 'Google: How to safely update WordPress', url: 'https://www.google.com/search?q=how+to+update+wordpress+safely+without+breaking+site' },
    ],
  },
  'File Editor Enabled': {
    summary: 'The WordPress theme/plugin file editor is enabled. Any admin who logs in can edit PHP files directly from the browser — a critical risk if admin credentials are stolen.',
    steps: [
      'Open wp-config.php via FTP or cPanel File Manager',
      'Add the line shown in the code box below',
      'Save the file — the Editor option will disappear from WP Admin immediately',
    ],
    code: `// Add this to wp-config.php (before the "stop editing" line)\ndefine('DISALLOW_FILE_EDIT', true);`,
    links: [
      { label: 'Google: Disable WordPress file editor wp-config', url: 'https://www.google.com/search?q=disable+wordpress+file+editor+wp-config+DISALLOW_FILE_EDIT' },
    ],
  },
  'Default Login Path': {
    summary: 'Your site uses the default wp-login.php URL. Bots scan this path constantly to attempt brute-force attacks against admin accounts.',
    steps: [
      'Install WPS Hide Login to change the login URL to something custom',
      'Enable login attempt limits to block repeated failed logins',
      'Consider adding two-factor authentication (2FA) for admin accounts',
      'After changing the URL, update it wherever you have it bookmarked',
    ],
    plugins: [
      { name: 'WPS Hide Login', desc: 'Change wp-admin URL to any custom path you choose', url: 'https://wordpress.org/plugins/wps-hide-login/' },
      { name: 'Limit Login Attempts Reloaded', desc: 'Automatically blocks IPs after repeated failed logins', url: 'https://wordpress.org/plugins/limit-login-attempts-reloaded/' },
      { name: 'WP 2FA', desc: 'Adds two-factor authentication to admin logins', url: 'https://wordpress.org/plugins/wp-2fa/' },
    ],
    links: [
      { label: 'Google: Change WordPress login URL security', url: 'https://www.google.com/search?q=change+wordpress+login+url+wps+hide+login+setup' },
    ],
  },
  'SSL Not Enabled': {
    summary: 'Your site is not served over HTTPS. All data (passwords, form data) is transmitted unencrypted. Google also penalises non-HTTPS sites in search rankings.',
    steps: [
      'In cPanel, go to SSL/TLS → Let\'s Encrypt SSL → Install a free certificate',
      'In WordPress Admin → Settings → General, change both URLs from http:// to https://',
      'Install Really Simple SSL to handle redirects and mixed content automatically',
      'Test the site to make sure all resources (images, scripts) load over HTTPS',
    ],
    plugins: [
      { name: 'Really Simple SSL', desc: 'One-click HTTP → HTTPS redirect, fixes mixed content', url: 'https://wordpress.org/plugins/really-simple-ssl/' },
    ],
    links: [
      { label: 'Google: Install free SSL certificate on WordPress cPanel', url: 'https://www.google.com/search?q=install+free+ssl+certificate+wordpress+cpanel+lets+encrypt' },
    ],
  },
  'Low Disk Space': {
    summary: 'Server disk usage is above 90%. This can cause site crashes, failed email delivery, and database write errors.',
    steps: [
      'In cPanel, use Disk Usage tool to find which folders are largest',
      'Remove old backups from wp-content/uploads/ if stored locally',
      'Clean up database: remove spam comments, post revisions, and transients',
      'Delete old server log files from cPanel → Error Logs',
      'Switch backup storage to Google Drive or Dropbox to free local space',
    ],
    plugins: [
      { name: 'WP-Optimize', desc: 'Clean database, remove revisions and spam in one click', url: 'https://wordpress.org/plugins/wp-optimize/' },
      { name: 'WPvivid Backup', desc: 'Backup to cloud storage to avoid filling server disk', url: 'https://wordpress.org/plugins/wpvivid-backuprestore/' },
    ],
    links: [
      { label: 'Google: Free up WordPress site disk space cPanel', url: 'https://www.google.com/search?q=free+up+wordpress+site+disk+space+cpanel' },
    ],
  },
  'High Disk Usage': {
    summary: 'Disk usage is above 80%. Start cleaning up now before the server runs out of space and causes errors.',
    steps: [
      'Use cPanel Disk Usage to identify large directories',
      'Review and clean wp-content/uploads/ for unnecessarily large files',
      'Run database optimization to remove post revisions and transients',
    ],
    plugins: [
      { name: 'WP-Optimize', desc: 'Database cleaner, removes revisions and spam automatically', url: 'https://wordpress.org/plugins/wp-optimize/' },
    ],
    links: [
      { label: 'Google: Reduce WordPress disk usage', url: 'https://www.google.com/search?q=reduce+wordpress+site+disk+usage+optimization' },
    ],
  },
  'No Backup Plugin': {
    summary: 'No backup plugin is active on this site. Without backups, a hack or server crash means permanent data loss with no recovery option.',
    steps: [
      'Install WPvivid Backup or UpdraftPlus from the WordPress plugin directory',
      'After activation, go to the plugin settings and configure remote storage (Google Drive or Dropbox)',
      'Create your first manual backup to verify it works',
      'Set up an automatic weekly (or daily for active sites) backup schedule',
    ],
    plugins: [
      { name: 'WPvivid Backup', desc: 'Free automated backups to Google Drive, Dropbox, and more', url: 'https://wordpress.org/plugins/wpvivid-backuprestore/' },
      { name: 'UpdraftPlus', desc: 'Most popular backup plugin with cloud storage support', url: 'https://wordpress.org/plugins/updraftplus/' },
      { name: 'BackWPup', desc: 'Scheduled backups to Dropbox, S3, FTP, or email', url: 'https://wordpress.org/plugins/backwpup/' },
    ],
    links: [
      { label: 'Google: Best free WordPress backup plugin 2024', url: 'https://www.google.com/search?q=best+free+wordpress+backup+plugin+2024+google+drive' },
    ],
  },
  'No Backups Found': {
    summary: 'WPvivid is installed but no backups have been created. Your site has no recovery point if something goes wrong.',
    steps: [
      'Go to WordPress Admin → WPvivid Backup → Backup & Restore',
      'Click "Backup Now" to create your first backup immediately',
      'Verify the backup completes successfully and shows in the backup list',
      'Set up an automatic schedule: weekly for low-traffic sites, daily for stores',
      'Connect remote storage (Google Drive) so backups are saved off-server',
    ],
    plugins: [
      { name: 'WPvivid Backup', desc: 'Already installed — go configure it now', url: 'https://wordpress.org/plugins/wpvivid-backuprestore/' },
    ],
    links: [
      { label: 'Google: WPvivid backup setup guide', url: 'https://www.google.com/search?q=wpvivid+backup+setup+guide+google+drive' },
    ],
  },
  'Multiple Failed Logins': {
    summary: 'More than 10 failed login attempts were detected in the last 24 hours. Your site is being targeted by an automated brute-force attack.',
    steps: [
      'Install Limit Login Attempts Reloaded immediately to start blocking offending IPs',
      'Change your admin password to a strong, unique password (16+ characters)',
      'Install WPS Hide Login to change the login URL so bots can\'t find it',
      'Enable 2FA for all admin accounts',
      'In WP Admin → Users, check for any unknown admin accounts and delete them',
    ],
    plugins: [
      { name: 'Limit Login Attempts Reloaded', desc: 'Locks out IPs automatically after failed attempts', url: 'https://wordpress.org/plugins/limit-login-attempts-reloaded/' },
      { name: 'WPS Hide Login', desc: 'Hides wp-login.php from automated scanners', url: 'https://wordpress.org/plugins/wps-hide-login/' },
      { name: 'Wordfence Security', desc: 'Real-time IP blocking firewall + login security', url: 'https://wordpress.org/plugins/wordfence/' },
    ],
    links: [
      { label: 'Google: Stop WordPress brute force attack', url: 'https://www.google.com/search?q=stop+wordpress+brute+force+attack+limit+login+attempts' },
    ],
  },
  'Site is Down': {
    summary: 'The site is not responding to HTTP requests. This could be a server outage, a crashed PHP process, a full disk, or a misconfigured plugin.',
    steps: [
      'Open the site URL in your browser to confirm it is unreachable',
      'Log into cPanel and check if the web server (Apache/LiteSpeed) is running',
      'Go to cPanel → Error Logs and look for recent errors',
      'Check if disk space is full (cPanel → Disk Usage)',
      'Try deactivating recently installed/updated plugins via FTP if site is on white screen',
      'Contact your hosting provider if server-level access is needed',
    ],
    links: [
      { label: 'Google: WordPress site down troubleshooting guide', url: 'https://www.google.com/search?q=wordpress+site+down+white+screen+of+death+fix' },
      { label: 'Google: Check cPanel error logs website down', url: 'https://www.google.com/search?q=cpanel+error+logs+website+down+troubleshoot' },
    ],
  },
};

function getSolution(alert) {
  if (SOLUTIONS[alert.name]) return SOLUTIONS[alert.name];
  if (alert.name.startsWith('Plugin Update:')) {
    const pluginName = alert.name.replace('Plugin Update: ', '');
    return {
      summary: `A new version of the plugin "${pluginName}" is available. Plugin updates often include security patches — update promptly.`,
      steps: [
        'Go to WordPress Admin → Dashboard → Updates',
        `Find "${pluginName}" in the plugins list`,
        'Check the changelog for security-related fixes before updating',
        'Click "Update" to install the latest version',
        'If the site breaks after updating, deactivate the plugin and contact the plugin author',
      ],
      links: [
        { label: `Google: "${pluginName}" plugin update safe?`, url: `https://www.google.com/search?q=${encodeURIComponent(pluginName)}+wordpress+plugin+update+safe+changelog` },
        { label: 'Google: How to update WordPress plugins safely', url: 'https://www.google.com/search?q=how+to+safely+update+wordpress+plugins' },
      ],
    };
  }
  if (alert.name.startsWith('Theme Update:')) {
    const themeName = alert.name.replace('Theme Update: ', '');
    return {
      summary: `A new version of the theme "${themeName}" is available. Keeping themes updated prevents known security vulnerabilities.`,
      steps: [
        'Go to WordPress Admin → Dashboard → Updates',
        `Find "${themeName}" in the themes list`,
        'If you have custom code in the theme files, back them up first — or use a child theme',
        'Click "Update" to install the latest version',
      ],
      links: [
        { label: `Google: "${themeName}" theme update WordPress`, url: `https://www.google.com/search?q=${encodeURIComponent(themeName)}+wordpress+theme+update` },
      ],
    };
  }
  return {
    summary: `No specific fix guide is available for "${alert.name}" yet. Apply general WordPress security best practices while we add a detailed guide.`,
    steps: [
      'Keep WordPress core, all plugins, and themes up to date',
      'Use a security plugin like Wordfence or Sucuri for active monitoring',
      'Ensure all admin accounts have strong, unique passwords',
      'Take a full backup before making any changes to the site',
    ],
    plugins: [
      { name: 'Wordfence Security', desc: 'Free firewall, malware scanner, and security hardening', url: 'https://wordpress.org/plugins/wordfence/' },
    ],
    links: [
      { label: `Google: "${alert.name}" WordPress security fix`, url: `https://www.google.com/search?q=${encodeURIComponent(alert.name)}+wordpress+security+fix` },
      { label: 'Google: WordPress security hardening checklist', url: 'https://www.google.com/search?q=wordpress+security+hardening+checklist+2024' },
    ],
  };
}

function AlertSolutionModal({ alert, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const sol = getSolution(alert);
  const icon = TYPE_ICONS[alert.type] || TYPE_ICONS.Server;

  return (
    <div className="sol-overlay" onClick={onClose}>
      <div className="sol-panel" onClick={e => e.stopPropagation()}>
        <div className="sol-header">
          <div className="sol-header-left">
            <div className={`sol-icon ${icon.cls}`}>
              <svg viewBox="0 0 24 24">{icon.d}</svg>
            </div>
            <div>
              <div className="sol-title">{alert.name}</div>
              <div className="sol-meta">
                <span className={`sev ${alert.sevCls}`}>{alert.sevLabel}</span>
                <span className="sol-site">{alert.site}</span>
              </div>
            </div>
          </div>
          <button className="sol-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="sol-body">
          <div className="sol-summary">{sol.summary}</div>

          {sol.steps && sol.steps.length > 0 && (
            <div className="sol-section">
              <div className="sol-section-title">
                <svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                How to Fix
              </div>
              <ol className="sol-steps">
                {sol.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          )}

          {sol.code && (
            <div className="sol-section">
              <div className="sol-section-title">
                <svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                Code
              </div>
              <pre className="sol-code">{sol.code}</pre>
            </div>
          )}

          {sol.plugins && sol.plugins.length > 0 && (
            <div className="sol-section">
              <div className="sol-section-title">
                <svg viewBox="0 0 24 24"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>
                Recommended Plugins
              </div>
              <div className="sol-plugins">
                {sol.plugins.map((p, i) => (
                  <a key={i} className="sol-plugin-card" href={p.url} target="_blank" rel="noopener noreferrer">
                    <div className="sol-plugin-name">{p.name}</div>
                    <div className="sol-plugin-desc">{p.desc}</div>
                    <span className="sol-plugin-link">View on WordPress.org →</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {sol.links && sol.links.length > 0 && (
            <div className="sol-section">
              <div className="sol-section-title">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Search & Learn More
              </div>
              <div className="sol-links">
                {sol.links.map((l, i) => (
                  <a key={i} className="sol-link" href={l.url} target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Alerts() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-alerts'); return () => setPageClass(''); }, [setPageClass]);

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [selectedAlert, setSelectedAlert] = useState(null);

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('All Sites');
  const [type, setType] = useState('All Types');
  const [status, setStatus] = useState('All Status');

  useEffect(() => {
    setLoading(true);
    api.listAlerts()
      .then(r => setAlerts(r.alerts || []))
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = { total: alerts.length, high: 0, medium: 0, low: 0, resolved: 0 };
    alerts.forEach(a => {
      if (a.status === 'resolved') c.resolved++;
      else c[a.severity]++;
    });
    return c;
  }, [alerts]);

  const siteOptions = useMemo(() => ['All Sites', ...Array.from(new Set(alerts.map(a => a.site)))], [alerts]);
  const typeOptions = useMemo(() => ['All Types', ...Array.from(new Set(alerts.map(a => a.type)))], [alerts]);

  const typeBreakdown = useMemo(() => {
    const map = {};
    alerts.forEach(a => { map[a.type] = (map[a.type] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count, pct: counts.total ? ((count / counts.total) * 100).toFixed(1) : '0' }));
  }, [alerts, counts.total]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return alerts.filter(a => {
      const matchTab =
        tab === 'all' ? true :
        tab === 'resolved' ? a.status === 'resolved' :
        a.severity === tab;
      const matchSearch = !term || (`${a.name} ${a.desc} ${a.site} ${a.siteLabel} ${a.type}`.toLowerCase().includes(term));
      const matchSite = site === 'All Sites' || a.site === site;
      const matchType = type === 'All Types' || a.type === type;
      const matchStatus = status === 'All Status' || a.status === status.toLowerCase();
      return matchTab && matchSearch && matchSite && matchType && matchStatus;
    });
  }, [alerts, tab, search, site, type, status]);

  const TABS = [
    { key: 'all',      label: <>All Alerts <span className="tab-count">({counts.total})</span></> },
    { key: 'high',     label: <>High <span className="tab-count">({counts.high})</span></> },
    { key: 'medium',   label: <>Medium <span className="tab-count">({counts.medium})</span></> },
    { key: 'low',      label: <>Low <span className="tab-count">({counts.low})</span></> },
    { key: 'resolved', label: <>Resolved <span className="tab-count">({counts.resolved})</span></> },
  ];

  const donutConfig = useMemo(() => ({
    type: 'doughnut',
    data: { datasets: [{ data: [counts.high, counts.medium, counts.low], backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6'], borderWidth: 0, hoverOffset: 4 }] },
    options: { responsive: false, cutout: '70%', animation: false, plugins: { legend: { display: false } } },
  }), [counts.high, counts.medium, counts.low]);

  const pct = (n) => counts.total ? ((n / counts.total) * 100).toFixed(1) : '0';

  return (
    <>
      <div className="stat-cards">
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-red"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="stat-text"><div className="stat-label">Total Alerts</div><div className="stat-value">{counts.total}</div><div className="stat-sub">Across all sites</div></div>
          <div className="stat-sparkline"><Sparkline id="a-g1" color="#ef4444" points="2,16 12,20 22,12 32,22 42,10 52,18 66,14" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-orange"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="stat-text"><div className="stat-label">High Severity</div><div className="stat-value">{counts.high}</div><div className="stat-sub">{pct(counts.high)}% of total alerts</div></div>
          <div className="stat-sparkline"><Sparkline id="a-g2" color="#f97316" points="2,20 12,16 22,22 32,14 42,18 52,10 66,16" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-yellow"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="stat-text"><div className="stat-label">Medium Severity</div><div className="stat-value">{counts.medium}</div><div className="stat-sub">{pct(counts.medium)}% of total alerts</div></div>
          <div className="stat-sparkline"><Sparkline id="a-g3" color="#eab308" points="2,18 12,14 22,20 32,12 42,16 52,10 66,14" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-blue"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <div className="stat-text"><div className="stat-label">Low Severity</div><div className="stat-value">{counts.low}</div><div className="stat-sub">{pct(counts.low)}% of total alerts</div></div>
          <div className="stat-sparkline"><Sparkline id="a-g4" color="#3b82f6" points="2,22 12,18 22,22 32,16 42,20 52,14 66,18" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-green"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div>
          <div className="stat-text"><div className="stat-label">Resolved</div><div className="stat-value">{counts.resolved}</div><div className="stat-sub">All time</div></div>
          <div className="stat-sparkline"><Sparkline id="a-g5" color="#22c55e" points="2,22 12,18 22,20 32,14 42,16 52,10 66,8" /></div>
        </div></div>
      </div>

      <div className="filter-bar">
        <div className="filter-tabs">
          {TABS.map(t => (
            <div key={t.key} className={`filter-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>
          ))}
        </div>
        <div className="alerts-toolbar">
          <div className="search-box">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="search-input" type="text" placeholder="Search alerts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <CustomSelect value={site} onChange={setSite} options={siteOptions} />
          <CustomSelect value={type} onChange={setType} options={typeOptions} />
          <CustomSelect value={status} onChange={setStatus} options={['All Status', 'Active', 'Resolved']} />
          <button className="export-btn">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Export
          </button>
        </div>
      </div>

      <div className="alerts-layout">
        <div className="alerts-main">
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 240 }}>Alert</th>
                  <th style={{ minWidth: 140 }}>Site</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th style={{ minWidth: 120 }}>First Detected</th>
                  <th style={{ minWidth: 120 }}>Last Detected</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && (<tr className="no-results-row"><td colSpan={8}>Loading alerts…</td></tr>)}
                {!loading && loadError && (<tr className="no-results-row"><td colSpan={8} style={{ color: '#fca5a5' }}>Failed to load: {loadError}</td></tr>)}
                {!loading && !loadError && visible.length === 0 && (
                  <tr className="no-results-row"><td colSpan={8}>{alerts.length === 0 ? 'No alerts found. Sync a site first to see its alerts here.' : 'No alerts match your filters.'}</td></tr>
                )}
                {!loading && visible.map(a => {
                  const icon = TYPE_ICONS[a.type] || TYPE_ICONS.Server;
                  const [fd, ft] = fmtDateParts(a.first);
                  const [ld, lt] = fmtDateParts(a.last);
                  return (
                    <tr key={a.id} className="alert-row" onClick={() => setSelectedAlert(a)}>
                      <td>
                        <div className="alert-cell">
                          <div className={`alert-circle ${icon.cls}`}><svg viewBox="0 0 24 24">{icon.d}</svg></div>
                          <div><div className="al-name">{a.name}</div><div className="al-desc">{a.desc}</div></div>
                        </div>
                      </td>
                      <td><div className="site-cell"><div className="wp-circle">W</div><div><div className="site-url">{a.site}</div><div className="site-label">{a.siteLabel}</div></div></div></td>
                      <td><span className="type-badge">{a.type}</span></td>
                      <td><span className={`sev ${a.sevCls}`}>{a.sevLabel}</span></td>
                      <td><div className="date-main">{fd}</div><div className="date-time">{ft}</div></td>
                      <td><div className="date-main">{ld}</div><div className="date-time">{lt}</div></td>
                      <td>
                        {a.status === 'active'
                          ? <div className="status-active"><span className="dot-active" />Active</div>
                          : <span className="status-resolved">Resolved</span>}
                      </td>
                      <td><div className="dots-btn">⋮</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && visible.length > 0 && (
              <div className="tbl-footer">
                <span className="tbl-footer-text">Showing {visible.length} of {counts.total} alerts</span>
              </div>
            )}
          </div>
        </div>

        <div className="alerts-right">
          <div className="panel">
            <div className="panel-header"><div className="panel-title">Alerts by Severity</div></div>
            <div className="donut-inner">
              <div className="donut-wrap">
                {counts.total > 0 && <ChartCanvas key={`${counts.high}-${counts.medium}-${counts.low}`} config={donutConfig} width={130} height={130} />}
                <div className="donut-center"><div className="donut-num">{counts.total}</div><div className="donut-lbl">Total Alerts</div></div>
              </div>
              <div className="donut-legend">
                <div className="dl-row"><div className="dl-dot" style={{ background: '#ef4444' }}/><div className="dl-name">High</div><div className="dl-val">{counts.high}</div><div className="dl-pct">({pct(counts.high)}%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#f59e0b' }}/><div className="dl-name">Medium</div><div className="dl-val">{counts.medium}</div><div className="dl-pct">({pct(counts.medium)}%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#3b82f6' }}/><div className="dl-name">Low</div><div className="dl-val">{counts.low}</div><div className="dl-pct">({pct(counts.low)}%)</div></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Alerts by Type</div></div>
            <div className="type-list">
              {typeBreakdown.length === 0 && <div style={{ padding: 12, color: '#7a839e', fontSize: 13 }}>No data</div>}
              {typeBreakdown.map(t => {
                const icon = TYPE_ICONS[t.name] || TYPE_ICONS.Server;
                const iconCls = icon.cls.replace('ac-', 'ti-');
                return (
                  <div className="type-row" key={t.name}>
                    <div className={`type-icon-sm ${iconCls}`}><svg viewBox="0 0 24 24">{icon.d}</svg></div>
                    <div className="type-name-col">{t.name}</div>
                    <div className="type-count-col">{t.count}</div>
                    <div className="type-pct-col">({t.pct}%)</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selectedAlert && <AlertSolutionModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />}

      <div className="qa-panel">
        <div className="panel-title">Quick Actions</div>
        <div className="qa-grid">
          <div className="qa-card">
            <div className="qa-icon qi-purple"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <div><div className="qa-label">Run New Scan</div><div className="qa-sub">Scan All Sites Now</div></div>
          </div>
          <div className="qa-card">
            <div className="qa-icon qi-green"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div>
            <div><div className="qa-label">Mark All Resolved</div><div className="qa-sub">Resolve Active Alerts</div></div>
          </div>
          <div className="qa-card">
            <div className="qa-icon qi-blue"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div>
            <div><div className="qa-label">View All Sites</div><div className="qa-sub">Manage Connected Sites</div></div>
          </div>
          <div className="qa-card">
            <div className="qa-icon qi-orange"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
            <div><div className="qa-label">Export Report</div><div className="qa-sub">Download Alerts Report</div></div>
          </div>
          <div className="qa-card">
            <div className="qa-icon qi-cyan"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 1 22 12a10 10 0 0 1-2.93 7.07M4.93 4.93A10 10 0 0 0 2 12a10 10 0 0 0 2.93 7.07"/></svg></div>
            <div><div className="qa-label">Alert Settings</div><div className="qa-sub">Configure Notifications</div></div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ cls, label, val, sub, spId, spColor }) {
  return (
    <div className="stat-card"><div className="stat-card-top">
      <div className={`stat-icon ${cls}`}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg></div>
      <div className="stat-text"><div className="stat-label">{label}</div><div className="stat-value">{val}</div><div className="stat-sub">{sub}</div></div>
      <div className="stat-sparkline"><Sparkline id={spId} color={spColor} points="2,18 12,14 22,16 32,10 42,12 52,8 66,10" /></div>
    </div></div>
  );
}
