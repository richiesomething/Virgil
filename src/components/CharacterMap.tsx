import { useEffect, useMemo, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { drag } from 'd3-drag'
import type { Character, RelationType } from '../types'
import type { Connection } from '../lib/spoilers'
import { relationTypes } from '../lib/relations'
import { initials } from './CharacterChip'

interface Node extends SimulationNodeDatum {
  id: string
  character: Character
}

interface Props {
  characters: Character[]
  connections: Connection[]
  selected: string | null
  onSelect: (id: string | null) => void
  /** Shared across renders so the layout doesn't jump when the chapter changes. */
  positions: Map<string, { x: number; y: number }>
}

const radius = { major: 20, supporting: 14, minor: 10 }

/** Small maps label everyone; big ones label minor characters only around the focus. */
const isLabelled = (c: Character, count: number) => count <= 30 || c.importance !== 'minor'
/** Rough width of an 11px label; close enough for spacing nodes apart. */
const labelWidth = (name: string) => name.length * 6.2
const dashFor = Object.fromEntries(relationTypes.map((r) => [r.type, r.dash])) as Record<RelationType, string | undefined>

export default function CharacterMap({ characters, connections, selected, onSelect, positions }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const simRef = useRef<Simulation<Node, undefined> | null>(null)
  const fitRef = useRef<() => void>(() => {})
  const [, setTick] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)

  // The simulation only restarts when the set of characters or links changes,
  // not when a label or selection does.
  const nodeKey = characters.map((c) => c.id).join(',')
  const linkKey = connections.map((c) => c.a + '|' + c.b).join(',')
  const nodes = useMemo<Node[]>(
    () =>
      characters.map((c) => {
        const p = positions.get(c.id)
        return { id: c.id, character: c, x: p?.x, y: p?.y }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeKey, positions],
  )
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const links = connections.filter((c) => nodeById.has(c.a) && nodeById.has(c.b))
  const pairs = useMemo(
    () => links.map((l) => ({ source: l.a, target: l.b })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linkKey, nodeById],
  )

  // Layout
  useEffect(() => {
    // Characters new to the map start beside someone they're linked to, so
    // moving the chapter slider grows the map instead of reshuffling it.
    const known = nodes.filter((n) => n.x !== undefined)
    for (const n of nodes) {
      if (n.x !== undefined) continue
      const pair = pairs.find((p) => (p.source === n.id || p.target === n.id))
      const other = pair && nodeById.get(pair.source === n.id ? pair.target : pair.source)
      if (other?.x !== undefined && other.y !== undefined) {
        n.x = other.x + (Math.random() - 0.5) * 60
        n.y = other.y + (Math.random() - 0.5) * 60
      }
    }
    const sim = forceSimulation<Node>(nodes)
      .force(
        'link',
        forceLink<Node, { source: string; target: string }>(pairs.map((p) => ({ ...p })))
          .id((n) => n.id)
          .distance(110)
          .strength(0.4),
      )
      .force('charge', forceManyBody().strength(-420))
      .force('center', forceCenter(0, 0))
      .force('x', forceX(0).strength(0.05))
      .force('y', forceY(0).strength(0.07))
      .force(
        'collide',
        // Leave room for the name label as well as the dot, so labels don't overlap.
        forceCollide<Node>((n) => {
          const dot = radius[n.character.importance] + 22
          return isLabelled(n.character, nodes.length) ? Math.max(dot, labelWidth(n.character.name) / 2 + 10) : dot
        }).iterations(3),
      )
      .stop()

    const save = () => {
      for (const n of nodes) if (n.x !== undefined && n.y !== undefined) positions.set(n.id, { x: n.x, y: n.y })
    }
    let frame = 0
    sim.on('tick', () => {
      save()
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), setTick((t) => t + 1)))
    })

    if (known.length < nodes.length / 2) {
      // Mostly new: settle off-screen, then show the finished layout, fitted.
      sim.tick(300)
      save()
      setTick((t) => t + 1)
      fitRef.current()
    } else {
      sim.alpha(0.4).restart()
    }
    simRef.current = sim
    return () => {
      sim.stop()
      cancelAnimationFrame(frame)
    }
  }, [nodes, pairs, nodeById, positions])

  // Pan & zoom
  useEffect(() => {
    const svg = svgRef.current!
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .on('zoom', (e) => gRef.current?.setAttribute('transform', e.transform.toString()))
    select(svg).call(z).on('dblclick.zoom', null)
    zoomRef.current = z
    fitRef.current()
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [])

  // Dragging nodes
  useEffect(() => {
    const g = gRef.current!
    const sim = simRef.current
    if (!sim) return
    const behaviour = drag<SVGGElement, unknown>()
      .clickDistance(4)
      .on('start', function (e) {
        const n = nodeById.get(this.dataset.id!)
        if (!n) return
        if (!e.active) sim.alphaTarget(0.2).restart()
        n.fx = n.x
        n.fy = n.y
      })
      .on('drag', function (e) {
        const n = nodeById.get(this.dataset.id!)
        if (n) ((n.fx = e.x), (n.fy = e.y))
      })
      .on('end', function (e) {
        const n = nodeById.get(this.dataset.id!)
        if (!e.active) sim.alphaTarget(0)
        if (n) ((n.fx = null), (n.fy = null))
      })
    select(g).selectAll<SVGGElement, unknown>('g.node').call(behaviour)
  })

  const focus = hovered ?? selected
  const neighbours = useMemo(() => {
    if (!focus) return null
    const set = new Set([focus])
    for (const l of links) {
      if (l.a === focus) set.add(l.b)
      if (l.b === focus) set.add(l.a)
    }
    return set
  }, [focus, links])

  // Scale and centre the view so every character is visible.
  fitRef.current = () => {
    const svg = svgRef.current
    const z = zoomRef.current
    const pts = nodes.filter((n) => n.x !== undefined && n.y !== undefined)
    if (!svg || !z || !pts.length) return
    const { width, height } = svg.getBoundingClientRect()
    const xs = pts.map((n) => n.x!)
    const ys = pts.map((n) => n.y!)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const pad = 90 // room for name labels and the zoom buttons
    const k = Math.min(1.4, width / (x1 - x0 + pad * 2), height / (y1 - y0 + pad * 2))
    select(svg).call(
      z.transform,
      zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2),
    )
  }

  const zoomBy = (k: number) => {
    const svg = svgRef.current
    if (svg && zoomRef.current) select(svg).call(zoomRef.current.scaleBy, k)
  }

  return (
    <div className="map">
      <svg
        ref={svgRef}
        className="map__svg"
        role="img"
        aria-label={`Character map with ${nodes.length} characters and ${links.length} relationships`}
        onClick={(e) => e.target === svgRef.current && onSelect(null)}
      >
        <g ref={gRef}>
          <g className="map__links">
            {links.map((l) => {
              const s = nodeById.get(l.a)!
              const t = nodeById.get(l.b)!
              if (s.x === undefined || t.x === undefined) return null
              const dim = neighbours && !(neighbours.has(l.a) && neighbours.has(l.b) && (l.a === focus || l.b === focus))
              return (
                <g key={l.a + '|' + l.b} className={'map__link' + (dim ? ' is-dim' : '')}>
                  <line
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    className={`rel rel--${l.type}`}
                    strokeDasharray={dashFor[l.type]}
                  />
                  <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} className="map__link-hit">
                    <title>{`${s.character.name} – ${t.character.name}: ${l.label}`}</title>
                  </line>
                </g>
              )
            })}
          </g>
          <g className="map__nodes">
            {nodes.map((n) => {
              if (n.x === undefined || n.y === undefined) return null
              const c = n.character
              const r = radius[c.importance]
              const dim = neighbours && !neighbours.has(n.id)
              const showLabel = isLabelled(c, nodes.length) || (neighbours?.has(n.id) ?? false)
              return (
                <g
                  key={n.id}
                  data-id={n.id}
                  className={`node node--${c.importance}` + (dim ? ' is-dim' : '') + (selected === n.id ? ' is-selected' : '')}
                  transform={`translate(${n.x},${n.y})`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(selected === n.id ? null : n.id)
                  }}
                  onPointerEnter={() => setHovered(n.id)}
                  onPointerLeave={() => setHovered(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={c.name}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(n.id))}
                >
                  <circle r={r + 8} className="node__hit" />
                  <circle r={r} className="node__dot" />
                  {r >= 14 && (
                    <text className="node__initials" dy="0.35em" fontSize={r * 0.75}>
                      {initials(c.name)}
                    </text>
                  )}
                  {showLabel && (
                    <text className="node__label" y={r + 14}>
                      {c.name}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </g>
      </svg>
      <div className="map__zoom">
        <button className="icon-btn" onClick={() => zoomBy(1.3)} aria-label="Zoom in">+</button>
        <button className="icon-btn" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">−</button>
        <button className="icon-btn map__fit" onClick={() => fitRef.current()} aria-label="Fit everyone in view" title="Fit everyone in view">⤢</button>
      </div>
    </div>
  )
}
