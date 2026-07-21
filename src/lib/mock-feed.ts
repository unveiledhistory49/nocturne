import type { CheckInMethod, ConnectionType, LiveEvent, Transaction } from './types';
import { CAMPUS_BUILDINGS, TRANSACTION_CATEGORIES } from '@/data/campus';
import { makeRng, pick, randInt } from './rng';

const rng = makeRng(20260720);

function connectionType(): ConnectionType {
  const r = rng();
  if (r < 0.46) return '5g';
  if (r < 0.78) return 'wifi';
  if (r < 0.93) return '4g';
  if (r < 0.985) return '3g';
  return '2g';
}

export function nextEvent(now: number): LiveEvent {
  const building = pick(rng, CAMPUS_BUILDINGS);
  const roll = rng();
  if (roll < 0.62) {
    const latencyMs = randInt(rng, building.networkStatus.dropoff ? 70 : 11, building.networkStatus.dropoff ? 240 : 60);
    const ct = connectionType();
    return {
      kind: 'ping',
      payload: {
        id: `p-${now}-${Math.floor(rng() * 1e6)}`,
        buildingId: building.id,
        timestamp: now,
        latencyMs,
        connectionType: ct,
        dropoff: ct === '2g' || ct === '3g' || building.networkStatus.dropoff ? rng() < 0.55 : false
      }
    };
  }
  if (roll < 0.85) {
    const methods: CheckInMethod[] = ['biometric', 'card', 'mobile'];
    return {
      kind: 'checkin',
      payload: {
        id: `c-${now}-${Math.floor(rng() * 1e6)}`,
        buildingId: building.id,
        timestamp: now,
        method: pick(rng, methods)
      }
    };
  }
  const txn: Transaction = {
    id: `t-${now}-${Math.floor(rng() * 1e6)}`,
    buildingId: building.id,
    category: pick(rng, TRANSACTION_CATEGORIES),
    amount: randInt(rng, 1, 60) - 0.01 * randInt(rng, 0, 99),
    timestamp: now
  };
  return { kind: 'transaction', payload: txn };
}

// Deterministic historical baseline used to seed the time-of-day auth-flow Sankey.
export function authFlows(seed = 1) {
  const r = makeRng(seed * 31);
  const bands = ['07:00', '09:00', '12:00', '15:00', '18:00'];
  const depts = ['Computer Science', 'Biology', 'Law', 'Library Services', 'Economics', 'Architecture', 'Fine Arts'];
  const methods: CheckInMethod[] = ['biometric', 'card', 'mobile'];
  const out: Array<{ from: string; to: string; value: number; method?: CheckInMethod; band?: string }> = [];
  for (const band of bands) {
    for (const d of depts) {
      out.push({ from: band, to: d, value: randInt(r, 40, 240) });
      for (const m of methods) out.push({ from: d, to: `${d}::${m}`, value: randInt(r, 18, 120), method: m, band });
    }
  }
  return out;
}
