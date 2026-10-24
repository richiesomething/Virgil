import type { BookData, BookMeta } from '../types'
import { meta as monteCristo } from './monte-cristo/meta'
import { meta as harryPotter1 } from './harry-potter-1/meta'
import { meta as thePearl } from './the-pearl/meta'

/** Metadata for every book in the library (cheap; loaded up front). */
export const library: BookMeta[] = [monteCristo, harryPotter1, thePearl]

/** Full book data is code-split so the library stays fast as it grows. */
const loaders: Record<string, () => Promise<{ default: BookData }>> = {
  'monte-cristo': () => import('./monte-cristo/data'),
  'harry-potter-1': () => import('./harry-potter-1/data'),
  'the-pearl': () => import('./the-pearl/data'),
}

const cache = new Map<string, Promise<BookData>>()

export function loadBook(id: string): Promise<BookData> | undefined {
  const loader = loaders[id]
  if (!loader) return undefined
  if (!cache.has(id)) cache.set(id, loader().then((m) => m.default))
  return cache.get(id)
}
