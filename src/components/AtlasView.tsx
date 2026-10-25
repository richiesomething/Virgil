import { useEffect, useMemo, useState } from 'react'
import type { Place } from '../types'
import AtlasMap, { type JourneyMode } from './AtlasMap'
import Icon from './Icon'
import { initials } from './CharacterChip'
import { Sheet, Switch, leaveSheetTo } from './ui'
import { useBook } from '../lib/book-context'
import { href, navigate, useLocation, withQuery } from '../lib/router'
import {
  bestFrame,
  chapterSettings,
  chaptersAt,
  currentPlace,
  frameById,
  offMapPlaces,
  peopleAt,
  placeAt,
  placeTagline,
  positionIn,
  precisionLabel,
  unlockedFrames,
  visibleJourneys,
} from '../lib/atlas'

/** Link into the Atlas (Cast → Places → Map), optionally focused on a place or frame. */
export function atlasHref(bookId: string, opts: { place?: string; frame?: string } = {}) {
  return withQuery(href('b', bookId, 'cast'), { seg: 'places', view: 'map', place: opts.place, frame: opts.frame })
}

export function chapterRange(chs: number[]): string {
  if (!chs.length) return ''
  const runs: string[] = []
  let start = chs[0]
  let prev = chs[0]
  for (const c of [...chs.slice(1), Infinity]) {
    if (c === prev + 1) {
      prev = c
      continue
    }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`)
    start = prev = c
  }
  return (chs.length === 1 ? 'Ch ' : 'Chs ') + runs.join(', ')
}

const credit = (geo: boolean, osm: boolean) => (geo ? (osm ? 'Map data: Natural Earth; © OpenStreetMap contributors' : 'Map data: Natural Earth') : '')
const OSM_FRAMES = new Set(['marseilles', 'paris', 'rome', 'london'])

export default function AtlasView() {
  const { book, upTo } = useBook()
  const id = book.meta.id
  const loc = useLocation()
  const qPlace = loc.query.get('place')
  const qFrame = loc.query.get('frame')

  const [asOf, setAsOf] = useState(upTo)
  useEffect(() => setAsOf(upTo), [upTo])
  const [showMentioned, setShowMentioned] = useState(true)
  const [journeys, setJourneys] = useState<JourneyMode>('recent')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(qPlace)
  const [sheetOpen, setSheetOpen] = useState(!!qPlace)

  const frames = useMemo(() => unlockedFrames(book, asOf), [book, asOf])
  const here = currentPlace(book, asOf)
  const focusPlace = qPlace ? placeAt(book, qPlace, upTo) : undefined
  const defaultFrame = (focusPlace && bestFrame(book, focusPlace, asOf)) || (here && bestFrame(book, here, asOf)) || frames[0]
  const frame = (qFrame && frames.find((f) => f.id === qFrame)) || defaultFrame
  const highlight = chapterSettings(book, asOf, asOf).map((p) => p.id)
  const offMap = offMapPlaces(book, asOf)

  const setFrame = (frameId: string, place?: string) =>
    navigate(withQuery(href('b', id, 'cast'), { seg: 'places', view: 'map', frame: frameId, place }), { replace: true })

  const select = (pid: string | null) => {
    setSelected(pid)
    if (pid) setSheetOpen(true)
  }

  if (!frame) {
    return (
      <div className="empty">
        <p>Places appear on the map as the story reaches them.</p>
      </div>
    )
  }

  const sel = selected ? placeAt(book, selected, asOf) : undefined
  const parent = frame.parent ? frameById(book, frame.parent) : undefined

  return (
    <div className="atlas-screen">
      <div className="atlas-stage">
        <AtlasMap
          book={book}
          frame={frame}
          asOf={asOf}
          selected={sel?.id ?? null}
          onSelect={select}
          onFrame={(f) => setFrame(f)}
          highlight={highlight}
          here={here?.id}
          showMentioned={showMentioned}
          journeys={journeys}
          focus={qPlace ?? undefined}
        />

        <div className="atlas-top">
          <button className="pill-btn atlas-list" onClick={() => navigate(withQuery(href('b', id, 'cast'), { seg: 'places' }), { replace: true })}>
            <Icon name="list" className="icon--sm" /> List
          </button>
          <div className="atlas-frames" role="tablist" aria-label="Maps">
            {frames.map((f) => (
              <button key={f.id} role="tab" aria-selected={f.id === frame.id} className="atlas-chip" onClick={() => setFrame(f.id)}>
                {f.short}
              </button>
            ))}
          </div>
          <button className="pill-btn atlas-filter" onClick={() => setFiltersOpen(true)} aria-label="Map options">
            <Icon name="layers" className="icon--sm" />
          </button>
        </div>
        {parent && (
          <button className="pill-btn atlas-up" onClick={() => setFrame(parent.id)}>
            <Icon name="back" className="icon--sm" /> {parent.short}
          </button>
        )}

        {upTo > 1 && (
          <div className="map__dock atlas-dock">
            <span className="atlas-dock__label">
              Ch {asOf}
              {here ? <span className="muted"> · {here.name}</span> : null}
            </span>
            <input type="range" min={1} max={upTo} value={asOf} onChange={(e) => setAsOf(Number(e.target.value))} aria-label="Show the map as of chapter" />
            {asOf < upTo && (
              <button className="link" style={{ minHeight: 36 }} onClick={() => setAsOf(upTo)}>
                Now
              </button>
            )}
          </div>
        )}
        {frame.type === 'geo' && <span className="atlas-credit">{credit(true, OSM_FRAMES.has(frame.id))}</span>}
      </div>

      <PlaceSheet place={sel} asOf={asOf} open={sheetOpen && !!sel} onClose={() => setSheetOpen(false)} onFrame={setFrame} currentFrame={frame.id} />

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Map options">
        <p className="muted small" style={{ marginTop: 0 }}>
          <strong>{frame.title}.</strong> {frame.note}
        </p>
        <Switch checked={showMentioned} onChange={setShowMentioned} label="Places only mentioned (small dots)" />
        <p className="group-title">Journeys</p>
        <div className="group radio-list" role="radiogroup">
          {(
            [
              ['recent', 'Recent chapters'],
              ['all', 'Every journey so far'],
              ['none', 'Hide journeys'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} className="row" role="radio" aria-checked={journeys === v} onClick={() => setJourneys(v)}>
              {l}
            </button>
          ))}
        </div>
        <Legend />
        {offMap.length > 0 && (
          <>
            <p className="group-title">Not on these maps</p>
            <div className="group">
              {offMap.map((p) => (
                <button key={p.id} className="row" onClick={() => leaveSheetTo(href('b', id, 'places', p.id))}>
                  <span className="row__body">
                    <span className="row__title">{p.name}</span>
                    <span className="row__sub clamp-1">{p.precision === 'unknown' ? 'The book never says where' : placeTagline(p, asOf)}</span>
                  </span>
                  <Icon name="chevronRight" className="icon--sm chev" />
                </button>
              ))}
            </div>
          </>
        )}
        <button className="btn btn--primary btn--block" style={{ marginTop: 16 }} onClick={() => history.back()}>
          Done
        </button>
      </Sheet>
    </div>
  )
}

function Legend() {
  return (
    <div className="atlas-legend" aria-label="Legend">
      <span>
        <svg width="16" height="20" viewBox="-8 -18 16 20" aria-hidden="true">
          <path className="atlas-place__pin" d="M0 0c-1-4.5-7.5-8.6-7.5-14a7.5 7.5 0 0 1 15 0c0 5.4-6.5 9.5-7.5 14Z" />
        </svg>
        Scene
      </span>
      <span>
        <svg width="16" height="20" viewBox="-8 -18 16 20" aria-hidden="true">
          <path className="atlas-place__pin atlas-legend__gold" d="M0 0c-1-4.5-7.5-8.6-7.5-14a7.5 7.5 0 0 1 15 0c0 5.4-6.5 9.5-7.5 14Z" />
        </svg>
        This chapter
      </span>
      <span>
        <svg width="12" height="12" aria-hidden="true">
          <circle className="atlas-place__dot" cx="6" cy="6" r="4.5" />
        </svg>
        Mentioned
      </span>
      <span>
        <svg width="18" height="18" aria-hidden="true">
          <circle className="atlas-place__area" cx="9" cy="9" r="7.5" />
        </svg>
        Approximate
      </span>
      <span>
        <svg width="26" height="8" aria-hidden="true">
          <line x1="1" y1="4" x2="25" y2="4" className="atlas-leg atlas-leg--water is-recent" />
        </svg>
        By sea
      </span>
      <span>
        <svg width="26" height="8" aria-hidden="true">
          <line x1="1" y1="4" x2="25" y2="4" className="atlas-leg atlas-leg--land is-recent" />
        </svg>
        Over land
      </span>
    </div>
  )
}

/** Close the open sheet, then run fn once its history entry is gone. */
function afterBack(fn: () => void) {
  const h = () => {
    window.removeEventListener('popstate', h)
    setTimeout(fn, 0)
  }
  window.addEventListener('popstate', h)
  history.back()
}

/** The bottom sheet for a tapped place. */
export function PlaceSheet({
  place,
  asOf,
  open,
  onClose,
  onFrame,
  currentFrame,
}: {
  place?: Place
  asOf: number
  open: boolean
  onClose: () => void
  onFrame?: (frameId: string, place?: string) => void
  currentFrame?: string
}) {
  const { book } = useBook()
  const id = book.meta.id
  if (!place) return null
  const chs = chaptersAt(book, place.id, asOf)
  const people = peopleAt(book, place.id, asOf)
  const otherFrames = unlockedFrames(book, asOf).filter((f) => f.id !== currentFrame && positionIn(f, place))
  const parent = place.parent ? placeAt(book, place.parent, asOf) : undefined
  const legs = visibleJourneys(book, asOf).flatMap((j) => j.legs.filter((l) => l.fromPlace.id === place.id || l.toPlace.id === place.id).map((l) => ({ ...l, who: j.who })))
  return (
    <Sheet open={open} onClose={onClose} label={place.name}>
      <div className="place-head">
        <span className="avatar avatar--place" aria-hidden="true">
          <Icon name="pin" />
        </span>
        <div>
          <h2 style={{ fontSize: '1.5rem' }}>{place.name}</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {placeTagline(place, asOf)}
          </p>
        </div>
      </div>
      <p className="place-tags">
        <span className={`tag tag--${place.precision}`}>{precisionLabel[place.precision]}</span>
        {parent && (
          <a className="tag" onClick={(e) => (e.preventDefault(), leaveSheetTo(href('b', id, 'places', parent.id)))} href={href('b', id, 'places', parent.id)}>
            In {parent.name}
          </a>
        )}
      </p>
      {chs.length > 0 && (
        <>
          <p className="group-title">Scenes here · {chapterRange(chs)}</p>
          <div className="chips">
            {chs.slice(-12).map((n) => (
              <button key={n} className="chip-btn" onClick={() => leaveSheetTo(href('b', id, 'chapters', n))}>
                Ch {n}
              </button>
            ))}
          </div>
        </>
      )}
      {people.length > 0 && (
        <>
          <p className="group-title">People here</p>
          <div className="people-strip">
            {people.slice(0, 10).map((c) => (
              <button key={c.id} onClick={() => leaveSheetTo(href('b', id, 'characters', c.id))} aria-label={c.name}>
                <span className={`avatar avatar--sm avatar--${c.importance}`} aria-hidden="true">
                  {initials(c.name)}
                </span>
                <span className="name">{c.name}</span>
              </button>
            ))}
            {people.length > 10 && <span className="small muted">+{people.length - 10}</span>}
          </div>
        </>
      )}
      {legs.length > 0 && (
        <>
          <p className="group-title">Journeys</p>
          <ul className="leg-list">
            {legs.slice(-4).map((l, i) => (
              <li key={i}>
                <span className="muted">Ch {l.chapter}</span> {l.journey.name}: {l.fromPlace.name} → {l.toPlace.name}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="place-actions">
        <button className="btn btn--primary" onClick={() => leaveSheetTo(href('b', id, 'places', place.id))}>
          Open place
        </button>
        {otherFrames.map((f) => (
          <button key={f.id} className="btn btn--secondary" onClick={() => afterBack(() => onFrame?.(f.id, place.id))}>
            <Icon name="map" className="icon--sm" /> {f.short}
          </button>
        ))}
        {place.lonlat && place.precision !== 'fictional' && place.precision !== 'unknown' && (
          <a className="btn btn--ghost" href={`https://maps.apple.com/?q=${encodeURIComponent(place.name)}&ll=${place.lonlat[1]},${place.lonlat[0]}`} target="_blank" rel="noreferrer">
            See it today <Icon name="external" className="icon--sm" />
          </a>
        )}
      </div>
    </Sheet>
  )
}
