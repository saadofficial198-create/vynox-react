import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

/* Shared, app-wide cache for the handful of API calls several pages each
 * used to fetch independently (listSites, listAlerts, pageSpeedLatestAll,
 * listBadges — see the per-page notes below). Before this, navigating
 * Dashboard -> Sites -> Scans re-downloaded the same site list three times
 * and the same PageSpeed data six times, and the always-mounted Topbar
 * fired its own copy of listSites/listAlerts on top of whatever the page
 * underneath was already doing. Every page showed a spinner for data the
 * app had already received seconds earlier.
 *
 * Three things make this feel instant:
 *
 *  1. CACHE — a resolved value is kept and handed to the next reader
 *     synchronously, so a revisited page renders with data on its first
 *     frame instead of mounting empty and filling in.
 *  2. IN-FLIGHT DEDUPE — concurrent readers of the same key share one
 *     request. Mounting Dashboard fires listSites from the page and from
 *     the Topbar at the same moment; that's one network call, not two.
 *  3. STALE-WHILE-REVALIDATE — a cached value is served immediately AND
 *     refreshed in the background. The screen is never blocked on the
 *     network for data we already have; it just quietly updates if the
 *     server's answer differs.
 *
 * Deliberately not a library (react-query/swr): this app has ~8 shared
 * endpoints, all read-only lists, and the codebase's own convention is
 * small local helpers over dependencies.
 */

const DataCacheContext = createContext(null);

// How long a cached value is served without a background refresh behind
// it. Everything cached here is written by backend jobs that run hourly at
// best (scans, PageSpeed, screenshots), so a value a few seconds old is
// never meaningfully wrong — this is about avoiding redundant requests, not
// about correctness.
const FRESH_MS = 20_000;

// Background poll for the always-visible numbers (site list, alert counts,
// PageSpeed scores). One timer for the whole app, replacing the three
// separate 30s intervals Dashboard/Sites/Scans each used to run.
const POLL_MS = 30_000;

export function DataCacheProvider({ children }) {
  // key -> { data, at, error }. A ref, not state: writing here must not
  // re-render the provider (which would re-render the entire app); the
  // subscriber list below is what tells individual readers to update.
  const cache = useRef(new Map());
  // key -> Promise, so concurrent callers share one request.
  const inflight = useRef(new Map());
  // key -> Set<callback>, the components currently reading that key.
  const subscribers = useRef(new Map());
  // key -> fetcher, for the dynamic per-site keys (snap:<id>, history:<id>,
  // …) that aren't in the static FETCHERS table. Recorded when a component
  // fetches one, so invalidate() and the background poll can re-run them
  // without the caller having to supply the fetcher a second time.
  const dynamicFetchers = useRef(new Map());

  const emit = useCallback((key) => {
    const subs = subscribers.current.get(key);
    if (subs) for (const cb of subs) cb();
  }, []);

  // Runs `fetcher` for `key`, unless an identical request is already in
  // flight — in which case that one's promise is returned instead.
  const fetchKey = useCallback((key, fetcher) => {
    if (!FETCHERS[key]) dynamicFetchers.current.set(key, fetcher);
    const existing = inflight.current.get(key);
    if (existing) return existing;

    const p = fetcher()
      .then((data) => {
        cache.current.set(key, { data, at: Date.now(), error: null });
        return data;
      })
      .catch((err) => {
        // Keep any previously good data on failure — a transient network
        // blip shouldn't blank out a working screen. The error is recorded
        // alongside it so a reader can surface it if it wants to.
        const prev = cache.current.get(key);
        cache.current.set(key, { data: prev?.data ?? null, at: prev?.at ?? 0, error: err });
        throw err;
      })
      .finally(() => {
        inflight.current.delete(key);
        emit(key);
      });

    inflight.current.set(key, p);
    return p;
  }, [emit]);

  const subscribe = useCallback((key, cb) => {
    if (!subscribers.current.has(key)) subscribers.current.set(key, new Set());
    subscribers.current.get(key).add(cb);
    return () => {
      const subs = subscribers.current.get(key);
      if (!subs) return;
      subs.delete(cb);
      if (!subs.size) subscribers.current.delete(key);
    };
  }, []);

  const peek = useCallback((key) => cache.current.get(key), []);

  // Drops a cached value so the next read refetches — for after a mutation
  // (adding/renaming/deleting a site, saving a badge) where the cached list
  // is now known to be out of date.
  const invalidate = useCallback((...keys) => {
    for (const key of keys) {
      cache.current.delete(key);
      const fetcher = FETCHERS[key] || dynamicFetchers.current.get(key);
      // Refetch immediately rather than waiting for a reader: the component
      // that just mutated something is usually about to render the result.
      // Only worth doing while something is actually on screen reading it.
      if (fetcher && subscribers.current.has(key)) fetchKey(key, fetcher).catch(() => {});
      else emit(key);
      // Nothing is reading it and its value is gone — drop the remembered
      // fetcher too, so deleted sites don't accumulate here.
      if (!subscribers.current.has(key)) dynamicFetchers.current.delete(key);
    }
  }, [fetchKey, emit]);

  // One timer for the whole app. Only refreshes keys something is actually
  // reading right now — an open Settings page shouldn't be polling the
  // PageSpeed scores nobody is looking at.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return; // don't poll a backgrounded tab
      for (const key of subscribers.current.keys()) {
        // Shared lists only. The per-site keys (a snapshot, a tab's
        // history, a sitemap scrape) are deliberately NOT polled: they're
        // written by jobs that run hourly at best, and one of them —
        // pageCandidates — scrapes the customer's live site, which is far
        // too expensive to repeat on a timer behind an idle tab. They
        // refresh when the user revisits them, or on demand after a Sync.
        const fetcher = FETCHERS[key];
        if (fetcher) fetchKey(key, fetcher).catch(() => {});
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchKey]);

  // Warm the cache for what every page needs, at app boot, in parallel —
  // so the first page the user lands on already has its data instead of
  // starting a request only once it mounts. These are the same four calls
  // that used to be scattered across Dashboard/Sites/Scans/Topbar.
  useEffect(() => {
    for (const key of PREFETCH_KEYS) fetchKey(key, FETCHERS[key]);
  }, [fetchKey]);

  const value = { fetchKey, subscribe, peek, invalidate };
  return <DataCacheContext.Provider value={value}>{children}</DataCacheContext.Provider>;
}

