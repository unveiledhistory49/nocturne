import type { Building } from '@/lib/types';

// Campus layout — normalized 0..100 coordinate space; endpoints scale to canvas.
// Reflects a small academic quad: 11 named buildings, real departments.
export const CAMPUS_BUILDINGS: Building[] = [
  { id: 'b-arch',  name: 'Arch Hall',        department: 'Architecture',   mapCoords: { x: 8,  y: 14, w: 12, h: 16 }, currentEngagementScore: 0.42, networkStatus: { latencyMs: 38, connection: 'wifi', dropoff: false }, studentCount: 642 },
  { id: 'b-bio',   name: 'Boyd Life Sciences', department: 'Biology',      mapCoords: { x: 26, y: 10, w: 14, h: 18 }, currentEngagementScore: 0.78, networkStatus: { latencyMs: 22, connection: '5g',  dropoff: false }, studentCount: 1180 },
  { id: 'b-chem',  name: 'Chemin Laboratories', department: 'Chemistry',   mapCoords: { x: 46, y: 12, w: 12, h: 14 }, currentEngagementScore: 0.55, networkStatus: { latencyMs: 41, connection: 'wifi', dropoff: false }, studentCount: 740 },
  { id: 'b-cs',    name: 'Turing Hall',       department: 'Computer Science', mapCoords: { x: 64, y: 16, w: 16, h: 18 }, currentEngagementScore: 0.94, networkStatus: { latencyMs: 14, connection: '5g',  dropoff: false }, studentCount: 2140 },
  { id: 'b-econ',  name: 'Plinth Building',   department: 'Economics',     mapCoords: { x: 84, y: 10, w: 12, h: 16 }, currentEngagementScore: 0.66, networkStatus: { latencyMs: 33, connection: '4g',  dropoff: false }, studentCount: 980 },
  { id: 'b-fine',  name: 'Whitfield Fine Arts', department: 'Fine Arts',   mapCoords: { x: 12, y: 46, w: 14, h: 18 }, currentEngagementScore: 0.31, networkStatus: { latencyMs: 78, connection: 'wifi', dropoff: false }, studentCount: 520 },
  { id: 'b-law',   name: 'Carver Law School', department: 'Law',           mapCoords: { x: 32, y: 42, w: 16, h: 20 }, currentEngagementScore: 0.58, networkStatus: { latencyMs: 29, connection: 'wifi', dropoff: false }, studentCount: 1320 },
  { id: 'b-lib',   name: 'Marshall Library',  department: 'Library Services', mapCoords: { x: 54, y: 44, w: 18, h: 22 }, currentEngagementScore: 0.88, networkStatus: { latencyMs: 18, connection: '5g',  dropoff: false }, studentCount: 0 },
  { id: 'b-music', name: 'Resonance Hall',    department: 'Music',          mapCoords: { x: 78, y: 42, w: 12, h: 16 }, currentEngagementScore: 0.24, networkStatus: { latencyMs: 62, connection: '3g',  dropoff: true  }, studentCount: 410 },
  { id: 'b-phys',  name: 'Faraday Physics',   department: 'Physics',        mapCoords: { x: 16, y: 74, w: 14, h: 18 }, currentEngagementScore: 0.51, networkStatus: { latencyMs: 27, connection: 'wifi', dropoff: false }, studentCount: 690 },
  { id: 'b-stu',   name: 'Drift Union',        department: 'Student Union', mapCoords: { x: 38, y: 76, w: 22, h: 18 }, currentEngagementScore: 0.81, networkStatus: { latencyMs: 19, connection: '5g',  dropoff: false }, studentCount: 0 },
  { id: 'b-gym',   name: 'Lentz Athletics',   department: 'Athletics',     mapCoords: { x: 70, y: 74, w: 16, h: 18 }, currentEngagementScore: 0.46, networkStatus: { latencyMs: 88, connection: '3g',  dropoff: true  }, studentCount: 530 }
];

// Adjacency for fiber lines — actual walkable paths on the quad.
export const CAMPUS_EDGES: ReadonlyArray<[string, string]> = [
  ['b-arch', 'b-bio'], ['b-bio', 'b-chem'], ['b-chem', 'b-cs'], ['b-cs', 'b-econ'],
  ['b-arch', 'b-fine'], ['b-fine', 'b-law'], ['b-law', 'b-lib'], ['b-lib', 'b-music'],
  ['b-cs',  'b-lib'], ['b-law', 'b-phys'], ['b-phys', 'b-stu'], ['b-stu', 'b-gym'],
  ['b-stu', 'b-lib'], ['b-music', 'b-gym'], ['b-econ', 'b-music']
];

export const DEPARTMENTS = Array.from(new Set(CAMPUS_BUILDINGS.map(b => b.department)));

export const TRANSACTION_CATEGORIES = ['Coffee', 'Textbooks', 'Supplies', 'Meals', 'Tickets', 'Printing'];

export const TIME_BANDS = ['07:00', '09:00', '12:00', '15:00', '18:00'] as const;
export type TimeBand = typeof TIME_BANDS[number];
