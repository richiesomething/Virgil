import Icon from '../components/Icon'
import AtlasMap from '../components/LazyAtlasMap'
import { atlasHref, chapterRange } from '../lib/atlas'
import { initials } from '../components/CharacterChip'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { bestFrame, chaptersAt, peopleAt, placeRole, placeAliases, placeAt, placeTagline, precisionLabel, visibleJourneys, visiblePlaces } from '../lib/atlas'
import { chapter, lookupCharacter } from '../lib/spoilers'

export default function PlacePage({ id }: { id: string }) {
  const { book, upTo, openNote } = useBook()
  const bookId = book.meta.id
  const place = placeAt(book, id, upTo)

  if (!place) {
    return (
      <div className="empty">
        <Icon name="lock" />
        <p>You haven’t reached this place yet.</p>
        <a className="btn btn--secondary" href={href('b', bookId, 'cast') + '?seg=places'}>
          All places
        </a>
      </div>
    )
  }

  const frame = bestFrame(book, place, upTo)
  const chs = chaptersAt(book, place.id, upTo)
  const people = peopleAt(book, place.id, upTo)
  const aliases = placeAliases(place, upTo)
  const parent = place.parent ? placeAt(book, place.parent, upTo) : undefined
  const within = visiblePlaces(book, upTo).filter((p) => p.parent === place.id)
  const cast = lookupCharacter(book, place.id, upTo)
  const castEntry = cast.status === 'visible' ? cast.character : undefined
  const story = castEntry?.description.filter((d) => d.from <= upTo) ?? []
  const note = place.note ? book.notes.find((n) => n.placeId === place.id && n.chapter <= upTo) : undefined
  const legs = visibleJourneys(book, upTo).flatMap((j) => j.legs.filter((l) => l.fromPlace.id === place.id || l.toPlace.id === place.id))

  return (
    <article className="place-page">
      {frame && (
        <a className="place-map" href={atlasHref(bookId, { place: place.id, frame: frame.id })} aria-label={`Open ${place.name} on the map`}>
          <AtlasMap book={book} frame={frame} asOf={upTo} highlight={[place.id]} interactive={false} />
          <span className="place-map__cta">
            <Icon name="map" className="icon--sm" /> {frame.short}
          </span>
        </a>
      )}
      <h1 className="page-title" style={{ marginTop: 16 }}>
        {place.name}
      </h1>
      {aliases.length > 0 && <p className="muted small" style={{ margin: '0 0 6px' }}>Also: {aliases.join(', ')}</p>}
      <p className="lead" style={{ marginTop: 4 }}>
        {placeTagline(place, upTo)}
      </p>
      <p className="place-tags">
        <span className={`tag tag--${place.precision}`}>{precisionLabel[place.precision]}</span>
        {parent && (
          <a className="tag tag--link" href={href('b', bookId, 'places', parent.id)}>
            In {parent.name}
          </a>
        )}
        {placeRole(book, place, upTo) === 'mentioned' && <span className="tag">Mentioned, not visited</span>}
      </p>

      {story.length > 0 && (
        <section className="section">
          {story.map((d, i) => (
            <p key={i}>{d.text}</p>
          ))}
          <a className="link" href={href('b', bookId, 'characters', place.id)}>
            Connections & moments <Icon name="chevronRight" className="icon--sm" />
          </a>
        </section>
      )}

      {place.today && (
        <section className="section">
          <p className="group-title">Today</p>
          <p style={{ margin: 0 }}>{place.today}</p>
        </section>
      )}

      {note && (
        <section className="section">
          <button className="row note-link" onClick={() => openNote(note.id)}>
            <span className="row__body">
              <span className="row__title">Glossary: {note.term}</span>
              <span className="row__sub clamp-1">{note.text}</span>
            </span>
            <Icon name="chevronRight" className="icon--sm chev" />
          </button>
        </section>
      )}

      {chs.length > 0 && (
        <section className="section">
          <p className="group-title">Scenes here · {chapterRange(chs)}</p>
          <div className="group">
            {chs.map((n) => {
              const ch = chapter(book, n, upTo)!
              return (
                <a key={n} className="row" href={href('b', bookId, 'chapters', n)}>
                  <span className="row__body">
                    <span className="row__title">
                      Chapter {n}
                      {ch.title ? ` · ${ch.title}` : ''}
                    </span>
                    <span className="row__sub clamp-1">{ch.summary}</span>
                  </span>
                  <Icon name="chevronRight" className="icon--sm chev" />
                </a>
              )
            })}
          </div>
        </section>
      )}

      {within.length > 0 && (
        <section className="section">
          <p className="group-title">Places here</p>
          <div className="chips">
            {within.map((p) => (
              <a key={p.id} className="chip-btn" href={href('b', bookId, 'places', p.id)}>
                {p.name}
              </a>
            ))}
          </div>
        </section>
      )}

      {people.length > 0 && (
        <section className="section">
          <p className="group-title">People here</p>
          <div className="people-strip">
            {people.map((c) => (
              <a key={c.id} href={href('b', bookId, 'characters', c.id)}>
                <span className={`avatar avatar--sm avatar--${c.importance}`} aria-hidden="true">
                  {initials(c.name)}
                </span>
                <span className="name">{c.name}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {legs.length > 0 && (
        <section className="section">
          <p className="group-title">Journeys</p>
          <ul className="leg-list">
            {legs.map((l, i) => (
              <li key={i}>
                <span className="muted">Ch {l.chapter}</span> {l.journey.name}: {l.fromPlace.name} → {l.toPlace.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
