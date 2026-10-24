import { useEffect, useMemo, useState } from 'react'
import type { BookPageProps } from './BookShell'
import type { RelationType } from '../types'
import CharacterMap from '../components/CharacterMap'
import { href, navigate } from '../lib/router'
import { connections, currentTagline, displayId, familyAnchors, isThing, kindOf, kinRole, metCharacters } from '../lib/spoilers'
import { kinLabel, relationLabel, relationTypes } from '../lib/relations'

type Scope = 'major' | 'main' | 'all'

// Node positions survive leaving and re-opening the map.
const layoutCache = new Map<string, Map<string, { x: number; y: number }>>()

export default function MapPage({ book, upTo, focusId }: BookPageProps & { focusId?: string }) {
  const { meta } = book
  const [asOf, setAsOf] = useState(upTo)
  useEffect(() => setAsOf(upTo), [upTo])

  const met = metCharacters(book, asOf)
  // Start small for big casts; readers can widen it.
  const [scope, setScope] = useState<Scope>(() => {
    const n = metCharacters(book, upTo).filter((c) => !isThing(c)).length
    return n > 50 ? 'major' : n > 30 ? 'main' : 'all'
  })
  const [group, setGroup] = useState('')
  const [hidden, setHidden] = useState<Set<RelationType>>(new Set())
  // Objects and places are opt-in so the map isn't crowded.
  const [showObjects, setShowObjects] = useState(false)
  const [showPlaces, setShowPlaces] = useState(false)
  // Family view: only family ties and marriages, laid out by generation.
  const [familyOnly, setFamilyOnly] = useState(false)
  const objectCount = met.filter((c) => kindOf(c) === 'object').length
  const placeCount = met.filter((c) => kindOf(c) === 'place').length
  const kindShown = (k: string) => k === 'character' || (k === 'object' && showObjects) || (k === 'place' && showPlaces)

  // A focus id in the URL may name a disguise the reader has since seen through.
  const selected = focusId ? (displayId(book, focusId, asOf) ?? null) : null
  const select = (id: string | null) => navigate(id ? href('b', meta.id, 'map', id) : href('b', meta.id, 'map'))

  const all = useMemo(() => connections(book, asOf), [book, asOf])
  const groups = [...new Set(met.filter((c) => kindShown(kindOf(c))).map((c) => c.group))].sort()

  const inScope = met.filter(
    (c) =>
      (familyOnly
        ? !isThing(c)
        : kindShown(kindOf(c)) &&
          (isThing(c) || scope === 'all' || c.importance === 'major' || (scope === 'main' && c.importance === 'supporting'))) &&
      (!group || c.group === group),
  )
  const scopeIds = new Set(inScope.map((c) => c.id))
  if (selected) scopeIds.add(selected)
  const isFamily = (l: (typeof all)[number]) => !!l.kin || l.type === 'family'
  const shownLinks = all.filter(
    (l) => (familyOnly ? isFamily(l) : !hidden.has(l.type)) && scopeIds.has(l.a) && scopeIds.has(l.b),
  )
  // Narrow screens stack family blocks in a narrower column so they stay readable.
  const anchors = familyOnly ? familyAnchors(shownLinks, window.innerWidth < 600 ? 420 : 900) : undefined
  const linked = new Set(shownLinks.flatMap((l) => [l.a, l.b]))
  if (selected) linked.add(selected)
  const shownCharacters = met.filter((c) => linked.has(c.id))

  const positions = layoutCache.get(meta.id) ?? new Map()
  layoutCache.set(meta.id, positions)

  const byId = new Map(book.characters.map((c) => [c.id, c]))
  const sel = selected ? byId.get(selected) : undefined
  const selLinks = selected
    ? all
        .filter((l) => l.a === selected || l.b === selected)
        .sort((p, q) => relationTypes.findIndex((r) => r.type === p.type) - relationTypes.findIndex((r) => r.type === q.type))
    : []

  const pickPerson = (id: string) => {
    const c = byId.get(id)
    if (c && !inScope.some((x) => x.id === id)) {
      if (kindOf(c) === 'object') setShowObjects(true)
      else if (kindOf(c) === 'place') setShowPlaces(true)
      else setScope('all')
      setGroup('')
    }
    select(id)
  }

  if (upTo === 0 || met.length === 0) {
    return (
      <div className="empty">
        <h1>No map yet</h1>
        <p>Set your bookmark, and the map will fill in as you meet characters.</p>
      </div>
    )
  }

  return (
    <div className="map-page">
      <div className="map-page__head">
        <h1 className="page-title">Character map</h1>
        <p className="muted">
          Who’s who and how they’re connected, as of chapter {asOf}. Drag to move, scroll or pinch to zoom.
        </p>
      </div>

      <div className="filters">
        <button
          className={'legend__item family-toggle' + (familyOnly ? ' is-on' : '')}
          aria-pressed={familyOnly}
          onClick={() => setFamilyOnly(!familyOnly)}
        >
          <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
            <circle cx="8" cy="3" r="2.4" /><circle cx="3" cy="11" r="2.4" /><circle cx="13" cy="11" r="2.4" />
            <path d="M8 5.4V8M3 8h10M3 8v.6M13 8v.6" fill="none" strokeWidth="1.4" />
          </svg>
          Family only
        </button>
        {!familyOnly && (
        <select className="input" value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label="Which characters">
          <option value="major">Major characters</option>
          <option value="main">Major & supporting</option>
          <option value="all">Everyone</option>
        </select>
        )}
        <select className="input" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter by group">
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>

      {upTo > 1 && (
        <label className="timeline-slider">
          <span>
            Replay: chapter <strong>{asOf}</strong>
            {asOf < upTo && (
              <button className="link-btn" onClick={() => setAsOf(upTo)}>
                back to ch. {upTo}
              </button>
            )}
          </span>
          <input
            type="range"
            min={1}
            max={upTo}
            value={asOf}
            onChange={(e) => setAsOf(Number(e.target.value))}
            aria-label="Show the map as of chapter"
          />
        </label>
      )}

      {familyOnly && (
        <p className="small muted family-note">
          Showing family ties and marriages for everyone you’ve met, with parents above their children.
        </p>
      )}

      {!familyOnly && (objectCount > 0 || placeCount > 0) && (
        <div className="also-show" role="group" aria-label="Also show">
          <span>Also show:</span>
          {objectCount > 0 && (
            <button className={'legend__item' + (showObjects ? '' : ' is-off')} aria-pressed={showObjects} onClick={() => setShowObjects(!showObjects)}>
              <span className="shape shape--object" aria-hidden="true" /> Objects ({objectCount})
            </button>
          )}
          {placeCount > 0 && (
            <button className={'legend__item' + (showPlaces ? '' : ' is-off')} aria-pressed={showPlaces} onClick={() => setShowPlaces(!showPlaces)}>
              <span className="shape shape--place" aria-hidden="true" /> Places ({placeCount})
            </button>
          )}
        </div>
      )}

      {!familyOnly && (
      <div className="legend" role="group" aria-label="Relationship types">
        {relationTypes.filter((r) => r.type !== 'tie' || showObjects || showPlaces).map((r) => {
          const off = hidden.has(r.type)
          return (
            <button
              key={r.type}
              className={'legend__item' + (off ? ' is-off' : '')}
              aria-pressed={!off}
              onClick={() => {
                const next = new Set(hidden)
                if (off) next.delete(r.type)
                else next.add(r.type)
                setHidden(next)
              }}
            >
              <svg width="28" height="10" aria-hidden="true">
                <line x1="2" y1="5" x2="26" y2="5" className={`rel rel--${r.type}`} strokeDasharray={r.dash} />
              </svg>
              {r.label}
            </button>
          )
        })}
      </div>
      )}

      <div className="map-layout">
        {shownCharacters.length ? (
          <CharacterMap
            characters={shownCharacters}
            connections={shownLinks}
            selected={selected}
            onSelect={select}
            positions={positions}
            anchors={anchors}
          />
        ) : (
          <div className="map map--empty">
            <p className="muted">No relationships to show with these filters.</p>
          </div>
        )}

        <aside className="map-panel card" aria-live="polite">
          {sel ? (
            <>
              <p className="eyebrow">{sel.group}</p>
              <h2>{sel.name}</h2>
              <p className="muted">{currentTagline(sel, asOf)}</p>
              <a className="link-more" href={href('b', meta.id, 'characters', sel.id)}>
                Open profile →
              </a>
              <h3 className="map-panel__title">
                {selLinks.length} relationship{selLinks.length === 1 ? '' : 's'}
              </h3>
              <ul className="rel-list">
                {selLinks.map((l) => {
                  const other = byId.get(l.a === sel.id ? l.b : l.a)!
                  return (
                    <li key={other.id}>
                      <svg width="20" height="10" aria-hidden="true">
                        <line x1="1" y1="5" x2="19" y2="5" className={`rel rel--${l.type}`} strokeDasharray={relationTypes.find((r) => r.type === l.type)?.dash} />
                      </svg>
                      <span>
                        <button className="link-btn" onClick={() => pickPerson(other.id)}>
                          {other.name}
                        </button>
                        <span className="small muted"> · {kinRole(l, other.id) ? kinLabel[kinRole(l, other.id)!] : relationLabel[l.type]}</span>
                        <br />
                        <span className="small">{l.label}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <>
              <p className="eyebrow">How to use</p>
              <p>Tap a character to see their relationships. Tap a line’s name in the list to jump to that person.</p>
              <p className="small muted">
                Showing {shownCharacters.length} characters and {shownLinks.length} relationships. Only what you’ve
                read through chapter {asOf} appears here.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
