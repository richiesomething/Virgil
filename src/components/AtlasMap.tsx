import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { geoMercator, type GeoProjection } from 'd3-geo'
import { line as d3line, curveCatmullRom, curveCatmullRomClosed, curveLinearClosed, curveLinear } from 'd3-shape'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import type { AtlasFrame, BookData, FrameArt, MapLabel, Place } from '../types'
import { childFrames, coveredByChild, positionIn, visibleJourneys, visiblePlaces } from '../lib/atlas'
import Icon from './Icon'

// Base geography and drawings are code-split per frame.
const artFiles = import.meta.glob<{ default: FrameArt }>('../books/*/atlas/*.json')
const artCache = new Map<string, FrameArt>()

export function useFrameArt(bookId: string, frameId: string): FrameArt | null {
  const key = `../books/${bookId}/atlas/${frameId}.json`
  const [loaded, setLoaded] = useState<{ key: string; art: FrameArt } | null>(null)
  useEffect(() => {
    if (artCache.has(key)) return
    let live = true
    artFiles[key]?.().then((m) => {
      artCache.set(key, m.default)
      if (live) setLoaded({ key, art: m.default })
    })
    return () => {
      live = false
    }
  }, [key])
  // Only ever hand back the drawing for *this* frame, never the previous one.
  return artCache.get(key) ?? (loaded?.key === key ? loaded.art : null)
}

type XY = [number, number]
export type JourneyMode = 'recent' | 'all' | 'none'

export interface AtlasMapProps {
  book: BookData
  frame: AtlasFrame
  asOf: number
  selected?: string | null
  onSelect?: (id: string | null) => void
  onFrame?: (frameId: string, focus?: string) => void
  /** Places to emphasise (this chapter's settings). */
  highlight?: string[]
  /** "You are here". */
  here?: string
  showMentioned?: boolean
  journeys?: JourneyMode
  interactive?: boolean
  /** Centre on this place when the frame opens. */
  focus?: string
  className?: string
}

/** Projection from frame space (lon/lat or drawing x/y) to the SVG's pixels at zoom 1. */
function makeProjection(frame: AtlasFrame, w: number, h: number, pad: number) {
  if (frame.type === 'geo' && frame.bounds) {
    const [[x0, y0], [x1, y1]] = frame.bounds
    const p: GeoProjection = geoMercator().fitExtent(
      [
        [pad, pad],
        [w - pad, h - pad],
      ],
      { type: 'MultiPoint', coordinates: [[x0, y0], [x1, y1]] },
    )
    const project = (c: XY): XY => p(c) as XY
    // Pixels per metre at the frame's centre, for real-width rivers and uncertainty circles.
    const mid: XY = [(x0 + x1) / 2, (y0 + y1) / 2]
    const a = project(mid)
    const b = project([mid[0] + 0.01, mid[1]])
    const pxPerM = Math.hypot(b[0] - a[0], b[1] - a[1]) / (0.01 * 111_320 * Math.cos((mid[1] * Math.PI) / 180))
    return { project, pxPerM }
  }
  const [W, H] = frame.size ?? [1000, 700]
  const s = Math.min((w - pad * 2) / W, (h - pad * 2) / H)
  const tx = (w - W * s) / 2
  const ty = (h - H * s) / 2
  const project = (c: XY): XY => [tx + c[0] * s, ty + c[1] * s]
  return { project, pxPerM: 0, planScale: s }
}

const lineGen = d3line<XY>()

interface Portal {
  c: AtlasFrame
  kind: 'edge' | 'box' | 'badge'
  x: number
  y: number
  count: number
  hasHere: boolean
  box: { x: number; y: number; w: number; h: number } | null
  /** Where the badge really belongs, when it had to be nudged clear of another. */
  from?: number
}

