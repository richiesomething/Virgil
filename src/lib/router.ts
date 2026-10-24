import { useSyncExternalStore } from 'react'

// Hash routing: GitHub Pages has no server-side fallback for client routes.
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export function href(...parts: (string | number)[]): string {
  return '#/' + parts.map((p) => encodeURIComponent(String(p))).join('/')
}

export function navigate(to: string) {
  window.location.hash = to.replace(/^#/, '')
}
