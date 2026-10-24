import type { BookPageProps } from './BookShell'
import type { BookMeta, Chapter } from '../types'
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
      {groupByVolume(meta.volumes, chapters).map(({ title, chapters: inGroup }) => (
        <section key={title || 'all'} className="volume">
          {title && <h2 className="section-title">{title}</h2>}
          <ol className="chapter-list">
            {inGroup.map((c) => (
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
      ))}
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

/** Newest first; books without volumes get a single untitled group. */
function groupByVolume(volumes: BookMeta['volumes'], chapters: Chapter[]) {
  const newestFirst = [...chapters].reverse()
  if (!volumes.length) return newestFirst.length ? [{ title: '', chapters: newestFirst }] : []
  return [...volumes]
    .reverse()
    .map((v) => ({ title: v.title, chapters: newestFirst.filter((c) => c.volume === v.number) }))
    .filter((g) => g.chapters.length)
}
