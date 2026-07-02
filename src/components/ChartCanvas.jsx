import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Thin wrapper around Chart.js.
 * `config` may be an object, or a function (ctx) => config so charts can
 * build canvas gradients. Rebuilds when config reference changes.
 */
export default function ChartCanvas({ config, width, height, className, style }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const ctx = ref.current.getContext('2d');
    const cfg = typeof config === 'function' ? config(ctx) : config;
    if (chartRef.current) {
      try { chartRef.current.destroy(); } catch (e) { /* ignore */ }
    }
    chartRef.current = new Chart(ctx, cfg);
    return () => {
      if (chartRef.current) {
        try { chartRef.current.destroy(); } catch (e) { /* ignore */ }
        chartRef.current = null;
      }
    };
  }, [config]);

  return <canvas ref={ref} width={width} height={height} className={className} style={style} />;
}
