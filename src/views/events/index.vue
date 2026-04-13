<template>
  <main class="abnormal-monitoring">
    <header class="abnormal-monitoring__header">
      <h1 class="abnormal-monitoring__h1">
        <el-icon class="abnormal-monitoring__h1-ico">
          <DataLine />
        </el-icon>
        异常监测
      </h1>

      <div class="abnormal-monitoring__header-r">
        <div class="abnormal-monitoring__time-tabs">
          <button
            v-for="item in timeTabList"
            :key="item.value"
            type="button"
            class="abnormal-monitoring__time-tab"
            :class="{ 'is-on': timeFilter === item.value }"
            @click="timeFilter = item.value"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="abnormal-monitoring__updated">
          <el-icon><Timer /></el-icon>
          数据更新时间 {{ updateClock }}
        </div>
      </div>
    </header>

    <div class="abnormal-monitoring__grid">
      <div class="abnormal-monitoring__col abnormal-monitoring__col--left">
        <AbnormalEventsPanel
          :events="events"
          :loading="eventsLoading"
          :pagination="eventsPagination"
          :is-learning-period="isLearningPeriod"
          :config-loading="learningConfigLoading"
          @toggle-analysis="toggleAnalysis"
          @confirm-access-relation="handleConfirmAccessRelation"
          @view-learning-config="openLearningConfigDialog"
        />
      </div>
    </div>

    <div v-if="eventsPagination.total > 0" class="abnormal-monitoring__pagination">
      <el-pagination
        :current-page="eventsPagination.current_page"
        :page-size="eventsPagination.page_size"
        :total="eventsPagination.total"
        layout="slot, prev, pager, next"
        small
        @current-change="onEventsPageChange"
      >
        <span class="abnormal-monitoring__pagination-total">共 {{ eventsPagination.total }} 条</span>
      </el-pagination>
    </div>

    <el-dialog
      v-model="learningConfigVisible"
      title="当前学习期配置"
      width="640px"
      class="learning-config-dialog"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="learning-config-dialog__content ledger-triangle-loading-anchor">
  
        <div class="learning-config-dialog__status">
          <div
            class="learning-config-dialog__badge"
            :class="{ 'is-on': learningConfigForm.enabled }"
          >
            {{ learningConfigForm.enabled ? '学习期进行中' : '学习期未开启' }}
          </div>
          <div class="learning-config-dialog__summary">
            {{ learningConfigSummary }}
          </div>
        </div>

        <el-form
          :model="learningConfigForm"
          label-width="104px"
          class="learning-config-dialog__form"
        >
          <el-form-item label="学习时间">
            <div class="learning-config-dialog__days">
              <el-input-number
                v-model="learningConfigForm.learning_days"
                :min="1"
                :max="365"
                controls-position="right"
                size="small"
              />
              <span class="learning-config-dialog__unit">天</span>
            </div>
          </el-form-item>

          <el-form-item label="学习源IP">
            <el-input
              v-model="learningSrcIpsText"
              type="textarea"
              :rows="5"
              resize="none"
              placeholder="每行输入一个 IP 或 CIDR"
            />
          </el-form-item>

          <el-form-item label="目的IP">
            <el-input
              v-model="learningDestIpsText"
              type="textarea"
              :rows="5"
              resize="none"
              placeholder="每行输入一个 IP 或 CIDR"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="learning-config-dialog__footer">
          <el-button class="default-class" @click="learningConfigVisible = false">
            取消
          </el-button>
          <el-button
            type="danger"
            plain
            :loading="learningActionLoading"
            @click="handleEndLearningPeriod"
          >
            结束学习期
          </el-button>
          <el-button
            class="primary-class"
            type="primary"
            plain
            :loading="learningActionLoading"
            @click="handleSaveLearningConfig"
          >
            更改
          </el-button>
        </div>
      </template>
    </el-dialog>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { DataLine, Timer } from '@element-plus/icons-vue'
import AbnormalEventsPanel from './com/AbnormalEventsPanel.vue'
import {
  queryBaselineAnomalyEventsAPI,
  updateFlowProcessStatusAPI,
  queryLearningPeriodAPI,
  setLearningPeriodAPI,
  endLearningPeriodAPI
} from '@/api/threaAssessment'
import { ensureNdrAuthorKey } from '@/utils/ndr'

type TimeFilter = 'today' | '24h' | '3d' | '7d'

interface EventPagination {
  current_page: number
  page_size: number
  total: number
  total_pages: number
}

interface LearningConfigForm {
  configured: boolean
  id: number | null
  mode: string
  learning_days: number
  learning_src_ips: string[]
  learning_dest_ips: string[]
  enabled: boolean
}

