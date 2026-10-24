import { useMemo, useState } from 'react'
import type { BookPageProps } from './BookShell'
import type { Importance } from '../types'
import { href } from '../lib/router'
import { currentAliases, currentTagline, metCharacters } from '../lib/spoilers'
import { initials } from '../components/CharacterChip'

type Sort = 'appearance' | 'name' | 'recent'
const importanceRank: Record<Importance, number> = { major: 0, supporting: 1, minor: 2 }

export default function CharacterList({ book, upTo }: BookPageProps) {
  const { meta } = book
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [sort, setSort] = useState<Sort>('appearance')
  const [minorToo, setMinorToo] = useState(true)

  const met = metCharacters(book, upTo)
  const groups = useMemo(() => [...new Set(met.map((c) => c.group))].sort(), [met])

  const q = query.trim().toLowerCase()
  const shown = met
    .filter((c) => minorToo || c.importance !== 'minor')
    .filter((c) => !group || c.group === group)
    .filter(
      (c) =>
        !q ||
        [c.name, ...currentAliases(c, upTo), currentTagline(c, upTo)].some((s) =>
          s.toLowerCase().includes(q),
        ),
    )
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'recent') return b.firstChapter - a.firstChapter
      return a.firstChapter - b.firstChapter || importanceRank[a.importance] - importanceRank[b.importance]
    })

  return (
    <div>
      <h1 className="page-title">Characters</h1>
      <p className="muted">
        {met.length} character{met.length === 1 ? '' : 's'} met through chapter {upTo}. Profiles
        only include what you’ve read so far.
      </p>

      {met.length === 0 ? (
        <p className="empty">Set your bookmark to start meeting characters.</p>
      ) : (
        <>
          <div className="filters">
            <input
              className="input"
              type="search"
              placeholder="Search names, nicknames, titles…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search characters"
            />
            <select className="input" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter by group">
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
              <option value="appearance">Order of appearance</option>
              <option value="recent">Most recently met</option>
              <option value="name">A–Z</option>
            </select>
            <label className="check">
              <input type="checkbox" checked={minorToo} onChange={(e) => setMinorToo(e.target.checked)} />
              Include minor characters
            </label>
          </div>

          <ul className="character-list">
            {shown.map((c) => {
              const aliases = currentAliases(c, upTo)
              return (
                <li key={c.id}>
                  <a className="character-row" href={href('b', meta.id, 'characters', c.id)}>
                    <span className={`avatar avatar--${c.importance}`} aria-hidden="true">{initials(c.name)}</span>
                    <span className="character-row__body">
                      <span className="character-row__name">
                        {c.name}
                        {c.firstChapter === upTo && <span className="badge">New</span>}
                      </span>
                      {aliases.length > 0 && (
                        <span className="character-row__aliases">also: {aliases.join(', ')}</span>
                      )}
                      <span className="character-row__tagline">{currentTagline(c, upTo)}</span>
                    </span>
                    <span className="character-row__meta">
                      <span>Ch. {c.firstChapter}</span>
                      <span className="muted">{c.group}</span>
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
          {shown.length === 0 && <p className="muted">No characters match.</p>}
        </>
      )}
    </div>
  )
}
