import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Monitor from './Monitor.tsx'
import MapApp from './map/MapApp.tsx'

// /monitor = researcher back end; anything else = the journal.
const isMonitor = location.pathname.startsWith('/monitor')
const isMap = location.pathname.startsWith('/map') // thought map MVP
document.title = isMonitor ? 'Monitor' : isMap ? 'Thought map' : 'Journal'

createRoot(document.getElementById('root')!).render(<StrictMode>{isMonitor ? <Monitor /> : isMap ? <MapApp /> : <App />}</StrictMode>)
