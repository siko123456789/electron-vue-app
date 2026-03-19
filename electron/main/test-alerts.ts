import type { AlertVariant } from './tray-manager'

/**
 * 测试告警（仅用于开发/自测）
 * - 每分钟推送一条告警，用来验证：右上角弹窗/托盘气泡/未读数联动
 */
export function createTestAlertsRunner(opts: {
  isMainWindowHidden: () => boolean
  showAlert: (payload: { variant: AlertVariant; title: string; message: string; sound: boolean }) => void
}) {
  let timer: NodeJS.Timeout | null = null

  function setEnabled(enabled: boolean) {
    const on = Boolean(enabled)
    if (on) {
      if (timer) return
      let tick = 0
      const sendOne = () => {
        if (!opts.isMainWindowHidden()) return
        tick += 1
        const kind = tick % 2 === 1 ? 'vuln' : 'port'
        const now = new Date().toLocaleString()
        const alertTitle = kind === 'vuln' ? '新发现关键漏洞' : '新发现高危端口'
        const alertMessage =
          kind === 'vuln'
            ? `检测到关键漏洞需要立即处理。\n时间：${now}\n建议：尽快修复并验证。`
            : `检测到高危端口暴露风险。\n时间：${now}\n建议：立即核查端口来源并限制访问。`
        opts.showAlert({ variant: 'risk', title: alertTitle, message: alertMessage, sound: true })
      }

      setTimeout(sendOne, 1000)
      timer = setInterval(sendOne, 60_000)
    } else {
      if (timer) clearInterval(timer)
      timer = null
    }
  }

  function isEnabled() {
    return Boolean(timer)
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  return { setEnabled, isEnabled, stop }
}