interface AbnormalEventItem {
  id: string
  type: string
  title: string
  description: string
  time: string
  timestamp: number
  severity: string
  assetIp?: string
  port?: string | number
  srcIp?: string
  destIp?: string
  dstPort?: string | number
  src_ip?: string
  src_ips?: string[]
  dest_ip?: string
  dst_port?: string | number
  proto?: string
  isExpanded?: boolean
  isAnalyzing?: boolean
  isResponding?: boolean
  analysisData?: {
    newAudiences: string[]
  }
}

const events = ref<AbnormalEventItem[]>([])
const eventsLoading = ref(false)

const eventsPagination = reactive<EventPagination>({
  current_page: 1,
  page_size: 20,
  total: 0,
  total_pages: 0
})

const timeFilter = ref<TimeFilter>('24h')
const timeTabList = [
  { value: 'today', label: '当天' },
  { value: '24h', label: '最近24小时' },
  { value: '3d', label: '近3天' },
  { value: '7d', label: '近7天' }
]

const updateClock = ref('')
let clockTimer: number | null = null

const isLearningPeriod = ref(false)
const learningConfigVisible = ref(false)
const learningConfigLoading = ref(false)
const learningActionLoading = ref(false)

const learningConfigForm = reactive<LearningConfigForm>({
  configured: false,
  id: null,
  mode: 'learning_days',
  learning_days: 1,
  learning_src_ips: [],
  learning_dest_ips: [],
  enabled: false
})

const learningSrcIpsText = ref('')
const learningDestIpsText = ref('')

const learningConfigSummary = computed(() => {
  if (!learningConfigForm.configured) {
    return '尚未查询到学习期配置'
  }
  return `学习时长 ${learningConfigForm.learning_days || 0} 天，共 ${learningConfigForm.learning_src_ips.length} 个源IP/CIDR，${learningConfigForm.learning_dest_ips.length} 个目的IP/CIDR`
})

watch(timeFilter, async () => {
  eventsPagination.current_page = 1
  await fetchEvents()
})

onMounted(async () => {
  tickClock()
  clockTimer = window.setInterval(tickClock, 1000)
  try {
    await ensureNdrAuthorKey()
  } catch (error: any) {
    ElMessage.error(error?.message || '获取威胁检测系统授权信息失败')
    return
  }
  await fetchEvents()
})

onBeforeUnmount(() => {
  if (clockTimer) {
    window.clearInterval(clockTimer)
    clockTimer = null
  }
})

function getTimeRange() {
  const now = Date.now()
  let start: number

  switch (timeFilter.value) {
    case 'today':
      start = new Date().setHours(0, 0, 0, 0)
      break
    case '24h':
      start = now - 24 * 60 * 60 * 1000
      break
    case '3d':
      start = now - 3 * 24 * 60 * 60 * 1000
      break
    case '7d':
      start = now - 7 * 24 * 60 * 60 * 1000
      break
    default:
      start = now - 24 * 60 * 60 * 1000
  }

  return {
    start_time: start,
    end_time: now
  }
}

