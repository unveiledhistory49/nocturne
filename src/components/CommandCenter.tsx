'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CampusMap } from '@/components/CampusMap';
import { LiveMetricRail, buildRailRows } from '@/components/LiveMetricRail';
import { AuthFlowSankey } from '@/components/AuthFlowSankey';
import { MarketplaceScatter } from '@/components/MarketplaceScatter';
import { DepartmentDrawer } from '@/components/DepartmentDrawer';
import { AccessibleAlternate } from '@/components/AccessibleAlternate';
import { useLiveFeed } from '@/hooks/useLiveFeed';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import type { MapView } from '@/lib/types';
import { CAMPUS_BUILDINGS } from '@/data/campus';

type TabView = 'map' | 'sankey' | 'scatter' | 'rail';

export function CommandCenter() {
  const feed = useLiveFeed();
  const w = useViewportWidth();
  const [view, setView] = useState<MapView>('engagement');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabView>('map');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastFlushRef = useRef(0);

  // lastFlushEpoch — drives arrival pulses on the map. We treat each state refresh as a flush.
  useEffect(() => {
    lastFlushRef.current = performance.now();
  }, [feed.recentEvents]);

  // Keyboard: ESC closes drawer; M swaps view (Engagement/Latency); number tabs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDrawerOpen(false); return; }
      if (e.key === 'm') setView(v => v === 'engagement' ? 'latency' : 'engagement');
      if (e.key === '1') setTab('map');
      if (e.key === '2') setTab('sankey');
      if (e.key === '3') setTab('scatter');
      if (e.key === '4') setTab('rail');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Listen for "next building" events from the drawer.
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      setSelectedId(id);
    };
    window.addEventListener('nocturne:focus-building', handler as EventListener);
    return () => window.removeEventListener('nocturne:focus-building', handler as EventListener);
  }, []);

  const selectedBuilding = selectedId ? feed.buildings[selectedId] : null;

  const drawerEvents = useMemo(() => {
    if (!selectedId) return [];
    const all = [
      ...feed.pings.filter(p => p.buildingId === selectedId).map(p => ({ latencyMs: p.latencyMs, method: p.connectionType, at: p.timestamp })),
      ...feed.transactions.filter(t => t.buildingId === selectedId).map(t => ({ category: t.category, amount: t.amount, at: t.timestamp })),
      ...feed.checkIns.filter(c => c.buildingId === selectedId).map(c => ({ method: c.method, at: c.timestamp, latencyMs: 0 })),
    ];
    return all.sort((a, b) => a.at - b.at);
  }, [feed.pings, feed.transactions, feed.checkIns, selectedId]);

  const ariaSummary = useMemo(() => {
    const arr = CAMPUS_BUILDINGS.map(b => {
      const live = feed.buildings[b.id];
      const eng = Math.round((live?.currentEngagementScore ?? 0) * 100);
      const lat = live?.networkStatus.latencyMs ?? 0;
      const dropoff = live?.networkStatus.dropoff ? 'drop-off active' : 'nominal';
      return `${b.name} (${b.department}): ${eng}% engagement, ${lat} ms latency, ${dropoff}.`;
    }).join(' ');
    return `Live campus status. ${arr} Active users: ${feed.activeUsers}. Average latency: ${feed.avgLatencyMs.toFixed(1)} ms. Transactions per minute: ${feed.transactionsPerMin}.`;
  }, [feed.buildings, feed.activeUsers, feed.avgLatencyMs, feed.transactionsPerMin]);

  const railRows = buildRailRows({
    activeUsers: feed.activeUsers,
    avgLatencyMs: feed.avgLatencyMs,
    transactionsPerMin: feed.transactionsPerMin
  });

  const compact = w < 1024;

  return (
    <main id='main' className='relative flex h-screen w-screen flex-col bg-night-indigo-deep text-stone'>
      <NavHeader view={view} tab={tab} setTab={setTab} compact={compact} />

      {/* Map always present as primary chart. Tabs swap the secondary panel. */}
      <div className='flex min-h-0 flex-1 flex-col'>
        <div className={'relative grid min-h-0 flex-1 ' + (compact ? 'grid-rows-[1fr_220px]' : 'grid-cols-[1fr_320px]')}>
          <section className='relative min-h-0 overflow-hidden border-r border-[var(--hairline)]' aria-label='Campus map'>
            <CampusMap
              buildings={feed.buildings}
              view={view}
              lastFlushEpoch={lastFlushRef.current}
              onSelectBuilding={(id) => { setSelectedId(id); setDrawerOpen(true); }}
              onChangeView={setView}
              selectedId={selectedId}
              ariaSummary={ariaSummary}
            />
          </section>

          <section className='relative min-h-0 overflow-hidden'
            aria-label={tab === 'sankey' ? 'Authentication flow Sankey' : tab === 'scatter' ? 'Marketplace scatter' : 'Secondary chart'}>
            {compact && (
              <div role='tablist' aria-label='Secondary views' className='absolute right-3 top-3 z-10 flex gap-1'>
                <TabBtn active={tab === 'sankey'} onClick={() => setTab('sankey')} label='Flow' k='2' />
                <TabBtn active={tab === 'scatter'} onClick={() => setTab('scatter')} label='Velocity' k='3' />
                <TabBtn active={tab === 'rail'} onClick={() => setTab('rail')} label='Rail' k='4' />
              </div>
            )}
            {!compact && tab === 'map' && (
              <div className='absolute left-3 top-3 z-10 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-soft'>
                Press 1 / 2 / 3 to switch · Esc closes drawer · M swaps view
              </div>
            )}
            {/* Always mounted rail on desktop, slides into the tab slot on mobile */}
            <div className={compact && tab !== 'rail' ? 'hidden' : 'absolute inset-0'}>
              <LiveMetricRail rows={railRows} />
            </div>
            <div className={compact && tab !== 'sankey' ? 'hidden' : 'absolute inset-0'}>
              <AuthFlowSankey
                width={compact ? w : 320}
                height={compact ? 220 : 480}
                transactionsPerMin={feed.transactionsPerMin}
              />
            </div>
            <div className={compact && tab !== 'scatter' ? 'hidden' : 'absolute inset-0'}>
              <MarketplaceScatter
                transactions={feed.transactions}
                width={compact ? w : 320}
                height={compact ? 220 : 480}
              />
            </div>
          </section>
        </div>
      </div>

      <DepartmentDrawer
        open={drawerOpen && !!selectedBuilding}
        onClose={() => setDrawerOpen(false)}
        building={selectedBuilding}
        recentEvents={drawerEvents.map(e => ({ ...e, method: e.method }))}
      />

      <AccessibleAlternate pings={feed.pings} transactions={feed.transactions} checkIns={feed.checkIns} />
    </main>
  );
}

