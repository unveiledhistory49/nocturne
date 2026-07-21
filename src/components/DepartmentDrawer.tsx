'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Building } from '@/lib/types';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { CAMPUS_BUILDINGS } from '@/data/campus';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  building: Building | null;
  recentEvents: { latencyMs: number; method?: string; category?: string; amount?: number; at: number }[];
}

// This is the one place the entire app uses `backdrop-filter` (spec §2, §6).
// It sits over the still-visible map; the panel itself contains only static
// text, never a redrawing chart — so the blur compositor never fights a repaint.
export function DepartmentDrawer({ open, onClose, building, recentEvents }: DrawerProps) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!building) return null;
  const isDropoff = building.networkStatus.dropoff || building.networkStatus.latencyMs > 90;

  return (
    <div
      className={
        'pointer-events-' + (open ? 'auto' : 'none') +
        ' absolute inset-0 z-30 flex justify-end'
      }
      aria-hidden={!open}
    >
      <div
        className={
          'absolute inset-0 transition-colors duration-[280ms] ' +
          (open ? 'bg-[rgba(10,14,24,0.55)]' : 'bg-transparent')
        }
        onClick={onClose}
        aria-hidden='true'
      />
      <section
        ref={panelRef}
        tabIndex={-1}
        role='dialog'
        aria-modal='true'
        aria-label={`${building.name} — ${building.department}`}
        className={
          'glass-drawer relative h-full w-full max-w-[440px] border-l border-[var(--hairline-strong)] px-6 py-6 outline-none ' +
          (open ? 'animate-drawer-in' : 'translate-x-full')
        }
      >
        <header className='flex items-start justify-between gap-4'>
          <div>
            <div className='font-mono text-[10px] uppercase tracking-[0.2em] text-stone-soft'>
              {building.id.toUpperCase()} · DEPARTMENT
            </div>
            <h2 className='mt-1 font-serif text-[28px] leading-tight text-stone'>
              {building.name}
            </h2>
            <div className='mt-1 font-sans text-sm text-stone-soft'>{building.department}</div>
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close department detail'
            className='border border-[var(--hairline)] bg-transparent px-2 py-1 text-stone transition-colors hover:border-fiber-cyan hover:text-fiber-cyan'
          >
            Esc
          </button>
        </header>

        <hr className='hairline my-5' />

        <div className='grid grid-cols-2 gap-x-6 gap-y-3'>
          <Field label='Engagement score'>
            <span className='mono-tabular text-[22px] text-window-amber'>
              {Math.round(building.currentEngagementScore * 1000) / 10}%
            </span>
          </Field>
          <Field label='Live latency'>
            <span className='mono-tabular text-[22px]' style={{ color: isDropoff ? 'var(--dropout-red)' : 'var(--fiber-cyan)' }}>
              {building.networkStatus.latencyMs} ms
            </span>
          </Field>
          <Field label='Connection'>
            <span className='mono-tabular uppercase text-stone'>{building.networkStatus.connection}</span>
          </Field>
          <Field label='Drop-off status'>
            {
              isDropoff
                ? (
                  <span className='flex items-center gap-2'>
                    <span className='hatch-dropout inline-block h-3 w-3 border border-dropout-red' />
                    <span className='mono-tabular text-dropout-red'>ACTIVE</span>
                  </span>
                )
                : <span className='mono-tabular text-stone'>— nominal</span>
            }
          </Field>
          <Field label='Enrolled students'>
            <span className='mono-tabular text-stone'>
              {building.studentCount ? building.studentCount.toLocaleString('en-US') : 'N/A (common area)'}
            </span>
          </Field>
          <Field label='Campus coordinate'>
            <span className='mono-tabular text-stone'>
              ({building.mapCoords.x.toFixed(1)}, {building.mapCoords.y.toFixed(1)})
            </span>
          </Field>
        </div>

        <hr className='hairline my-5' />

        <div>
          <div className='font-mono text-[10px] uppercase tracking-[0.2em] text-stone-soft'>
            Recent activity · last 20 events
          </div>
          {recentEvents.length === 0 ? (
            <p className='mt-3 text-sm text-stone-soft'>
              No events received yet for this building.
            </p>
          ) : (
            <ul className='mt-3 flex flex-col divide-y divide-[var(--hairline)] text-xs'>
              {recentEvents.slice(-20).reverse().map((e, i) => (
                <li key={i} className='flex items-baseline justify-between py-2'>
                  <span className='text-stone'>
                    {e.category
                      ? <span><span className='text-window-amber'>PURCHASE</span> · {e.category} · ${e.amount?.toFixed(2)}</span>
                      : <span><span className='text-fiber-cyan'>PING</span> · {e.latencyMs} ms · {e.method ?? ''}</span>}
                  </span>
                  <span className='mono-tabular text-stone-soft'>
                    {new Date(e.at).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className='mt-6 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-soft'>
          <button
            type='button'
            onClick={() => {
              const idx = CAMPUS_BUILDINGS.findIndex(b => b.id === building.id);
              const next = CAMPUS_BUILDINGS[(idx + 1) % CAMPUS_BUILDINGS.length];
              focusBuilding(next.id);
            }}
            className='border border-[var(--hairline)] px-2 py-1 hover:border-fiber-cyan hover:text-fiber-cyan'
          >
            Next building →
          </button>
          <span>{reduced ? 'Reduced motion honored' : 'Pulse confirmation active'}</span>
        </div>
      </section>
    </div>
  );
}

function focusBuilding(id: string) {
  // Hooked up by parent via custom event; for the drawer's own button we dispatch.
  window.dispatchEvent(new CustomEvent('nocturne:focus-building', { detail: id }));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className='font-mono text-[9px] uppercase tracking-[0.18em] text-stone-soft'>{label}</div>
      <div className='mt-1'>{children}</div>
    </div>
  );
}
