'use client';

import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { sankey, sankeyLinkHorizontal, sankeyJust } from 'd3-sankey';
import { scaleLinear } from 'd3-scale';
import { Group } from '@visx/group';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { TIME_BANDS } from '@/data/campus';
import { authFlows } from '@/lib/mock-feed';
import type { CheckInMethod } from '@/lib/types';

interface SankeyNodeExtra {
  name: string;
  kind: 'band' | 'department' | 'method';
  methodLetter?: CheckInMethod;
}
interface SankeyLinkExtra { value: number; method?: CheckInMethod; band?: string }

const BAND_NODE_COLOR = '#9C9484';
const DEPT_NODE_COLOR = '#E8A33D';
const METHOD_NODE_COLOR = '#5FD4E0';

export function AuthFlowSankey({
  width: _width, height: _height, transactionsPerMin
}: {
  width: number; height: number; transactionsPerMin: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number }>();

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setBox({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  void _width; void _height;

  const width = box?.w ?? 320;
  const height = box?.h ?? 480;
  const reduced = useReducedMotion();
  const flowRef = useRef<SVGPathElement | null>(null);

  const { nodes, links, maxLinkValue } = useMemo(() => {
    const flows = authFlows(1);
    const nodeNames = new Set<string>();
    flows.forEach(f => { nodeNames.add(f.from); nodeNames.add(f.to); });
    const nodesArr = Array.from(nodeNames).map(n => {
      const isBand = (TIME_BANDS as readonly string[]).includes(n);
      const isMethod = n.includes('::');
      return {
        name: n,
        kind: isBand ? 'band' : isMethod ? 'method' : 'department',
        methodLetter: isMethod ? (n.split('::')[1] as CheckInMethod) : undefined
      } as SankeyNodeExtra & { index?: number };
    });

    const graph = sankey<SankeyNodeExtra, SankeyLinkExtra>()
      .nodeId(d => d.name)
      .nodeWidth(8)
      .nodePadding(10)
      .nodeAlign(sankeyJust)
      .extent([[0, 8], [width, height - 8]]);

    const computed = graph({
      nodes: nodesArr.map(({ name, kind, methodLetter }) => ({ name, kind, methodLetter })),
      links: flows.map(f => ({ source: f.from, target: f.to, value: f.value, method: f.method, band: f.band }))
    });

    const maxV = Math.max(...computed.links.map(l => l.value));
    return { nodes: computed.nodes, links: computed.links, maxLinkValue: maxV };
  }, [width, height]);

  const opacityScale = useMemo(
    () => scaleLinear().domain([0, maxLinkValue]).range([0.06, 0.55]).clamp(true),
    [maxLinkValue]
  );

  // Continuous "live flow" drift — the spec-mandated exception for Sankey.
  // Implemented via stroke-dasharray with an incrementing offset, funneled through CSS variable,
  // so under reduced-motion the animation halts but the visual stays readable.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let offset = 0;
    const tick = () => {
      offset = (offset - 0.4) % 1000;
      // We animate via dash offset on each link path directly to keep it cheap.
      const path = flowRef.current;
      if (path) path.style.strokeDashoffset = `${offset}`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div ref={wrapRef} className='h-full w-full'>
      <svg width={width} height={height} role='img' aria-label='Authentication flows: time-of-day into departments into check-in method'>
      <Group>
        {links.map((l, i) => {
          const path = sankeyLinkHorizontal()(l);
          const opacity = opacityScale(l.value);
          const color = l.method === 'mobile' ? '#5FD4E0' : '#E8A33D';
          return (
            <path
              key={`l-${i}`}
              ref={i === 0 ? flowRef : undefined}
              d={path || ''}
              fill='none'
              stroke={color}
              strokeOpacity={opacity}
              strokeWidth={Math.max(0.5, l.width)}
              strokeDasharray={reduced ? undefined : '6 14'}
              style={{ transition: 'stroke-opacity 300ms ease' }}
            >
              <title>{`${(l.source as SankeyNodeExtra & { name: string }).name} → ${(l.target as SankeyNodeExtra & { name: string }).name}: ${l.value} check-ins`}</title>
            </path>
          );
        })}

        {nodes.map((n, i) => {
          const color =
            n.kind === 'band' ? BAND_NODE_COLOR :
            n.kind === 'department' ? DEPT_NODE_COLOR :
            METHOD_NODE_COLOR;
          const label = n.methodLetter ?? n.name;
          const nodeHeight = Math.max(2, n.y1 - n.y0);
          return (
            <Group key={`n-${i}`} top={n.y0} left={n.x0}>
              <rect width={n.x1 - n.x0} height={nodeHeight} fill={color} fillOpacity={n.kind === 'department' ? 0.92 : 0.45} />
              <text
                x={n.x0 < width / 2 ? (n.x1 - n.x0) + 6 : -6}
                y={nodeHeight / 2}
                fontSize={10}
                fill='#9C9484'
                textAnchor={n.x0 < width / 2 ? 'start' : 'end'}
                alignmentBaseline='middle'
                fontFamily={n.kind === 'department' ? 'var(--font-serif)' : 'var(--font-sans)'}
              >
                {label}
              </text>
            </Group>
          );
        })}
      </Group>
      <text x={12} y={20} fontSize={10} fill='#6E6759' fontFamily='var(--font-mono)'>
        AUTHENTICATION FLOW · {transactionsPerMin} tx/min
      </text>
    </svg>
    </div>
  );
}
