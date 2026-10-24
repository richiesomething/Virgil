import { useSyncExternalStore } from 'react'

// Hash routing: GitHub Pages has no server-side fallback for client routes.
// URLs look like #/b/monte-cristo/chapters/12?tab=notes

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export interface Location {
  parts: string[]
  query: URLSearchParams
  /** Path without the query, e.g. "/b/monte-cristo/chapters/12". */
  path: string
}

let cachedHash = ''
let cachedLocation: Location = parse('')

function parse(hash: string): Location {
  const raw = hash.replace(/^#/, '')
  const [path, qs = ''] = raw.split('?')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  return { parts, query: new URLSearchParams(qs), path: '/' + parts.join('/') }
}

function snapshot(): Location {
  const h = window.location.hash
  if (h !== cachedHash) ((cachedHash = h), (cachedLocation = parse(h)))
  return cachedLocation
}

export function useLocation(): Location {
  return useSyncExternalStore(subscribe, snapshot)
}

/** @deprecated use useLocation().parts */
export function useRoute(): string[] {
  return useLocation().parts
}

export function href(...parts: (string | number)[]): string {
  return '#/' + parts.map((p) => encodeURIComponent(String(p))).join('/')
}

export function withQuery(base: string, query: Record<string, string | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `${base}?${s}` : base
}

/** Navigate. `replace` swaps the current history entry (used when leaving a sheet). */
export function navigate(to: string, opts: { replace?: boolean; restore?: boolean } = {}) {
  if (opts.restore) restoreNext = true
  const hash = to.startsWith('#') ? to : '#' + to
  if (opts.replace) window.location.replace(hash)
  else window.location.hash = hash.slice(1)
}

// ── Scroll restoration ──────────────────────────────────────────────────────
// Back/forward and tab switches return to where you were; new pages start at the top.

const scroll = new Map<string, number>()
let restoreNext = false
let poppedAt = 0

if (typeof window !== 'undefined') {
  history.scrollRestoration = 'manual'
  window.addEventListener('popstate', () => (poppedAt = Date.now()))
  window.addEventListener('hashchange', (e) => {
    const from = parse(new URL(e.oldURL).hash)
    scroll.set(from.path, window.scrollY)
  })
}

/** Called after a route renders. `samePage` = only the query or map focus changed. */
export function settleScroll(path: string, samePage: boolean) {
  if (samePage) return
  const back = restoreNext || Date.now() - poppedAt < 400
  restoreNext = false
  const y = back ? (scroll.get(path) ?? 0) : 0
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
}
