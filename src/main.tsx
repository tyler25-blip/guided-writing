import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Monitor from './Monitor.tsx'
import MapApp from './map/MapApp.tsx'
import Admin from './map/Admin.tsx'

// /monitor = researcher back end; anything else = the journal.
const isMonitor = location.pathname.startsWith('/monitor')
const isMapAdmin = location.pathname.startsWith('/map/admin') // thought map back office
const isMap = location.pathname.startsWith('/map') // thought map MVP
document.title = isMonitor ? 'Monitor' : isMapAdmin ? 'Thought map · back office' : isMap ? 'Thought map' : 'Journal'

createRoot(document.getElementById('root')!).render(<StrictMode>{isMonitor ? <Monitor /> : isMapAdmin ? <Admin /> : isMap ? <MapApp /> : <App />}</StrictMode>)
