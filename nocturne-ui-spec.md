# NOCTURNE — Campus Ecosystem & Network Analytics Engine — UI & Build Spec

Build a production-quality, real-time command-center dashboard using Next.js, React, TypeScript, Visx and Nivo (canvas-mode for dense views), a WebSocket data layer, and Tailwind CSS.

REINTERPRETATION NOTE: the brief asked for "glass and light" via a full-bleed animated mesh gradient with frosted glass throughout. That specific combination is the default look most AI-assisted dashboards land on, and it's also expensive to render honestly at the data density this brief needs. This spec keeps the ambition — glass, light, high-tech academic, a real showpiece — but grounds both ideas in something specific: an actual campus at night. Glass becomes real architecture and one deliberate static panel; light becomes literal lit windows encoding real engagement data. Everything below still aims to be the best-looking thing in your portfolio.

---

## 1. CONCEPT

**"THE CAMPUS NEVER SLEEPS."** Picture the view of a university from above at night — some buildings dark, some blazing with light, fiber lines of activity running between them. That image already *is* a heatmap; NOCTURNE just makes it a live one. Every building glows with real engagement data, every connecting line pulses with real network traffic. The dashboard isn't decorated with a tech aesthetic — it's built from the literal, physical thing a night-time campus already looks like.

**The signature move:** the live campus map is not a decorative header sitting above your charts — it *is* your primary chart. Form and function are the same object, which reads as considerably more impressive in a portfolio than glass panels floating over an abstract gradient.

---

## 2. VISUAL SYSTEM

**Color (every value named, every value earning its place):**
- `Night Indigo` `#161B2E` — primary background, the "sky" the whole UI sits in
- `Window Amber` `#E8A33D` — human/engagement data only: check-ins, active users, lit "windows"
- `Fiber Cyan` `#5FD4E0` — network/infrastructure data only: latency, bandwidth, connectivity
- `Stone` `#9C9484` — UI chrome, hairlines, labels — a warm architectural neutral, not tech-blue-gray
- `Dropout Red` `#C24E42` — 2G/3G drop-off and alerts, and *only* alerts

Amber = people. Cyan = network. Never swap their meaning across the app — that consistency is what lets someone read the dashboard at a glance after a week of use.

**Typography:**
- Department/building labels: a collegiate serif used sparingly, evoking engraved cornerstone lettering — labels only, never body or UI text
- UI/nav/filters: a clean geometric sans
- Every metric (latency in ms, timestamps, transaction amounts): monospace with tabular figures, so numbers align like a real ops console

**Where glass is actually allowed:** exactly one place — the department drill-down drawer (a static panel that sits *over* the live map but does not itself contain a redrawing chart). This is both the thematically justified spot (real academic buildings are glass-walled) and the performance-safe one (see Section 6). Nowhere else gets translucency.

---

## 3. SCREENS

**A. Command Center (default view)**
A stylized top-down/isometric campus map as the primary surface. Buildings render as extruded forms whose glow intensity *is* their live engagement score (Amber). Fiber-Cyan lines pulse between buildings for real-time network traffic. A slim live-metric rail along one edge: active users, avg latency, transactions/min — numbers only, no decorative icon-and-card stat widgets.

**B. Latency Heatmap (deep dive)**
Same map base, reweighted: building glow now encodes sync speed instead of engagement. 2G/3G drop-off zones render as a distinct Dropout Red texture overlay (hatching, not just a color fill — see accessibility notes) so low-bandwidth zones are readable even without color.

**C. Authentication Flow (Sankey)**
Curved flow diagram: time-of-day bands (7am / 9am / 12pm / 3pm / 6pm) flow into department nodes, then into check-in method (biometric / card / mobile). Line weight encodes volume. This is the one screen where motion is justified beyond feedback — a slow, continuous flow animation along the curves reads as "live," not decorative.

**D. Marketplace Velocity (scatter)**
Transactions plotted by time-of-day against location/category, point size by amount. New transactions pulse softly once on arrival (a Spotify-style "I heard that" confirmation, not a persistent animation) then settle into the static field.

**E. Department Drill-down (drawer)**
Clicking any building slides in the one glass panel in the app, over the still-visible, dimmed map — full detail for that department without losing the command-center context.

---

## 4. DATA MODEL

