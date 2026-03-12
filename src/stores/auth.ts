import { defineStore } from 'pinia'

type UserInfo = unknown

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
    userInfo: safeParseJson(localStorage.getItem(STORAGE_KEYS.userInfo)),
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token),
  },
  actions: {
    setAuth(payload: { token: string; userInfo?: UserInfo }) {
      this.token = payload.token
      this.userInfo = payload.userInfo ?? null
      localStorage.setItem(STORAGE_KEYS.token, payload.token)
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
