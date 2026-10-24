import type { BookData } from '../types'

interface Props {
  book: BookData
  upTo: number
  setUpTo: (n: number) => void
}

/**
 * The reader's bookmark. Titles of chapters past the bookmark are hidden
 * because some of them give away the plot ("The Suicide", "Expiation"…).
 */
export default function BookmarkBar({ book, upTo, setUpTo }: Props) {
  const max = book.meta.chapterCount
  const label = (n: number) => {
    if (n === 0) return 'Not started yet'
    const ch = book.chapters.find((c) => c.number === n)
    return n <= upTo && ch?.title ? `Chapter ${n} · ${ch.title}` : `Chapter ${n}`
  }

  return (
    <div className="bookmark">
      <span className="bookmark__label" id="bookmark-label">
        <BookmarkIcon /> I’ve finished
      </span>
      <div className="bookmark__controls">
        <button
          className="icon-btn"
          onClick={() => setUpTo(upTo - 1)}
          disabled={upTo <= 0}
          aria-label="Move bookmark back one chapter"
        >
          ‹
        </button>
        <select
          className="bookmark__select"
          aria-labelledby="bookmark-label"
          value={upTo}
          onChange={(e) => setUpTo(Number(e.target.value))}
        >
          {Array.from({ length: max + 1 }, (_, n) => (
            <option key={n} value={n}>
              {label(n)}
            </option>
          ))}
        </select>
        <button
          className="icon-btn icon-btn--primary"
          onClick={() => setUpTo(upTo + 1)}
          disabled={upTo >= max}
          aria-label="I finished the next chapter"
          title="I finished the next chapter"
        >
          ›
        </button>
      </div>
    </div>
  )
}

function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h12v18l-6-4-6 4z" fill="currentColor" />
    </svg>
  )
}
