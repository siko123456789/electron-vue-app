import request from '../utils/request'

export function login(data: Record<string, any>) {
  // 实际登录请求
  return request.post('/user/login', data)
}

export function logout(params?: Record<string, any>) {
  // request.ts 已配置 baseURL = '/api'，这里不要再手写 '/api'
  return request.get('/user/logout', params)
}
