'use client';

interface RailRow {
  label: string;
  value: string;
  sublabel?: string;
  trend?: 'up' | 'down' | 'steady';
  accent: 'amber' | 'cyan' | 'stone';
}

export function LiveMetricRail({ rows }: { rows: RailRow[] }) {
  return (
    <aside
      className='flex h-full flex-col justify-between border-l border-[var(--hairline)] bg-[rgba(14,19,34,0.55)] px-5 py-6'
      aria-label='Live metrics'
    >
      <header className='mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-soft'>
        Live rail
      </header>
      <div className='flex flex-col gap-7'>
        {rows.map(r => (
          <MetricRailRow key={r.label} row={r} />
        ))}
      </div>
      <footer className='mt-6 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-soft'>
        <span className='mb-px mr-2 inline-block h-1.5 w-1.5 rounded-full bg-fiber-cyan align-middle [animation:arrivalPulse_1.6s_ease-in-out_infinite]' />
        <span>Streaming · 250ms batch</span>
      </footer>
    </aside>
  );
}

function accentColor(a: RailRow['accent']): string {
  if (a === 'amber') return 'var(--window-amber)';
  if (a === 'cyan') return 'var(--fiber-cyan)';
  return 'var(--stone)';
}

function MetricRailRow({ row }: { row: RailRow }) {
  return (
    <div className='group relative'>
      <div className='font-mono text-[10px] uppercase tracking-[0.18em] text-stone-soft'>
        {row.label}
      </div>
      <div
        className='mono-tabular mt-1 text-[28px] leading-none font-medium tracking-tight'
        style={{ color: accentColor(row.accent) }}
        aria-live='polite'
      >
        {row.value}
      </div>
      {row.sublabel && (
        <div className='mono-tabular mt-2 text-[11px] text-stone'>
          {row.sublabel}
        </div>
      )}
    </div>
  );
}

export interface LiveMetricRailProps {
  activeUsers: number;
  avgLatencyMs: number;
  transactionsPerMin: number;
}

export function buildRailRows(props: LiveMetricRailProps): RailRow[] {
  return [
    {
      label: 'Active on campus',
      value: props.activeUsers.toLocaleString('en-US'),
      sublabel: 'live check-ins · wifi/5g/4g sessions',
      accent: 'amber',
      trend: 'up'
    },
    {
      label: 'Avg network latency',
      value: `${props.avgLatencyMs.toFixed(1)} ms`,
      sublabel: 'rolling 50-ping median',
      accent: 'cyan',
      trend: props.avgLatencyMs < 35 ? 'down' : 'up'
    },
    {
      label: 'Marketplace velocity',
      value: `${props.transactionsPerMin} /min`,
      sublabel: 'txn settled last 60s',
      accent: 'amber',
      trend: 'steady'
    }
  ];
}
