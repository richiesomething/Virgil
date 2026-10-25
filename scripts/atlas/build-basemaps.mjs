// Builds the base geography for every geo frame into src/books/<book>/atlas/<frame>.json.
// Developer-only (needs network on first run; downloads are cached in ~/.cache/virgil-atlas). Outputs are committed.
// Sources: Natural Earth (public domain) and OpenStreetMap (© OpenStreetMap contributors, ODbL).
// Usage: node scripts/atlas/build-basemaps.mjs [book]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import bboxClip from '@turf/bbox-clip'
import simplify from 'simplify-js'
import { CACHE, nominatimPolygon, overpass } from './osm.mjs'

const books = process.argv[2] ? [process.argv[2]] : ['monte-cristo', 'harry-potter-1', 'the-pearl']
const only = process.argv[3]?.split(',')

const ne = new Map()
async function naturalEarth(name) {
  if (ne.has(name)) return ne.get(name)
  const file = join(CACHE, name + '.geojson')
  if (!existsSync(file)) {
    const res = await fetch(`https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/${name}.geojson`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  }
  const json = JSON.parse(readFileSync(file, 'utf8'))
  ne.set(name, json)
  return json
}

// ---------- geometry helpers ----------

const polygonsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [])
const linesOf = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [])
const bboxOf = (rings) => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const r of rings) for (const [x, y] of r) ((w = Math.min(w, x)), (e = Math.max(e, x)), (s = Math.min(s, y)), (n = Math.max(n, y)))
  return [w, s, e, n]
}
const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]

function makeTools(box, tol, dp) {
  const round = (v) => Math.round(v * 10 ** dp) / 10 ** dp
  const simp = (ring, closed) => {
    const pts = simplify(ring.map(([x, y]) => ({ x, y })), tol, true).map((p) => [round(p.x), round(p.y)])
    if (closed && pts.length && (pts[0][0] !== pts.at(-1)[0] || pts[0][1] !== pts.at(-1)[1])) pts.push(pts[0])
    return pts
  }
  const clipPolys = (polys) => {
    const out = []
    for (const poly of polys) {
      if (!overlaps(bboxOf(poly), box)) continue
      const clipped = bboxClip({ type: 'Feature', geometry: { type: 'Polygon', coordinates: poly }, properties: {} }, box).geometry
      for (const p of polygonsOf(clipped)) {
        const rings = p.map((r) => simp(r, true)).filter((r) => r.length >= 4)
        if (rings.length && area(rings[0]) > tol * tol * 4) out.push(rings)
      }
    }
    return out
  }
  const clipLines = (lines) => {
    const out = []
    for (const line of lines) {
      if (!overlaps(bboxOf([line]), box)) continue
      const clipped = bboxClip({ type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: {} }, box).geometry
      for (const l of linesOf(clipped)) {
        const s = simp(l, false)
        if (s.length >= 2) out.push(s)
      }
    }
    return out
  }
  return { clipPolys, clipLines, round }
}

function area(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1])
  return Math.abs(a / 2)
}

/** Joins ways that share end points into longer chains (closed rings where they close). */
function chain(ways) {
  const key = (p) => p[0].toFixed(7) + ',' + p[1].toFixed(7)
  const pool = ways.map((w) => [...w])
  const done = []
  while (pool.length) {
    let cur = pool.pop()
    let grew = true
    while (grew && key(cur[0]) !== key(cur.at(-1))) {
      grew = false
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i]
        if (key(w[0]) === key(cur.at(-1))) cur = cur.concat(w.slice(1))
        else if (key(w.at(-1)) === key(cur[0])) cur = w.concat(cur.slice(1))
        else if (key(w.at(-1)) === key(cur.at(-1))) cur = cur.concat([...w].reverse().slice(1))
        else if (key(w[0]) === key(cur[0])) cur = [...w].reverse().concat(cur.slice(1))
        else continue
        pool.splice(i, 1)
        grew = true
        break
      }
    }
    done.push(cur)
  }
  return done
}

/**
 * Land polygons from OSM coastline ways inside a box. Coastlines keep land on their left, so an open
 * chain is closed by walking the box edge counter-clockwise from where it leaves to where it entered.
 */