function NavHeader({ view, tab, setTab, compact }: { view: MapView; tab: TabView; setTab: (t: TabView) => void; compact: boolean }) {
  return (
    <header className='flex items-center justify-between border-b border-[var(--hairline)] px-6 py-3'>
      <div className='flex items-baseline gap-3'>
        <div className='display-serif text-[22px] tracking-wide text-stone'>Nocturne</div>
        <div className='font-mono text-[10px] uppercase tracking-[0.2em] text-stone-soft'>
          Campus Network & Ecosystem Analytics
        </div>
      </div>
      {!compact && (
        <nav role='tablist' aria-label='View' className='flex items-center gap-1'>
          <TabBtn active={tab === 'map'} onClick={() => setTab('map')} label='Map' k='1' />
          <TabBtn active={tab === 'sankey'} onClick={() => setTab('sankey')} label='Flow' k='2' />
          <TabBtn active={tab === 'scatter'} onClick={() => setTab('scatter')} label='Velocity' k='3' />
          <TabBtn active={tab === 'rail'} onClick={() => setTab('rail')} label='Rail' k='4' />
        </nav>
      )}
      <div className='font-mono text-[10px] uppercase tracking-wider text-stone-soft'>
        {view === 'engagement' ? 'Engagement field' : 'Latency field'} · Live
      </div>
    </header>
  );
}

function TabBtn({ active, onClick, label, k }: { active: boolean; onClick: () => void; label: string; k: string }) {
  return (
    <button
      type='button'
      role='tab'
      aria-selected={active}
      onClick={onClick}
      className={
        'border border-[var(--hairline)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ' +
        (active ? 'bg-[rgba(95,212,224,0.08)] text-fiber-cyan' : 'text-stone hover:border-fiber-cyan hover:text-fiber-cyan')
      }
    >
      {label} <span className='text-stone-soft'>·{k}</span>
    </button>
  );
}
