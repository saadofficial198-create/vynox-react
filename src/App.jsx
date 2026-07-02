import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sites from './pages/Sites';
import Alerts from './pages/Alerts';
import Scans from './pages/Scans';
import Backups from './pages/Backups';
import Updates from './pages/Updates';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import SettingsPage from './pages/Settings';

/* Tiny inline placeholder until each page is ported. */
function Placeholder({ name }) {
  return (
    <div style={{ padding: 40, color: '#7a839e' }}>
      <h2 style={{ color: '#fff', marginBottom: 8 }}>{name}</h2>
      <p>Coming soon — this page hasn’t been ported to React yet.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/scans" element={<Scans />} />
        <Route path="/backups" element={<Backups />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/products" element={<Placeholder name="Products" />} />
        <Route path="/api-keys" element={<Placeholder name="API Keys" />} />
        <Route path="/activity-log" element={<Placeholder name="Activity Log" />} />
        <Route path="/documentation" element={<Placeholder name="Documentation" />} />
        <Route path="*" element={<Placeholder name="Not found" />} />
      </Route>
    </Routes>
  );
}
