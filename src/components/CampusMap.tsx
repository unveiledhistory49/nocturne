'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { Building, MapView } from '@/lib/types';
import { CAMPUS_BUILDINGS, CAMPUS_EDGES } from '@/data/campus';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
  buildings: Record<string, Building>;
  view: MapView;
  lastFlushEpoch: number;     // performance.now() at the last batch flush — drives arrival pulses
  onSelectBuilding: (id: string) => void;
  onChangeView: (v: MapView) => void;
  selectedId: string | null;
  ariaSummary: string;        // text alternative for SR users
}

const DPR_CAP = 2;

function withDPR(canvas: HTMLCanvasElement): [CanvasRenderingContext2D, number, number] {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('campus map: 2d context unavailable');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [ctx, rect.width, rect.height];
}

const STONE_DIM = 'rgba(156,148,132,0.20)';
const STONE_LINE = 'rgba(156,148,132,0.36)';
const INK_ON_DARK = 'rgba(14,19,34,0.92)';

function glowColorForBuilding(b: Building, view: MapView): string {
  if (view === 'latency') {
    if (b.networkStatus.dropoff || b.networkStatus.latencyMs > 90) return '#C24E42';
    if (b.networkStatus.latencyMs > 55) return 'rgba(232,163,61,0.55)';
    return '#E8A33D';
  }
  return '#E8A33D';
}