export default function AtlasMap(props: AtlasMapProps) {
  const { book, frame, asOf, selected, onSelect, onFrame, highlight = [], here, showMentioned = true, journeys = 'recent', interactive = true, focus, className } = props
  const wrap = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [t, setT] = useState<ZoomTransform>(zoomIdentity)
  const art = useFrameArt(book.meta.id, frame.id)

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setSize((s) => (s && s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const w = size?.w ?? 0
  const h = size?.h ?? 0
  const proj = useMemo(() => (size ? makeProjection(frame, w, h, interactive ? 20 : 10) : null), [frame, w, h, size, interactive])

  // Pan & zoom (interactive maps only).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !interactive || !size) return
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, frame.type === 'geo' ? 24 : 6])
      .translateExtent([
        [-w * 0.15, -h * 0.15],
        [w * 1.15, h * 1.15],
      ])
      .on('zoom', (e) => setT(e.transform))
    select(svg).call(z).on('dblclick.zoom', null)
    zoomRef.current = z
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [interactive, size, w, h, frame.type])

  // Reset (or centre on the focus place) whenever the frame changes.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !proj) return
    let target = zoomIdentity
    const p = focus ? visiblePlaces(book, asOf).find((x) => x.id === focus) : undefined
    const pos = p && positionIn(frame, p)
    if (!interactive) {
      // Small maps frame what they're about: the highlighted places.
      const pts = highlight
        .map((hid) => visiblePlaces(book, asOf).find((x) => x.id === hid))
        .map((p) => p && positionIn(frame, p))
        .filter((c): c is XY => !!c)
        .map(proj.project)
      if (pts.length) {
        const xs = pts.map((p) => p[0])
        const ys = pts.map((p) => p[1])
        const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
        const max = frame.type === 'geo' ? 4 : 2.2
        const k = Math.max(1, Math.min(max, (w - 120) / Math.max(1, x1 - x0), (h - 70) / Math.max(1, y1 - y0)))
        target = zoomIdentity.translate(w / 2, h / 2 + 8).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
      }
    } else if (pos && interactive) {
      const [x, y] = proj.project(pos)
      const k = frame.type === 'geo' ? 2 : 1.3
      target = zoomIdentity.translate(w / 2, h / 2).scale(k).translate(-x, -y)
    } else if (interactive && frame.type === 'plan' && proj.planScale) {
      // Drawings fill the screen's height on a phone and centre on where the story is.
      const [W, H] = frame.size ?? [1000, 700]
      const k = Math.max(1, Math.min(1.6, (h - 220) / (H * proj.planScale)))
      const hereP = here ? visiblePlaces(book, asOf).find((x) => x.id === here) : undefined
      const c = (hereP && positionIn(frame, hereP)) ?? [W / 2, H / 2]
      const [cx, cy] = proj.project(c)
      const [ax, ay] = proj.project([W / 2, H / 2])
      // Keep the whole drawing's height in view; only pan sideways toward the focus.
      target = zoomIdentity.translate(w / 2, h / 2 + 10).scale(k).translate(-(k > 1 ? cx * 0.6 + ax * 0.4 : ax), -(ay * 0.85 + cy * 0.15))
    } else if (interactive && frame.type === 'geo') {
      // Open on what the reader has reached, never on the book's whole extent.
      const pts = visiblePlaces(book, asOf)
        .filter((p) => p.role === 'setting' || frame.parent)
        .map((p) => positionIn(frame, p))
        .filter((c): c is XY => !!c)
        .map(proj.project)
      for (const c of childFrames(book, frame, asOf)) {
        if (c.bounds) pts.push(proj.project(c.bounds[0]), proj.project(c.bounds[1]))
        else if (c.anchor && !c.offmap) pts.push(proj.project(c.anchor))
      }
      if (pts.length) {
        const xs = pts.map((p) => p[0])
        const ys = pts.map((p) => p[1])
        const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
        // Leave room for the chips above, the zoom buttons on the right and the chapter dock below.
        const k = Math.max(1, Math.min(6, (w - 150) / Math.max(1, x1 - x0), (h - 240) / Math.max(1, y1 - y0)))
        target = zoomIdentity.translate(w / 2 - 22, h / 2 + 4).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
      }
    }
    if (zoomRef.current) select(svg).call(zoomRef.current.transform, target)
    else setT(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.id, proj, focus])

  const zoomBy = (k: number) => {
    const svg = svgRef.current
    if (svg && zoomRef.current) select(svg).call(zoomRef.current.scaleBy, k)
  }
  const resetZoom = () => {
    const svg = svgRef.current
    if (svg && zoomRef.current) select(svg).call(zoomRef.current.transform, zoomIdentity)
  }

  // ---------- static layers (in zoom-1 pixels; the <g> carries the transform) ----------
  const base = useMemo(() => {
    if (!proj || !art) return null
    const ring = (r: XY[]) => 'M' + r.map((c) => proj.project(c).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z'
    const polys = (list: [number, number][][][] | undefined) => (list ?? []).map((rings) => rings.map(ring).join('')).join('')
    const line = (pts: XY[], curve?: boolean, closed?: boolean) =>
      lineGen.curve(closed ? (curve ? curveCatmullRomClosed.alpha(0.5) : curveLinearClosed) : curve ? curveCatmullRom.alpha(0.5) : curveLinear)(pts.map(proj.project)) ?? ''
    return {
      land: polys(art.land),
      water: polys(art.water),
      parks: polys(art.parks),
      rivers: (art.rivers ?? []).map((r) => ({ d: line(r.line, r.curve), w: r.w ? Math.max(1, r.w * proj.pxPerM) : 0 })),
      walls: (art.walls ?? []).map((l) => line(l)),
      features: (art.features ?? []).map((f) =>
        f.poly
          ? { k: f.k, d: line(f.poly, f.curve, true), w: f.w }
          : f.line
            ? { k: f.k, d: line(f.line, f.curve), w: f.w, open: true }
            : f.at
              ? { k: f.k, c: proj.project(f.at), r: (f.r ?? 6) * (proj.planScale ?? 1) }
              : null,
      ),
    }
  }, [proj, art])

  // ---------- dynamic layers (screen pixels) ----------
  const toScreen = (c: XY): XY => {
    const [x, y] = proj!.project(c)
    return [x * t.k + t.x, y * t.k + t.y]
  }

  const places = visiblePlaces(book, asOf)
  const children = useMemo(() => childFrames(book, frame, asOf), [book, frame, asOf])
  const hl = new Set(highlight)

  const markers = proj
    ? places
        .flatMap((p) => {
          const pos = positionIn(frame, p)
          if (!pos || p.precision === 'unknown' || frame.place === p.id) return []
          if (coveredByChild(book, frame, p, asOf)) return []
          const important = hl.has(p.id) || p.id === here || p.id === selected
          if (!interactive && !important && p.role !== 'setting') return []
          if (!showMentioned && p.role === 'mentioned' && !important) return []
          const [x, y] = toScreen(pos)
          const radius = frame.type === 'geo' && p.radiusKm && p.precision !== 'exact' ? p.radiusKm * 1000 * proj.pxPerM * t.k : 0
          return [{ p, x, y, radius: p.id === selected || radius < 60 ? radius : 0, important }]
        })
        .sort((a, b) => rankOf(a.p, a.important) - rankOf(b.p, b.important))
    : []

  // Child frames: geo children as boxes (or badges when small), drawings as badges at their anchor.
  const portals = proj
    ? children.flatMap((c): Portal[] => {
        const count = places.filter((p) => positionIn(c, p)).length
        const hasHere = !!here && places.some((p) => p.id === here && positionIn(c, p) && coveredByChild(book, frame, p, asOf)?.id === c.id)
        if (c.offmap?.frame === frame.id) {
          const edge: XY = c.offmap.dir === 'N' ? [w / 2, 100] : c.offmap.dir === 'S' ? [w / 2, h - 70] : c.offmap.dir === 'E' ? [w - 60, h / 2] : [60, h / 2]
          return [{ c, kind: 'edge', x: edge[0], y: edge[1], count, hasHere, box: null }]
        }
        if (c.type === 'geo' && c.bounds) {
          const [a, b] = [toScreen(c.bounds[0]), toScreen(c.bounds[1])]
          const box = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) }
          const big = box.w > 70 && box.h > 50
          return [{ c, kind: big ? 'box' : 'badge', x: box.x + box.w / 2, y: box.y + box.h / 2, count, hasHere, box }]
        }
        if (c.anchor) {
          const [x, y] = toScreen(c.anchor)
          return [{ c, kind: 'badge', x, y, count, hasHere, box: null }]
        }
        return []
      })
    : []

  for (let i = 0; i < portals.length; i++) {
    const p = portals[i]
    if (p.kind === 'box') continue
    const y0 = p.y
    for (let guard = 0; guard < 6 && portals.slice(0, i).some((q) => Math.abs(q.x - p.x) < 90 && Math.abs((q.kind === 'box' && q.box ? q.box.y : q.y) - p.y) < 32); guard++) p.y += 34
    if (p.y !== y0) p.from = y0
  }

  // Where a journey end point appears in this frame.
  const legPos = (p: Place): XY | undefined => {
    const own = positionIn(frame, p)
    if (own) {
      const cover = coveredByChild(book, frame, p, asOf)
      const portal = cover && portals.find((x) => x.c.id === cover.id)
      return portal ? [portal.x, portal.y] : toScreen(own)
    }
    for (const portal of portals) if (portal.kind !== 'edge' && positionIn(portal.c, p)) return [portal.x, portal.y]
    if (frame.type === 'geo' && p.lonlat) return toScreen(p.lonlat)
    return undefined
  }

  const legs =
    proj && interactive && journeys !== 'none'
      ? visibleJourneys(book, asOf)
          .flatMap((j) => j.legs)
          .filter((l) => journeys === 'all' || l.chapter >= asOf - 3)
          .flatMap((l) => {
            const a = legPos(l.fromPlace)
            const b = legPos(l.toPlace)
            if (!a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) < 10) return []
            const via = frame.type === 'geo' && positionIn(frame, l.fromPlace) && positionIn(frame, l.toPlace) ? (l.via ?? []).map(toScreen) : []
            const d = lineGen.curve(curveCatmullRom.alpha(0.5))([a, ...via, b]) ?? ''
            return [{ key: `${l.journey.id}-${l.chapter}-${l.from}-${l.to}`, d, mode: l.mode, recent: l.chapter >= asOf - 1 }]
          })
      : []

  // Labels: greedy placement, most important first; skip any that would overlap.
  const placed: { x: number; y: number; w: number; h: number }[] = []
  const fits = (r: { x: number; y: number; w: number; h: number }) =>
    r.x > 2 && r.y > 2 && r.x + r.w < w - 2 && r.y + r.h < h - 2 && !placed.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y)
  for (const p of portals) placed.push({ x: p.x - 40, y: p.y - 14, w: 80, h: 28 })
  for (const l of [...(frame.labels ?? []), ...(art?.labels ?? [])]) {
    if (!proj || l.kind === 'sea' || l.kind === 'region') continue
    const [lx, ly] = l.kind === 'floor' ? [12, toScreen(l.at)[1]] : toScreen(l.at)
    const lw = l.text.length * 6.6
    placed.push(l.kind === 'floor' ? { x: lx, y: ly - 7, w: lw, h: 14 } : { x: lx - lw / 2, y: ly - 11, w: lw, h: 14 })
  }
  for (const m of markers) placed.push({ x: m.x - 7, y: m.y - (m.p.role === 'setting' ? 24 : 5), w: 14, h: m.p.role === 'setting' ? 24 : 10 })
  const labelFor = (m: (typeof markers)[number]) => {
    const show = m.important || (interactive && (m.p.role === 'setting' ? t.k >= 1 : t.k >= 2.2 || frame.type === 'plan'))
    if (!show) return null
    const fs = m.important ? 13 : m.p.role === 'setting' ? 12 : 11
    const width = m.p.name.length * fs * 0.56 + 6
    const top = m.p.role === 'setting' ? m.y - 22 : m.y - 7
    for (const [dx, anchor] of [
      [10, 'start'],
      [-10, 'end'],
    ] as const) {
      const r = { x: anchor === 'start' ? m.x + dx : m.x + dx - width, y: top, w: width, h: fs + 4 }
      if (fits(r)) {
        placed.push(r)
        return { x: m.x + dx, y: top + fs, anchor, fs }
      }
    }
    const below = { x: m.x - width / 2, y: m.y + 5, w: width, h: fs + 4 }
    if (fits(below)) {
      placed.push(below)
      return { x: m.x, y: m.y + 5 + fs, anchor: 'middle' as const, fs }
    }
    return null
  }
  const markerLabels = new Map(markers.map((m) => [m.p.id, labelFor(m)]))

  const staticLabels = proj
    ? [...(frame.labels ?? []), ...(art?.labels ?? [])].flatMap((l) => {
        if (!interactive && l.kind !== 'floor') return []
        if ((l.kind === 'minor' || l.kind === 'area') && t.k < (frame.type === 'plan' ? 1 : 1.5) && frame.type === 'geo') return []
        const [x, y] = toScreen(l.at)
        if (l.kind === 'floor') return [{ l, x: 12, y }]
        return [{ l, x, y }]
      })
    : []

  const bgClass = `atlas-bg atlas-bg--${art?.bg ?? (frame.type === 'geo' ? 'sea' : 'grass')}`
  const ready = !!(proj && base)

  return (
    <div ref={wrap} className={`atlas ${interactive ? 'atlas--live' : 'atlas--static'} ${className ?? ''}`}>
      {size && (
        <svg
          ref={svgRef}
          className="atlas__svg"
          width={w}
          height={h}
          role="img"
          aria-label={`Map: ${frame.title}`}
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as Element).classList.contains('atlas-bg')) onSelect?.(null)
          }}
        >
          <defs>
            <marker id="atlas-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 1 9 5 0 9z" className="atlas-arrow" />
            </marker>
          </defs>
          <rect className={bgClass} x={0} y={0} width={w} height={h} />
          {ready && (
            <g transform={t.toString()}>
              <rect className={bgClass} x={-w} y={-h} width={w * 3} height={h * 3} />
              {base!.land && <path className="atlas-land" d={base!.land} />}
              {base!.parks && <path className="atlas-park" d={base!.parks} />}
              {base!.water && <path className="atlas-water" d={base!.water} />}
              {base!.rivers.map((r, i) => (
                <path key={i} className="atlas-river" d={r.d} style={r.w ? { strokeWidth: r.w } : undefined} vectorEffect={r.w ? undefined : 'non-scaling-stroke'} />
              ))}
              {base!.walls.map((d, i) => (
                <path key={i} className="atlas-wall" d={d} vectorEffect="non-scaling-stroke" />
              ))}
              {base!.features.map((f, i) =>
                !f ? null : 'c' in f && f.c ? (
                  <circle key={i} className={`art art--${f.k}`} cx={f.c[0]} cy={f.c[1]} r={f.r} />
                ) : (
                  <path key={i} className={`art art--${f.k}${'open' in f ? ' art--line' : ''}`} d={(f as { d: string }).d} style={f.w ? { strokeWidth: f.w } : undefined} />
                ),
              )}
            </g>
          )}

          {ready && (
            <g className="atlas-labels" aria-hidden="true">
              {staticLabels.map(({ l, x, y }, i) => (
                <StaticLabel key={i} l={l} x={x} y={y} />
              ))}
            </g>
          )}

          {ready &&
            legs.map((l) => (
              <path key={l.key} d={l.d} className={`atlas-leg atlas-leg--${legClass(l.mode)}${l.recent ? ' is-recent' : ''}`} markerEnd="url(#atlas-arrow)" />
            ))}

          {ready &&
            markers.map((m) => {
              const label = markerLabels.get(m.p.id)
              const isSel = m.p.id === selected
              const isHere = m.p.id === here
              const cls = ['atlas-place', `atlas-place--${m.p.role}`, hl.has(m.p.id) && 'is-hl', isHere && 'is-here', isSel && 'is-selected'].filter(Boolean).join(' ')
              return (
                <g
                  key={m.p.id}
                  className={cls}
                  role={interactive ? 'button' : undefined}
                  tabIndex={interactive ? 0 : -1}
                  aria-label={interactive ? `${m.p.name}${isHere ? ', you are here' : ''}` : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (interactive) onSelect?.(m.p.id)
                  }}
                  onKeyDown={(e) => {
                    if (interactive && (e.key === 'Enter' || e.key === ' ')) (e.preventDefault(), onSelect?.(m.p.id))
                  }}
                >
                  {m.radius > 10 && <circle className="atlas-place__area" cx={m.x} cy={m.y} r={Math.min(m.radius, Math.max(w, h))} />}
                  {interactive && <circle className="atlas-place__hit" cx={m.x} cy={m.p.role === 'setting' ? m.y - 10 : m.y} r={20} />}
                  {isHere && <circle className="atlas-place__pulse" cx={m.x} cy={m.y} r={14} />}
                  {m.p.role === 'setting' ? (
                    <path className="atlas-place__pin" transform={`translate(${m.x} ${m.y})${isSel ? ' scale(1.25)' : ''}`} d="M0 0c-1-4.5-7.5-8.6-7.5-14a7.5 7.5 0 0 1 15 0c0 5.4-6.5 9.5-7.5 14Zm0-11.2a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z" />
                  ) : (
                    <circle className="atlas-place__dot" cx={m.x} cy={m.y} r={isSel ? 6 : 4.5} />
                  )}
                  {label && (
                    <text className="atlas-place__label" x={label.x} y={label.y} textAnchor={label.anchor} style={{ fontSize: label.fs }}>
                      {m.p.name}
                    </text>
                  )}
                </g>
              )
            })}
          {ready &&
            portals.map((p) => (
              <g
                key={p.c.id}
                className={`atlas-portal${p.hasHere ? ' is-here' : ''}`}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : -1}
                aria-label={interactive ? `Open ${p.c.title}${p.count ? `, ${p.count} places` : ''}` : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  if (interactive) onFrame?.(p.c.id)
                }}
                onKeyDown={(e) => {
                  if (interactive && (e.key === 'Enter' || e.key === ' ')) (e.preventDefault(), onFrame?.(p.c.id))
                }}
              >
                {p.from !== undefined && (
                  <>
                    <line className="atlas-portal__leader" x1={p.x} y1={p.from} x2={p.x} y2={p.y - 15} />
                    <circle className="atlas-portal__anchor" cx={p.x} cy={p.from} r={3.5} />
                  </>
                )}
                {p.kind === 'box' && p.box && <rect className="atlas-portal__box" x={p.box.x} y={p.box.y} width={p.box.w} height={p.box.h} rx={6} />}
                <PortalBadge x={p.kind === 'box' && p.box ? p.box.x + p.box.w / 2 : p.x} y={p.kind === 'box' && p.box ? p.box.y : p.y} label={p.kind === 'edge' ? (p.c.offmap!.badge ?? p.c.short) : p.c.short} edge={p.kind === 'edge' ? p.c.offmap!.dir : undefined} />
              </g>
            ))}

        </svg>
      )}
      {!ready && <div className="atlas__loading">Drawing the map…</div>}
      {interactive && ready && (
        <div className="map__zoom atlas__zoom">
          <button className="icon-btn" onClick={() => zoomBy(1.6)} aria-label="Zoom in">
            <Icon name="plus" />
          </button>
          <button className="icon-btn" onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out">
            <Icon name="minus" />
          </button>
          <button className="icon-btn" onClick={resetZoom} aria-label="Show the whole map">
            <Icon name="fit" />
          </button>
        </div>
      )}
    </div>
  )
}