function tickClock() {
  updateClock.value = new Date().toLocaleTimeString()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function applyLearningConfig(data: any = {}) {
  learningConfigForm.configured = !!data.configured
  learningConfigForm.id = data.id ?? null
  learningConfigForm.mode = data.mode || 'learning_days'
  learningConfigForm.learning_days =
    Number(data.learning_days) > 0 ? Number(data.learning_days) : 1
  learningConfigForm.learning_src_ips = Array.isArray(data.learning_src_ips)
    ? data.learning_src_ips.filter(Boolean)
    : []
  learningConfigForm.learning_dest_ips = Array.isArray(data.learning_dest_ips)
    ? data.learning_dest_ips.filter(Boolean)
    : []
  learningConfigForm.enabled = !!data.enabled

  learningSrcIpsText.value = learningConfigForm.learning_src_ips.join('\n')
  learningDestIpsText.value = learningConfigForm.learning_dest_ips.join('\n')
}

function parseIpTextarea(text: string) {
  return String(text || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

async function fetchLearningPeriodConfig(openAfterFetch = false) {
  learningConfigLoading.value = true
  try {
    const res = await queryLearningPeriodAPI()
    if (res?.code !== 0) {
      throw new Error(res?.msg || '获取学习期配置失败')
    }

    const data = res?.data || {}
    applyLearningConfig(data)
    isLearningPeriod.value = !!data.enabled

    if (openAfterFetch) {
      learningConfigVisible.value = true
    }
  } catch (error: any) {
    console.error('fetchLearningPeriodConfig error:', error)
    ElMessage.error(error?.message || '获取学习期配置失败')
  } finally {
    learningConfigLoading.value = false
  }
}

async function fetchEvents() {
  eventsLoading.value = true
  try {
    const { start_time, end_time } = getTimeRange()
    const res = await queryBaselineAnomalyEventsAPI({
      current_page: eventsPagination.current_page,
      page_size: eventsPagination.page_size,
      start_time,
      end_time
    })

    if (res?.code === 1001) {
      events.value = []
      eventsPagination.total = 0
      eventsPagination.total_pages = 0
      isLearningPeriod.value = true
      await fetchLearningPeriodConfig()
      return
    }

    if (res?.code !== 0) {
      throw new Error(res?.msg || '获取异常事件失败')
    }

    isLearningPeriod.value = false
    const data = res?.data ?? {}
    const list = Array.isArray(data.events) ? data.events : []

    events.value = list.map((item: any, idx: number) => {
      const rawEventType = item.event_type || ''
      const audienceList = Array.isArray(item.src_ips)
        ? item.src_ips.filter(Boolean)
        : item.src_ip
          ? [item.src_ip]
          : []

      const normalizedType = rawEventType.includes('已有资产')
        ? 'existing_asset_service'
        : rawEventType.includes('新资产')
          ? 'new_asset_service'
          : 'baseline_anomaly'

      const normalizedSeverity =
        normalizedType === 'existing_asset_service'
          ? 'info'
          : normalizedType === 'new_asset_service'
            ? 'warning'
            : 'high'

      const normalizedTitle =
        normalizedType === 'existing_asset_service'
          ? '发现了新的服务（已有资产）'
          : normalizedType === 'new_asset_service'
            ? '发现了新的服务（新资产）'
            : '检测到业务关系基线异常'

      const normalizedDescription =
        normalizedType === 'baseline_anomaly'
          ? `${item.dest_ip || '-'} 的 ${item.dst_port ?? '-'}${item.proto ? ` (${item.proto})` : ''} 端口服务，新增了一个受众对象：${audienceList[0] || item.src_ip || '-'}`
          : `检测到 ${item.dest_ip || '-'}（${normalizedType === 'existing_asset_service' ? '已有资产' : '新的IP'}）提供了新的服务 ${item.dst_port ?? '-'}${item.proto ? ` (${item.proto})` : ''}`

      return {
        id: `ev-${idx}-${item.src_ip}-${item.dest_ip}-${item.dst_port}-${String(item.last_seen || '').slice(0, 30)}`,
        type: normalizedType,
        title: normalizedTitle,
        description: normalizedDescription,
        time: item.last_seen ? new Date(item.last_seen).toLocaleString() : '-',
        timestamp: item.last_seen ? new Date(item.last_seen).getTime() : 0,
        severity: normalizedSeverity,
        assetIp: item.dest_ip,
        port: item.dst_port,
        srcIp: item.src_ip,
        destIp: item.dest_ip,
        dstPort: item.dst_port,
        src_ip: item.src_ip,
        src_ips: audienceList,
        dest_ip: item.dest_ip,
        dst_port: item.dst_port,
        proto: item.proto,
        isExpanded: false,
        isAnalyzing: false,
        isResponding: false,
        analysisData: {
          newAudiences: audienceList
        }
      } as AbnormalEventItem
    })

    eventsPagination.current_page = data.page ?? eventsPagination.current_page
    eventsPagination.page_size = data.page_size ?? eventsPagination.page_size
    eventsPagination.total = data.total ?? 0
    eventsPagination.total_pages = data.total_pages ?? 0
  } catch (error: any) {
    events.value = []
    eventsPagination.total = 0
    eventsPagination.total_pages = 0
    console.error('fetchEvents error:', error)
    ElMessage.error(error?.message || '获取异常事件失败')
  } finally {
    eventsLoading.value = false
  }
}

async function toggleAnalysis(eventId: string) {
  const event = events.value.find((e) => e.id === eventId)
  if (!event) return

  if (event.isExpanded) {
    events.value = events.value.map((e) =>
      e.id === eventId ? { ...e, isExpanded: false } : e
    )
    return
  }

  if (!event.analysisData) {
    events.value = events.value.map((e) =>
      e.id === eventId ? { ...e, isAnalyzing: true } : e
    )

    await sleep(800)

    events.value = events.value.map((e) =>
      e.id === eventId
        ? {
            ...e,
            isAnalyzing: false,
            isExpanded: true,
            analysisData: { newAudiences: [] }
          }
        : e
    )
  } else {
    events.value = events.value.map((e) =>
      e.id === eventId ? { ...e, isExpanded: true } : e
    )
  }
}

async function handleConfirmAccessRelation(payload: {
  eventId: string
  ip?: string
  ips?: string[]
  isBatch?: boolean
}) {
  const event = events.value.find((item) => item.id === payload?.eventId)
  if (!event) return

  const destIp = event.dest_ip || event.destIp || event.assetIp || ''
  const destPort = event.dst_port || event.dstPort || event.port
  const ips = payload?.isBatch
    ? (payload.ips || []).filter(Boolean)
    : payload?.ip
      ? [payload.ip]
      : []

  if (!destIp || !ips.length) return

  try {
    const res = await updateFlowProcessStatusAPI({
      src_ips: ips,
      dest_ip: destIp,
      dest_port: destPort
    })

    const successMsg = String(res?.msg || res?.data?.msg || '')
    if (!successMsg.includes('成功')) {
      throw new Error(successMsg || '确认访问关系失败')
    }

    ElMessage.success(payload?.isBatch ? '已批量确认访问关系' : '已确认访问关系')
    await fetchEvents()
  } catch (error: any) {
    console.error('handleConfirmAccessRelation error:', error)
    ElMessage.error(error?.message || '确认访问关系失败')
  }
}

function onEventsPageChange(page: number) {
  eventsPagination.current_page = page
  fetchEvents()
}

async function openLearningConfigDialog() {
  await fetchLearningPeriodConfig(true)
}

async function handleSaveLearningConfig() {
  const payload = {
    id: learningConfigForm.id,
    mode: learningConfigForm.mode || 'learning_days',
    learning_days: Number(learningConfigForm.learning_days) > 0
      ? Number(learningConfigForm.learning_days)
      : 1,
    learning_src_ips: parseIpTextarea(learningSrcIpsText.value),
    learning_dest_ips: parseIpTextarea(learningDestIpsText.value),
    enabled: true
  }

  learningActionLoading.value = true
  try {
    const res = await setLearningPeriodAPI(payload)
    if (res?.code !== 0) {
      throw new Error(res?.msg || '学习期配置修改失败')
    }

    ElMessage.success(res?.msg || '学习期配置修改成功')
    await fetchLearningPeriodConfig()
    await fetchEvents()
  } catch (error: any) {
    console.error('handleSaveLearningConfig error:', error)
    ElMessage.error(error?.message || '学习期配置修改失败')
  } finally {
    learningActionLoading.value = false
  }
}

async function handleEndLearningPeriod() {
  learningActionLoading.value = true
  try {
    const res = await endLearningPeriodAPI({
      id: learningConfigForm.id
    })

    if (res?.code !== 0) {
      throw new Error(res?.msg || '结束学习期失败')
    }

    isLearningPeriod.value = false
    learningConfigVisible.value = false
    ElMessage.success(res?.msg || '学习期已结束')

    await fetchLearningPeriodConfig()
    await fetchEvents()
  } catch (error: any) {
    console.error('handleEndLearningPeriod error:', error)
    ElMessage.error(error?.message || '结束学习期失败')
  } finally {
    learningActionLoading.value = false
  }
}
</script>

<style scoped lang="scss">
.abnormal-monitoring {
  width: 100%;
  min-width: 0;
  padding: 32px 30px 30px;
  box-sizing: border-box;
  animation: am-in 0.45s ease both;
}

@keyframes am-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.abnormal-monitoring__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}

.abnormal-monitoring__h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #18181b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.abnormal-monitoring__h1-ico {
  font-size: 24px;
  color: var(--default-color);
}

.abnormal-monitoring__header-r {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  min-width: 0;
  justify-content: flex-end;
}

.abnormal-monitoring__time-tabs {
  display: flex;
  align-items: center;
  background: #fff;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  padding: 4px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.abnormal-monitoring__time-tabs::-webkit-scrollbar {
  display: none;
}

.abnormal-monitoring__time-tab {
  border: none;
  background: transparent;
  padding: 6px 12px;
  min-width: 88px;
  white-space: nowrap;
  border-radius: 8px;
  font-size: 12px;
  color: #71717a;
  cursor: pointer;
  transition: all 0.2s ease;
}

.abnormal-monitoring__time-tab.is-on {
  color: #fff;
  background: var(--default-color);
  box-shadow: 0 4px 12px rgba(var(--default-color-rgb), 0.28);
}

.abnormal-monitoring__updated {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #71717a;
  font-size: 12px;
}

.abnormal-monitoring__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}

