import { defineStore } from 'pinia'

export type UserInfo = {
  username?: string
  userName?: string
  name?: string
  realName?: string
  roleName?: string
  role_name?: string
  role?: {
    name?: string
  }
  user?: {
    username?: string
    name?: string
    roleName?: string
    role_name?: string
    role?: {
      name?: string
    }
  }
  profile?: {
    username?: string
  }
  [key: string]: unknown
}

type AuthState = {
  token: string | null
  userInfo: UserInfo | null
}

const STORAGE_KEYS = {
  token: 'token',
  userInfo: 'userInfo',
  rememberLogin: 'rememberLogin',
} as const

function safeParseJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function readRememberLogin() {
  const raw = localStorage.getItem(STORAGE_KEYS.rememberLogin)
  if (raw === null) return true
  return raw === '1' || raw === 'true'
}

function readPersistedAuth(): Pick<AuthState, 'token' | 'userInfo'> {
  if (!readRememberLogin()) {
    return { token: null, userInfo: null }
  }
  return {
    token: localStorage.getItem(STORAGE_KEYS.token),
    userInfo: safeParseJson(localStorage.getItem(STORAGE_KEYS.userInfo)) as UserInfo | null,
  }
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    ...readPersistedAuth(),
  }),
  getters: {
    // Some backends use cookie/session login and don't return token in body.
    // Treat having userInfo as logged in as well (router guard will allow entry).
    isLoggedIn: (state) => Boolean(state.token) || Boolean(state.userInfo),
  },
  actions: {
    setAuth(payload: { token?: string | null; userInfo?: UserInfo }) {
      const nextToken = (payload.token ?? '').toString().trim()
      this.token = nextToken ? nextToken : null
      this.userInfo = payload.userInfo ?? null

      if (readRememberLogin()) {
        if (this.token) localStorage.setItem(STORAGE_KEYS.token, this.token)
        else localStorage.removeItem(STORAGE_KEYS.token)
        localStorage.setItem(STORAGE_KEYS.userInfo, JSON.stringify(this.userInfo))
      } else {
        localStorage.removeItem(STORAGE_KEYS.token)
        localStorage.removeItem(STORAGE_KEYS.userInfo)
      }
    },
    /** 关闭「记住登录」时：去掉持久化，当前会话内存态仍可保留 */
    dropPersistedAuth() {
      localStorage.removeItem(STORAGE_KEYS.token)
      localStorage.removeItem(STORAGE_KEYS.userInfo)
    },
    clearAuth() {
      this.token = null
      this.userInfo = null
      localStorage.removeItem(STORAGE_KEYS.token)
      localStorage.removeItem(STORAGE_KEYS.userInfo)
    },
  },
})
