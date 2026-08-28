<template>
  <div v-loading="loading" class="level-config">
    <div class="level-config__toolbar">
      <div>
        <h3 class="level-config__title">事件等级自定义映射</h3>
        <p class="level-config__hint">
          自定义每种告警事件的响应级别，修改后即刻应用至新触发告警
        </p>
      </div>
      <el-button
        class="level-config__reset"
        :loading="resetting"
        :disabled="saving"
        @click="handleReset"
      >
        <el-icon><RefreshRight /></el-icon>
        恢复默认级别
      </el-button>
    </div>

    <div class="level-board">
      <section
        v-for="col in columns"
        :key="col.priority"
        class="level-col"
        :class="`is-p${col.priority}`"
      >
        <header class="level-col__head">
          <div class="level-col__title-row">
            <span class="level-col__icon" aria-hidden="true">
              <el-icon><component :is="col.icon" /></el-icon>
            </span>
            <div class="level-col__title-wrap">
              <div class="level-col__title">
                {{ col.title }}
                <span class="level-col__count">{{ col.items.length }} 种</span>
              </div>
              <p class="level-col__desc">{{ col.desc }}</p>
            </div>
          </div>
        </header>

        <div class="level-col__body">
          <article
            v-for="item in col.items"
            :key="item.key"
            class="event-card"
          >
            <div class="event-card__name">{{ item.label }}</div>
            <div class="event-card__desc">{{ item.desc }}</div>
            <div class="event-card__actions">
              <span class="event-card__adjust">调整到:</span>
              <button
                v-for="target in moveTargets(col.priority)"
                :key="target.priority"
                type="button"
                class="move-btn"
                :class="`is-p${target.priority}`"
                :disabled="saving || resetting"
                @click="setPriority(item.key, target.priority)"
              >
                <i class="move-btn__dot" />
                {{ target.short }}
              </button>
            </div>
          </article>

          <div v-if="!col.items.length" class="level-col__empty">暂无事件</div>
        </div>
      </section>
    </div>

    <div class="level-config__footer">
      <el-button :disabled="saving || resetting" @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="resetting" @click="handleSave">
        保存设置
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  InfoFilled,
  RefreshRight,
  Warning,
  WarningFilled,
} from '@element-plus/icons-vue'
import {
  fetchNotifySetting,
  resetNotifySetting,
  updateNotifySetting,
  type NotifyPriorityMap,
} from '@/api/setting'

type RiskPriority = 0 | 1 | 2

type EventMeta = {
  label: string
  desc: string
}

type EventItem = {
  key: string
  label: string
  desc: string
  priority: RiskPriority
}

/** 仅名称/说明；条数与 key 以接口 priority_map 为准 */
const EVENT_META: Record<string, EventMeta> = {
  exploit_behavior: { label: '漏洞利用行为', desc: '高风险威胁拦截' },
  vuln_intel: { label: '新漏洞情报', desc: '外部漏洞预警' },
  scan_probe: { label: '扫描探测日志', desc: '攻击探测行为拦截' },
  blocked_access: { label: '被拦截的访问行为', desc: '异常访问行为拦截' },
  critical_vuln: { label: '新发现关键漏洞', desc: '资产中存在高危漏洞' },
  weak_password: { label: '新发现弱口令', desc: '资产中存在弱密码账户' },
  high_risk_port: { label: '新发现高危端口', desc: '资产开放了高风险端口' },
  relation_anomaly: { label: '访问关系异常', desc: '环境或资产感知参考' },
  new_asset: { label: '新资产发现', desc: '环境或资产感知参考' },
  new_port: { label: '新端口发现', desc: '环境或资产感知参考' },
}

const EVENT_ORDER = [
  'exploit_behavior',
  'vuln_intel',
  'blocked_access',
  'scan_probe',
  'critical_vuln',
  'weak_password',
  'high_risk_port',
  'relation_anomaly',
  'new_asset',
  'new_port',
] as const

