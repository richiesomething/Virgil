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

const TIBER_BRIDGES = ['Ponte Milvio', "Ponte Duca d'Aosta", 'Ponte del Risorgimento', 'Ponte Giacomo Matteotti', 'Ponte Pietro Nenni', 'Ponte Regina Margherita', 'Ponte Cavour', 'Ponte Umberto I', "Ponte Sant'Angelo", 'Ponte Vittorio Emanuele II', 'Ponte Principe Amedeo Savoia Aosta', 'Ponte Giuseppe Mazzini', 'Ponte Sisto', 'Ponte Garibaldi', 'Ponte Palatino', 'Ponte Sublicio', 'Ponte Testaccio', "Ponte dell'Industria", 'Ponte Guglielmo Marconi']
const ROME_WALL_GATES = ['Porta del Popolo', 'Porta Pinciana', 'Porta Salaria', 'Porta Pia', 'Porta Tiburtina', 'Porta Maggiore', 'Porta San Giovanni', 'Porta Metronia', 'Porta Latina', 'Porta San Sebastiano', 'Porta Ardeatina', 'Porta San Paolo']
const JANICULUM_GATES = ['Porta Portese', 'Porta San Pancrazio', 'Porta Cavalleggeri', 'Porta Angelica']
const THAMES_BRIDGES = ['Wandsworth Bridge', 'Battersea Bridge', 'Albert Bridge', 'Chelsea Bridge', 'Grosvenor Bridge', 'Vauxhall Bridge', 'Lambeth Bridge', 'Westminster Bridge', 'Hungerford Bridge', 'Waterloo Bridge', 'Blackfriars Bridge', 'Southwark Bridge', 'London Bridge', 'Tower Bridge']

const recipes = {
  async mediterranean(frame, tools) {
    return naturalBase(frame, tools)
  },
  async britain(frame, tools) {
    return naturalBase(frame, tools)
  },
  async gulf(frame, tools) {
    return naturalBase(frame, tools)
  },
  async marseilles(frame, tools, box) {
    const q = `[out:json][timeout:120];way["natural"="coastline"](${box[1]},${box[0]},${box[3]},${box[2]});out geom;`
    let land
    try {
      const r = await overpass(q)
      land = tools.clipPolys(landFromCoastline(r.elements.map((e) => e.geometry.map((p) => [p.lon, p.lat])), box).map((p) => p))
    } catch (e) {
      console.warn('  coastline unavailable, using Natural Earth:', e.message)
      land = (await naturalBase(frame, tools)).land
    }
    const parks = await nominatimShapes(['Parc Borély, Marseille', 'Jardin du Pharo, Marseille'], tools)
    return { bg: 'sea', land, water: [], rivers: [], parks: parks.polys }
  },
  async paris(frame, tools, box) {
    const water = (await osmRiverPolygons('48.80,2.20,48.92,2.44', tools)) ?? []
    const river = water.length ? [] : (await nominatimShapes(['La Seine, Paris'], tools)).lines.map((line) => ({ line, w: 150 }))
    const parks = await nominatimShapes(
      ['Bois de Boulogne', 'Jardin des Tuileries', 'Jardin du Luxembourg', 'Champ de Mars, Paris', 'Cimetière du Père-Lachaise', 'Jardin des Plantes, Paris', 'Parc Monceau', 'Esplanade des Invalides', 'Bois de Vincennes'],
      tools,
    )
    return { bg: 'land', land: [], water, rivers: river, parks: parks.polys, walls: [tools.clipLines([FARMERS_GENERAL_WALL])[0]].filter(Boolean) }
  },
  async rome(frame, tools, box) {
    const water = (await osmRiverPolygons('41.83,12.42,41.94,12.55', tools, 2)) ?? []
    let tiber = water.length ? [] : ((await osmLines('["waterway"="river"]["name"="Tevere"]', '41.83,12.42,41.94,12.55', 3)) ?? [])
    if (!water.length && !tiber.length) tiber = [await traced(TIBER_BRIDGES, 'Roma')]
    const river = tools.clipLines(chain(tiber)).map((line) => ({ line, w: 90 }))
    const parks = await nominatimShapes(['Villa Borghese, Roma', 'Villa Doria Pamphilj', 'Palatino, Roma', 'Circo Massimo', 'Villa Ada'], tools)
    let walls = (await osmLines('["historic"="citywalls"]', '41.865,12.455,41.915,12.53', 3)) ?? []
    if (!walls.length) walls = [await traced(ROME_WALL_GATES, 'Roma'), await traced(JANICULUM_GATES, 'Roma')]
    return { bg: 'land', land: [], water, rivers: river, parks: parks.polys, walls: tools.clipLines(chain(walls)) }
  },
  async london(frame, tools, box) {
    const water = (await osmRiverPolygons('51.48,-0.22,51.56,-0.05', tools, 2)) ?? []
    let thames = water.length ? [] : ((await osmLines('["waterway"="river"]["name"="River Thames"]', '51.48,-0.22,51.56,-0.05', 3)) ?? [])
    if (!water.length && !thames.length) thames = [await traced(THAMES_BRIDGES, 'London')]
    const river = tools.clipLines(chain(thames)).map((line) => ({ line, w: 230, curve: true }))
    const parks = await nominatimShapes(["Hyde Park, London", "Kensington Gardens", "Regent's Park", 'Green Park, London', "St James's Park", 'Primrose Hill'], tools)
    return { bg: 'land', land: [], water, rivers: river, parks: parks.polys }
  },
}

