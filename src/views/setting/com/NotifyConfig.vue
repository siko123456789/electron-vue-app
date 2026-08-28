<template>
  <div v-loading="loading" class="notify-config">
    <div class="notify-config__toolbar">
      <div>
        <h3 class="notify-config__title">通知偏好设置</h3>
        <p class="notify-config__hint">
          自定义 P0 / P1 / P2 告警在桌面的原生声音与弹窗行为
        </p>
      </div>
    </div>

    <div class="notify-config__list">
      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">P0 声音提醒</div>
          <p class="setting-card__desc">开启后触发 P0 紧急告警时自动播放系统级警报音效</p>
        </div>
        <el-checkbox v-model="form.p0_sound_enabled" :true-value="1" :false-value="0" />
      </section>

      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">P0 勿扰时段</div>
          <p class="setting-card__desc">
            设定时段内 P0 告警自动静音，但右下角弹窗依然保持强提醒驻留
          </p>
          <div class="setting-card__time">
            <el-time-picker
              v-model="form.p0_do_not_disturb_start"
              class="notify-time"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="开始"
              :clearable="true"
            />
            <span class="setting-card__time-sep">至</span>
            <el-time-picker
              v-model="form.p0_do_not_disturb_end"
              class="notify-time"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="结束"
              :clearable="true"
            />
          </div>
        </div>
      </section>

      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">P0 任务栏红色闪烁</div>
          <p class="setting-card__desc">未处理 P0 时，Windows 任务栏图标持续闪烁高亮</p>
        </div>
        <el-checkbox v-model="form.p0_taskbar_flash_enabled" :true-value="1" :false-value="0" />
      </section>

      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__head">
            <div>
              <div class="setting-card__title">P1 弹窗开关</div>
              <p class="setting-card__desc">关闭后 P1 告警不弹窗，仅直接进入应用列表</p>
            </div>
            <el-checkbox v-model="form.p1_popup_enabled" :true-value="1" :false-value="0" />
          </div>
          <div class="setting-card__extra">
            <span class="setting-card__extra-label">P1 自动消失展现时长:</span>
            <el-select
              v-model="form.p1_auto_dismiss_seconds"
              class="notify-select"
              :disabled="form.p1_popup_enabled !== 1"
            >
              <el-option
                v-for="opt in dismissOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
        </div>
      </section>

      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">P2 普通告警列表展示</div>
          <p class="setting-card__desc">关闭后普通 P2 告警不在监测列表中陈列</p>
        </div>
        <el-checkbox v-model="form.p2_workbench_enabled" :true-value="1" :false-value="0" />
      </section>
      <section class="setting-card notify-test-card">
        <div class="setting-card__main">
          <div class="setting-card__title">弹窗效果测试（前端假数据）</div>
          <p class="setting-card__desc">
            不请求后端，直接弹出桌面通知。P0 可连点多条看折叠；P1 看限时消失；P2 为轻提示。
          </p>
          <div class="notify-test-actions">
            <el-button class="notify-test-btn is-p0" @click="handleTestAlert(0)">
              测试 P0
            </el-button>
            <el-button class="notify-test-btn is-p1" @click="handleTestAlert(1)">
              测试 P1
            </el-button>
            <el-button class="notify-test-btn is-p2" @click="handleTestAlert(2)">
              测试 P2
            </el-button>
            <el-button plain @click="handleClearP0Test">清空 P0 栈</el-button>
          </div>
        </div>
      </section>
    </div>

    <div class="notify-config__footer">
      <el-button :disabled="saving" @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存设置</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchNotifySetting,
  updateNotifySetting,
  type NotifySettingData,
} from '@/api/setting'
import { useNotifyRealtimeStore } from '@/stores/notifyRealtime'

type NotifyForm = {
  p0_sound_enabled: number
  p0_do_not_disturb_start: string
  p0_do_not_disturb_end: string
  p0_taskbar_flash_enabled: number
  p1_popup_enabled: number
  p1_auto_dismiss_seconds: number
  p2_workbench_enabled: number
}

