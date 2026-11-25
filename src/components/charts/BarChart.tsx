import { useId, useState } from 'react';

/**
 * One measure per day as thin bars (one series, so the title names it and no
 * legend is needed). Bars sit on the baseline with rounded tops and a 2px gap;
 * hover or focus shows the exact value; the same numbers are available as a table.
 */
export function BarChart({
  title,
  data,
  format = (n) => n.toLocaleString('en-US'),
  tableLabel,
  testId,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
  format?: (n: number) => string;
  tableLabel: string;
  testId?: string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 640;
  const H = 160;
  const pad = { top: 6, bottom: 1, left: 0, right: 0 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const slot = (W - pad.left - pad.right) / n;
  const bar = Math.max(2, slot - 2); // 2px surface gap between bars
  const plotH = H - pad.top - pad.bottom;
  const total = data.reduce((s, d) => s + d.value, 0);
  const h = hover !== null ? data[hover] : null;

  return (
    <figure className="bar-chart" data-testid={testId}>
      <figcaption className="row between">
        <span id={`${id}-t`} className="chart-title">
          {title}
        </span>
        <span className="muted small">
          {h ? (
            <>
              {h.label}: <strong style={{ color: 'var(--text)' }}>{format(h.value)}</strong>
            </>
          ) : (
            <>
              Σ <strong style={{ color: 'var(--text)' }}>{format(total)}</strong>
            </>
          )}
        </span>
      </figcaption>
      {table ? (
        <div className="table-wrap">
          <table>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <th scope="row">{d.label}</th>
                  <td className="num">{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bar-plot">
          {total > 0 && <span className="tick top">{format(max)}</span>}
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t`} preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
            <line x1={pad.left} x2={W - pad.right} y1={H - pad.bottom} y2={H - pad.bottom} className="axis" vectorEffect="non-scaling-stroke" />
            {data.map((d, i) => {
              const bh = d.value === 0 ? 0 : Math.max(3, (d.value / max) * plotH);
              const x = pad.left + i * slot + (slot - bar) / 2;
              const y = H - pad.bottom - bh;
              const r = Math.min(4, bar / 2, bh);
              return (
                <g key={d.label}>
                  {/* Hit target: the whole column, larger than the bar. */}
                  <rect x={pad.left + i * slot} y={pad.top} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
                  {bh > 0 && <path className={`bar ${hover === i ? 'on' : ''}`} d={`M${x},${H - pad.bottom} V${y + r} Q${x},${y} ${x + r},${y} H${x + bar - r} Q${x + bar},${y} ${x + bar},${y + r} V${H - pad.bottom} Z`} pointerEvents="none" />}
                </g>
              );
            })}
          </svg>
          <div className="ticks">
            <span className="tick">{data[0]?.label}</span>
            <span className="tick">{data[data.length - 1]?.label}</span>
          </div>
        </div>
      )}
      <button type="button" className="link small" onClick={() => setTable(!table)}>
        {table ? title : tableLabel}
      </button>
    </figure>
  );
}