function glowIntensity(b: Building, view: MapView): number {
  if (view === 'latency') {
    const latency = b.networkStatus.latencyMs;
    return clamp01(1 - (latency - 10) / 110);
  }
  return b.currentEngagementScore;
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

function hatchRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = '#C24E42') {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  const step = 6;
  for (let sx = x - h; sx < x + w; sx += step) {
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.lineTo(sx + h, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function withAlpha(hex: string, a: number): string {
  const n = hex.startsWith('#') ? hex.slice(1) : hex;
  if (n.length !== 6 || /[rgba(]/.test(hex)) return hex;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function CampusMap({
  buildings, view, lastFlushEpoch, onSelectBuilding, onChangeView, selectedId, ariaSummary
}: Props) {
  const dataRef = useRef<HTMLCanvasElement | null>(null);
  const hoverRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const pulsesRef = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const project = useMemo(() => {
    const sx = (size.w - 32) / 100;
    const sy = (size.h - 32) / 100;
    return {
      rect: (b: Building) => ({
        x: 16 + b.mapCoords.x * sx,
        y: 16 + b.mapCoords.y * sy,
        w: b.mapCoords.w * sx,
        h: b.mapCoords.h * sy
      }),
      center: (b: Building) => ({
        x: 16 + (b.mapCoords.x + b.mapCoords.w / 2) * sx,
        y: 16 + (b.mapCoords.y + b.mapCoords.h / 2) * sy
      })
    };
  }, [size]);

  // Seed arrival pulses whenever the feed flushes.
  useEffect(() => {
    if (lastFlushEpoch === 0) return;
    const now = performance.now();
    const end = now + 150;
    for (const id of Object.keys(buildings)) {
      const b = buildings[id];
      if (b && b.currentEngagementScore > 0.6) pulsesRef.current.set(id, end);
    }
  }, [lastFlushEpoch, buildings]);

  const draw = useCallback(() => {
    const canvas = dataRef.current;
    if (!canvas || size.w === 0) return;
    const [ctx, w, h] = withDPR(canvas);
    ctx.clearRect(0, 0, w, h);

    // Subtle night-sky vignette — not a gradient mesh, just atmosphere.
    const g = ctx.createRadialGradient(w * 0.5, h * 0.55, Math.min(w, h) * 0.18, w * 0.5, h * 0.55, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(30, 36, 56, 0.7)');
    g.addColorStop(1, 'rgba(14, 19, 34, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const all = CAMPUS_BUILDINGS.map(b => buildings[b.id] ?? b);
    const now = performance.now();

    // Optical fiber — long dim base stroke.
    ctx.lineWidth = 1;
    for (const [aId, bId] of CAMPUS_EDGES) {
      const a = buildings[aId], b = buildings[bId];
      if (!a || !b) continue;
      const pa = project.center(a), pb = project.center(b);
      const grad = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
      grad.addColorStop(0, 'rgba(95, 212, 224, 0.0)');
      grad.addColorStop(0.5, 'rgba(95, 212, 224, 0.55)');
      grad.addColorStop(1, 'rgba(95, 212, 224, 0.0)');
      ctx.strokeStyle = grad;
      const activity = (a.networkStatus.latencyMs + b.networkStatus.latencyMs) / 2;
      ctx.globalAlpha = clamp01(0.25 + 0.45 * (1 - clamp01((activity - 15) / 80)));
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
      const off = Math.max(Math.abs(pb.x - pa.x), Math.abs(pb.y - pa.y)) * 0.18;
      ctx.bezierCurveTo(mx, my + (pa.y < pb.y ? -off : off), mx, my + (pa.y < pb.y ? off : -off), pb.x, pb.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Animated dash — continuous cyan pulse of *live* network traffic. Killed under reduced-motion.
    if (!reduced) {
      ctx.setLineDash([2, 8]);
      ctx.lineDashOffset = -((now / 90) % 10);
      ctx.strokeStyle = 'rgba(95, 212, 224, 0.7)';
      ctx.lineWidth = 1.4;
      for (const [aId, bId] of CAMPUS_EDGES) {
        const a = buildings[aId], b = buildings[bId];
        if (!a || !b) continue;
        const pa = project.center(a), pb = project.center(b);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
        const off = Math.max(Math.abs(pb.x - pa.x), Math.abs(pb.y - pa.y)) * 0.18;
        ctx.bezierCurveTo(mx, my + (pa.y < pb.y ? -off : off), mx, my + (pa.y < pb.y ? off : -off), pb.x, pb.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    for (const b of all) {
      const r = project.rect(b);
      const intensity = glowIntensity(b, view);
      const color = glowColorForBuilding(b, view);
      const selected = selectedId === b.id;

      // Outer aura — radiant glow whose intensity IS the live number.
      const grad = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 1, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.95);
      grad.addColorStop(0, withAlpha(color, 0.55 * intensity));
      grad.addColorStop(0.5, withAlpha(color, 0.18 * intensity));
      grad.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(r.x - r.w * 0.6, r.y - r.h * 0.6, r.w * 2.2, r.h * 2.2);

      ctx.save();
      ctx.fillStyle = INK_ON_DARK;
      ctx.strokeStyle = selected ? '#5FD4E0' : STONE_LINE;
      ctx.lineWidth = selected ? 2 : 1;
      roundRect(ctx, r.x, r.y, r.w, r.h, 1);
      ctx.fill();
      ctx.stroke();

      // Isometric roof line — only at sizes large enough to read it.
      if (r.w > 36 && r.h > 36) {
        ctx.strokeStyle = STONE_DIM;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + 5, r.y - 5);
        ctx.lineTo(r.x + r.w + 5, r.y - 5);
        ctx.lineTo(r.x + r.w, r.y);
        ctx.stroke();
      }

      // Window grid — count of lit windows == engagement/latency score. The literal campus metaphor.
      const cols = Math.max(2, Math.floor(r.w / 9));
      const rows = Math.max(2, Math.floor(r.h / 9));
      const padX = (r.w - (cols * 5 + (cols - 1) * 3)) / 2;
      const padY = (r.h - (rows * 5 + (rows - 1) * 3)) / 2;
      const litWindows = Math.floor(cols * rows * intensity);
      const cells: Array<[number, number]> = [];
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) cells.push([cx, cy]);
      // Stable per-building ordering — spread lit windows across the form rather than clustering.
      const seed = hashStr(b.id) % 31;
      cells.sort((a, b) => (a[0] + a[1] * 7 + seed) - (b[0] + b[1] * 7 + seed));
      for (let i = 0; i < cells.length; i++) {
        const [cx, cy] = cells[i];
        const wx = r.x + padX + cx * 8;
        const wy = r.y + padY + cy * 8;
        const lit = i < litWindows;
        if (lit) {
          ctx.save();
          ctx.globalAlpha = 0.85;
          ctx.shadowColor = color;
          ctx.shadowBlur = 4;
          ctx.fillStyle = color;
          ctx.fillRect(wx, wy, 5, 5);
          ctx.restore();
        } else {
          ctx.fillStyle = 'rgba(156,148,132,0.10)';
          ctx.fillRect(wx, wy, 5, 5);
        }
      }

      if ((b.networkStatus.dropoff || b.networkStatus.latencyMs > 90) && view === 'latency') {
        hatchRect(ctx, r.x, r.y, r.w, r.h);
      }

      // Arrival pulse — 150ms confirmation ring only when an event actually arrived.
      const pulseEnd = pulsesRef.current.get(b.id);
      if (pulseEnd && !reduced) {
        if (now < pulseEnd) {
          const t = (pulseEnd - now) / 150;
          const radius = Math.max(r.w, r.h) * (1.05 + (1 - t) * 0.5);
          ctx.save();
          ctx.strokeStyle = withAlpha(color, t * 0.6);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(r.x + r.w / 2, r.y + r.h / 2, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else {
          pulsesRef.current.delete(b.id);
        }
      }

      ctx.restore();

      // Engraved-cornerstone label — serif, sparingly.
      if (r.w > 60 && r.h > 36) {
        ctx.fillStyle = 'rgba(156,148,132,0.78)';
        ctx.font = '500 10px "EB Garamond", Georgia, serif';
        ctx.textAlign = 'left';
        ctx.fillText(b.name.toUpperCase(), r.x, r.y - 8);
        if (hoverId === b.id || selected) {
          ctx.fillStyle = '#5FD4E0';
          ctx.font = '500 11px "Inter Tight", system-ui, sans-serif';
          ctx.fillText(b.department, r.x, r.y + r.h + 14);
        }
      }
    }
  }, [buildings, view, size, selectedId, hoverId, reduced, project]);

  // Trigger a redraw whenever the data/view/hover changes.
  useEffect(() => { draw(); }, [draw]);

  // rAF tick — drives the dashed fiber drift + arrival pulses only (motion respect handled inside draw).
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const tick = () => { draw(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, draw]);

  // Hover overlay canvas lightweight repaint.
  useEffect(() => {
    if (!hoverRef.current || size.w === 0) return;
    const [ctx, w, h] = withDPR(hoverRef.current);
    ctx.clearRect(0, 0, w, h);
    if (!hoverId) return;
    const b = buildings[hoverId];
    if (!b) return;
    const r = project.rect(b);
    ctx.strokeStyle = '#5FD4E0';
    ctx.lineWidth = 2;
    roundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 1);
    ctx.stroke();
  }, [hoverId, buildings, size, project]);

  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let found: string | null = null;
    for (const b of CAMPUS_BUILDINGS) {
      const r = project.rect(b);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { found = b.id; break; }
    }
    setHoverId(found);
    canvas.style.cursor = found ? 'pointer' : 'default';
  };

  const onClick = () => {
    if (hoverId) onSelectBuilding(hoverId);
  };

  const onKey = (e: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const idx = CAMPUS_BUILDINGS.findIndex(b => b.id === (selectedId ?? CAMPUS_BUILDINGS[0].id));
    if (idx < 0) return;
    if (e.key === 'Enter') { onSelectBuilding(CAMPUS_BUILDINGS[idx].id); return; }
    if (e.key === 'ArrowRight') onSelectBuilding(CAMPUS_BUILDINGS[(idx + 1) % CAMPUS_BUILDINGS.length].id);
    if (e.key === 'ArrowLeft')  onSelectBuilding(CAMPUS_BUILDINGS[(idx - 1 + CAMPUS_BUILDINGS.length) % CAMPUS_BUILDINGS.length].id);
  };

  return (
    <div ref={wrapRef} className='relative h-full w-full overflow-hidden' role='img' aria-label={`Campus map, ${view} view`}>
      <canvas ref={dataRef} className='absolute inset-0 h-full w-full touch-none' />
      <canvas
        ref={hoverRef}
        className='absolute inset-0 h-full w-full touch-none'
        onPointerMove={onMove}
        onPointerDown={onClick}
        onKeyDown={onKey}
        tabIndex={0}
        role='button'
        aria-label='Campus map — arrow keys move between buildings, Enter drills down'
      />
      <p className='sr-only' id='map-aria-summary'>{ariaSummary}</p>

      <div
        className='absolute left-4 top-4 flex items-center gap-1 border border-[var(--hairline)] bg-[rgba(14,19,34,0.65)] p-1 text-xs'
        role='tablist'
        aria-label='Map view'
      >
        {(['engagement', 'latency'] as const).map(v => {
          const isActive = view === v;
          return (
            <button
              key={v}
              role='tab'
              aria-selected={isActive}
              onClick={() => onChangeView(v)}
              type='button'
              className={
                'px-3 py-1.5 uppercase tracking-wide transition-colors ' +
                (isActive ? 'bg-[rgba(95,212,224,0.10)] text-fiber-cyan' : 'text-stone hover:text-fiber-cyan')
              }
            >
              {v === 'engagement' ? 'Engagement' : 'Latency'}
            </button>
          );
        })}
      </div>

      <CampusLegend view={view} />
    </div>
  );
}

function CampusLegend({ view }: { view: MapView }) {
  return (
    <div className='absolute bottom-4 left-4 flex flex-col gap-1.5 font-mono text-[10px] uppercase tracking-wider text-stone'>
      <LegendRow swatch={<span style={{ background: '#E8A33D' }} className='inline-block h-2 w-2' />}
        label={view === 'engagement' ? 'Amber — Live engagement' : 'Amber — Low latency (healthy sync)'} />
      <LegendRow swatch={<span className='inline-block h-2 w-2 bg-fiber-cyan' />}
        label='Cyan — Live network traffic' />
      <LegendRow swatch={<span className='hatch-dropout inline-block h-2 w-2 border border-dropout-red' />}
        label='Hatched red — 2G/3G drop-off (readable without color)' />
    </div>
  );
}

function LegendRow({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <div className='flex items-center gap-2'>
      {swatch}
      <span>{label}</span>
    </div>
  );
}