const dismissOptions = [
  { value: 3, label: '3 秒' },
  { value: 5, label: '5 秒' },
  { value: 10, label: '10 秒 (推荐)' },
  { value: 15, label: '15 秒' },
  { value: 30, label: '30 秒' },
]

const loading = ref(false)
const saving = ref(false)
const form = reactive<NotifyForm>(createDefaultForm())
const savedSnapshot = ref<NotifyForm>(createDefaultForm())
const notifyRealtime = useNotifyRealtimeStore()

function createDefaultForm(): NotifyForm {
  return {
    p0_sound_enabled: 1,
    p0_do_not_disturb_start: '',
    p0_do_not_disturb_end: '',
    p0_taskbar_flash_enabled: 1,
    p1_popup_enabled: 1,
    p1_auto_dismiss_seconds: 5,
    p2_workbench_enabled: 1,
  }
}

function toFlag(value: unknown, fallback = 0) {
  const num = Number(value)
  return num === 1 ? 1 : Number.isFinite(num) ? (num ? 1 : 0) : fallback
}

function toSeconds(value: unknown, fallback = 5) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return fallback
  return Math.round(num)
}

function applyForm(data: Partial<NotifySettingData> | null | undefined) {
  const next: NotifyForm = {
    p0_sound_enabled: toFlag(data?.p0_sound_enabled, 1),
    p0_do_not_disturb_start: String(data?.p0_do_not_disturb_start || ''),
    p0_do_not_disturb_end: String(data?.p0_do_not_disturb_end || ''),
    p0_taskbar_flash_enabled: toFlag(data?.p0_taskbar_flash_enabled, 1),
    p1_popup_enabled: toFlag(data?.p1_popup_enabled, 1),
    p1_auto_dismiss_seconds: toSeconds(data?.p1_auto_dismiss_seconds, 5),
    p2_workbench_enabled: toFlag(data?.p2_workbench_enabled, 1),
  }
  Object.assign(form, next)
  savedSnapshot.value = { ...next }
  notifyRealtime.cachePrefsFromSetting(next)
}

function handleCancel() {
  Object.assign(form, savedSnapshot.value)
}

