/* A small single-series bar chart (one hue, no legend: the title names it). Bars have 4px rounded tops on the
   baseline, a recessive axis, labels under each bar, and the value on hover / focus. */
import { useState } from "react";

export function MiniBars({ data, label, unit, strong }: { data: { label: string; value: number; title: string }[]; label: string; unit: string; strong?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320, H = 112, top = 14, base = 88;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = W / data.length;
  const bw = Math.min(24, slot - 8);
  const h = (v: number) => (v / max) * (base - top);
  return (
    <figure className="minibars">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${data.map((d) => `${d.title} ${d.value} ${unit}`).join(", ")}`} onMouseLeave={() => setHover(null)}>
        <line className="chart-base" x1={0} x2={W} y1={base + 0.5} y2={base + 0.5} />
        {data.map((d, i) => {
          const x = i * slot + (slot - bw) / 2, bh = h(d.value);
          const r = Math.min(4, bh / 2, bw / 2);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => setHover(i)} tabIndex={0}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {bh > 0 && <path className={`bar${hover === i ? " hot" : ""}`} d={`M${x},${base} V${base - bh + r} Q${x},${base - bh} ${x + r},${base - bh} H${x + bw - r} Q${x + bw},${base - bh} ${x + bw},${base - bh + r} V${base} Z`} />}
              <text className={`chart-tick${i === strong ? " strong" : ""}`} x={x + bw / 2} y={base + 18} textAnchor="middle">{d.label}</text>
              {hover === i && <text className="chart-end" x={x + bw / 2} y={Math.max(11, base - bh - 5)} textAnchor="middle">{d.value}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && <figcaption className="muted small">{data[hover].title}: <b>{data[hover].value}</b> {unit}</figcaption>}
    </figure>
  );
}
