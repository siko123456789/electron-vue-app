/** AI 治理 WebSocket 返回帧的统一文本解析。 */
export async function normalizeAiWsPayloadToText(payload: unknown): Promise<string> {
  if (typeof Blob !== 'undefined' && payload instanceof Blob) return payload.text()
  if (typeof payload === 'string') return payload
  if (payload instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(payload)
  return payload == null ? '' : String(payload)
}

/** 判断服务端是否结束流式输出。 */
export function isAiStreamEnd(payload: unknown): boolean {
  const text = String(payload ?? '').trim().toLowerCase()
  return ['[done]', '[end]', 'done', 'end', 'stream_end', 'finish'].includes(text)
}

/** 提取常见的 JSON/角色帧中的正文。 */
export function normalizeAiChunk(payload: unknown): string {
  const text = String(payload ?? '')
  try {
    const value = JSON.parse(text)
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
      return String(value.content ?? value.text ?? value.delta ?? value.message ?? '')
    }
  } catch { /* 普通文本帧 */ }
  return text
}
