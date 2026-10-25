// Cached Overpass queries for the basemap build (developer-only; outputs are committed).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const CACHE = join(homedir(), '.cache', 'virgil-atlas')
mkdirSync(CACHE, { recursive: true })

const ENDPOINTS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function overpass(query, attempts = 12) {
  const file = join(CACHE, 'osm-' + createHash('sha1').update(query).digest('hex').slice(0, 16) + '.json')
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  for (let attempt = 0; attempt < attempts; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length]
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(120_000), headers: { 'User-Agent': 'virgil-reading-app/1.0' } })
      if (res.ok) {
        const text = await res.text()
        if (text.startsWith('{')) {
          writeFileSync(file, text)
          return JSON.parse(text)
        }
      }
      console.warn(`  overpass ${res.status} from ${new URL(url).host}, retrying`)
    } catch (e) {
      console.warn(`  overpass ${e.name} from ${new URL(url).host}, retrying`)
    }
    await sleep(3000 + attempt * 2000)
  }
  throw new Error('Overpass failed: ' + query.slice(0, 120))
}

export async function nominatimPolygon(q) {
  const file = join(CACHE, 'nom-' + createHash('sha1').update(q).digest('hex').slice(0, 16) + '.json')
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  await sleep(1100)
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&polygon_geojson=1&polygon_threshold=0.00005&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'virgil-reading-app/1.0' } })
  const json = await res.json()
  writeFileSync(file, JSON.stringify(json))
  return json
}
