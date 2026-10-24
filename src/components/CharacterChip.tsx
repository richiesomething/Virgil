import type { Character } from '../types'
import { href } from '../lib/router'

export default function CharacterChip({ bookId, c, isNew }: { bookId: string; c: Character; isNew?: boolean }) {
  return (
    <a className={`chip chip--${c.importance}`} href={href('b', bookId, 'characters', c.id)}>
      <span className="avatar avatar--sm" aria-hidden="true">{initials(c.name)}</span>
      {c.name}
      {isNew && <span className="badge">New</span>}
    </a>
  )
}

export function initials(name: string): string {
  const words = name
    .replace(/^(the|m\.|mme\.|mlle\.|monsieur|madame|mademoiselle|signor|abbé|count|countess|baron|baroness|major|dr\.|lord|king|duc|marquis|marquise)\s+/i, '')
    .split(/[\s-]+/)
    .filter((w) => /^[A-ZÀ-Ý]/.test(w))
  return ((words[0]?.[0] ?? name[0]) + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}
