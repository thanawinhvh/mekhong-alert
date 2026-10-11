import type { GaugeReading } from "../lib/types";

interface Props {
  readings: GaugeReading[];
  height?: number;
}

// Plain SVG line chart — a single-series time series with one threshold line
// doesn't earn a charting library (§2 doesn't lock one for this).
export default function GaugeChart({ readings, height = 220 }: Props) {
  if (readings.length === 0) return <div style={{ height }} />;

  const width = 640;
  const padding = 32;
  const floodStage = readings[0].flood_stage_m;
  const levels = readings.map((r) => r.level_m);
  const minLevel = Math.min(...levels, floodStage) - 0.3;
  const maxLevel = Math.max(...levels, floodStage) + 0.3;

  const x = (i: number) => padding + (i / (readings.length - 1)) * (width - padding * 2);
  const y = (level: number) => height - padding - ((level - minLevel) / (maxLevel - minLevel)) * (height - padding * 2);

  const linePath = readings.map((r, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(r.level_m)}`).join(" ");
  const floodY = y(floodStage);
  const latest = readings[readings.length - 1];
  const isNearFlood = latest.level_m >= floodStage - 0.5;
  const lineColor = isNearFlood ? "#fb4d5c" : "#2dd4bf";

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Water level trend">
      <line x1={padding} y1={floodY} x2={width - padding} y2={floodY} stroke="#fb4d5c" strokeDasharray="4 4" />
      <text x={width - padding} y={floodY - 6} textAnchor="end" fontSize="11" fill="#fb4d5c">
        flood stage {floodStage}m
      </text>
      <path
        d={linePath}
        fill="none"
        stroke={lineColor}
        strokeWidth={2.5}
        style={{ filter: `drop-shadow(0 0 6px ${lineColor}80)` }}
      />
      <circle cx={x(readings.length - 1)} cy={y(latest.level_m)} r={4.5} fill={lineColor} />
      <text
        x={x(readings.length - 1)}
        y={y(latest.level_m) - 12}
        textAnchor="end"
        fontSize="13"
        fontWeight={700}
        fill="rgba(255,255,255,0.92)"
      >
        {latest.level_m.toFixed(2)}m
      </text>
    </svg>
  );
}