```
Building     { id, name, department, mapCoords, currentEngagementScore, networkStatus, studentCount }
NetworkPing  { id, buildingId, timestamp, latencyMs, connectionType: '5g'|'wifi'|'4g'|'3g'|'2g', dropoff: boolean }
CheckIn      { id, buildingId, timestamp, method: 'biometric'|'card'|'mobile' }
Transaction  { id, buildingId, category, amount, timestamp }
```

---

## 5. REAL-TIME DATA STRATEGY

This is a live system, not a request/response CRUD app like a typical ops dashboard — that changes the interaction model:
- WebSocket push for pings, check-ins, and transactions, not polling
- Client-side batching: buffer incoming events into 250–500ms windows and re-render once per window, not once per message — a campus-scale feed arriving unbatched will re-render dozens of times a second and the map will visibly stutter
- Treat "live" the way Apple treats personalization: the data should feel like it's simply always current, never like something visibly refreshing or flickering in

---

## 6. PERFORMANCE — solving the glass-over-charts problem directly

This is the brief's own named challenge, and it deserves a direct answer:
- **Never wrap an actively-redrawing chart in `backdrop-filter`.** Blur compositing and chart repaints are two separate, expensive GPU operations — stacking them is what causes the frame drops. Glass only appears on the static drawer in Section 2, which sits *behind* the map's render layer, not around any chart canvas.
- **Render dense views on canvas, not SVG.** Use Nivo's canvas-mode components (or Visx primitives over a hand-rolled canvas layer) once the scatter plot or heatmap exceeds roughly 500–1,000 points — SVG-per-point degrades well before real campus-scale data would.
- **Decouple the background layer from the data layer in the render tree entirely.** The map's ambient glow/background should not share a repaint boundary with the chart canvases sitting on top of it.
- **Level-of-detail on the scatter plot:** aggregate into density hexbins at full-campus zoom, resolve to individual points only past a zoom threshold.

---

## 7. COMPONENT BREAKDOWN

```
CommandCenterLayout
 ├─ CampusMap            (canvas-rendered; shared by Command Center + Latency Heatmap)
 │   ├─ BuildingNode      (glow = engagement or latency, depending on view)
 │   └─ FiberLine         (pulse = live network traffic)
 ├─ LiveMetricRail
 ├─ AuthFlowSankey        (Visx)
 ├─ MarketplaceScatter    (Nivo canvas-mode)
 └─ DepartmentDrawer      (the one glass surface; static, non-repainting)
```

---

## 8. MOTION

Restrained and meaningful, matching a real ops console rather than a marketing site:
- Building glow changes: smooth 300ms transition, no bounce
- New transaction/check-in: one soft 150ms pulse on arrival, then settled — confirmation, not decoration
- Sankey flow lines: a slow, continuous animation along the curve — the one place continuous motion is earned, since it's depicting an actual flow
- Respect `prefers-reduced-motion`: kill the Sankey's continuous flow and the transaction pulse, keep every value updating instantly and legibly

---

## 9. RESPONSIVE & ACCESSIBILITY

- Never convey drop-off/alert status by color alone — Dropout Red zones get a hatched texture in addition to color, since amber-vs-red distinctions are hard for some forms of color blindness
- Below 1024px, the map becomes the primary view with Sankey/scatter accessible via tabs rather than simultaneous panels — don't try to keep three dense visualizations on screen at once on a laptop-or-smaller viewport
- Visible focus states in Fiber Cyan, 2px, never default blue
- Every chart needs a text-based summary/table view as an alternative for screen readers — a glowing map has no accessible equivalent on its own

---

## 10. STRICTLY AVOID

- A literal animated mesh gradient as the base background — the campus map *is* the background
- Frosted glass on anything that redraws — nav, filter bar, and every chart stay opaque
- Generic icon-and-number "stat card" widgets — every number lives inside the map, the rail, or a chart, never a decorative card with no real meaning behind it
- Glow used for glow's sake — every glow value maps to a real number (engagement, latency), never decoration
- Color as the only signal for anything alert-related

---

## 11. CASE-STUDY CAPTURE LIST

Screenshot/GIF these for the portfolio writeup:
1. The campus map at full engagement vs. a quiet 3am state, side by side
2. The frame-rate difference (or a written before/after note) between naive backdrop-filter-everywhere and the decoupled-layer approach
3. The Sankey diagram mid-flow-animation
4. The one glass drawer open over the dimmed live map
5. Reduced-motion mode vs. default on the same view
