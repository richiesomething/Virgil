import type { BookPageProps } from './BookShell'
import CharacterChip from '../components/CharacterChip'
import { href, navigate } from '../lib/router'
import { chapter, charactersInChapter } from '../lib/spoilers'

export default function ChapterDetail({ book, upTo, setUpTo, n }: BookPageProps & { n: number }) {
  const { meta } = book
  const ch = Number.isInteger(n) ? chapter(book, n, upTo) : undefined

  if (!ch) {
    const exists = n >= 1 && n <= meta.chapterCount
    return (
      <div className="empty">
        <h1>{exists ? `Chapter ${n} is still ahead of you` : 'No such chapter'}</h1>
        {exists && <p>Its summary unlocks once you’ve finished it.</p>}
        <div className="row">
          {exists && n === upTo + 1 && (
            <button className="btn" onClick={() => setUpTo(n)}>✓ I finished chapter {n}</button>
          )}
          <a className="btn btn--ghost" href={href('b', meta.id, 'chapters')}>All chapters</a>
        </div>
      </div>
    )
  }

  const people = charactersInChapter(book, ch, upTo)
  const volume = meta.volumes.find((v) => v.number === ch.volume)

  return (
    <article className="chapter">
      <a className="back" href={href('b', meta.id, 'chapters')}>← All chapters</a>
      <p className="eyebrow">
        {volume ? `${volume.title} · ` : ''}
        {ch.title ? `Chapter ${ch.number}` : meta.title}
      </p>
      <h1 className="page-title">{ch.title || `Chapter ${ch.number}`}</h1>
      <p className="lede">{ch.summary}</p>
      <div className="prose">
        {ch.details.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {people.length > 0 && (
        <section className="card">
          <p className="eyebrow">In this chapter</p>
          <div className="chips">
            {people.map((c) => (
              <CharacterChip key={c.id} bookId={meta.id} c={c} isNew={c.firstChapter === ch.number} />
            ))}
          </div>
        </section>
      )}

      <nav className="pager" aria-label="Chapter navigation">
        {ch.number > 1 ? (
          <a className="btn btn--ghost" href={href('b', meta.id, 'chapters', ch.number - 1)}>← Chapter {ch.number - 1}</a>
        ) : <span />}
        {ch.number < upTo ? (
          <a className="btn btn--ghost" href={href('b', meta.id, 'chapters', ch.number + 1)}>Chapter {ch.number + 1} →</a>
        ) : ch.number < meta.chapterCount ? (
          <button
            className="btn"
            onClick={() => {
              setUpTo(ch.number + 1)
              navigate(href('b', meta.id, 'chapters', ch.number + 1))
            }}
          >
            ✓ I finished chapter {ch.number + 1}
          </button>
        ) : <span />}
      </nav>
    </article>
  )
}
