// Appearance: follow the system, or force parchment (light) / candlelight (dark).
// Stored per device; index.html applies it before first paint to avoid a flash.

export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'theme'

export function getTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(choice: ThemeChoice = getTheme()) {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
  // Match the phone's status bar to the page.
  const bar = getComputedStyle(root).getPropertyValue('--color-parchment-dark').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar || '#3b2a1a')
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* not remembered */
  }
  applyTheme(choice)
}

/** Re-apply when the system theme flips (only matters for "system"). */
export function watchSystemTheme() {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme())
}
