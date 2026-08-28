/**
 * 通用时间和表单校验工具。
 * 兼容 Element Plus / Vue 表单 validator(rule, value, callback) 写法。
 */

export function formatTime(time: unknown) {
  if (time === null || time === undefined || time === '') return ''
  const date = new Date(String(time))
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function convertISOToLocalTime(isoString: unknown) {
  return isoString ? formatTime(isoString) : ''
}

export function validatePass(_rule: unknown, value: unknown, callback: (error?: Error) => void) {
  if (!value) callback(new Error('密码不能为空'))
  else if (/\s/.test(String(value))) callback(new Error('密码不能包含空格'))
  else callback()
}

export function validatePass2(_rule: unknown, value: unknown, callback: (error?: Error) => void, vm: { ruleForm?: { pass?: string } }) {
  if (String(value || '').trim() !== String(vm?.ruleForm?.pass || '')) callback(new Error('两次输入的密码不一致'))
  else callback()
}

const ipv4Part = '(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)'
const ipv4Regex = new RegExp(`^${ipv4Part}(\\.${ipv4Part}){3}$`)

export function validateIP(_rule: unknown, value: unknown, callback: (error?: Error) => void) {
  ipv4Regex.test(String(value || '').trim()) ? callback() : callback(new Error('请输入正确的IP'))
}

export function validatePort(_rule: unknown, value: unknown, callback: (error?: Error) => void) {
  const port = Number(String(value ?? '').trim())
  if (String(value ?? '').trim() && Number.isInteger(port) && port >= 0 && port <= 65535) callback()
  else callback(new Error('请输入正确的端口号'))
}

export function validateNetworkSegment(_rule: unknown, value: unknown, callback: (error?: Error) => void) {
  const match = String(value || '').trim().match(/^(.+)\/(\d{1,2})$/)
  const prefix = match ? Number(match[2]) : -1
  if (match && ipv4Regex.test(match[1]) && prefix >= 0 && prefix <= 32) callback()
  else callback(new Error('请输入正确的网段'))
}

export function validateIPOrNetworkSegment(rule: unknown, value: unknown, callback: (error?: Error) => void) {
  const text = String(value || '').trim()
  if (ipv4Regex.test(text)) callback()
  else validateNetworkSegment(rule, text, callback)
}

export function validateSpace(_rule: unknown, value: unknown, callback: (error?: Error) => void) {
  if (value && String(value).trim() === '') callback(new Error('不能只输入空格'))
  else callback()
}

export function validateMAC(_rule: unknown, value: unknown, callback: (error?: Error) => void) {
  const text = String(value || '')
  const mac = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{12}$/
  if (!text || mac.test(text)) callback()
  else callback(new Error('请输入正确的mac'))
}