function landFromCoastline(ways, box) {
  const [W, S, E, N] = box
  const per = 2 * (E - W) + 2 * (N - S)
  const t = ([x, y]) => {
    // Counter-clockwise perimeter position: bottom (W→E), right (S→N), top (E→W), left (N→S).
    if (Math.abs(y - S) < 1e-9) return x - W
    if (Math.abs(x - E) < 1e-9) return E - W + (y - S)
    if (Math.abs(y - N) < 1e-9) return E - W + (N - S) + (E - x)
    return 2 * (E - W) + (N - S) + (N - y)
  }
  const corners = [[E, S], [E, N], [W, N], [W, S]].map((c) => ({ c, t: t(c) }))
  const inside = ([x, y]) => x > W && x < E && y > S && y < N
  const rings = []
  const segs = []
  for (const c of chain(ways)) {
    const closed = c.length > 3 && c[0][0] === c.at(-1)[0] && c[0][1] === c.at(-1)[1]
    if (closed && c.every(inside)) {
      rings.push([c])
      continue
    }
    const clipped = bboxClip({ type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: {} }, box).geometry
    for (const l of linesOf(clipped)) if (l.length >= 2) segs.push(l)
  }
  // Snap segment ends to the box edge, then stitch.
  const snap = ([x, y]) => {
    const d = [Math.abs(x - W), Math.abs(x - E), Math.abs(y - S), Math.abs(y - N)]
    const m = Math.min(...d)
    return m === d[0] ? [W, y] : m === d[1] ? [E, y] : m === d[2] ? [x, S] : [x, N]
  }
  const open = segs.map((s) => ({ pts: s, a: t(snap(s[0])), b: t(snap(s.at(-1))), used: false }))
  for (const start of open) {
    if (start.used) continue
    const ring = []
    let cur = start
    for (let guard = 0; guard < 500; guard++) {
      cur.used = true
      ring.push(...cur.pts)
      // Walk CCW from the exit to the next entry point.
      const from = cur.b
      const dist = (x) => (x - from + per) % per
      const next = open.filter((s) => !s.used || s === start).sort((p, q) => dist(p.a) - dist(q.a))[0]
      for (const k of corners.filter((k) => dist(k.t) > 0 && dist(k.t) < dist(next.a)).sort((p, q) => dist(p.t) - dist(q.t))) ring.push(k.c)
      if (next === start) break
      cur = next
    }
    ring.push(ring[0])
    rings.push([ring])
  }
  return rings
}

// ---------- per-frame recipes ----------

const NE_RIVERS = ['ne_10m_rivers_lake_centerlines', 'ne_10m_rivers_europe']

async function naturalBase(frame, tools, { minorIslands = true } = {}) {
  const span = frame.bounds[1][0] - frame.bounds[0][0]
  const maxRank = span > 20 ? 4 : span > 4 ? 6 : 9
  const land = []
  for (const f of (await naturalEarth('ne_10m_land')).features) land.push(...polygonsOf(f.geometry))
  if (minorIslands) for (const f of (await naturalEarth('ne_10m_minor_islands')).features) land.push(...polygonsOf(f.geometry))
  const lakes = []
  for (const f of (await naturalEarth('ne_10m_lakes')).features) if ((f.properties.scalerank ?? 9) <= 8) lakes.push(...polygonsOf(f.geometry))
  const rivers = []
  for (const name of NE_RIVERS)
    for (const f of (await naturalEarth(name)).features) if ((f.properties.scalerank ?? 9) <= maxRank && f.properties.featurecla !== 'Lake Centerline') rivers.push(...linesOf(f.geometry))
  return { bg: 'sea', land: tools.clipPolys(land), water: tools.clipPolys(lakes), rivers: tools.clipLines(rivers).map((line) => ({ line })) }
}

async function nominatimShapes(queries, tools) {
  const polys = []
  const lines = []
  for (const q of queries) {
    const [hit] = await nominatimPolygon(q)
    if (!hit?.geojson) {
      console.warn(`  nominatim: nothing for "${q}"`)
      continue
    }
    polys.push(...tools.clipPolys(polygonsOf(hit.geojson)))
    lines.push(...tools.clipLines(linesOf(hit.geojson)))
  }
  return { polys, lines }
}

async function osmRiverPolygons(bboxStr, tools, attempts = 4) {
  const q = `[out:json][timeout:120];(way["natural"="water"]["water"="river"](${bboxStr});relation["natural"="water"]["water"="river"](${bboxStr}););out geom;`
  let r
  try {
    r = await overpass(q, attempts)
  } catch {
    return null
  }
  const polys = []
  for (const el of r.elements) {
    if (el.type === 'way' && el.geometry) polys.push([el.geometry.map((p) => [p.lon, p.lat])])
    if (el.type === 'relation') {
      const outer = chain(el.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry.map((p) => [p.lon, p.lat])))
      const inner = chain(el.members.filter((m) => m.role === 'inner' && m.geometry).map((m) => m.geometry.map((p) => [p.lon, p.lat])))
      for (const o of outer) polys.push([o, ...inner.filter((i) => overlaps(bboxOf([i]), bboxOf([o])))])
    }
  }
  return tools.clipPolys(polys.map((p) => p.filter((r) => r.length >= 4 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1])).filter((p) => p.length))
}

