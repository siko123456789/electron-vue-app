export async function copyTextToClipboard(value: unknown) {
  const text = String(value ?? '')
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const input = document.createElement('textarea')
  input.value = text
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  input.remove()
}

/** @deprecated 请使用 copyTextToClipboard；保留别名避免旧引用报错 */
export const copyText = copyTextToClipboard
