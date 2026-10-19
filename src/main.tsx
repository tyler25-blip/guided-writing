import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Monitor from './Monitor.tsx'

// /monitor = researcher back end; anything else = the journal.
const isMonitor = location.pathname.startsWith('/monitor')
document.title = isMonitor ? 'Monitor' : 'Journal'

createRoot(document.getElementById('root')!).render(<StrictMode>{isMonitor ? <Monitor /> : <App />}</StrictMode>)
