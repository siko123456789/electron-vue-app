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
} as const

function safeParseJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem(STORAGE_KEYS.token),
    userInfo: safeParseJson(localStorage.getItem(STORAGE_KEYS.userInfo)) as UserInfo | null,
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
      if (this.token) localStorage.setItem(STORAGE_KEYS.token, this.token)
      else localStorage.removeItem(STORAGE_KEYS.token)
      localStorage.setItem(STORAGE_KEYS.userInfo, JSON.stringify(this.userInfo))
    },
    clearAuth() {
      this.token = null
      this.userInfo = null
      localStorage.removeItem(STORAGE_KEYS.token)
      localStorage.removeItem(STORAGE_KEYS.userInfo)
    },
  },
})
