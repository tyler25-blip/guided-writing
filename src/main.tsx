import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Monitor from './Monitor.tsx'
import MapApp from './map/MapApp.tsx'
import Admin from './map/Admin.tsx'

// /monitor = researcher back end; /map = thought map, /map/admin its back office; anything else = the journal.
// The public site (GitHub Pages) opens on the thought map.
const path = '/' + location.pathname.slice(import.meta.env.BASE_URL.length)
const isMonitor = path.startsWith('/monitor')
const isMapAdmin = path.startsWith('/map/admin') // thought map back office
const isMap = path.startsWith('/map') || (import.meta.env.VITE_HOME === 'map' && !isMonitor) // thought map MVP
document.title = isMonitor ? 'Monitor' : isMapAdmin ? 'Thought map · back office' : isMap ? 'Thought map' : 'Journal'

createRoot(document.getElementById('root')!).render(<StrictMode>{isMonitor ? <Monitor /> : isMapAdmin ? <Admin /> : isMap ? <MapApp /> : <App />}</StrictMode>)
