import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

// 创建 axios 实例
const service: AxiosInstance = axios.create({
  baseURL: '/api', // 基础 URL，会自动加上前面的代理
  timeout: 60000, // 请求超时时间
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
})

// 请求拦截器
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从本地存储中获取 token
    const token = localStorage.getItem('token')
    // 如果有 token，添加到请求头
    if (token) {
      ;(config.headers as any).Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response
    // 这里可以根据后端返回的数据结构进行处理
    // 例如，如果后端返回 { code: 200, data: {...}, message: 'success' }
    // 或者 { code: 0, data: {...}, message: 'success' }
    if (data && typeof data === 'object' && 'code' in data) {
      const code = (data as any).code
      if (code === 200 || code === 0) return data

      const message = (data as any).message || (data as any).msg
      console.error('响应错误:', message)
      return Promise.reject(new Error(message || '请求失败'))
    }

    // 兼容：后端直接返回数组/字符串/空对象等没有 code 的结构
    return data
  },
  (error) => {
    console.error('响应错误:', error)
    // 处理网络错误、超时等情况
    if (error.response) {
      // 服务器返回错误状态码
      switch (error.response.status) {
        case 401:
          // 未授权，可能需要重新登录
          console.error('未授权，请重新登录')
          // 可以在这里跳转到登录页面
          break
        case 403:
          console.error('拒绝访问')
          break
        case 404:
          console.error('请求地址不存在')
          break
        case 500:
          console.error('服务器内部错误')
          break
        default:
          console.error(`请求失败: ${error.response.status}`)
      }
    } else if (error.request) {
      // 请求已发出，但没有收到响应
      console.error('网络错误，未收到响应')
    } else {
      // 请求配置出错
      console.error('请求配置错误:', error.message)
    }
    return Promise.reject(error)
  }
)

// 导出常用的请求方法
export default {
  get: (url: string, params?: any) => service.get(url, { params }),
  post: (url: string, data?: any) => service.post(url, data),
  put: (url: string, data?: any) => service.put(url, data),
  delete: (url: string, params?: any) => service.delete(url, { params })
}