const COLUMN_META: Array<{
  priority: RiskPriority
  title: string
  short: string
  desc: string
  icon: unknown
}> = [
  {
    priority: 0,
    title: 'P0 紧急级别',
    short: 'P0',
    desc: '强提醒、桌面通知、最高优先处置',
    icon: Warning,
  },
  {
    priority: 1,
    title: 'P1 重要级别',
    short: 'P1',
    desc: '标准列表高亮警报、常规威胁提醒',
    icon: WarningFilled,
  },
  {
    priority: 2,
    title: 'P2 普通级别',
    short: 'P2',
    desc: '常规资产感知或轻度事件感知',
    icon: InfoFilled,
  },
]

const loading = ref(false)
const saving = ref(false)
const resetting = ref(false)
const priorityMap = reactive<Record<string, RiskPriority>>({})
const savedSnapshot = ref<NotifyPriorityMap>({})

const allItems = computed<EventItem[]>(() => {
  const keys = Object.keys(priorityMap)
  const ordered = EVENT_ORDER.filter(key => keys.includes(key))
  const extras = keys.filter(
    key => !EVENT_ORDER.includes(key as (typeof EVENT_ORDER)[number]),
  )
  return [...ordered, ...extras].map(key => {
    const meta = EVENT_META[key]
    return {
      key,
      label: meta?.label || key,
      desc: meta?.desc || '-',
      priority: priorityMap[key],
    }
  })
})

const columns = computed(() =>
  COLUMN_META.map(col => ({
    ...col,
    items: allItems.value.filter(item => item.priority === col.priority),
  })),
)

function moveTargets(current: RiskPriority) {
  return COLUMN_META.filter(col => col.priority !== current).map(col => ({
    priority: col.priority,
    short: col.short,
  }))
}

function normalizePriority(value: unknown, fallback: RiskPriority = 2): RiskPriority {
  const num = Number(value)
  if (num === 0 || num === 1 || num === 2) return num
  return fallback
}

function applyPriorityMap(map: NotifyPriorityMap | null | undefined) {
  const next: Record<string, RiskPriority> = {}
  Object.entries(map || {}).forEach(([key, value]) => {
    if (!key) return
    next[key] = normalizePriority(value, 2)
  })
  Object.keys(priorityMap).forEach(key => {
    delete priorityMap[key]
  })
  Object.assign(priorityMap, next)
  savedSnapshot.value = { ...next }
}

function toPriorityMapPayload(): NotifyPriorityMap {
  const payload: NotifyPriorityMap = {}
  Object.keys(priorityMap).forEach(key => {
    payload[key] = priorityMap[key]
  })
  return payload
}

function setPriority(key: string, value: number) {
  priorityMap[key] = normalizePriority(value, priorityMap[key] ?? 2)
}