async function osmLines(filter, bboxStr, attempts = 10) {
  try {
    const r = await overpass(`[out:json][timeout:90];way${filter}(${bboxStr});out geom;`, attempts)
    return r.elements.filter((e) => e.geometry).map((e) => e.geometry.map((p) => [p.lon, p.lat]))
  } catch {
    return null
  }
}

/** A line traced through named points (bridges along a river, gates along a wall), via Nominatim. */
async function traced(names, suffix) {
  const pts = []
  for (const n of names) {
    const [hit] = await nominatimPolygon(`${n}, ${suffix}`)
    if (hit) pts.push([Number(hit.lon), Number(hit.lat)])
    else console.warn(`  nominatim: no point for ${n}`)
  }
  return pts
}

/** Natural Earth land, lakes, rivers and islands: any region from a country to an ocean. */
async function naturalRecipe(frame, tools) {
  return naturalBase(frame, tools)
}

/**
 * A city or coast from OpenStreetMap and Nominatim, configured in frames.json (see docs/data-format.md):
 * coastline, river (water polygons → OSM centreline → line traced through bridges → Nominatim line),
 * parks, and walls (OSM → traced gates → hand-given coordinates).
 */
async function cityRecipe(frame, tools, box, r) {
  const osmBox = r.osmBox ?? `${box[1]},${box[0]},${box[3]},${box[2]}`
  let land = []
  if (r.coastline) {
    const q = `[out:json][timeout:120];way["natural"="coastline"](${box[1]},${box[0]},${box[3]},${box[2]});out geom;`
    try {
      const res = await overpass(q)
      land = tools.clipPolys(landFromCoastline(res.elements.map((e) => e.geometry.map((p) => [p.lon, p.lat])), box))
    } catch (e) {
      console.warn('  coastline unavailable, using Natural Earth:', e.message)
      land = (await naturalBase(frame, tools)).land
    }
  }
  let water = []
  let rivers = []
  if (r.river) {
    const rv = r.river
    water = (await osmRiverPolygons(r.river.polygonBox ?? osmBox, tools, 2)) ?? []
    if (!water.length) {
      let lines = rv.osm ? ((await osmLines(`["waterway"="river"]["name"="${rv.osm}"]`, osmBox, 3)) ?? []) : []
      if (!lines.length && rv.trace) lines = [await traced(rv.trace, rv.traceSuffix ?? '')]
      if (!lines.length && rv.nominatim) lines = (await nominatimShapes([rv.nominatim], tools)).lines
      else lines = tools.clipLines(chain(lines))
      rivers = lines.map((line) => ({ line, w: rv.width ?? 120, ...(rv.curve ? { curve: true } : {}) }))
    }
  }
  const parks = r.parks?.length ? (await nominatimShapes(r.parks, tools)).polys : []
  let walls = []
  if (r.walls) {
    const wl = r.walls
    let lines = wl.osm ? ((await osmLines('["historic"="citywalls"]', wl.osmBox ?? osmBox, 3)) ?? []) : []
    if (!lines.length && wl.trace) lines = await Promise.all(wl.trace.map((names) => traced(names, wl.traceSuffix ?? '')))
    walls = lines.length ? tools.clipLines(chain(lines)) : wl.coords ? tools.clipLines([wl.coords]) : []
  }
  return { bg: r.coastline ? 'sea' : 'land', land, water, rivers, parks, ...(r.walls ? { walls } : {}) }
}

const recipes = { natural: naturalRecipe, city: cityRecipe }

for (const book of books) {
  const framesFile = join('data-src', book, 'atlas', 'frames.json')
  if (!existsSync(framesFile)) continue
  mkdirSync(join('src/books', book, 'atlas'), { recursive: true })
  for (const frame of JSON.parse(readFileSync(framesFile, 'utf8'))) {
    if (frame.type !== 'geo' || (only && !only.includes(frame.id))) continue
    const recipe = recipes[frame.recipe?.type]
    if (!recipe) throw new Error(`Frame ${book}/${frame.id} needs a "recipe" of type ${Object.keys(recipes).join(' or ')} (see docs/data-format.md)`)
    const [[w, s], [e, n]] = frame.bounds
    const padX = (e - w) * 0.35
    const padY = (n - s) * 0.35
    const box = [w - padX, s - padY, e + padX, n + padY]
    const span = e - w
    const tol = span / 1400
    const dp = span > 5 ? 3 : span > 0.5 ? 4 : 5
    const tools = makeTools(box, tol, dp)
    console.log(`${book}/${frame.id}`)
    const base = await recipe(frame, tools, box, frame.recipe)
    const out = join('src/books', book, 'atlas', `${frame.id}.json`)
    writeFileSync(out, JSON.stringify(base))
    console.log(`  → ${out} (${(JSON.stringify(base).length / 1024).toFixed(0)} KB)`)
  }
}
