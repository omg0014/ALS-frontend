import { useSyncExternalStore } from 'react'
import { getThemeChoice, isDarkTheme, setThemeChoice, subscribeTheme } from '../lib/theme.js'

// { dark, choice, setChoice }: re-renders when the look changes (menu choice or the computer's setting).
export function useTheme() {
  const dark = useSyncExternalStore(subscribeTheme, isDarkTheme)
  const choice = useSyncExternalStore(subscribeTheme, getThemeChoice)
  return { dark, choice, setChoice: setThemeChoice }
}
