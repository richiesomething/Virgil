import type { Insight } from '../types'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { insightLabel, themeAt } from '../lib/understanding'

/** One "what to notice" note, with links to the themes it develops. */
export default function InsightCard({ insight, showChapter }: { insight: Insight; showChapter?: boolean }) {
  const { book, upTo } = useBook()
  const id = book.meta.id
  return (
    <article className={`insight insight--${insight.kind}`}>
      <p className="insight__kind">
        {insightLabel[insight.kind]}
        {showChapter && (
          <a href={href('b', id, 'chapters', insight.chapter) + '?tab=insights'} className="insight__ch">
            Ch {insight.chapter}
          </a>
        )}
      </p>
      <h3 className="insight__title">{insight.title}</h3>
      <p className="insight__text">{insight.text}</p>
      {insight.themes.length > 0 && (
        <div className="insight__themes">
          {insight.themes.map((t) => (
            <a key={t} className="theme-chip" href={href('b', id, 'themes', t)}>
              {themeAt(book, t, upTo)?.name}
            </a>
          ))}
        </div>
      )}
    </article>
  )
}