// The Farmers-General wall (1784–1860): Paris's customs wall in the 1830s, along today's boulevards.
const FARMERS_GENERAL_WALL = [
  [2.295, 48.8738], [2.3015, 48.8786], [2.309, 48.8812], [2.3205, 48.8833], [2.3275, 48.8838], [2.3375, 48.8823], [2.35, 48.8838], [2.3605, 48.8843],
  [2.3685, 48.884], [2.3707, 48.8778], [2.3765, 48.8722], [2.3833, 48.8662], [2.3868, 48.8628], [2.3906, 48.858], [2.3958, 48.8484], [2.4004, 48.8441],
  [2.396, 48.8396], [2.3895, 48.8378], [2.3818, 48.8368], [2.3756, 48.8352], [2.3694, 48.8334], [2.3557, 48.831], [2.3433, 48.831], [2.3325, 48.8339],
  [2.3243, 48.8381], [2.317, 48.8418], [2.3127, 48.8425], [2.3069, 48.8466], [2.2985, 48.8497], [2.2928, 48.8507], [2.2895, 48.8538], [2.2855, 48.8577],
  [2.2864, 48.8627], [2.2901, 48.867], [2.2932, 48.8714], [2.295, 48.8738],
]

for (const book of books) {
  const framesFile = join('data-src', book, 'atlas', 'frames.json')
  if (!existsSync(framesFile)) continue
  mkdirSync(join('src/books', book, 'atlas'), { recursive: true })
  for (const frame of JSON.parse(readFileSync(framesFile, 'utf8'))) {
    if (frame.type !== 'geo' || (only && !only.includes(frame.id))) continue
    const recipe = recipes[frame.id]
    if (!recipe) throw new Error(`No basemap recipe for ${book}/${frame.id}`)
    const [[w, s], [e, n]] = frame.bounds
    const padX = (e - w) * 0.35
    const padY = (n - s) * 0.35
    const box = [w - padX, s - padY, e + padX, n + padY]
    const span = e - w
    const tol = span / 1400
    const dp = span > 5 ? 3 : span > 0.5 ? 4 : 5
    const tools = makeTools(box, tol, dp)
    console.log(`${book}/${frame.id}`)
    const base = await recipe(frame, tools, box)
    const out = join('src/books', book, 'atlas', `${frame.id}.json`)
    writeFileSync(out, JSON.stringify(base))
    console.log(`  → ${out} (${(JSON.stringify(base).length / 1024).toFixed(0)} KB)`)
  }
}
