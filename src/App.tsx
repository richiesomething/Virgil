import { useEffect } from 'react'
import { settleScroll, useLocation } from './lib/router'
import { applyTheme, prefs } from './lib/store'
import { ToastHost } from './components/ui'
import Library from './pages/Library'
import BookShell from './pages/BookShell'
import NotFound from './pages/NotFound'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  const { parts, path } = useLocation()
  const theme = prefs.use().theme

  useEffect(() => applyTheme(theme), [theme])
  // Pages inside a book handle their own scroll restoration.
  useEffect(() => {
    if (parts[0] !== 'b') settleScroll(path, false)
  }, [path, parts])

  let page
  if (parts.length === 0) page = <Library />
  else if (parts[0] === 'b' && parts[1]) page = <BookShell key={parts[1]} bookId={parts[1]} />
  else page = <NotFound />
  return (
    <>
      <ErrorBoundary key={path} fallback={<NotFound message="Something went wrong showing this page." />}>
        {page}
      </ErrorBoundary>
      <ToastHost />
    </>
  )
}
