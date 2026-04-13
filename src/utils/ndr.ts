import { getIntegrationAPI } from '@/api/login'

const NDR_AUTHOR_KEY = 'ndrAuthorKey'
const NDR_SYSTEM_NAME = '威胁检测系统'

function readList(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.list)) return payload.list
  return []
}

function findThreatDetectionKey(payload: any): string {
  const list = readList(payload)
  const matched = list.find((item) => String(item?.name || '').trim() === NDR_SYSTEM_NAME)
  return String(matched?.key || '').trim()
}

export function getStoredNdrAuthorKey(): string {
  try {
    return String(localStorage.getItem(NDR_AUTHOR_KEY) || '').trim()
  } catch {
    return ''
  }
}

export function clearStoredNdrAuthorKey() {
  try {
    localStorage.removeItem(NDR_AUTHOR_KEY)
  } catch {}
}

export async function ensureNdrAuthorKey(forceRefresh = false): Promise<string> {
  const cachedKey = getStoredNdrAuthorKey()
  if (cachedKey && !forceRefresh) return cachedKey

  const res = await getIntegrationAPI()
  const nextKey = findThreatDetectionKey(res?.data)

  if (!nextKey) {
    clearStoredNdrAuthorKey()
    throw new Error(`未找到“${NDR_SYSTEM_NAME}”的集成 key`)
  }

  try {
    localStorage.setItem(NDR_AUTHOR_KEY, nextKey)
  } catch {}

  return nextKey
}
