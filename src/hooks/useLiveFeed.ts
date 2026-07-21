'use client';

import { useEffect, useRef, useState } from 'react';
import type { LiveEvent, NetworkPing, CheckIn, Transaction, Building } from '@/lib/types';
import { CAMPUS_BUILDINGS } from '@/data/campus';
import { nextEvent } from '@/lib/mock-feed';

const TICK_MS = 90;          // emit ~11 events/sec — real campus surge density
const BATCH_MS = 250;        // spec: 250–500ms render window
const KEEP_PINGS = 1400;
const KEEP_CHECKINS = 600;
const KEEP_TXNS = 900;

export interface FeedState {
  ready: boolean;
  buildings: Record<string, Building>;
  pings: NetworkPing[];
  checkIns: CheckIn[];
  transactions: Transaction[];
  recentEvents: LiveEvent[];      // last batch — used for arrival pulses
  activeUsers: number;
  avgLatencyMs: number;
  transactionsPerMin: number;
}

function cloneBuildings(): Record<string, Building> {
  const out: Record<string, Building> = {};
  for (const b of CAMPUS_BUILDINGS) out[b.id] = { ...b, networkStatus: { ...b.networkStatus } };
  return out;
}

export function useLiveFeed() {
  const [state, setState] = useState<FeedState>(() => ({
    ready: false,
    buildings: cloneBuildings(),
    pings: [], checkIns: [], transactions: [], recentEvents: [],
    activeUsers: 0, avgLatencyMs: 0, transactionsPerMin: 0
  }));
  const buffer = useRef<LiveEvent[]>([]);
  const staged = useRef({
    buildings: cloneBuildings(),
    pings: [] as NetworkPing[],
    checkIns: [] as CheckIn[],
    transactions: [] as Transaction[],
    activeUsers: 0,
    avgLatencyMsAccum: 0,
    pingsInLast60s: [] as number[],
    txnsInLast60s: [] as number[],
    lastFlush: 0
  });

  useEffect(() => {
    let alive = true;
    const tickEmit = () => {
      const now = Date.now();
      staged.current.activeUsers += randInt(0, 1) === 0 ? -1 : 3;
      staged.current.activeUsers = clamp(staged.current.activeUsers, 412, 2480);
      const e = nextEvent(now);
      buffer.current.push(e);
      applyToStage(e);
    };
    const applyInterval = setInterval(tickEmit, TICK_MS);
    const flushInterval = setInterval(() => {
      if (!alive) return;
      const now = Date.now();
      const s = staged.current;
      s.pingsInLast60s = s.pingsInLast60s.filter(t => now - t < 60_000);
      s.txnsInLast60s = s.txnsInLast60s.filter(t => now - t < 60_000);
      const evt = buffer.current;
      buffer.current = [];
      const pings = s.pings.slice(-KEEP_PINGS);
      const checkIns = s.checkIns.slice(-KEEP_CHECKINS);
      const transactions = s.transactions.slice(-KEEP_TXNS);
      const recentPingLatency = pings.slice(-50).reduce((a, p) => a + p.latencyMs, 0) / Math.max(1, Math.min(50, pings.length));
      setState({
        ready: true,
        buildings: { ...s.buildings },
        pings, checkIns, transactions, recentEvents: evt,
        activeUsers: s.activeUsers,
        avgLatencyMs: Math.round(recentPingLatency * 10) / 10,
        transactionsPerMin: s.txnsInLast60s.length
      });
      s.lastFlush = now;
    }, BATCH_MS);

    return () => { alive = false; clearInterval(applyInterval); clearInterval(flushInterval); };
  }, []);

  function applyToStage(e: LiveEvent) {
    const s = staged.current;
    if (e.kind === 'ping') {
      const p = e.payload;
      s.pings.push(p);
      s.pingsInLast60s.push(p.timestamp);
      const b = s.buildings[p.buildingId];
      if (b) {
        b.networkStatus = { latencyMs: p.latencyMs, connection: p.connectionType, dropoff: p.dropoff };
        // engagement drift, kept in [0.15, 0.98]
        const drift = Math.max(-0.05, Math.min(0.05, (p.latencyMs < 25 ? 0.03 : -0.01) + (Math.random() - 0.5) * 0.04));
        b.currentEngagementScore = clamp(b.currentEngagementScore + drift, 0.15, 0.98);
      }
    } else if (e.kind === 'checkin') {
      s.checkIns.push(e.payload);
      const b = s.buildings[e.payload.buildingId];
      if (b) b.currentEngagementScore = clamp(b.currentEngagementScore + 0.01, 0.15, 0.98);
    } else {
      s.transactions.push(e.payload);
      s.txnsInLast60s.push(Date.now());
      const b = s.buildings[e.payload.buildingId];
      if (b) b.currentEngagementScore = clamp(b.currentEngagementScore + 0.005, 0.15, 0.98);
    }
  }

  return state;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function randInt(lo: number, hi: number) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }
