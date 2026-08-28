/** AI 治理 WebSocket 帧解析，兼容纯文本和常见 JSON 流式帧。 */
export function isStreamEndPayload(payload: unknown) {
  const text = String(payload ?? '').trim().toLowerCase()
  return ['[done]', '[end]', 'done', 'end', 'stream_end', 'finish'].includes(text)
}

export function normalizeAiWsChunkToPlainText(payload: unknown) {
  const text = String(payload ?? '')
  try {
    const value = JSON.parse(text)
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') return String(value.content ?? value.text ?? value.delta ?? value.message ?? '')
  } catch { /* 普通文本帧 */ }
  return text
}
