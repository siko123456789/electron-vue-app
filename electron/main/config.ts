import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * 应用配置读写（存放在 userData 下）
 * - 这里只做“读取/写入 JSON”以及错误兜底
 * - 业务层决定配置含义与默认值
 */

export type AppConfig = {
  notificationsEnabled?: boolean
}

export function createConfigStore(configFilePath: string) {
  async function loadAppConfig(): Promise<AppConfig> {
    if (!configFilePath) return {}
    try {
      const text = await fs.readFile(configFilePath, 'utf8')
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object') return {}
      return parsed as AppConfig
    } catch {
      return {}
    }
  }

  async function saveAppConfig(config: AppConfig): Promise<void> {
    if (!configFilePath) return
    try {
      await fs.mkdir(path.dirname(configFilePath), { recursive: true })
      await fs.writeFile(configFilePath, JSON.stringify(config, null, 2), 'utf8')
    } catch {
      // ignore
    }
  }

  return { loadAppConfig, saveAppConfig }
}

