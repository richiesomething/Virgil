import Icon from '../components/Icon'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { afterwordFor, themeAt } from '../lib/understanding'

export default function Afterword() {
  const { book, upTo } = useBook()
  const id = book.meta.id
  const a = afterwordFor(book, upTo)
  if (!a) {
    return (
      <div className="empty">
        <Icon name="lock" size={32} />
        <h1>Finish the book first</h1>
        <p>The ending explained, the big debates and what to read next open once you’ve finished. Everything here discusses the ending.</p>
        <a className="btn btn--secondary" href={href('b', id)}>
          Back to Today
        </a>
      </div>
    )
  }
  return (
    <article className="afterword">
      <p className="eyebrow">After you finish</p>
      <h1 className="page-title">The full picture</h1>
      <nav className="afterword__toc" aria-label="Sections">
        {[
          ['ending', 'The ending'],
          ['themes', 'Themes'],
          ['readings', 'Ways to read it'],
          ['context', 'Context'],
          ['questions', 'Questions'],
          ['adaptations', 'Adaptations'],
          ['next', 'Read next'],
        ].map(([k, l]) => (
          <a key={k} className="chip-btn" href={`#aw-${k}`} onClick={(e) => (e.preventDefault(), document.getElementById(`aw-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}>
            {l}
          </a>
        ))}
      </nav>

      <section id="aw-ending" className="section">
        <h2>The ending, explained</h2>
        <div className="prose">
          {a.ending.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      <section id="aw-themes" className="section">
        <h2>How the themes resolve</h2>
        <div className="group">
          {a.themes.map((r) => {
            const t = themeAt(book, r.theme, upTo)
            return (
              <details key={r.theme} className="row aw-detail">
                <summary>
                  <span className="row__title">{t?.name ?? r.theme}</span>
                  <Icon name="chevronDown" className="icon--sm chev" />
                </summary>
                <p>{r.text}</p>
                {t && (
                  <a className="link" href={href('b', id, 'themes', t.id)}>
                    The whole thread <Icon name="chevronRight" className="icon--sm" />
                  </a>
                )}
              </details>
            )
          })}
        </div>
      </section>

      <section id="aw-readings" className="section">
        <h2>Ways to read it</h2>
        {a.interpretations.map((x) => (
          <div key={x.title} className="aw-block">
            <h3>{x.title}</h3>
            <p>{x.text}</p>
          </div>
        ))}
      </section>

      <section id="aw-context" className="section">
        <h2>Context</h2>
        {a.context.map((x) => (
          <div key={x.title} className="aw-block">
            <h3>{x.title}</h3>
            <p>{x.text}</p>
          </div>
        ))}
      </section>

      <section id="aw-questions" className="section">
        <h2>Questions to think about</h2>
        <ol className="aw-questions">
          {a.questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
      </section>

      <section id="aw-adaptations" className="section">
        <h2>Adaptations</h2>
        <div className="group">
          {a.adaptations.map((x) => (
            <div key={x.title + x.year} className="row">
              <span className="row__body">
                <span className="row__title">
                  {x.title} <span className="muted">({x.year})</span>
                </span>
                <span className="row__sub">{x.note}</span>
              </span>
              <span className="tag">{x.kind}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="aw-next" className="section">
        <h2>What to read next</h2>
        <div className="group">
          {a.readNext.map((x) => (
            <div key={x.title} className="row">
              <span className="row__body">
                <span className="row__title">
                  <em>{x.title}</em> <span className="muted">· {x.author}</span>
                </span>
                <span className="row__sub">{x.why}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </article>
  )
}
