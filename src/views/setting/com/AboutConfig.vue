<template>
  <div class="about-config">
    <div class="about-card">
      <div class="about-card__badge" aria-hidden="true">
        <el-icon class="about-card__badge-icon"><Monitor /></el-icon>
      </div>
      <h3 class="about-card__title">风险治理平台桌面端</h3>
      <p class="about-card__version">Version {{ versionLabel }}</p>
      <p class="about-card__tagline">
        端云互补架构 · 高频监控与实时告警哨兵 · 强制通知响应机制
      </p>
    </div>

    <el-button
      class="about-export"
      :loading="exporting"
      @click="handleExportLogs"
    >
      <el-icon class="about-export__icon"><Download /></el-icon>
      导出本地运行诊断日志
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Monitor } from '@element-plus/icons-vue'

const exporting = ref(false)
const versionLabel = ref('1.0.4')

onMounted(async () => {
  if (!window.ipcRenderer?.invoke) {
    versionLabel.value = String(import.meta.env.VITE_APP_VERSION || '1.0.4')
    return
  }
  try {
    const res = (await window.ipcRenderer.invoke('app/get-version')) as {
      version?: string
    }
    if (res?.version) versionLabel.value = res.version
  } catch {
    // keep fallback
  }
})

async function handleExportLogs() {
  if (!window.ipcRenderer?.invoke) {
    ElMessage.warning('请在桌面端中导出诊断日志')
    return
  }
  exporting.value = true
  try {
    const res = (await window.ipcRenderer.invoke('app/export-diagnostic-logs')) as {
      ok?: boolean
      canceled?: boolean
      filePath?: string
      fileCount?: number
      message?: string
    }
    if (res?.canceled) return
    if (!res?.ok) {
      throw new Error(res?.message || '导出失败')
    }
    ElMessage.success(
      `诊断日志已导出${typeof res.fileCount === 'number' ? `（含 ${res.fileCount} 个日志文件）` : ''}`,
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped lang="scss">
.about-config {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  min-height: 360px;
  padding: 24px 16px;
}

.about-card {
  width: min(100%, 520px);
  padding: 36px 28px 32px;
  text-align: center;
  border: 1px solid color-mix(in srgb, var(--c-primary) 22%, var(--c-border));
  border-radius: 16px;
  background: color-mix(in srgb, var(--c-bg-card) 88%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent),
    0 12px 32px color-mix(in srgb, #000 16%, transparent);
}

.about-card__badge {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 18px;
  border-radius: 50%;
  color: var(--c-primary-light);
  background: color-mix(in srgb, var(--c-primary) 18%, var(--c-bg));
  border: 1px solid color-mix(in srgb, var(--c-primary) 28%, transparent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--c-primary) 22%, transparent);
}

.about-card__badge-icon {
  font-size: 30px;
}

.about-card__title {
  margin: 0;
  color: var(--c-text);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.02em;
}

.about-card__version {
  margin: 10px 0 0;
  color: var(--c-text-muted);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.4;
}

.about-card__tagline {
  margin: 14px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
  line-height: 1.6;
  opacity: 0.9;
}

.about-export {
  height: 40px;
  padding: 0 18px;
  color: var(--c-text-secondary);
  background: color-mix(in srgb, var(--c-bg-card) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-primary) 20%, var(--c-border));
  border-radius: 10px;
}

.about-export:hover {
  color: var(--c-text);
  border-color: color-mix(in srgb, var(--c-primary) 40%, var(--c-border));
  background: color-mix(in srgb, var(--c-primary-bg) 55%, var(--c-bg-card));
}

.about-export__icon {
  margin-right: 6px;
  font-size: 16px;
}
</style>