async function loadConfig() {
  loading.value = true
  try {
    const res = await fetchNotifySetting()
    if (res?.code !== 0) {
      throw new Error(res?.msg || '读取等级配置失败')
    }
    applyPriorityMap(res.data?.priority_map)
  } catch (error) {
    applyPriorityMap({})
    ElMessage.error(error instanceof Error ? error.message : '读取等级配置失败')
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  applyPriorityMap(savedSnapshot.value)
}

async function handleReset() {
  try {
    await ElMessageBox.confirm(
      '确定将所有事件类型恢复为系统默认等级吗？此操作会立即生效。',
      '恢复默认级别',
      {
        type: 'warning',
        confirmButtonText: '确定恢复',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  resetting.value = true
  try {
    const res = await resetNotifySetting()
    if (res?.code !== 0) {
      throw new Error(res?.msg || '恢复默认失败')
    }
    applyPriorityMap(res.data?.priority_map)
    ElMessage.success('已恢复默认级别')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '恢复默认失败')
  } finally {
    resetting.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    const priority_map = toPriorityMapPayload()
    const res = await updateNotifySetting({ priority_map })
    if (res?.code !== 0) {
      throw new Error(res?.msg || '保存失败')
    }
    const nextMap = res.data?.priority_map || priority_map
    applyPriorityMap(nextMap)
    ElMessage.success('等级配置已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadConfig()
})
</script>

<style scoped lang="scss">
.level-config {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.level-config__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}

.level-config__title {
  margin: 0;
  color: var(--c-text);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.3;
}

.level-config__hint {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.level-config__reset {
  flex-shrink: 0;
  color: var(--c-info);
  background: transparent;
  border-color: color-mix(in srgb, var(--c-info) 42%, var(--c-border));

  &:hover,
  &:focus {
    color: var(--c-info);
    background: var(--c-info-bg);
    border-color: var(--c-info);
  }
}

.level-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.level-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid color-mix(in srgb, var(--level-accent) 32%, var(--c-border));
  border-radius: 14px;
  background: color-mix(in srgb, var(--c-bg-card) 88%, transparent);
  overflow: hidden;

  &.is-p0 {
    --level-accent: var(--c-danger);
    --level-accent-bg: var(--c-danger-bg);
  }

  &.is-p1 {
    --level-accent: var(--c-warn);
    --level-accent-bg: var(--c-warn-bg);
  }

  &.is-p2 {
    --level-accent: var(--c-info);
    --level-accent-bg: var(--c-info-bg);
  }
}

.level-col__head {
  flex-shrink: 0;
  padding: 14px 14px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--level-accent) 18%, var(--c-border-light));
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--level-accent-bg) 70%, transparent),
      transparent
    );
}

.level-col__title-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.level-col__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  margin-top: 1px;
  color: var(--level-accent);
  border: 1px solid color-mix(in srgb, var(--level-accent) 35%, transparent);
  border-radius: 8px;
  background: var(--level-accent-bg);
  font-size: 15px;
}

.level-col__title-wrap {
  min-width: 0;
}

.level-col__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--c-text);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
}

.level-col__count {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  color: var(--level-accent);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid color-mix(in srgb, var(--level-accent) 30%, transparent);
  border-radius: 999px;
  background: var(--level-accent-bg);
}

.level-col__desc {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.level-col__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 12px;
  overflow: auto;
}

.level-col__empty {
  display: grid;
  place-items: center;
  min-height: 96px;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  border: 1px dashed var(--c-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--c-bg) 55%, transparent);
}

.event-card {
  padding: 12px;
  border: 0;
  border-radius: 12px;
  background: color-mix(in srgb, var(--c-bg) 70%, var(--c-bg-card));
  box-shadow: 0 0px 4px color-mix(in srgb, var(--level-accent) 20%, transparent);
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;

  &:hover {
    // background: var(--c-bg-hover);
    box-shadow: 0 0px 4px color-mix(in srgb, var(--level-accent) 40%, transparent);
    transform: translateY(-1px);
  }
}

.event-card__name {
  color: var(--c-text);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.35;
}

.event-card__desc {
  margin-top: 4px;
  color: var(--c-text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.event-card__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.event-card__adjust {
  color: var(--c-text-muted);
  font-size: 12px;
}

.move-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  color: var(--c-text-secondary);
  font-size: 12px;
  font-weight: 600;
  background: color-mix(in srgb, var(--c-bg-card) 80%, transparent);
  border: 1px solid var(--c-border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &.is-p0 {
    --move-accent: var(--c-danger);
    --move-accent-bg: var(--c-danger-bg);
  }

  &.is-p1 {
    --move-accent: var(--c-warn);
    --move-accent-bg: var(--c-warn-bg);
  }

  &.is-p2 {
    --move-accent: var(--c-info);
    --move-accent-bg: var(--c-info-bg);
  }

  &:hover:not(:disabled) {
    color: var(--move-accent);
    background: var(--move-accent-bg);
    border-color: color-mix(in srgb, var(--move-accent) 40%, var(--c-border));
  }
}

.move-btn__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--move-accent);
}

.level-config__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
  padding-top: 4px;
}
</style>
