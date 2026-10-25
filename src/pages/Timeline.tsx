import { useState } from 'react'
import Icon from '../components/Icon'
import { initials } from '../components/CharacterChip'
import { Segmented } from '../components/ui'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { timelineUpTo, type TimelineView } from '../lib/understanding'

type Order = 'story' | 'telling'

export default function Timeline() {
  const { book, upTo } = useBook()
  const [order, setOrder] = useState<Order>('story')
  const events = timelineUpTo(book, upTo)
  // The story's "present": the latest event told in its own time (not a backstory).
  const present = events.filter((e) => !e.flashback).at(-1)

  const groups: { key: string; title: string; list: TimelineView[] }[] = []
  const sorted = order === 'story' ? events : [...events].sort((a, b) => a.revealed - b.revealed || a.date.localeCompare(b.date))
  for (const e of sorted) {
    const key = order === 'story' ? e.date.slice(0, 4) : String(e.revealed)
    const title = order === 'story' ? key : `Learned in chapter ${e.revealed}`
    if (groups.at(-1)?.key !== key) groups.push({ key, title, list: [] })
    groups.at(-1)!.list.push(e)
  }

  return (
    <div>
      <h1 className="page-title">Timeline</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Everything you know so far, in the order it happened, including the backstories told out of order.
      </p>
      <div className="sticky-sub">
        <Segmented<Order>
          label="Order"
          value={order}
          onChange={setOrder}
          options={[
            { value: 'story', label: 'When it happened' },
            { value: 'telling', label: 'When you learned it' },
          ]}
        />
      </div>
      {events.length === 0 && (
        <div className="empty">
          <p>Events appear here as you read.</p>
        </div>
      )}
      <div className="timeline">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="timeline__year">{g.title}</h2>
            <ol className="timeline__list">
              {g.list.map((e) => (
                <li key={e.id} className={`tl-event${e.flashback ? ' tl-event--back' : ''}`}>
                  <span className="tl-event__dot" aria-hidden="true" />
                  <p className="tl-event__date">
                    {e.label}
                    {e.flashback && <span className="tag tl-tag">Backstory · told in ch {e.revealed}</span>}
                  </p>
                  <h3 className="tl-event__title">{e.title}</h3>
                  {e.text && <p className="tl-event__text">{e.text}</p>}
                  <div className="tl-event__meta">
                    {e.people.slice(0, 5).map((c) => (
                      <a key={c.id} href={href('b', book.meta.id, 'characters', c.id)} className={`avatar avatar--xs avatar--${c.importance}`} title={c.name} aria-label={c.name}>
                        {initials(c.name)}
                      </a>
                    ))}
                    {e.places.slice(0, 2).map((p) => (
                      <a key={p.id} href={href('b', book.meta.id, 'places', p.id)} className="tl-place">
                        <Icon name="pin" className="icon--sm" /> {p.name}
                      </a>
                    ))}
                    {!e.flashback && e.chapters.length > 0 && (
                      <a href={href('b', book.meta.id, 'chapters', e.chapters[0])} className="tl-ch">
                        Ch {e.chapters.join(', ')}
                      </a>
                    )}
                  </div>
                  {order === 'story' && present && e.id === present.id && (
                    <p className="tl-now">
                      <Icon name="sparkle" className="icon--sm" /> You are here
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}
