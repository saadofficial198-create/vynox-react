import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Thin wrapper around Chart.js.
 * `config` may be an object, or a function (ctx) => config so charts can
 * build canvas gradients. Rebuilds when config reference changes.
 *
 * `updateInPlace` (default false, opt-in — every existing caller keeps the
 * old destroy-and-recreate behavior unchanged): when true, a deps change
 * updates the EXISTING Chart.js instance's data/options via `chart.update()`
 * instead of destroying and recreating it. This is what actually lets
 * Chart.js's own data-change animation play (destroy+recreate is a hard cut
 * — there's no "previous state" left to animate from). Only worth using for
 * charts whose TYPE never changes between updates (e.g. always 'line') —
 * swapping type via mutation isn't something Chart.js handles well.
 */
export default function ChartCanvas({ config, deps = [], width, height, className, style, updateInPlace = false }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  // Unmount-only cleanup, deliberately in its OWN effect (empty deps) so it
  // doesn't fire between every data-only update below — it reads
  // chartRef.current at cleanup time (refs are mutable), so it still always
  // destroys whichever instance is live when the component actually goes away.
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        try { chartRef.current.destroy(); } catch (e) { /* ignore */ }
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const ctx = ref.current.getContext('2d');
    const cfg = typeof config === 'function' ? config(ctx) : config;

    if (updateInPlace && chartRef.current) {
      chartRef.current.data = cfg.data;
      chartRef.current.options = cfg.options;
      chartRef.current.update();
      return;
    }

    if (chartRef.current) {
      try { chartRef.current.destroy(); } catch (e) { /* ignore */ }
    }
    chartRef.current = new Chart(ctx, cfg);
  }, [config, updateInPlace, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={ref} width={width} height={height} className={className} style={style} />;
}
