import { useEffect, useMemo, useState } from 'react'
import type { RelationType } from '../types'
import CharacterMap from './CharacterMap'
import Icon from './Icon'
import { initials } from './CharacterChip'
import { Sheet, Switch, leaveSheetTo } from './ui'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { connections, currentTagline, displayId, familyAnchors, isThing, kindOf, kinRole, metCharacters } from '../lib/spoilers'
import { kinLabel, relationLabel, relationTypes } from '../lib/relations'

type Scope = 'major' | 'main' | 'all'

// Node positions survive leaving and re-opening the map.
const layoutCache = new Map<string, Map<string, { x: number; y: number }>>()

export default function MapView({ focusId }: { focusId?: string }) {
  const { book, upTo } = useBook()
  const { meta } = book
  const [asOf, setAsOf] = useState(upTo)
  useEffect(() => setAsOf(upTo), [upTo])

  const met = metCharacters(book, asOf)
  const [scope, setScope] = useState<Scope>(() => {
    const n = metCharacters(book, upTo).filter((c) => !isThing(c)).length
    return n > 50 ? 'major' : n > 30 ? 'main' : 'all'
  })
  const [group, setGroup] = useState('')
  const [hidden, setHidden] = useState<Set<RelationType>>(new Set())
  const [showObjects, setShowObjects] = useState(false)
  const [showPlaces, setShowPlaces] = useState(false)
  const [familyOnly, setFamilyOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(() => (focusId ? (displayId(book, focusId, upTo) ?? null) : null))
  const [detailOpen, setDetailOpen] = useState(() => !!focusId)

  const objectCount = met.filter((c) => kindOf(c) === 'object').length
  const placeCount = met.filter((c) => kindOf(c) === 'place').length
  const kindShown = (k: string) => k === 'character' || (k === 'object' && showObjects) || (k === 'place' && showPlaces)
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
  const sel = selected && met.some((c) => c.id === selected) ? selected : null
  if (sel) scopeIds.add(sel)
  const isFamily = (l: (typeof all)[number]) => !!l.kin || l.type === 'family'
  const shownLinks = all.filter((l) => (familyOnly ? isFamily(l) : !hidden.has(l.type)) && scopeIds.has(l.a) && scopeIds.has(l.b))
  const linked = new Set(shownLinks.flatMap((l) => [l.a, l.b]))
  if (sel) linked.add(sel)
  const shownCharacters = met.filter((c) => linked.has(c.id))
  const anchors = familyOnly ? familyAnchors(shownLinks, window.innerWidth < 600 ? 420 : 900) : undefined

  const positions = layoutCache.get(meta.id) ?? new Map()
  layoutCache.set(meta.id, positions)

  const byId = new Map(book.characters.map((c) => [c.id, c]))
  const selChar = sel ? byId.get(sel) : undefined
  const selLinks = sel
    ? all
        .filter((l) => l.a === sel || l.b === sel)
        .sort((p, q) => relationTypes.findIndex((r) => r.type === p.type) - relationTypes.findIndex((r) => r.type === q.type))
    : []
  const activeFilters = (familyOnly ? 1 : 0) + (group ? 1 : 0) + hidden.size + (showObjects ? 1 : 0) + (showPlaces ? 1 : 0)

  const pick = (cid: string | null) => {
    setSelected(cid)
    if (cid) setDetailOpen(true)
  }
  const pickPerson = (cid: string) => {
    const c = byId.get(cid)
    if (c && !inScope.some((x) => x.id === cid)) {
      if (kindOf(c) === 'object') setShowObjects(true)
      else if (kindOf(c) === 'place') setShowPlaces(true)
      else setScope('all')
      setGroup('')
      setFamilyOnly(false)
    }
    setSelected(cid)
  }

  return (
    <div className="map-screen">
      <div className="map">
        {shownCharacters.length ? (
          <CharacterMap characters={shownCharacters} connections={shownLinks} selected={sel} onSelect={pick} positions={positions} anchors={anchors} />
        ) : (
          <div className="map--empty" style={{ height: '100%' }}>
            <p className="muted">No relationships to show with these filters.</p>
          </div>
        )}

        <div className="map__float map__float--tl">
          {!familyOnly && (
            <label className="pill-btn pill-select">
              {scope === 'major' ? 'Major' : scope === 'main' ? 'Main' : 'Everyone'}
              <Icon name="chevronDown" className="icon--sm" />
              <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label="Which characters">
                <option value="major">Major characters</option>
                <option value="main">Major & supporting</option>
                <option value="all">Everyone</option>
              </select>
            </label>
          )}
          <button className="pill-btn" aria-pressed={familyOnly} onClick={() => setFamilyOnly(!familyOnly)}>
            <Icon name="family" className="icon--sm" /> Family
          </button>
        </div>
        <div className="map__float map__float--tr">
          <button className="pill-btn" onClick={() => setFiltersOpen(true)} aria-label={`Map filters${activeFilters ? ` (${activeFilters} on)` : ''}`}>
            <Icon name="filter" className="icon--sm" /> Filters
            {activeFilters > 0 && <span className="badge-count" style={{ top: -6, right: -6 }}>{activeFilters}</span>}
          </button>
        </div>

        {upTo > 1 && (
          <div className="map__dock">
            <span style={{ minWidth: 48 }}>Ch {asOf}</span>
            <input type="range" min={1} max={upTo} value={asOf} onChange={(e) => setAsOf(Number(e.target.value))} aria-label="Show the map as of chapter" />
            {asOf < upTo && (
              <button className="link" style={{ minHeight: 36 }} onClick={() => setAsOf(upTo)}>
                Now
              </button>
            )}
          </div>
        )}
      </div>
      <p className="small muted" style={{ margin: '8px 4px 0' }}>
        {familyOnly
          ? 'Family ties and marriages, with parents above their children.'
          : `${shownCharacters.length} characters · ${shownLinks.length} relationships · drag, pinch or tap someone.`}
      </p>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Map filters">
        <Switch checked={familyOnly} onChange={setFamilyOnly} label="Family only" />
        {(objectCount > 0 || placeCount > 0) && !familyOnly && (
          <>
            <p className="group-title">Also show</p>
            {objectCount > 0 && <Switch checked={showObjects} onChange={setShowObjects} label={`◆ Objects (${objectCount})`} />}
            {placeCount > 0 && <Switch checked={showPlaces} onChange={setShowPlaces} label={`■ Places (${placeCount})`} />}
          </>
        )}
        {!familyOnly && (
          <>
            <p className="group-title">Relationships</p>
            {relationTypes
              .filter((r) => r.type !== 'tie' || showObjects || showPlaces)
              .map((r) => (
                <label key={r.type} className="legend-switch">
                  <span className="label">
                    <svg width="28" height="10" aria-hidden="true">
                      <line x1="2" y1="5" x2="26" y2="5" className={`rel rel--${r.type}`} strokeDasharray={r.dash} />
                    </svg>
                    {r.label}
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="switch"
                    checked={!hidden.has(r.type)}
                    onChange={() => {
                      const next = new Set(hidden)
                      if (next.has(r.type)) next.delete(r.type)
                      else next.add(r.type)
                      setHidden(next)
                    }}
                  />
                </label>
              ))}
          </>
        )}
        <p className="group-title">Group</p>
        <div className="group radio-list" role="radiogroup">
          {['', ...groups].map((g) => (
            <button key={g || 'all'} className="row" role="radio" aria-checked={group === g} onClick={() => setGroup(g)}>
              {g || 'All groups'}
            </button>
          ))}
        </div>
        <button className="btn btn--primary btn--block" style={{ marginTop: 16 }} onClick={() => history.back()}>
          Done
        </button>
      </Sheet>

      <Sheet open={detailOpen && !!selChar} onClose={() => setDetailOpen(false)} label={selChar?.name ?? 'Character'}>
        {selChar && (
          <>
            <div className="profile-head" style={{ marginTop: 0 }}>
              <span className={`avatar avatar--${selChar.importance} avatar--${kindOf(selChar)}`} aria-hidden="true">
                {initials(selChar.name)}
              </span>
              <div>
                <h2 style={{ fontSize: '1.5rem' }}>{selChar.name}</h2>
                <p className="small muted" style={{ margin: 0 }}>
                  {currentTagline(selChar, asOf)}
                </p>
              </div>
            </div>
            <button className="link" onClick={() => leaveSheetTo(href('b', meta.id, 'characters', selChar.id))}>
              Open profile <Icon name="chevronRight" className="icon--sm" />
            </button>
            <p className="group-title">
              {selLinks.length} relationship{selLinks.length === 1 ? '' : 's'}
            </p>
            <ul className="rel-list">
              {selLinks.map((l) => {
                const other = byId.get(l.a === selChar.id ? l.b : l.a)!
                const role = kinRole(l, other.id)
                return (
                  <li key={other.id}>
                    <button onClick={() => pickPerson(other.id)}>
                      <svg width="20" height="10" aria-hidden="true">
                        <line x1="1" y1="5" x2="19" y2="5" className={`rel rel--${l.type}`} strokeDasharray={relationTypes.find((r) => r.type === l.type)?.dash} />
                      </svg>
                      <span>
                        <span className="who">{other.name}</span>
                        <span className="small muted"> · {role ? kinLabel[role] : relationLabel[l.type]}</span>
                        <br />
                        <span className="small">{l.label}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Sheet>
    </div>
  )
}
