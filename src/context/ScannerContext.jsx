import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

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
    () => localStorage.getItem('vynox_scan_interval') || 'Every 1 Hour'
  );
  const totalSecs = SCAN_INTERVALS[intervalKey] ?? 3600;

  const [remaining,  setRemaining]  = useState(() => {
    if (totalSecs === 0) return 0;
    const lastAt = parseInt(localStorage.getItem('vynox_last_scan_at') || '0', 10);
    if (!lastAt) return totalSecs;
    const elapsed = Math.floor((Date.now() - lastAt) / 1000);
    const left = totalSecs - (elapsed % totalSecs);
    return left > 0 ? left : totalSecs;
  });
  const [isScanning, setIsScanning] = useState(false);
  const [progress,   setProgress]   = useState({ done: 0, total: 0, current: '' });
  const [lastScan,   setLastScan]   = useState(null);
  const [flash,      setFlash]      = useState(false);

  const isScanningRef  = useRef(false);
  const totalSecsRef   = useRef(totalSecs);
  totalSecsRef.current = totalSecs;

  const runScan = useCallback(async () => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setIsScanning(true);
    setProgress({ done: 0, total: 0, current: 'Loading sites…' });

    try {
      const res   = await api.listSites();
      const sites = res.sites || [];

      setProgress({ done: 0, total: sites.length, current: '' });

      /* Scan one by one so progress is visible */
      for (let i = 0; i < sites.length; i++) {
        const site = sites[i];
        setProgress({ done: i, total: sites.length, current: site.name || site.url });
        try { await api.syncSite(site._id); } catch { /* site might be offline */ }
        setProgress({ done: i + 1, total: sites.length, current: site.name || site.url });
      }

      const now = Date.now();
      localStorage.setItem('vynox_last_scan_at', String(now));
      setLastScan(new Date(now));
      setFlash(true);
      setTimeout(() => setFlash(false), 800);
      window.dispatchEvent(new CustomEvent('vynox:scan-complete'));
    } catch {
      /* backend not running */
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
      setProgress({ done: 0, total: 0, current: '' });
      setRemaining(totalSecsRef.current);
    }
  }, []);

  /* Recalculate remaining when interval changes */
  useEffect(() => {
    if (totalSecs === 0) { setRemaining(0); return; }
    const lastAt = parseInt(localStorage.getItem('vynox_last_scan_at') || '0', 10);
    if (!lastAt) { setRemaining(totalSecs); return; }
    const elapsed = Math.floor((Date.now() - lastAt) / 1000);
    const left = totalSecs - (elapsed % totalSecs);
    setRemaining(left > 0 ? left : totalSecs);
  }, [totalSecs]);

  /* Countdown tick — every second */
  useEffect(() => {
    if (totalSecs === 0) return;
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { runScan(); return totalSecsRef.current; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [totalSecs, runScan]);

  const changeInterval = useCallback((key) => {
    localStorage.setItem('vynox_scan_interval', key);
    setIntervalKey(key);
  }, []);

  const triggerScan = useCallback(() => {
    if (!isScanningRef.current) runScan();
  }, [runScan]);

  return (
    <ScannerContext.Provider value={{
      remaining, totalSecs, isScanning, progress, lastScan, flash,
      triggerScan, intervalKey, changeInterval,
    }}>
      {children}
    </ScannerContext.Provider>
  );
}

export function useScanner() {
  return useContext(ScannerContext);
}
