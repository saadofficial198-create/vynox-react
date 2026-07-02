/* Per-route topbar metadata. */
export const PAGE_META = {
  '/': { title: 'Dashboard', subtitle: 'Overview of all your WordPress sites' },
  '/sites': { title: 'Sites', breadcrumb: ['Dashboard', 'Sites'] },
  '/alerts': { title: 'Alerts', breadcrumb: ['Dashboard', 'Alerts'] },
  '/scans': { title: 'Scans', breadcrumb: ['Dashboard', 'Scans'] },
  '/backups': { title: 'Backups', breadcrumb: ['Dashboard', 'Backups'] },
  '/updates': { title: 'Updates', breadcrumb: ['Dashboard', 'Updates'] },
  '/reports': { title: 'Reports', breadcrumb: ['Dashboard', 'Reports'] },
  '/notifications': { title: 'Notifications', breadcrumb: ['Dashboard', 'Notifications'], search: 'Search notifications...' },
  '/settings': { title: 'Settings', breadcrumb: ['Dashboard', 'Settings'] },
  '/products': { title: 'Products', breadcrumb: ['Dashboard', 'Products'] },
  '/api-keys': { title: 'API Keys', breadcrumb: ['Dashboard', 'API Keys'] },
  '/activity-log': { title: 'Activity Log', breadcrumb: ['Dashboard', 'Activity Log'] },
  '/documentation': { title: 'Documentation', breadcrumb: ['Dashboard', 'Documentation'] },
};