.abnormal-monitoring__col {
  min-width: 0;
}

.abnormal-monitoring__pagination {
  margin-top: 20px;
  padding: 0 2px;
  display: flex;
  justify-content: flex-end;
  overflow-x: auto;
}

.abnormal-monitoring__pagination :deep(.el-pagination) {
  font-size: 12px;
  font-weight: 500;
  flex-wrap: nowrap;
}

.abnormal-monitoring__pagination :deep(.el-pagination .el-pagination__total) {
  color: #71717a;
  font-weight: 500;
}

.abnormal-monitoring__pagination-total {
  color: #71717a;
  font-weight: 500;
  white-space: nowrap;
}

.abnormal-monitoring__pagination :deep(.el-pagination .btn-prev),
.abnormal-monitoring__pagination :deep(.el-pagination .btn-next),
.abnormal-monitoring__pagination :deep(.el-pagination .el-pager li) {
  min-width: 28px;
  height: 28px;
  line-height: 26px;
  background: transparent !important;
  border: 1px solid #e4e4e7;
  border-radius: 6px;
  color: #52525b;
  font-weight: 500;
  margin: 0 2px;
}

.abnormal-monitoring__pagination :deep(.el-pagination .btn-prev:hover),
.abnormal-monitoring__pagination :deep(.el-pagination .btn-next:hover),
.abnormal-monitoring__pagination :deep(.el-pagination .el-pager li:hover) {
  color: var(--default-color);
  border-color: rgba(var(--default-color-rgb), 0.4);
  background: rgba(var(--default-color-rgb), 0.06) !important;
}

