import AtlasMap from './LazyAtlasMap'
import Icon from './Icon'
import { atlasHref } from '../lib/atlas'
import { useBook } from '../lib/book-context'
import { bestFrame, chapterSettings, positionIn } from '../lib/atlas'

/** "Where": a small map of a chapter's settings that opens the Atlas. */
export default function WhereCard({ n }: { n: number }) {
  const { book, upTo } = useBook()
  const places = chapterSettings(book, n, upTo)
  const [main] = places
  if (!main) return null
  const frame = bestFrame(book, main, upTo)
  const others = places.slice(1).map((p) => p.name)
  const body = (
    <span className="where-card__text">
      <Icon name="pin" />
      <span>
        <strong>{main.name}</strong>
        {others.length > 0 && <span>Also {others.slice(0, 3).join(', ')}{others.length > 3 ? ` and ${others.length - 3} more` : ''}</span>}
      </span>
      {frame && <Icon name="chevronRight" className="icon--sm chev" />}
    </span>
  )
  if (!frame) return <div className="where-card">{body}</div>
  return (
    <a className="where-card" href={atlasHref(book.meta.id, { place: main.id, frame: frame.id })} aria-label={`Where: ${main.name}. Open the map`}>
      <div className="where-card__map" aria-hidden="true">
        <AtlasMap book={book} frame={frame} asOf={upTo} highlight={places.filter((p) => positionIn(frame, p)).map((p) => p.id)} interactive={false} />
      </div>
      {body}
    </a>
  )
}
