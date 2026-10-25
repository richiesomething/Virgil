import Icon from '../components/Icon'
import InsightCard from '../components/InsightCard'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { afterwordFor, insightsForTheme, themeAt, themeStages, themeSummary, themesUpTo } from '../lib/understanding'

export default function Themes() {
  const { book, upTo } = useBook()
  const id = book.meta.id
  const themes = themesUpTo(book, upTo)
  const total = book.themes?.length ?? 0
  return (
    <div>
      <h1 className="page-title">Themes</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        The big ideas {book.meta.author.split(' ').slice(-1)[0]} keeps returning to, as far as you’ve read.
      </p>
      {themes.length === 0 ? (
        <div className="empty">
          <p>Themes appear here as the story starts to develop them.</p>
        </div>
      ) : (
        <div className="group" style={{ marginTop: 12 }}>
          {themes.map((t) => {
            const n = insightsForTheme(book, t.id, upTo).length
            return (
              <a key={t.id} className="row theme-row" href={href('b', id, 'themes', t.id)}>
                <span className="row__body">
                  <span className="row__title">{t.name}</span>
                  <span className="row__sub clamp-2">{themeSummary(t, upTo)}</span>
                </span>
                <span className="row__meta">{n ? `${n} note${n === 1 ? '' : 's'}` : ''}</span>
                <Icon name="chevronRight" className="icon--sm chev" />
              </a>
            )
          })}
        </div>
      )}
      {themes.length < total && upTo < book.meta.chapterCount && (
        <p className="small muted" style={{ marginTop: 16 }}>
          More themes come into view as you read.
        </p>
      )}
    </div>
  )
}

export function ThemePage({ themeId }: { themeId: string }) {
  const { book, upTo } = useBook()
  const id = book.meta.id
  const theme = themeAt(book, themeId, upTo)
  if (!theme) {
    return (
      <div className="empty">
        <Icon name="lock" />
        <p>You haven’t reached this theme yet.</p>
        <a className="btn btn--secondary" href={href('b', id, 'themes')}>
          All themes
        </a>
      </div>
    )
  }
  const stages = themeStages(theme, upTo)
  const insights = insightsForTheme(book, theme.id, upTo)
  const resolution = afterwordFor(book, upTo)?.themes.find((r) => r.theme === theme.id)
  return (
    <article>
      <p className="eyebrow">Theme</p>
      <h1 className="page-title">{theme.name}</h1>
      <p className="lead">{themeSummary(theme, upTo)}</p>

      {stages.length > 1 && (
        <section className="section">
          <p className="group-title">How it has built</p>
          <ol className="stages">
            {stages.map((s) => (
              <li key={s.from}>
                <a href={href('b', id, 'chapters', s.from)} className="stages__ch">
                  Ch {s.from}
                </a>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {resolution && (
        <section className="section card resolution">
          <p className="eyebrow">How it resolves</p>
          <p style={{ margin: 0 }}>{resolution.text}</p>
        </section>
      )}

      {insights.length > 0 && (
        <section className="section">
          <p className="group-title">Chapter by chapter · {insights.length}</p>
          <div className="insights">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} showChapter />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
