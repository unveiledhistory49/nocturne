'use client';

import type { CheckIn, NetworkPing, Transaction } from '@/lib/types';
import { CAMPUS_BUILDINGS } from '@/data/campus';

export function AccessibleMapTable({ pings, transactions, checkIns }: {
  pings: NetworkPing[]; transactions: Transaction[]; checkIns: CheckIn[];
}) {
  const nameOf = (id: string) => CAMPUS_BUILDINGS.find(b => b.id === id)?.name ?? id;
  return (
    <details className='sr-only focus-within:not-sr-only'>
      <summary className='font-mono text-xs cursor-pointer text-fiber-cyan'>
        Show text-based map alternative (screen reader users)
      </summary>
      <div className='mt-3 m-3 p-3 bg-night-indigo-deep border border-[var(--hairline)]'>
        <h4 className='display-serif text-lg text-stone'>Recent network pings</h4>
        <table className='mt-2 w-full text-xs text-stone'>
          <thead><tr><th>Building</th><th>Latency</th><th>Connection</th><th>Drop-off</th></tr></thead>
          <tbody>
            {pings.slice(-8).map(p => (
              <tr key={p.id}><td>{nameOf(p.buildingId)}</td><td>{p.latencyMs}ms</td><td>{p.connectionType}</td><td>{p.dropoff ? 'Yes' : 'No'}</td></tr>
            ))}
          </tbody>
        </table>
        <h4 className='mt-4 display-serif text-lg text-stone'>Recent transactions</h4>
        <table className='mt-2 w-full text-xs text-stone'>
          <thead><tr><th>Building</th><th>Category</th><th>Amount</th><th>When</th></tr></thead>
          <tbody>
            {transactions.slice(-8).map(t => (
              <tr key={t.id}><td>{nameOf(t.buildingId)}</td><td>{t.category}</td><td>${t.amount.toFixed(2)}</td><td>{new Date(t.timestamp).toLocaleTimeString()}</td></tr>
            ))}
          </tbody>
        </table>
        <h4 className='mt-4 display-serif text-lg text-stone'>Recent check-ins</h4>
        <table className='mt-2 w-full text-xs text-stone'>
          <thead><tr><th>Building</th><th>Method</th><th>When</th></tr></thead>
          <tbody>
            {checkIns.slice(-8).map(c => (
              <tr key={c.id}><td>{nameOf(c.buildingId)}</td><td>{c.method}</td><td>{new Date(c.timestamp).toLocaleTimeString()}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
