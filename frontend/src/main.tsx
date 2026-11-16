import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// After a redeploy, an open tab can request a lazy chunk that no longer exists.
// Reload once to fetch the new build; the timestamp stops a reload loop if the
// chunk is still missing (the route error boundary then shows a retry message).
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('chunk-reload-at') ?? 0)
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem('chunk-reload-at', String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
