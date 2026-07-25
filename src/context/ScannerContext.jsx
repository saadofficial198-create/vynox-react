import { createContext, useContext, useState, useCallback } from 'react';

/* NOTE: The manual/auto "Scan All" feature (interval countdown, triggerScan,
 * runScan calling the now-removed /sync endpoints) has been removed — security
 * data now refreshes automatically once a day via a GitHub Actions cron job.
 * This context is kept only because Settings.jsx still exposes a "Scan
 * Settings" interval preference picker; it now just stores that preference. */
export const SCAN_INTERVALS = {
  'Every 1 Minute':   60,
  'Every 5 Minutes':  300,
  'Every 15 Minutes': 900,
  'Every 1 Hour':     3600,
  'Off': 0,
};

const ScannerContext = createContext(null);

export function ScannerProvider({ children }) {
  const [intervalKey, setIntervalKey] = useState(
    () => localStorage.getItem('vynox_scan_interval') || 'Every 15 Minutes'
  );

  const changeInterval = useCallback((key) => {
    localStorage.setItem('vynox_scan_interval', key);
    setIntervalKey(key);
  }, []);

  return (
    <ScannerContext.Provider value={{ intervalKey, changeInterval }}>
      {children}
    </ScannerContext.Provider>
  );
}

export function useScanner() {
  return useContext(ScannerContext);
}