// Every shared key, and how to fetch it. Keys are plain strings so a
// component can name one without importing anything but the hook.
export const FETCHERS = {
  sites:   () => api.listSites().then(r => r.sites || []),
  alerts:  () => api.listAlerts().then(r => r.alerts || []),
  scans:   () => api.listScans().then(r => r.scans || []),
  updates: () => api.listUpdates().then(r => r.updates || []),
  badges:  () => api.listBadges().then(r => r.badges || []),
  otpLatest: () => api.otpCheckLatest().then(r => r.checks || []),
  // Kept whole rather than reduced to `.backups`: the response's `summary`
  // block (counts, total backup size, disk free) is what the Dashboard's
  // "Backups OK" card and the Backups page's stat row both read.
  backups: () => api.listBackups().then(r => ({ summary: r.summary || {}, backups: r.backups || [] })),
  'pagespeed:desktop': () => api.pageSpeedLatestAll('desktop').then(r => r.scores || {}),
  'pagespeed:mobile':  () => api.pageSpeedLatestAll('mobile').then(r => r.scores || {}),
};

// Fetched once at app boot rather than on first use. Chosen because every
// one of these is read by the landing page, the Topbar (always mounted), or
// both — so prefetching costs nothing extra and removes the initial wait.
const PREFETCH_KEYS = ['sites', 'alerts', 'pagespeed:desktop', 'pagespeed:mobile'];

/**
 * Reads one shared key. Returns cached data synchronously on the very first
 * render if the app already has it (the common case after boot), so the
 * component paints with real data instead of a spinner.
 *
 * `loading` is true only when there is genuinely nothing to show yet — not
 * during a background refresh of data already on screen, which is what
 * would otherwise make a populated table flash back to a loading state
 * every 30 seconds.
 */
export function useCachedData(key) {
  const ctx = useContext(DataCacheContext);
  const entry = ctx.peek(key);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const unsub = ctx.subscribe(key, () => forceRender(n => n + 1));
    const current = ctx.peek(key);
    const stale = !current || Date.now() - current.at > FRESH_MS;
    if (stale && FETCHERS[key]) ctx.fetchKey(key, FETCHERS[key]).catch(() => {});
    return unsub;
  }, [ctx, key]);

  // A "Refresh" button must actually reach the server — if a request for
  // this key happens to be in flight, joining it is fine (same result), but
  // a merely-fresh cached value must not short-circuit it.
  const refresh = useCallback(
    () => (FETCHERS[key] ? ctx.fetchKey(key, FETCHERS[key]).catch(() => {}) : Promise.resolve()),
    [ctx, key]
  );

  return {
    data: entry?.data ?? null,
    loading: !entry?.data && !entry?.error,
    error: entry?.error ?? null,
    refresh,
  };
}

/**
 * Cache for per-site data that isn't in FETCHERS because the key depends on
 * which site (and sometimes which tab) is selected — the site snapshot, a
 * tab's history, a sitemap scrape. Same cache and dedupe as above, but the
 * caller supplies the fetcher.
 *
 * This is what makes switching tabs inside a site instant: each tab's data
 * stays cached under its own key after the tab unmounts, so coming back to
 * it renders immediately while any update arrives in the background.
 *
 * Pass `key = null` to hold off entirely (e.g. no site selected yet).
 */
export function useCachedFetch(key, fetcher) {
  const ctx = useContext(DataCacheContext);
  const entry = key ? ctx.peek(key) : null;
  const [, forceRender] = useState(0);

  // Keep the latest fetcher without making it an effect dependency —
  // callers routinely pass an inline arrow, which would otherwise re-run
  // the effect (and refetch) on every single render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!key) return;
    const unsub = ctx.subscribe(key, () => forceRender(n => n + 1));
    const current = ctx.peek(key);
    const stale = !current || Date.now() - current.at > FRESH_MS;
    if (stale) ctx.fetchKey(key, () => fetcherRef.current()).catch(() => {});
    return unsub;
  }, [ctx, key]);

  // A manual refresh (a Refresh button, or a poll on a running job) must
  // reach the server regardless of how fresh the cached value is. Joining an
  // already-in-flight request is fine — same answer — so this goes straight
  // to fetchKey rather than invalidating first, which would blank the screen
  // for the moment between clearing the value and the response arriving.
  const refresh = useCallback(
    () => (key ? ctx.fetchKey(key, () => fetcherRef.current()).catch(() => {}) : Promise.resolve()),
    [ctx, key]
  );

  return {
    data: entry?.data ?? null,
    loading: !!key && !entry?.data && !entry?.error,
    error: entry?.error ?? null,
    refresh,
  };
}

/** Invalidate shared keys after a mutation (add/rename/delete a site, etc.). */
export function useInvalidate() {
  return useContext(DataCacheContext).invalidate;
}
