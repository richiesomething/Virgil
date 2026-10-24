import SiteHeader from '../components/SiteHeader'
import { href } from '../lib/router'

export default function NotFound({ message = 'That page doesn’t exist.' }: { message?: string }) {
  return (
    <>
      <SiteHeader />
      <main className="wrap page">
        <div className="empty">
          <h1>Lost in the woods</h1>
          <p>{message}</p>
          <a className="btn" href={href()}>Back to your library</a>
        </div>
      </main>
    </>
  )
}
