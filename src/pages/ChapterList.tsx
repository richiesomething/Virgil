import type { BookPageProps } from './BookShell'
import { href } from '../lib/router'
import { unlockedChapters } from '../lib/spoilers'

export default function ChapterList({ book, upTo, setUpTo }: BookPageProps) {
  const { meta } = book
  const chapters = unlockedChapters(book, upTo)
  const remaining = meta.chapterCount - upTo

  return (
    <div>
      <h1 className="page-title">Chapters</h1>
      {chapters.length === 0 && (
        <p className="muted">Set your bookmark to unlock chapter summaries.</p>
      )}
      {meta.volumes.map((v) => {
        const inVol = chapters.filter(
          (c) => c.volume === v.number,
        )
        if (!inVol.length) return null
        return (
          <section key={v.number} className="volume">
            <h2 className="section-title">{v.title}</h2>
            <ol className="chapter-list">
              {[...inVol].reverse().map((c) => (
                <li key={c.number}>
                  <a className="chapter-row" href={href('b', meta.id, 'chapters', c.number)}>
                    <span className="chapter-row__num">{c.number}</span>
                    <span className="chapter-row__body">
                      <span className="chapter-row__title">{c.title}</span>
                      <span className="chapter-row__summary">{c.summary}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )
      }).reverse()}
      {remaining > 0 && (
        <div className="locked">
          <p>
            🔒 {remaining} more chapter{remaining === 1 ? '' : 's'} stay hidden until you reach them.
          </p>
          <button className="btn btn--ghost" onClick={() => setUpTo(upTo + 1)}>
            ✓ I finished chapter {upTo + 1}
          </button>
        </div>
      )}
    </div>
  )
}
