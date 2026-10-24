import { useEffect } from 'react'
import { useRoute } from './lib/router'
import Library from './pages/Library'
import BookShell from './pages/BookShell'
import NotFound from './pages/NotFound'

export default function App() {
  const route = useRoute()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.join('/')])

  if (route.length === 0) return <Library />
  if (route[0] === 'b' && route[1]) return <BookShell bookId={route[1]} rest={route.slice(2)} />
  return <NotFound />
}
