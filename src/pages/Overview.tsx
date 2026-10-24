import type { BookPageProps } from './BookShell'
import ProgressBar from '../components/ProgressBar'
import CharacterChip from '../components/CharacterChip'
import { href } from '../lib/router'
import { chapter, metCharacters, newInChapter } from '../lib/spoilers'

export default function Overview({ book, upTo, setUpTo }: BookPageProps) {
  const { meta } = book
  const current = chapter(book, upTo, upTo)
  const fresh = newInChapter(book, upTo, upTo)
  const met = metCharacters(book, upTo)
  const pct = Math.round((upTo / meta.chapterCount) * 100)

  if (upTo === 0) {
    return (
      <div className="welcome">
        <h1>{meta.title}</h1>
        <p className="lede">{meta.blurb}</p>
        <div className="card">
          <h2>Where are you in the book?</h2>
          <p>
            Set your bookmark to the last chapter you <em>finished</em>, using the bar above. You’ll
            only see chapter summaries and characters up to that point.
          </p>
          <div className="row">
            <button className="btn" onClick={() => setUpTo(1)}>I’ve finished chapter 1</button>
          </div>
        </div>
        <p className="small muted">Summaries follow the {meta.edition}.</p>
      </div>
    )
  }

  return (
    <div className="overview">
      <section className="card progress-card">
        <div className="progress-card__head">
          <div>
            <p className="eyebrow">Your progress</p>
            <p className="big-number">
              {upTo} <span className="muted">/ {meta.chapterCount} chapters</span>
            </p>
          </div>
          <p className="big-number big-number--pct">{pct}%</p>
        </div>
        <ProgressBar value={upTo} max={meta.chapterCount} />
        {upTo < meta.chapterCount ? (
          <button className="btn btn--ghost" onClick={() => setUpTo(upTo + 1)}>
            ✓ I finished chapter {upTo + 1}
          </button>
        ) : (
          <p className="muted">You’ve finished the book. Everything is unlocked.</p>
        )}
      </section>

      {current && (
        <section className="card">
          <p className="eyebrow">Last chapter you finished</p>
          <h2>
            <a href={href('b', meta.id, 'chapters', current.number)}>
              Chapter {current.number}{current.title && `: ${current.title}`}
            </a>
          </h2>
          <p>{current.summary}</p>
          <a className="link-more" href={href('b', meta.id, 'chapters', current.number)}>
            Read the full summary →
          </a>
        </section>
      )}

      <section className="card">
        <p className="eyebrow">New in chapter {upTo}</p>
        {fresh.length ? (
          <div className="chips">
            {fresh.map((c) => (
              <CharacterChip key={c.id} bookId={meta.id} c={c} isNew />
            ))}
          </div>
        ) : (
          <p className="muted">No new characters in this chapter.</p>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <p className="eyebrow">Characters you’ve met · {met.length}</p>
          <a className="link-more" href={href('b', meta.id, 'characters')}>See all →</a>
        </div>
        <div className="chips">
          {met
            .filter((c) => c.importance === 'major')
            .map((c) => (
              <CharacterChip key={c.id} bookId={meta.id} c={c} />
            ))}
        </div>
      </section>
    </div>
  )
}
