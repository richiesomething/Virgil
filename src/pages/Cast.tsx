import { useMemo, useState } from 'react'
import type { Importance } from '../types'
import Icon from '../components/Icon'
import { initials } from '../components/CharacterChip'
import { Segmented, Sheet, Switch } from '../components/ui'
import MapView from '../components/MapView'
import { useBook } from '../lib/book-context'
import { href, navigate, withQuery } from '../lib/router'
import { currentAliases, currentTagline, isThing, kindOf, metCharacters } from '../lib/spoilers'
import { fold } from '../lib/search'

type Segment = 'people' | 'places' | 'things'
type Sort = 'appearance' | 'name' | 'recent'
const rank: Record<Importance, number> = { major: 0, supporting: 1, minor: 2 }

/** People · Places · Things, with the map one tap away. */
export default function Cast({ segment }: { segment: Segment }) {
  const { book, upTo } = useBook()
  const id = book.meta.id
  const met = metCharacters(book, upTo)
  const people = met.filter((c) => !isThing(c))
  const places = met.filter((c) => kindOf(c) === 'place')
  const things = met.filter((c) => kindOf(c) === 'object')
  const go = (s: Segment) => navigate(withQuery(href('b', id, 'cast'), { seg: s === 'people' ? undefined : s }), { replace: true })
  const current: Segment = segment === 'places' && !places.length ? 'people' : segment === 'things' && !things.length ? 'people' : segment

  return (
    <div>
      <div className="title-row">
        <h1 className="large-title">Cast</h1>
        {upTo > 0 && (
          <a className="pill-btn" href={href('b', id, 'map')}>
            <Icon name="map" className="icon--sm" /> Map
          </a>
        )}
      </div>
      <div className="sticky-sub">
        <Segmented<Segment>
          label="Cast sections"
          value={current}
          onChange={go}
          options={[
            { value: 'people', label: 'People', count: people.length },
            ...(places.length ? [{ value: 'places' as Segment, label: 'Places', count: places.length }] : []),
            ...(things.length ? [{ value: 'things' as Segment, label: 'Things', count: things.length }] : []),
          ]}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        {upTo === 0 ? (
          <div className="empty">
            <p>Set your bookmark to start meeting characters.</p>
          </div>
        ) : current === 'places' ? (
          <CharacterRows list={places} />
        ) : current === 'things' ? (
          <CharacterRows list={things} />
        ) : (
          <PeopleList />
        )}
      </div>
    </div>
  )
}

/** The relationship map, as its own screen pushed from Cast. */
export function MapScreen({ focusId }: { focusId?: string }) {
  const { upTo } = useBook()
  return (
    <div>
      <h1 className="page-title">Character map</h1>
      {upTo === 0 ? (
        <div className="empty">
          <p>Set your bookmark, and the map fills in as you meet characters.</p>
        </div>
      ) : (
        <MapView focusId={focusId} />
      )}
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