const rankOf = (p: Place, important: boolean) => (important ? 0 : p.role === 'setting' ? 1 : 2)
const legClass = (mode: string) => (['sea', 'boat', 'swim', 'river'].includes(mode) ? 'water' : ['air', 'magic'].includes(mode) ? 'air' : 'land')

function StaticLabel({ l, x, y }: { l: MapLabel; x: number; y: number }) {
  return (
    <text className={`atlas-label atlas-label--${l.kind}`} x={x} y={y} textAnchor={l.kind === 'floor' ? 'start' : 'middle'} transform={l.rot ? `rotate(${l.rot} ${x} ${y})` : undefined}>
      {l.text}
    </text>
  )
}

function PortalBadge({ x, y, label, edge }: { x: number; y: number; label: string; edge?: 'N' | 'S' | 'E' | 'W' }) {
  const width = label.length * 7.4 + 34
  const arrow = edge === 'N' ? '↑ ' : edge === 'S' ? '↓ ' : edge === 'E' ? '→ ' : edge === 'W' ? '← ' : ''
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect className="atlas-portal__badge" x={-width / 2} y={-15} width={width} height={30} rx={15} />
      <text className="atlas-portal__label" x={0} y={5} textAnchor="middle">
        {arrow}
        {label} ›
      </text>
    </g>
  )
}
