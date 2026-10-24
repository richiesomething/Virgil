import { useMemo, useState } from 'react'
import type { Importance, Kind } from '../types'
import Icon from '../components/Icon'
import { initials } from '../components/CharacterChip'
import { Segmented, Sheet, Switch } from '../components/ui'
import MapView from '../components/MapView'
import { useBook } from '../lib/book-context'
import { href, navigate, withQuery } from '../lib/router'
import { currentAliases, currentTagline, isThing, kindOf, metCharacters } from '../lib/spoilers'
import { fold } from '../lib/search'

type Segment = 'people' | 'things' | 'map'
type Sort = 'appearance' | 'name' | 'recent'
const rank: Record<Importance, number> = { major: 0, supporting: 1, minor: 2 }

export default function Cast({ segment, focusId }: { segment: Segment; focusId?: string }) {
  const { book, upTo } = useBook()
  const id = book.meta.id
  const met = metCharacters(book, upTo)
  const people = met.filter((c) => !isThing(c))
  const things = met.filter(isThing)
  const go = (s: Segment) =>
    navigate(s === 'map' ? href('b', id, 'map') : withQuery(href('b', id, 'cast'), { seg: s === 'people' ? undefined : s }), { replace: true })

  return (
    <div>
      <h1 className="large-title">Cast</h1>
      <div className="sticky-sub">
        <Segmented<Segment>
          label="Cast sections"
          value={segment}
          onChange={go}
          options={[
            { value: 'people', label: 'People', count: people.length },
            ...(things.length ? [{ value: 'things' as Segment, label: 'Things', count: things.length }] : []),
            { value: 'map', label: 'Map' },
          ]}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        {upTo === 0 ? (
          <div className="empty">
            <p>Set your bookmark to start meeting characters.</p>
          </div>
        ) : segment === 'map' ? (
          <MapView focusId={focusId} />
        ) : segment === 'things' ? (
          <ThingsList />
        ) : (
          <PeopleList />
        )}
      </div>
    </div>
  )
}

function PeopleList() {
  const { book, upTo } = useBook()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [sort, setSort] = useState<Sort>('appearance')
  const [minor, setMinor] = useState(true)
  const [filters, setFilters] = useState(false)
  const people = metCharacters(book, upTo).filter((c) => !isThing(c))
  const groups = useMemo(() => [...new Set(people.map((c) => c.group))].sort(), [people])
  const active = (group ? 1 : 0) + (sort !== 'appearance' ? 1 : 0) + (minor ? 0 : 1)

  const fq = fold(q.trim())
  const shown = people
    .filter((c) => minor || c.importance !== 'minor')
    .filter((c) => !group || c.group === group)
    .filter((c) => !fq || [c.name, ...currentAliases(c, upTo)].some((s) => fold(s).includes(fq)))
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'recent'
          ? b.firstChapter - a.firstChapter
          : a.firstChapter - b.firstChapter || rank[a.importance] - rank[b.importance],
    )

  return (
    <>
      <div className="toolbar">
        <label className="field">
          <Icon name="search" className="icon--sm" />
          <input type="search" placeholder="Find a character" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a character" />
        </label>
        <button className="icon-btn icon-btn--surface" style={{ position: 'relative' }} onClick={() => setFilters(true)} aria-label={`Filters${active ? ` (${active} on)` : ''}`}>
          <Icon name="filter" />
          {active > 0 && <span className="badge-count">{active}</span>}
        </button>
      </div>
      <CharacterRows list={shown} />
      {shown.length === 0 && <p className="empty">No one matches.</p>}

      <Sheet open={filters} onClose={() => setFilters(false)} title="Filter people">
        <p className="group-title">Sort</p>
        <div className="group radio-list" role="radiogroup">
          {(
            [
              ['appearance', 'Order of appearance'],
              ['recent', 'Most recently met'],
              ['name', 'A–Z'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} className="row" role="radio" aria-checked={sort === v} onClick={() => setSort(v)}>
              {l}
            </button>
          ))}
        </div>
        <p className="group-title">Group</p>
        <div className="group radio-list" role="radiogroup">
          {['', ...groups].map((g) => (
            <button key={g || 'all'} className="row" role="radio" aria-checked={group === g} onClick={() => setGroup(g)}>
              {g || 'All groups'}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <Switch checked={minor} onChange={setMinor} label="Include minor characters" />
        </div>
        <button className="btn btn--primary btn--block" style={{ marginTop: 8 }} onClick={() => history.back()}>
          Show {shown.length} {shown.length === 1 ? 'person' : 'people'}
        </button>
      </Sheet>
    </>
  )
}

function ThingsList() {
  const { book, upTo } = useBook()
  const [kind, setKind] = useState<Kind | null>(null)
  const things = metCharacters(book, upTo).filter(isThing)
  const objects = things.filter((c) => kindOf(c) === 'object').length
  const places = things.length - objects
  const shown = things.filter((c) => !kind || kindOf(c) === kind)
  return (
    <>
      <div className="chips" style={{ margin: '0 -16px 4px' }}>
        <button className="chip-btn" aria-pressed={kind === null} onClick={() => setKind(null)}>
          All {things.length}
        </button>
        {objects > 0 && (
          <button className="chip-btn" aria-pressed={kind === 'object'} onClick={() => setKind(kind === 'object' ? null : 'object')}>
            ◆ Objects {objects}
          </button>
        )}
        {places > 0 && (
          <button className="chip-btn" aria-pressed={kind === 'place'} onClick={() => setKind(kind === 'place' ? null : 'place')}>
            ■ Places {places}
          </button>
        )}
      </div>
      <CharacterRows list={shown} />
    </>
  )
}

function CharacterRows({ list }: { list: ReturnType<typeof metCharacters> }) {
  const { book, upTo } = useBook()
  if (!list.length) return null
  return (
    <div className="group" style={{ marginTop: 12 }}>
      {list.map((c) => (
        <a key={c.id} className="row row--avatar" href={href('b', book.meta.id, 'characters', c.id)} style={{ minHeight: 64 }}>
          <span className={`avatar avatar--${c.importance} avatar--${kindOf(c)}`} aria-hidden="true">
            {initials(c.name)}
          </span>
          <span className="row__body">
            <span className="row__title">{c.name}</span>
            <span className="row__sub clamp-1">{currentTagline(c, upTo)}</span>
          </span>
          {c.firstChapter === upTo && <span className="tag tag--new">New</span>}
        </a>
      ))}
    </div>
  )
}
