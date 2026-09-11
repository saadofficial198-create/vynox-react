import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AuthGate from './components/AuthGate';
import { DataCacheProvider } from './context/DataCache';
import './styles/style.css';

// DataCacheProvider sits INSIDE AuthGate on purpose: it prefetches the
// shared lists as soon as it mounts, and doing that before the user is
// authenticated would just fire a burst of 401s (and trip the
// vynox:unauthorized handler) on the login screen.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>
      <DataCacheProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DataCacheProvider>
    </AuthGate>
  </StrictMode>
);
