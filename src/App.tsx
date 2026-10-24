import { useEffect } from 'react'
import { useRoute } from './lib/router'
import Library from './pages/Library'
import BookShell from './pages/BookShell'
import NotFound from './pages/NotFound'

export default function App() {
  const route = useRoute()

  // Selecting a character on the map changes the URL but shouldn't scroll the page.
  const page = route[2] === 'map' ? route.slice(0, 3).join('/') : route.join('/')
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])

  if (route.length === 0) return <Library />
  if (route[0] === 'b' && route[1]) return <BookShell bookId={route[1]} rest={route.slice(2)} />
  return <NotFound />
}
