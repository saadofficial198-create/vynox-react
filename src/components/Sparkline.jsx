/* Tiny SVG sparkline used in stat cards. */
export default function Sparkline({ id, color, points, width = 68, height = 32, viewBox = '0 0 68 32' }) {
  // build a closed polygon path from the polyline points + bottom corners
  const [maxX, maxY] = viewBox.split(' ').slice(2).map(Number);
  const polygon = `${points} ${maxX - 2},${maxY} 2,${maxY}`;
  return (
    <svg width={width} height={height} viewBox={viewBox}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={polygon} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
