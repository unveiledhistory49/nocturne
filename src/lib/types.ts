export type ConnectionType = '5g' | 'wifi' | '4g' | '3g' | '2g';
export type CheckInMethod = 'biometric' | 'card' | 'mobile';
export type MapView = 'engagement' | 'latency';

export interface Building {
  id: string;
  name: string;
  department: string;
  mapCoords: { x: number; y: number; w: number; h: number };
  currentEngagementScore: number; // 0..1
  networkStatus: { latencyMs: number; connection: ConnectionType; dropoff: boolean };
  studentCount: number;
}

export interface NetworkPing {
  id: string;
  buildingId: string;
  timestamp: number;
  latencyMs: number;
  connectionType: ConnectionType;
  dropoff: boolean;
}

export interface CheckIn {
  id: string;
  buildingId: string;
  timestamp: number;
  method: CheckInMethod;
}

export interface Transaction {
  id: string;
  buildingId: string;
  category: string;
  amount: number;
  timestamp: number;
}

export interface LiveSnapshot {
  activeUsers: number;
  avgLatencyMs: number;
  transactionsPerMin: number;
  pings: NetworkPing[];
  checkIns: CheckIn[];
  transactions: Transaction[];
  buildings: Building[];
}

export type LiveEvent =
  | { kind: 'ping'; payload: NetworkPing }
  | { kind: 'checkin'; payload: CheckIn }
  | { kind: 'transaction'; payload: Transaction };
