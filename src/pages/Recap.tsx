import { useState } from 'react'
import Icon from '../components/Icon'
import { initials } from '../components/CharacterChip'
import { Segmented } from '../components/ui'
import { useBook } from '../lib/book-context'
import { href, navigate } from '../lib/router'
import { currentTagline, recapFor, whoMattersNow } from '../lib/spoilers'

type View = 'short' | 'full'

/** "Story so far": the latest checkpoint, what's happened since, and who matters now. */
export default function Recap() {
  const { book, upTo, dismissWelcome } = useBook()
  const [view, setView] = useState<View>('short')
  const id = book.meta.id
  const { checkpoint, since } = recapFor(book, upTo)
  const reached = book.recaps.filter((r) => r.through <= upTo)
  const who = whoMattersNow(book, upTo, 6)
  const done = upTo >= book.meta.chapterCount

  if (upTo === 0) {
    return (
      <div className="empty">
        <h1>Nothing to recap yet</h1>
        <p>Finish a chapter or two and the story so far will build up here.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="large-title">Story so far</h1>
      <p className="muted">Through chapter {upTo}</p>
      {reached.length > 1 && (
        <div style={{ margin: '12px 0 4px' }}>
          <Segmented<View>
            label="Recap length"
            value={view}
            onChange={setView}
            options={[
              { value: 'short', label: 'Short' },
              { value: 'full', label: 'Full' },
            ]}
          />
        </div>
      )}

      {view === 'short' ? (
        <>
          {checkpoint && (
            <section className="card" style={{ marginTop: 16 }}>
              <p className="eyebrow">Through chapter {checkpoint.through}</p>
              <h2 style={{ marginBottom: 10 }}>{checkpoint.title}</h2>
              <div className="prose">
                {checkpoint.text.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}
          {since.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <p className="eyebrow">{checkpoint ? 'Since then' : 'So far'}</p>
              <div className="group">
                {since.map((c) => (
                  <a key={c.number} className="row ch-row" href={href('b', id, 'chapters', c.number)}>
                    <span className="ch-row__num">{c.number}</span>
                    <span className="row__body">
                      <span className="row__title">{c.title || `Chapter ${c.number}`}</span>
                      <span className="row__sub">{c.summary}</span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div style={{ marginTop: 16 }}>
          {reached.map((r, i) => (
            <details key={r.through} className="section" open={i === reached.length - 1}>
              <summary>
                <span>
                  <span className="eyebrow" style={{ display: 'block', margin: '8px 0 2px' }}>
                    Chapters 1–{r.through}
                  </span>
                  {r.title}
                </span>
                <Icon name="chevronDown" className="icon--sm chev" />
              </summary>
              <div className="section__body prose">
                {r.text.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      {who.length > 0 && !done && (
        <section style={{ marginTop: 24 }}>
          <p className="eyebrow">Who matters right now</p>
          <div className="group">
            {who.map((c) => (
              <a key={c.id} className="row row--avatar" href={href('b', id, 'characters', c.id)}>
                <span className={`avatar avatar--sm avatar--${c.importance}`} aria-hidden="true">
                  {initials(c.name)}
                </span>
                <span className="row__body">
                  <span className="row__title">{c.name}</span>
                  <span className="row__sub clamp-2">{currentTagline(c, upTo)}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {!done && (
        <button
          className="btn btn--primary btn--lg btn--block"
          style={{ marginTop: 24 }}
          onClick={() => {
            dismissWelcome()
            navigate(href('b', id))
          }}
        >
          Back to Chapter {upTo + 1} <Icon name="chevronRight" />
        </button>
      )}
    </div>
  )
}
