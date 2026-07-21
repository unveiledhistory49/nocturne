'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { hexbin as d3Hexbin } from 'd3-hexbin';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { TRANSACTION_CATEGORIES } from '@/data/campus';
import type { Transaction } from '@/lib/types';

interface Props {
  transactions: Transaction[];
  width: number;
  height: number;
}

const PAD = { top: 32, right: 24, bottom: 38, left: 48 };

// Time of day maps 0..24h to x-axis. Category index maps y.
// Point radius encodes log(amount). Amber for high-value, stone for low.

function categoryIndex(cat: string): number {
  const i = TRANSACTION_CATEGORIES.indexOf(cat);
  return i < 0 ? 0 : i;
}

function timeOfDayFromTs(ts: number): number {
  // Build a 24h x-axis from timestamps with a stable projection.
  const d = new Date(ts);
  return d.getHours() + d.getMinutes() / 60;
}

export function MarketplaceScatter({ transactions, width, height }: Props) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);  // > 1 → individual points; < 1 → hexbins
  const [size, setSize] = useState({ w: width, h: height });
  const arrivalRef = useRef<number[]>([]);   // ms timestamps of points newly arrived in last 150ms

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entry => {
      const r = entry[0].contentRect;
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // LOD rule from spec: aggregate to hexbins at full-campus zoom, resolve to points past a threshold.
  const totalTx = transactions.length;
  const hexbinMode = totalTx > 600 && zoom <= 1;

  const xScale = useMemo(
    () => scaleLinear().domain([0, 24]).range([PAD.left, size.w - PAD.right]),
    [size.w]
  );
  const yScale = useMemo(
    () => scaleLinear().domain([-0.5, TRANSACTION_CATEGORIES.length - 0.5]).range([size.h - PAD.bottom, PAD.top]),
    [size.h]
  );
  const rScale = useMemo(
    () => scaleLinear().domain([1, 60]).range([2.2, 9]),
    []
  );

  // Record arrival timestamps for new txns to drive the one-shot 150ms pulse.
  useEffect(() => {
    if (transactions.length === 0) return;
    const last = transactions[transactions.length - 1];
    if (Date.now() - last.timestamp < 350) arrivalRef.current.push(performance.now() + 150);
    // keep arrival list short
    while (arrivalRef.current.length > 16) arrivalRef.current.shift();
  }, [transactions]);

  // Draw — canvas only, never wraps in backdrop-filter (spec §6).
  useEffect(() => {
    if (!canvasRef.current) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    // Axes.
    ctx.strokeStyle = 'rgba(156,148,132,0.22)';
    ctx.fillStyle = '#9C9484';
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
    ctx.lineWidth = 1;

    // x ticks every 4h.
    [0, 4, 8, 12, 16, 20, 24].forEach(h => {
      const x = xScale(h);
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, size.h - PAD.bottom); ctx.stroke();
      ctx.fillText(`${String(h).padStart(2, '0')}:00`, x + 4, size.h - PAD.bottom + 18);
    });
    // y ticks — category names.
    TRANSACTION_CATEGORIES.forEach((cat, i) => {
      const y = yScale(i);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(size.w - PAD.right, y); ctx.stroke();
      ctx.fillText(cat.toUpperCase(), 8, y + 3);
    });

    if (hexbinMode) {
      const hb = d3Hexbin()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .radius(14)
        .extent([[PAD.left, PAD.top], [size.w - PAD.right, size.h - PAD.bottom]]);
      const pts = transactions.map(t => ({
        x: timeOfDayFromTs(t.timestamp),
        y: categoryIndex(t.category),
        amount: t.amount,
        ts: t.timestamp
      }));
      const bins = hb(pts as any);
      bins.forEach(b => {
        const cnt = b.length;
        const cx = b.x, cy = b.y;
        const radius = Math.max(4, Math.min(14, Math.sqrt(cnt) * 2));
        const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, radius);
        grad.addColorStop(0, 'rgba(232, 163, 61, 0.85)');
        grad.addColorStop(1, 'rgba(232, 163, 61, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
      });
    } else {
      // Individual points.
      transactions.forEach((t, i) => {
        const cx = xScale(timeOfDayFromTs(t.timestamp));
        const cy = yScale(categoryIndex(t.category));
        const r = rScale(t.amount);
        const isRecent = arrivalRef.current.some(end => performance.now() < end);
        const isLatest = i === transactions.length - 1 && isRecent;
        ctx.beginPath();
        ctx.fillStyle = isLatest ? '#E8A33D' : 'rgba(232,163,61,0.45)';
        ctx.globalAlpha = isLatest ? 1 : 0.85;
        if (isLatest && !reduced) {
          ctx.shadowColor = '#E8A33D';
          ctx.shadowBlur = 10;
        }
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        if (isLatest && !reduced) {
          // Soft 150ms ring — the Spotify-style "I heard that" arrival.
          const pulseR = r + 4 + 4 * Math.sin((performance.now() / 30) % Math.PI);
          ctx.strokeStyle = 'rgba(232,163,61,0.6)';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(cx, cy, pulseR, 0, Math.PI * 2); ctx.stroke();
        }
      });
    }

    // Header label.
    ctx.fillStyle = '#6E6759';
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText(`MARKETPLACE VELOCITY · ${hexbinMode ? 'HEXBIN DENSITY' : 'INDIVIDUAL TXNS'} · ${transactions.length} pts`, 12, 20);
  }, [transactions, hexbinMode, reduced, size, xScale, yScale, rScale]);

  // rAF for arrival pulse only — a single tick counter drives the latest-point glow.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const tick = () => { setTick(t => (t + 1) % 1000000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div ref={wrapRef} className='relative h-full w-full'>
      <canvas ref={canvasRef} className='h-full w-full' aria-label='Marketplace transactions by time of day and category' />
      <div className='absolute right-3 top-3 flex gap-1'>
        <LodButton active={!hexbinMode} onClick={() => setZoom(2)} label='Points' />
        <LodButton active={hexbinMode} onClick={() => setZoom(1)} label='Density' />
      </div>
      <span className='sr-only'>A text alternative to this scatter is available via the Live rail and the table below.</span>
    </div>
  );
}

function LodButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={active}
      className={
        'border border-[var(--hairline)] bg-[rgba(14,19,34,0.65)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ' +
        (active ? 'text-fiber-cyan' : 'text-stone hover:text-fiber-cyan')
      }
    >
      {label}
    </button>
  );
}
