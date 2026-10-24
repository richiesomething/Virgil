import SiteHeader from '../components/SiteHeader'
import ProgressBar from '../components/ProgressBar'
import { library } from '../books'
import { useAllProgress } from '../lib/progress'
import { href } from '../lib/router'

export default function Library() {
  const progress = useAllProgress()
  return (
    <>
      <SiteHeader />
      <main className="wrap page">
        <section className="hero">
          <h1>Your guide through difficult books</h1>
          <p>
            Tell Virgil which chapter you’ve finished. You’ll get chapter summaries and a cast of
            characters that stops at your bookmark, so nothing from later in the book is spoiled.
          </p>
        </section>

        <h2 className="section-title">Library</h2>
        <div className="book-grid">
          {library.map((book) => {
            const done = progress[book.id] ?? 0
            return (
              <a key={book.id} className="book-card" href={href('b', book.id)}>
                <div className="cover" style={{ background: book.color }}>
                  <span className="cover__title">{book.title}</span>
                  <span className="cover__author">{book.author}</span>
                </div>
                <div className="book-card__body">
                  <h3>{book.title}</h3>
                  <p className="muted">
                    {book.author} · {book.year}
                  </p>
                  <p className="book-card__blurb">{book.blurb}</p>
                  <ProgressBar value={done} max={book.chapterCount} />
                  <p className="small muted">
                    {done === 0
                      ? 'Not started'
                      : done === book.chapterCount
                        ? 'Finished'
                        : `Finished chapter ${done} of ${book.chapterCount}`}
                  </p>
                </div>
              </a>
            )
          })}
        </div>
        <p className="small muted footnote">
          More books coming. Your bookmarks are saved in this browser.
        </p>
      </main>
    </>
  )
}
