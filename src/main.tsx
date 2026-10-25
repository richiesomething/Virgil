import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// After a deploy, a page opened earlier asks for files that no longer exist: reload once to pick up the new version.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('virgil:reloaded') ?? 0)
    if (Date.now() - last < 30_000) return
    sessionStorage.setItem('virgil:reloaded', String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