async function loadConfig() {
  loading.value = true
  try {
    const res = await fetchNotifySetting()
    if (res?.code !== 0) {
      throw new Error(res?.msg || '读取通知配置失败')
    }
    applyForm(res.data)
  } catch (error) {
    applyForm(createDefaultForm())
    ElMessage.error(error instanceof Error ? error.message : '读取通知配置失败')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    const payload = {
      p0_sound_enabled: form.p0_sound_enabled,
      p0_do_not_disturb_start: form.p0_do_not_disturb_start || '',
      p0_do_not_disturb_end: form.p0_do_not_disturb_end || '',
      p0_taskbar_flash_enabled: form.p0_taskbar_flash_enabled,
      p1_popup_enabled: form.p1_popup_enabled,
      p1_auto_dismiss_seconds: form.p1_auto_dismiss_seconds,
      p2_workbench_enabled: form.p2_workbench_enabled,
    }
    const res = await updateNotifySetting(payload)
    if (res?.code !== 0) {
      throw new Error(res?.msg || '保存失败')
    }
    applyForm(res.data || payload)
    ElMessage.success('通知配置已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

let testSeq = 0

async function handleTestAlert(priority: 0 | 1 | 2) {
  if (!window.ipcRenderer?.invoke) {
    ElMessage.warning('请在 Electron 桌面端测试弹窗')
    return
  }

  // 先把当前表单偏好灌进 store，测试结果跟页面开关一致（无需先保存）
  notifyRealtime.cachePrefsFromSetting(form)

  testSeq += 1
  const samples = {
    0: {
      title: `测试 P0 紧急告警 #${testSeq}`,
      message: '模拟漏洞利用行为，用于验证折叠常驻弹窗',
      event_type_name: '新漏洞利用行为',
    },
    1: {
      title: `测试 P1 高危端口 #${testSeq}`,
      message: '模拟 10.60.66.24:3389 高危端口发现',
      event_type_name: '新发现高危端口',
    },
    2: {
      title: `测试 P2 新资产 #${testSeq}`,
      message: '模拟新资产发现，默认轻提示',
      event_type_name: '新资产发现',
    },
  } as const

  const sample = samples[priority]
  const id = `test_${priority}_${Date.now()}_${testSeq}`

  let sound = false
  let popup = true
  let autoDismissSeconds = 5

  if (priority === 0) {
    popup = true
    sound = form.p0_sound_enabled === 1
    autoDismissSeconds = 0
  } else if (priority === 1) {
    popup = form.p1_popup_enabled === 1
    sound = false
    autoDismissSeconds = Math.max(1, Number(form.p1_auto_dismiss_seconds) || 5)
  } else {
    popup = true
    sound = false
    autoDismissSeconds = 3
  }

  if (!popup) {
    ElMessage.info(priority === 1 ? 'P1 弹窗已关闭，仅会进入列表逻辑' : '当前等级未开启弹窗')
    return
  }

  // 同步角标/闪烁，方便一起测托盘
  if (priority === 0) {
    const nextP0 = Math.max(1, Number(notifyRealtime.summary.p0 || 0) + 1)
    notifyRealtime.applySummary({
      ...notifyRealtime.summary,
      p0: nextP0,
      pending: Math.max(Number(notifyRealtime.summary.pending || 0), nextP0),
      all: Math.max(Number(notifyRealtime.summary.all || 0), nextP0),
    })
  }

  await window.ipcRenderer.invoke('app/show-alert', {
    id,
    title: sample.title,
    message: sample.message,
    variant: 'risk',
    sound,
    priority,
    autoDismissSeconds,
    forceDesktop: true,
  })

  ElMessage.success(`已触发测试 ${priority === 0 ? 'P0' : priority === 1 ? 'P1' : 'P2'}`)
}

async function handleClearP0Test() {
  try {
    await window.ipcRenderer?.invoke('app/alert-clear-p0')
    void window.ipcRenderer?.invoke('app/set-unread-count', { count: 0, flash: false })
    notifyRealtime.applySummary({
      ...notifyRealtime.summary,
      p0: 0,
    })
    ElMessage.success('已清空 P0 弹窗栈')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '清空失败')
  }
}

onMounted(() => {
  void loadConfig()
})
</script>

<style scoped lang="scss">
.notify-config {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.notify-config__toolbar {
  flex-shrink: 0;
}

.notify-config__title {
  margin: 0;
  color: var(--c-text);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.3;
}

.notify-config__hint {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.notify-config__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
  padding: 2px;
}

.notify-time {
  width: 128px;

  :deep(.el-input__wrapper),
  :deep(.el-input) {
    width: 128px;
  }
}

.notify-select {
  width: 148px;
}

.notify-config__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
  padding-top: 4px;
}

.notify-test-card {
  margin-top: 4px;
}

.notify-test-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.notify-test-btn.is-p0 {
  --el-button-bg-color: var(--c-danger);
  --el-button-border-color: var(--c-danger);
  --el-button-text-color: #fff;
  --el-button-hover-bg-color: color-mix(in srgb, var(--c-danger) 88%, #000);
  --el-button-hover-border-color: color-mix(in srgb, var(--c-danger) 88%, #000);
  --el-button-hover-text-color: #fff;
}

.notify-test-btn.is-p1 {
  --el-button-bg-color: var(--c-warn);
  --el-button-border-color: var(--c-warn);
  --el-button-text-color: #1f2937;
  --el-button-hover-bg-color: color-mix(in srgb, var(--c-warn) 88%, #000);
  --el-button-hover-border-color: color-mix(in srgb, var(--c-warn) 88%, #000);
  --el-button-hover-text-color: #1f2937;
}

.notify-test-btn.is-p2 {
  --el-button-bg-color: var(--c-info, #3b82f6);
  --el-button-border-color: var(--c-info, #3b82f6);
  --el-button-text-color: #fff;
  --el-button-hover-bg-color: color-mix(in srgb, var(--c-info, #3b82f6) 88%, #000);
  --el-button-hover-border-color: color-mix(in srgb, var(--c-info, #3b82f6) 88%, #000);
  --el-button-hover-text-color: #fff;
}
</style>
