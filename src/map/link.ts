// How the page reaches the AI. With the person's own key: straight from this browser to Anthropic (the public site works
// this way, nothing passes through us). Without one: the local server, if it runs here with a key in .env.
import Anthropic from '@anthropic-ai/sdk'
import { mapRoute } from './brain.ts'

const MODEL = 'claude-sonnet-5-5'
const KEYNAME = 'tm-api-key'

export const getKey = () => {
  try {
    return localStorage.getItem(KEYNAME) ?? ''
  } catch {
    return ''
  }
}
let client: Anthropic | null = null
export const setKey = (k: string) => {
  try {
    if (k) localStorage.setItem(KEYNAME, k)
    else localStorage.removeItem(KEYNAME)
  } catch {
    /* private window: the key just isn't kept */
  }
  client = null
}

let server: Promise<boolean> | null = null
export const hasServer = () =>
  (server ??= fetch(`${import.meta.env.BASE_URL}api/health`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => Boolean(j?.key))
    .catch(() => false))

// The page listens for this to ask for a key.
export const NEED_KEY = 'tm-need-key'

// demo mode: the page never reaches the AI (and never asks for a key); the script and the stubs answer everything
let demo = false
export const setDemo = (on: boolean) => void (demo = on)

export async function ai<T>(path: string, body: unknown): Promise<T | null> {
  if (demo) return null
  const key = getKey()
  try {
    if (key) {
      client ??= new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true })
      return (await mapRoute(client, MODEL, path, body)) as T
    }
    if (await hasServer()) {
      const r = await fetch(`${import.meta.env.BASE_URL}api/map/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      return r.ok ? ((await r.json()) as T) : null
    }
    dispatchEvent(new Event(NEED_KEY))
    return null
  } catch (e) {
    console.warn('[map] AI call failed:', e)
    if (e instanceof Anthropic.AuthenticationError) dispatchEvent(new Event(NEED_KEY))
    return null
  }
}
