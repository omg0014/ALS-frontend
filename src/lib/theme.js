// Light / dark look. The choice ('light' | 'dark' | 'system') is kept in this browser only.
// public/theme-init.js applies it before the first paint; this module keeps it up to date afterwards.

const KEY = 'acls.theme'
const EVENT = 'acls:theme'
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)')

export function getThemeChoice() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const resolve = (choice) => (choice === 'system' ? (media()?.matches ? 'dark' : 'light') : choice)

function apply() {
  const theme = resolve(getThemeChoice())
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#090d18' : '#f3f5fa')
  window.dispatchEvent(new Event(EVENT))
}

export function setThemeChoice(choice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* storage unavailable: the choice lasts until the page is reloaded */
  }
  apply()
}

// Call once at start-up: applies the theme and follows the computer's setting while on 'system'.
export function initTheme() {
  apply()
  media()?.addEventListener('change', () => getThemeChoice() === 'system' && apply())
}

export function subscribeTheme(callback) {
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}

export const isDarkTheme = () => document.documentElement.dataset.theme === 'dark'
