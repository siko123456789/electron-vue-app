export type ColorTheme = 'light' | 'dark'

const STORAGE_KEY = 'colorTheme'

export function getStoredColorTheme(): ColorTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    // ignore
  }
  return 'light'
}

/** 将主题应用到 document.documentElement（html[data-theme]） */
export function applyColorTheme(theme: ColorTheme): void {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore
  }
}

export function toggleColorTheme(current: ColorTheme): ColorTheme {
  const next: ColorTheme = current === 'light' ? 'dark' : 'light'
  applyColorTheme(next)
  return next
}