.abnormal-monitoring__pagination :deep(.el-pagination .el-pager li.is-active) {
  background: rgba(var(--default-color-rgb), 0.12) !important;
  border-color: var(--default-color);
  color: var(--default-color);
}

:deep(.learning-config-dialog) {
  border-radius: 18px;
  overflow: hidden;
}

.learning-config-dialog__content {
  position: relative;
  min-height: 240px;
}

.learning-config-dialog__status {
  margin-bottom: 18px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #fafafa;
  border: 1px solid #ececec;
}

.learning-config-dialog__badge {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: #f4f4f5;
  color: #71717a;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 10px;
}

.learning-config-dialog__badge.is-on {
  color: var(--default-color);
  background: rgba(var(--default-color-rgb), 0.12);
}

.learning-config-dialog__summary {
  font-size: 13px;
  line-height: 1.7;
  color: #52525b;
}

.learning-config-dialog__days {
  display: flex;
  align-items: center;
  gap: 10px;
}

.learning-config-dialog__unit {
  font-size: 12px;
  color: #71717a;
}

.learning-config-dialog__footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 1024px) {
  .abnormal-monitoring {
    padding: 24px 20px 24px;
  }

  .abnormal-monitoring__header {
    align-items: flex-start;
  }

  .abnormal-monitoring__header-r {
    width: 100%;
    justify-content: space-between;
  }

  .abnormal-monitoring__updated {
    margin-left: auto;
  }

  .abnormal-monitoring__pagination {
    margin-top: 18px;
  }
}

@media (max-width: 768px) {
  .abnormal-monitoring {
    padding: 18px 14px 20px;
  }

  .abnormal-monitoring__header {
    gap: 12px;
    margin-bottom: 18px;
  }

  .abnormal-monitoring__h1 {
    font-size: 18px;
  }

  .abnormal-monitoring__h1-ico {
    font-size: 20px;
  }

  .abnormal-monitoring__header-r {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .abnormal-monitoring__time-tabs {
    width: 100%;
    padding: 4px;
  }

  .abnormal-monitoring__time-tab {
    min-width: 78px;
    padding: 6px 10px;
  }

  .abnormal-monitoring__updated {
    margin-left: 0;
    justify-content: flex-end;
    font-size: 11px;
  }

  .abnormal-monitoring__pagination {
    justify-content: flex-start;
    margin-top: 14px;
  }

  :deep(.learning-config-dialog) {
    width: calc(100vw - 24px) !important;
    max-width: 640px;
  }

  .learning-config-dialog__status {
    padding: 12px;
  }

  .learning-config-dialog__footer {
    justify-content: stretch;
  }

  .learning-config-dialog__footer :deep(.el-button) {
    flex: 1 1 140px;
    margin-left: 0 !important;
  }
}

@media (max-width: 480px) {
  .abnormal-monitoring {
    padding: 14px 10px 18px;
  }

  .abnormal-monitoring__time-tab {
    min-width: 72px;
    font-size: 11px;
  }

  .abnormal-monitoring__updated {
    justify-content: flex-start;
  }

  .abnormal-monitoring__pagination :deep(.el-pagination) {
    font-size: 11px;
  }

  .learning-config-dialog__days {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}
</style>
