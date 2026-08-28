<template>
  <div class="risk-monitor-page">
    <header class="page-header">
      <h1 class="page-header__title">风险监测</h1>
      <p class="page-header__sub">
        P0 / P1 / P2 点击卡片展开 · P2 含基线异常 / 新资产服务 / 已有资产新服务
      </p>
    </header>

    <section class="metric-row">
      <button
        v-for="card in metricCards"
        :key="card.key"
        type="button"
        class="metric-card"
        :class="[`is-${card.tone}`, { 'is-active': activeMetric === card.key }]"
        @click="handleMetricClick(card.key)"
      >
        <div class="metric-card__head">
          <span class="metric-card__label">
            <i class="metric-card__dot" />
            {{ card.label }}
          </span>
          <span class="metric-card__badge">{{ card.badge }}</span>
        </div>
        <div class="metric-card__value">{{ card.value }}</div>
      </button>
    </section>

    <section class="list-controls">
      <div class="view-switch" role="tablist" aria-label="视图切换">
        <button
          v-for="tab in viewTabs"
          :key="tab.key"
          type="button"
          role="tab"
          class="view-switch__item"
          :class="{
            'is-active': viewMode === tab.key,
            'is-disabled': tab.disabled,
          }"
          :aria-selected="viewMode === tab.key"
          @click="handleViewChange(tab.key, tab.disabled)"
        >
          <el-icon><component :is="tab.icon" /></el-icon>
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <div class="filter-dim">
        <span class="filter-dim__label">
          <el-icon><Filter /></el-icon>
          维度过滤:
        </span>

        <el-select
          v-model="filters.priority"
          class="filter-select filter-select--priority"
          clearable
          placeholder="全部级别"
          @change="handlePriorityFilterChange"
        >
          <el-option label="P0 紧急" :value="0" />
          <el-option label="P1 高优" :value="1" />
          <el-option label="P2 关注" :value="2" />
        </el-select>

        <el-select
          v-model="filters.event_type"
          class="filter-select filter-select--type"
          clearable
          filterable
          :loading="eventTypesLoading"
          :placeholder="eventTypePlaceholder"
          @change="handleSearch"
        >
          <el-option
            v-for="item in eventTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>

        <el-select
          v-model="filters.status"
          class="filter-select filter-select--status"
          clearable
          placeholder="全部处置状态"
          @change="handleStatusFilterChange"
        >
          <el-option label="待处理" :value="0" />
          <el-option label="已处理" :value="1" />
        </el-select>

        <el-select
          v-model="filters.time_range"
          class="filter-select filter-select--time"
          placeholder="时间范围"
          @change="handleSearch"
        >
          <el-option label="今天" value="today" />
          <el-option label="最近 7 天" value="7d" />
          <el-option label="最近 30 天" value="30d" />
        </el-select>

        <span class="filter-dim__count">
          符合条件:
          <em>{{ total }}</em>
          条
        </span>

        <button
          v-if="showFilterReset"
          type="button"
          class="filter-reset-btn"
          @click="handleReset"
        >
          <el-icon><RefreshLeft /></el-icon>
          重置
        </button>
      </div>
    </section>

    <section class="list-panel">
      <div class="table-panel">
        <div class="table-panel__body" v-loading="loading">
          <el-table
            :data="tableData"
            height="100%"
            row-key="id"
            :row-class-name="tableRowClassName"
            @selection-change="handleSelectionChange"
          >
            <template #empty>
              <div class="risk-table-empty">
                <el-icon class="risk-table-empty__icon"><DataAnalysis /></el-icon>
                <span>暂无数据</span>
              </div>
            </template>
            <!-- <el-table-column type="selection" width="44" /> -->

            <el-table-column label="事件类型" width="230">
              <template #default="{ row }">
                <span class="type-tag" :class="eventTypeClass(row)">
                  <strong class="type-tag__priority">P{{ row.priority }}</strong>
                  <i class="type-tag__divider" aria-hidden="true" />
                  {{ row.event_type_name || row.event_type || '-' }}
                </span>
              </template>
            </el-table-column>

            <el-table-column label="风险名称" min-width="220">
              <template #default="{ row }">
                <span class="risk-name-cell" :title="row.title">{{ row.title || '-' }}</span>
              </template>
            </el-table-column>

            <el-table-column label="告警时间" min-width="158">
              <template #default="{ row }">
                <span class="time-cell">{{ row.occurred_at || '-' }}</span>
              </template>
            </el-table-column>

            <el-table-column label="状态" min-width="78" align="center">
              <template #default="{ row }">
                <span class="status-text" :class="row.status === 1 ? 'is-done' : 'is-pending'">
                  {{ statusLabel(row.status) }}
                </span>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <div class="op-cell">
                  <el-button
                    size="small"
                    @click="openDetail(row)"
                  >
                    详情
                  </el-button>
                  <el-button
                    size="small"
                    type="success"
                    @click="openStatusDialog(row)"
                  >
                    切换状态
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="total > 0" class="table-panel__pagination">
          <div class="pager-info">
            共 {{ total }} 条记录
            <span v-if="total > 0">
              | 显示第 {{ pageStart }} - {{ pageEnd }} 条
            </span>
          </div>
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            background
            layout="sizes, prev, pager, next, jumper"
            :page-sizes="[10, 20, 50]"
            :total="total"
            @current-change="handlePageChange"
            @size-change="handleSizeChange"
          />
        </div>
      </div>
    </section>

    <NotifyDetailPanel
      v-model="detailVisible"
      :row="detailRow"
      @detail-updated="handleDetailUpdated"
    />
    <BlockedAccessDetailPanel
      v-model="blockedDetailVisible"
      :row="blockedDetailRow"
    />
    <VulnerabilityDetailPanel
      v-model="vulnerabilityDetailVisible"
      :row="vulnerabilityDetailRow"
    />
    <CriticalVulnGovern
      v-if="governEventDetailKind === 'critical'"
      :visible="governEventDetailVisible"
      :single-task-mode="true"
      :external-task-list="governEventDetailList"
      @update:visible="governEventDetailVisible = $event"
      @refresh="handleGovernRefresh"
      @status-updated="handleGovernStatusUpdated"
    />
    <HighRiskPorts
      v-else-if="governEventDetailKind === 'port'"
      :visible="governEventDetailVisible"
      :single-task-mode="true"
      :external-task-list="governEventDetailList"
      @update:visible="governEventDetailVisible = $event"
      @refresh="handleGovernRefresh"
      @status-updated="handleGovernStatusUpdated"
    />
    <WeakPasswordGovern
      v-else-if="governEventDetailKind === 'weak'"
      :visible="governEventDetailVisible"
      :single-task-mode="true"
      :external-task-list="governEventDetailList"
      @update:visible="governEventDetailVisible = $event"
      @refresh="handleGovernRefresh"
      @status-updated="handleGovernStatusUpdated"
    />
    <StatusToggleDialog
      v-model="statusVisible"
      :row="statusRow"
      @updated="handleStatusUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DataAnalysis, Filter, Grid, Menu, Clock, RefreshLeft } from '@element-plus/icons-vue'
import {
  buildNotifyListBody,
  buildNotifySummaryBody,
  fetchNotifyEventTypes,
  fetchNotifyDetail,
  fetchNotifyList,
  fetchNotifySummary,
  type RiskMonitorItem,
} from '@/api/riskMonitor'
import { useNotifyRealtimeStore } from '@/stores/notifyRealtime'
import NotifyDetailPanel from './com/NotifyDetailPanel.vue'
import BlockedAccessDetailPanel from './com/BlockedAccessDetailPanel.vue'
import VulnerabilityDetailPanel from './com/VulnerabilityDetailPanel.vue'
import CriticalVulnGovern from '@/components/governCom/firstStep/criticalVulnGovern.vue'
import HighRiskPorts from '@/components/governCom/firstStep/highRiskPorts.vue'
import WeakPasswordGovern from '@/components/governCom/firstStep/weakPasswordGovern.vue'
import StatusToggleDialog from './com/StatusToggleDialog.vue'

const route = useRoute()
const router = useRouter()

type MetricKey = 'all' | 'p0' | 'p1' | 'p2' | 'handled'
type ViewMode = 'table' | 'kanban' | 'timeline'
type ApiResultLike = { code?: number; msg?: string; data?: unknown }
type NotifySummaryLike = {
  all?: number
  p0?: number
  p1?: number
  p2?: number
  handled?: number
}
type EventTypeOption = {
  label: string
  value: string
}

const loading = ref(false)
const viewMode = ref<ViewMode>('table')
const activeMetric = ref<MetricKey>('all')
const tableData = ref<RiskMonitorItem[]>([])
const selectedRows = ref<RiskMonitorItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
/** 程序改分页时挡住 el-pagination 的二次回调，避免接口连打两次 */
const suppressPagerFetch = ref(false)
const detailVisible = ref(false)
const detailRow = ref<RiskMonitorItem | null>(null)
const governEventDetailVisible = ref(false)
const governEventDetailKind = ref<'critical' | 'port' | 'weak' | ''>('')
const governEventDetailList = ref<Record<string, unknown>[]>([])
/** 当前打开的监测告警 id，治理后用最新 list 回填风险详情 */
const governEventDetailSourceId = ref<number | null>(null)
const blockedDetailVisible = ref(false)
const blockedDetailRow = ref<RiskMonitorItem | null>(null)
const vulnerabilityDetailVisible = ref(false)
const vulnerabilityDetailRow = ref<RiskMonitorItem | null>(null)
const statusVisible = ref(false)
const statusRow = ref<RiskMonitorItem | null>(null)

const overview = reactive({
  all: 0,
  p0: 0,
  p1: 0,
  p2: 0,
  handled: 0,
})

const filters = reactive({
  keyword: '',
  event_type: '' as string,
  /** 全部卡片不传 status；P0/P1/P2 传 0；已处理传 1 */
  status: '' as number | '',
  time_range: 'today',
  priority: '' as number | '',
})

const viewTabs = [
  { key: 'table' as const, label: '数据表格', icon: Grid, disabled: false },
  { key: 'kanban' as const, label: '看板视图', icon: Menu, disabled: false },
  { key: 'timeline' as const, label: '时间轴', icon: Clock, disabled: false },
]

const eventTypePlaceholder = computed(() => {
  const count = eventTypeOptions.value.length
  return count > 0 ? `全部事件类型 (${count}种)` : '全部事件类型'
})

/** 有筛选条件时显示重置 */
const showFilterReset = computed(() => {
  return (
    filters.priority !== '' ||
    Boolean(filters.event_type) ||
    filters.status !== '' ||
    filters.time_range !== 'today' ||
    activeMetric.value !== 'all'
  )
})

/** 事件类型下拉：来自 POST /notify/event-types */
const eventTypeOptions = ref<EventTypeOption[]>([])
const eventTypesLoading = ref(false)

const metricCards = computed(() => [
  {
    key: 'all' as const,
    label: '全部',
    badge: '总览',
    value: overview.all,
    tone: 'primary',
  },
  {
    key: 'p0' as const,
    label: 'P0',
    badge: '紧急优先',
    value: overview.p0,
    tone: 'danger',
  },
  {
    key: 'p1' as const,
    label: 'P1',
    badge: '高优',
    value: overview.p1,
    tone: 'warn',
  },
  {
    key: 'p2' as const,
    label: 'P2',
    badge: '关注',
    value: overview.p2,
    tone: 'info',
  },
  {
    key: 'handled' as const,
    label: '已处理',
    badge: '完成',
    value: overview.handled,
    tone: 'success',
  },
])

const pageStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
const pageEnd = computed(() => Math.min(page.value * pageSize.value, total.value))

function statusLabel(status: number) {
  return status === 1 ? '已处理' : '待处理'
}

const eventTypeToneMap = new Map<string, number>()
let nextEventTypeTone = 0

function eventTypeClass(row: RiskMonitorItem) {
  const priority = Number(row.priority)
  if (priority !== 0) return `is-p${priority}`

  // P0 按事件类型分配四种紧急色，不绑定具体名称，支持用户自定义类型；
  // 使用类型映射避免哈希碰撞导致不同类型显示成同一种颜色。
  const text = `${row.event_type || ''}|${row.event_type_name || ''}`
  if (!eventTypeToneMap.has(text)) {
    eventTypeToneMap.set(text, nextEventTypeTone % 4)
    nextEventTypeTone += 1
  }
  return `is-p0-tone-${eventTypeToneMap.get(text)}`
}

function parseSummary(summary: string) {
  const text = (summary || '').trim()
  if (!text) return { source: '-', target: '-' }
  const matched = text.match(/^(\S+)\s*->\s*(\S+)/)
  if (matched) {
    return { source: matched[1], target: matched[2] }
  }
  return { source: text, target: '-' }
}

function applyMetricToFilters(key: MetricKey) {
  activeMetric.value = key
  // 点卡片 → list / event-types
  // 全部：priority 不传（空）
  // P0/P1/P2：priority 传 0/1/2，status 传 0
  // 已处理：status 传 1，priority 不传
  filters.event_type = ''
  if (key === 'all') {
    filters.priority = ''
    filters.status = ''
    return
  }
  if (key === 'handled') {
    filters.priority = ''
    filters.status = 1
    return
  }
  filters.status = 0
  filters.priority = key === 'p0' ? 0 : key === 'p1' ? 1 : 2
}

/** 按当前卡片 priority 拉事件类型；全部/已处理不传 priority */
async function fetchEventTypeOptions() {
  eventTypesLoading.value = true
  try {
    const payload =
      filters.priority === '' || filters.priority === null || filters.priority === undefined
        ? {}
        : { priority: Number(filters.priority) }

    const res = await fetchNotifyEventTypes(payload)

    const raw = res as ApiResultLike & { list?: Array<{ event_type?: string; event_type_name?: string }> }
    if (raw?.code !== undefined && raw.code !== 0) {
      eventTypeOptions.value = []
      ElMessage.warning(raw.msg || '获取事件类型失败')
      return
    }

    const data = (raw?.data && typeof raw.data === 'object' ? raw.data : raw) as {
      list?: Array<{ event_type?: string; event_type_name?: string }>
    }
    const list = Array.isArray(data?.list) ? data.list : []
    eventTypeOptions.value = list
      .filter((item) => item?.event_type)
      .map((item) => ({
        value: String(item.event_type),
        label: String(item.event_type_name || item.event_type),
      }))

    // 当前选中类型不在新列表里时清空
    if (
      filters.event_type &&
      !eventTypeOptions.value.some((item) => item.value === filters.event_type)
    ) {
      filters.event_type = ''
    }
  } catch (error) {
    eventTypeOptions.value = []
    console.error('[风险监测] notify/event-types 请求失败 =>', error)
  } finally {
    eventTypesLoading.value = false
  }
}

function buildQuery() {
  return buildNotifyListBody({
    current_page: page.value,
    page_size: pageSize.value,
    status: filters.status,
    priority: filters.priority,
    event_type: filters.event_type,
    time_range: filters.time_range,
  })
}

async function fetchOverview() {
  try {
    const payload = buildNotifySummaryBody(filters.time_range)
    const res = await fetchNotifySummary(payload)

    // 兼容：{ code, data } 或直接返回统计对象
    const raw = res as ApiResultLike & NotifySummaryLike
    if (raw?.code !== undefined && raw.code !== 0) {
      ElMessage.error(raw.msg || '获取总览失败')
      return false
    }

    const data = (raw?.data && typeof raw.data === 'object' ? raw.data : raw) as NotifySummaryLike
    overview.all = Number(data.all) || 0
    overview.p0 = Number(data.p0) || 0
    overview.p1 = Number(data.p1) || 0
    overview.p2 = Number(data.p2) || 0
    overview.handled = Number(data.handled) || 0
    return true
  } catch (error) {
    console.error('[风险监测] notify/summary 请求失败 =>', error)
    ElMessage.warning('总览接口调用失败，卡片数字暂无法更新')
    return false
  }
}

async function fetchList() {
  loading.value = true
  try {
    const payload = buildQuery()
    const res = await fetchNotifyList(payload)

    if (res?.code === 0 && res.data) {
      const data = res.data
      tableData.value = Array.isArray(data.list) ? data.list : []
      total.value = Number(data.total) || 0
      // 不要回写 page / pageSize：会触发分页组件 current-change / size-change，导致再打一次 list
    } else {
      tableData.value = []
      total.value = 0
      ElMessage.error(res?.msg || '获取风险监测列表失败')
    }
  } catch (error) {
    tableData.value = []
    total.value = 0
    console.error('[风险监测] notify/list 请求失败 =>', error)
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(message || '获取风险监测列表失败')
  } finally {
    loading.value = false
  }
}

/** 静默改页码，避免和手动 fetch 叠成两次请求 */
async function resetPageSilent(nextPage = 1) {
  if (page.value === nextPage) return
  suppressPagerFetch.value = true
  page.value = nextPage
  await nextTick()
  suppressPagerFetch.value = false
}

async function refreshAll() {
  await resetPageSilent(1)
  await fetchOverview()
  await fetchEventTypeOptions()
  await fetchList()
}

function handleMetricClick(key: MetricKey) {
  applyMetricToFilters(key)
  void (async () => {
    await resetPageSilent(1)
    await fetchEventTypeOptions()
    await fetchList()
  })()
}

function handleSearch() {
  void refreshAll()
}

function handlePriorityFilterChange(value: number | '' | null | undefined) {
  const priority =
    value === '' || value === null || value === undefined ? '' : Number(value)
  filters.priority = priority === '' || Number.isNaN(priority) ? '' : priority

  if (filters.priority === '') {
    if (filters.status === 1) activeMetric.value = 'handled'
    else activeMetric.value = 'all'
  } else if (filters.priority === 0) {
    activeMetric.value = 'p0'
  } else if (filters.priority === 1) {
    activeMetric.value = 'p1'
  } else if (filters.priority === 2) {
    activeMetric.value = 'p2'
  }

  void (async () => {
    await resetPageSilent(1)
    await fetchEventTypeOptions()
    await fetchList()
  })()
}

function handleStatusFilterChange(value: number | '' | null | undefined) {
  const status =
    value === '' || value === null || value === undefined ? '' : Number(value)
  filters.status = status === '' || Number.isNaN(status) ? '' : status

  if (filters.status === 1) {
    activeMetric.value = 'handled'
    filters.priority = ''
  } else if (filters.priority === 0) {
    activeMetric.value = 'p0'
  } else if (filters.priority === 1) {
    activeMetric.value = 'p1'
  } else if (filters.priority === 2) {
    activeMetric.value = 'p2'
  } else {
    activeMetric.value = 'all'
  }

  void handleSearch()
}

function handleReset() {
  filters.keyword = ''
  filters.event_type = ''
  filters.status = ''
  filters.time_range = 'today'
  filters.priority = ''
  activeMetric.value = 'all'
  void refreshAll()
}

function handlePageChange() {
  if (suppressPagerFetch.value) return
  void fetchList()
}

function handleSizeChange() {
  if (suppressPagerFetch.value) return
  void (async () => {
    await resetPageSilent(1)
    await fetchList()
  })()
}

function handleViewChange(key: ViewMode, disabled?: boolean) {
  if (disabled) {
    ElMessage.info('该视图稍后开放，当前先使用表格模式')
    return
  }
  viewMode.value = key
}

function handleSelectionChange(rows: RiskMonitorItem[]) {
  selectedRows.value = rows
}

function parseDetailPayload(row: RiskMonitorItem): Record<string, unknown> {
  const raw = row.detail ?? row.detail_json
  let parsed: Record<string, unknown> | null = null
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    parsed = raw as Record<string, unknown>
  } else if (typeof raw === 'string') {
    try {
      const value = JSON.parse(raw)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed = value as Record<string, unknown>
      }
    } catch {
      // 保留空对象，让治理弹窗按自己的空数据状态展示
    }
  }
  if (!parsed) return {}
  try {
    return JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>
  } catch {
    return { ...parsed }
  }
}

/** 告警 detail → 治理弹窗任务字段（补齐 asset_ip 等别名） */
function mapGovernTaskDetail(
  kind: 'critical' | 'port' | 'weak',
  detail: Record<string, unknown>,
): Record<string, unknown> {
  const assetIp =
    detail.asset_ip ?? detail.affect_asset_ip ?? detail.ip ?? ''
  const port = detail.port ?? detail.lan_port ?? detail.affect_port ?? ''
  if (kind === 'port') {
    const vulnList = Array.isArray(detail.vulns)
      ? detail.vulns
      : Array.isArray(detail.related_vulns)
        ? detail.related_vulns
        : []
    // 显式组装，避免展开代理对象时丢掉 vulns
    return {
      id: detail.id,
      asset_id: detail.asset_id,
      asset_ip: assetIp,
      ip: detail.ip ?? assetIp,
      port,
      lan_port: detail.lan_port ?? port,
      service: detail.service ?? '',
      protocol: detail.protocol ?? '',
      status: detail.status,
      is_weaker: detail.is_weaker,
      is_high_risk: detail.is_high_risk,
      finger: detail.finger,
      type: detail.type,
      version: detail.version,
      vulns: vulnList.map((item) =>
        item && typeof item === 'object'
          ? { ...(item as Record<string, unknown>) }
          : item,
      ),
      vuln_ids: Array.isArray(detail.vuln_ids)
        ? [...detail.vuln_ids]
        : vulnList
            .map((item) =>
              item && typeof item === 'object'
                ? (item as Record<string, unknown>).id
                : null,
            )
            .filter((id) => id !== null && id !== undefined),
    }
  }
  return {
    ...detail,
    asset_ip: assetIp,
    port,
    suggestion: detail.suggestion ?? detail.repair_suggestion ?? '',
    // 弱口令凭证有时在 suggestion（如 root:123456），describe 为空时补一份便于展示/验证
    describe:
      detail.describe ||
      detail.suggestion ||
      detail.repair_suggestion ||
      '',
  }
}

function resolveGovernEventKind(
  row: RiskMonitorItem,
): 'critical' | 'port' | 'weak' | '' {
  const type = String(row.event_type || '')
  if (type === 'critical_vuln') return 'critical'
  if (type === 'high_risk_port') return 'port'
  if (type === 'weak_password') return 'weak'

  const label = `${type}|${row.event_type_name || ''}`
  if (/新发现关键漏洞|critical_vuln/i.test(label)) return 'critical'
  if (/新发现高危端口|high_risk_port/i.test(label)) return 'port'
  if (/新发现弱口令|weak_password/i.test(label)) return 'weak'
  return ''
}

async function openGovernDetail(
  kind: 'critical' | 'port' | 'weak',
  row: RiskMonitorItem,
) {
  // 先关再挂载：避免 v-if 新建组件时 visible 已是 true，el-dialog 不触发 @open
  governEventDetailVisible.value = false
  governEventDetailKind.value = kind
  governEventDetailSourceId.value = Number(row.id) || null
  governEventDetailList.value = [
    mapGovernTaskDetail(kind, parseDetailPayload(row)),
  ]
  await nextTick()
  governEventDetailVisible.value = true
}

/** 用监测 list 里最新 detail 回填治理弹窗风险详情 */
function syncGovernEventDetailFromList() {
  const kind = governEventDetailKind.value
  const sourceId = governEventDetailSourceId.value
  if (!kind || sourceId == null) return
  const row = tableData.value.find(
    item => Number(item.id) === Number(sourceId),
  )
  if (!row) return
  governEventDetailList.value = [
    mapGovernTaskDetail(kind, parseDetailPayload(row)),
  ]
}

/** 收敛等治理操作后：刷新监测列表，并同步弹窗内风险详情 */
async function handleGovernRefresh() {
  await refreshAll()
  syncGovernEventDetailFromList()
}

async function openDetail(row: RiskMonitorItem) {
  const id = Number(row?.id)
  const eventTypeCode = String(row?.event_type || '').trim()
  if (!Number.isFinite(id) || !eventTypeCode) {
    ElMessage.warning('缺少详情查询所需的事件信息')
    return
  }

  let fetchedRow: RiskMonitorItem
  try {
    const res = await fetchNotifyDetail({
      id,
      event_type: eventTypeCode,
    })
    if (res?.code !== 0 || !res.data) {
      throw new Error(res?.msg || '获取风险详情失败')
    }
    // 保留列表基础字段，以详情接口返回内容为准覆盖 detail/detail_json
    const previousDetail = parseDetailPayload(row)
    const fetchedDetailValue = res.data.detail ?? res.data.detail_json
    const fetchedDetail = parseDetailPayload({
      ...res.data,
      detail: fetchedDetailValue,
    } as RiskMonitorItem)
    fetchedRow = {
      ...row,
      ...res.data,
      // 详情接口短暂返回旧数据时，保留本地刚确认的访问关系字段
      detail: {
        ...previousDetail,
        ...fetchedDetail,
        src_ips: Array.isArray(fetchedDetail.src_ips) && fetchedDetail.src_ips.length
          ? fetchedDetail.src_ips
          : previousDetail.src_ips,
        dest_ip: fetchedDetail.dest_ip || previousDetail.dest_ip,
        dst_port: fetchedDetail.dst_port ?? previousDetail.dst_port,
        upstream_active: previousDetail.upstream_active === false
          ? false
          : fetchedDetail.upstream_active ?? previousDetail.upstream_active,
        display_hint: fetchedDetail.display_hint ?? previousDetail.display_hint,
      },
      detail_json: res.data.detail_json ?? row.detail_json,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(message || '获取风险详情失败')
    return
  }

  const eventType = `${row.event_type || ''}|${row.event_type_name || ''}`
  const eventKind = resolveGovernEventKind(row)
  if (eventKind) {
    await openGovernDetail(eventKind, fetchedRow)
    return
  }
  if (eventType.includes('被拦截的访问行为') || row.event_type === 'blocked_access') {
    blockedDetailRow.value = fetchedRow
    blockedDetailVisible.value = true
    return
  }
  if (row.event_type === 'vuln_intel' || eventType.includes('漏洞情报')) {
    vulnerabilityDetailRow.value = fetchedRow
    vulnerabilityDetailVisible.value = true
    return
  }
  detailRow.value = fetchedRow
  detailVisible.value = true
}

function openStatusDialog(row: RiskMonitorItem) {
  statusRow.value = row
  statusVisible.value = true
}

/** 治理弹窗验证/治理后：先本地改状态，再刷新 list 并用最新 detail 回填 */
async function handleGovernStatusUpdated(payload?: {
  ids?: Array<string | number>
  vuln_status?: number
}) {
  const ids = (payload?.ids || [])
    .map(Number)
    .filter(id => Number.isFinite(id) && id > 0)
  const nextStatus =
    payload?.vuln_status === undefined || payload?.vuln_status === null
      ? 3
      : Number(payload.vuln_status)

  if (ids.length && Number.isFinite(nextStatus)) {
    const idSet = new Set(ids)
    governEventDetailList.value = governEventDetailList.value.map(item => {
      const itemId = Number(item.id)
      if (!idSet.has(itemId)) return item
      return {
        ...item,
        vuln_status: nextStatus,
      }
    })
  }

  await refreshAll()
  syncGovernEventDetailFromList()
}

function handleStatusUpdated() {
  void refreshAll()
}

function handleDetailUpdated(updatedRow: RiskMonitorItem) {
  detailRow.value = updatedRow
  tableData.value = tableData.value.map(item =>
    Number(item.id) === Number(updatedRow.id)
      ? { ...item, ...updatedRow }
      : item,
  )
}

const notifyRealtime = useNotifyRealtimeStore()
const highlightAlertId = ref<string | null>(null)
let focusingAlertId: string | null = null

function tableRowClassName({ row }: { row: RiskMonitorItem }) {
  return highlightAlertId.value && String(row.id) === highlightAlertId.value
    ? 'is-alert-focus'
    : ''
}

async function dismissDesktopAlert(alertId: string) {
  try {
    await window.ipcRenderer?.invoke('app/alert-dismiss', alertId)
  } catch {
    // ignore
  }
}

/** 桌面/托盘点击：定位 list 行并打开详情，绑定成功后再消弹窗 */
async function bindFocusAlert(alertId: string) {
  const id = String(alertId || '').trim()
  if (!id) return
  // 路由监听、focusRevision 监听和页面初始化可能同时触发同一个定位请求。
  if (focusingAlertId === id) return
  focusingAlertId = id

  try {
    // 尽量露出该条：清级别筛选、待处理、回第一页
    filters.priority = ''
    filters.status = 0
    activeMetric.value = 'all'
    await resetPageSilent(1)
    await fetchOverview()
    await fetchEventTypeOptions()
    await fetchList()

    let row = tableData.value.find((item) => String(item.id) === id) || null
    if (!row) {
      // 当前页没有则放宽状态再试一次
      filters.status = ''
      await fetchList()
      row = tableData.value.find((item) => String(item.id) === id) || null
    }

    highlightAlertId.value = id
    if (row) {
      openDetail(row)
      await nextTick()
      await dismissDesktopAlert(id)
      ElMessage.success('已定位到对应告警')
    } else {
      // 即使列表暂未刷出，也先消桌面窗，避免 P0 卡死；用户仍可在列表里找
      await dismissDesktopAlert(id)
      ElMessage.warning('未在当前列表找到该告警，已打开风险监测')
    }

    if (route.query.alertId) {
      const nextQuery = { ...route.query }
      delete nextQuery.alertId
      void router.replace({ path: route.path, query: nextQuery })
    }

    window.setTimeout(() => {
      if (highlightAlertId.value === id) highlightAlertId.value = null
    }, 5000)
  } finally {
    if (focusingAlertId === id) focusingAlertId = null
  }
}

watch(
  () => notifyRealtime.focusRevision,
  async () => {
    if (notifyRealtime.focusRevision <= 0) return
    const id = notifyRealtime.consumeFocusAlert() || String(route.query.alertId || '')
    if (id) await bindFocusAlert(id)
  },
)

watch(
  () => route.query.alertId,
  (alertId) => {
    const id = String(alertId || '').trim()
    if (!id) return
    notifyRealtime.requestFocusAlert(id)
  },
)

/** WS summary 推送：同步顶部卡片（不打断当前筛选） */
watch(
  () => notifyRealtime.summaryRevision,
  () => {
    if (notifyRealtime.summaryRevision <= 0) return
    const s = notifyRealtime.summary
    overview.all = Number(s.all) || 0
    overview.p0 = Number(s.p0) || 0
    overview.p1 = Number(s.p1) || 0
    overview.p2 = Number(s.p2) || 0
    overview.handled = Number(s.handled) || 0
  },
)

/** 新告警 / 状态变更：静默刷列表 */
watch(
  () => notifyRealtime.listRevision,
  (rev, prev) => {
    if (rev <= 0) return
    if (typeof prev === 'number' && rev <= prev) return
    void fetchList()
  },
)

onMounted(() => {
  void refreshAll().then(() => {
    const id =
      notifyRealtime.consumeFocusAlert() || String(route.query.alertId || '').trim()
    if (id) void bindFocusAlert(id)
  })
})
</script>

<style scoped lang="scss">
.risk-monitor-page {
  --section-gap: var(--sp-4);
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--section-gap);
  box-sizing: border-box;
  min-height: 0;
  height: 100%;
  padding: var(--section-gap) var(--sp-5);
  background: var(--c-bg);
  overflow: hidden;
}

/* 覆盖公共 filter-area 底部 14px margin，避免和页面 gap 叠加 */
.risk-monitor-page .filter-area {
  margin: 0;
}

/* 一体式控制条：视图切换 + 维度过滤 */
.list-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 14px;
  padding: 8px 10px;
  background: var(--c-bg-card);
  border: 1px solid var(--c-border);
  border-radius: 12px;
}

.view-switch {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 2px;
  padding: 4px;
  /* 毛玻璃轨道：半透明 + 背景模糊 */
  background: color-mix(in srgb, var(--c-bg) 42%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-border) 75%, transparent);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent),
    0 4px 18px color-mix(in srgb, #000 14%, transparent);
  backdrop-filter: blur(16px) saturate(1.25);
  -webkit-backdrop-filter: blur(16px) saturate(1.25);
}

.view-switch__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  color: var(--c-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;

  :deep(.el-icon) {
    font-size: 14px;
  }

  &.is-active {
    color: var(--c-primary);
    /* 选中块：更亮一层的玻璃胶囊 */
    background: color-mix(in srgb, var(--c-primary) 16%, color-mix(in srgb, var(--c-bg-card) 55%, transparent));
    border-color: color-mix(in srgb, var(--c-primary) 38%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, #fff 28%, transparent),
      0 0 0 1px color-mix(in srgb, var(--c-primary) 8%, transparent),
      0 4px 14px color-mix(in srgb, var(--c-primary) 18%, transparent);
    backdrop-filter: blur(12px) saturate(1.35);
    -webkit-backdrop-filter: blur(12px) saturate(1.35);
  }

  &.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:hover:not(.is-disabled):not(.is-active) {
    color: var(--c-text-secondary);
    background: color-mix(in srgb, var(--c-bg-card) 55%, transparent);
  }
}

/*
 * 浅色：亮透科技毛玻璃（避免发灰凹陷）
 * — 高亮半透明底 + 紫青描边光 + 选中外发光
 */
html[data-theme='light'] {
  .view-switch {
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.78) 0%,
      rgba(245, 240, 255, 0.58) 48%,
      rgba(236, 248, 255, 0.62) 100%
    );
    border: 1px solid rgba(124, 58, 237, 0.2);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.95),
      inset 0 -1px 0 rgba(124, 58, 237, 0.04),
      0 0 0 1px rgba(255, 255, 255, 0.7),
      0 0 18px rgba(124, 58, 237, 0.1),
      0 0 32px rgba(56, 189, 248, 0.08);
    backdrop-filter: blur(22px) saturate(1.45);
    -webkit-backdrop-filter: blur(22px) saturate(1.45);
  }

  .view-switch__item {
    color: color-mix(in srgb, var(--c-primary) 28%, #8b90a5);

    &.is-active {
      color: var(--c-primary);
      background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.95) 0%,
        rgba(243, 238, 255, 0.72) 100%
      );
      border-color: rgba(124, 58, 237, 0.4);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 1),
        0 0 0 1px rgba(167, 139, 250, 0.22),
        0 0 10px rgba(124, 58, 237, 0.22),
        0 0 22px rgba(99, 102, 241, 0.14),
        0 0 28px rgba(56, 189, 248, 0.1);
      backdrop-filter: blur(14px) saturate(1.5);
      -webkit-backdrop-filter: blur(14px) saturate(1.5);
    }

    &:hover:not(.is-disabled):not(.is-active) {
      color: var(--c-primary);
      background: rgba(255, 255, 255, 0.45);
      box-shadow: inset 0 0 0 1px rgba(124, 58, 237, 0.12);
    }
  }
}

.filter-dim {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  margin-left: auto;
}

.filter-dim__label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 2px;
  color: var(--c-primary);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;

  :deep(.el-icon) {
    font-size: 14px;
  }
}

.filter-select {
  flex: 0 0 auto;
}

.filter-select--priority {
  width: 120px;
}

.filter-select--type {
  width: 168px;
}

.filter-select--status {
  width: 126px;
}

.filter-select--time {
  width: 118px;
}

.filter-select :deep(.el-select__wrapper) {
  min-height: 32px;
  padding: 2px 10px;
  color: var(--c-text-secondary);
  background-color: var(--c-bg);
  border-radius: 999px;
  box-shadow: 0 0 0 1px var(--c-border) inset;
  transition: box-shadow 0.15s ease;
}

.filter-select :deep(.el-select__wrapper.is-hovering:not(.is-focused)) {
  box-shadow: 0 0 0 1px var(--c-border-strong) inset;
}

.filter-select :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--c-primary) inset;
}

.filter-dim__count {
  margin-left: 4px;
  color: var(--c-text-muted);
  font-size: 12px;
  white-space: nowrap;

  em {
    margin: 0 2px;
    color: var(--c-primary);
    font-style: normal;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
}

.filter-reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  color: var(--c-text-secondary);
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;

  :deep(.el-icon) {
    font-size: 14px;
  }

  &:hover {
    color: var(--c-primary);
    background: var(--c-primary-bg);
    border-color: color-mix(in srgb, var(--c-primary) 32%, var(--c-border));
  }
}

.page-header__title {
  margin: 0;
  color: var(--c-text);
  font-size: var(--fs-4xl);
  font-weight: var(--fw-bold);
  line-height: 1.2;
}

.page-header__sub {
  margin: var(--sp-2) 0 0;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--sp-3);
}

@property --metric-flow-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.metric-card {
  --metric-dot-color: var(--c-primary);
  --metric-flow-color: var(--c-primary);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-height: 72px;
  padding: var(--sp-3);
  overflow: hidden;
  color: var(--c-text);
  text-align: left;
  background: var(--c-bg-card);
  border: 1px solid color-mix(in srgb, var(--metric-flow-color) 32%, var(--c-border));
  border-radius: var(--r-xl);
  cursor: pointer;
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;

  &::before {
    content: '';
    position: absolute;
    inset: 0 auto auto 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    opacity: 0.9;
  }

  &::after {
    position: absolute;
    inset: 0;
    z-index: 2;
    padding: 1px;
    content: '';
    pointer-events: none;
    border-radius: inherit;
    background: conic-gradient(
      from var(--metric-flow-angle),
      transparent 0 58%,
      color-mix(in srgb, var(--metric-flow-color) 38%, transparent) 66%,
      var(--metric-flow-color) 74%,
      #fff 80%,
      var(--metric-flow-color) 86%,
      transparent 94% 100%
    );
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    mask-composite: exclude;
    opacity: 0;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px color-mix(in srgb, var(--metric-flow-color) 12%, transparent);
  }

  &.is-active {
    border-color: color-mix(in srgb, var(--metric-flow-color) 68%, var(--c-border));
    box-shadow: 0 8px 24px color-mix(in srgb, var(--metric-flow-color) 14%, transparent),
      0 0 18px color-mix(in srgb, var(--metric-flow-color) 12%, transparent);
    transform: translateY(-2px);

    &::after {
      animation: metric-card-border-flow 3.6s linear infinite;
      opacity: 0.92;
    }

  }

  &.is-primary {
    --metric-flow-color: var(--c-primary);
    &::before {
      background: linear-gradient(135deg, var(--c-primary-bg), transparent 70%);
    }

    .metric-card__dot,
    .metric-card__badge {
      color: var(--c-primary);
      background: var(--c-primary-bg);
    }

    .metric-card__dot {
      --metric-dot-color: var(--c-primary);
      color: var(--c-primary);
      background: var(--c-primary);
    }

    &.is-active {
      border-color: color-mix(in srgb, var(--metric-flow-color) 68%, var(--c-border));
    }
  }

  &.is-danger {
    --metric-flow-color: var(--c-danger);
    &::before {
      background: linear-gradient(135deg, var(--c-danger-bg), transparent 70%);
    }

    .metric-card__dot {
      --metric-dot-color: var(--c-danger);
      color: var(--c-danger);
      background: var(--c-danger);
    }

    .metric-card__badge {
      color: var(--c-danger);
      background: var(--c-danger-bg);
    }

    &.is-active {
      border-color: color-mix(in srgb, var(--metric-flow-color) 68%, var(--c-border));
    }
  }

  &.is-warn {
    --metric-flow-color: var(--c-warn);
    &::before {
      background: linear-gradient(135deg, var(--c-warn-bg), transparent 70%);
    }

    .metric-card__dot {
      --metric-dot-color: var(--c-warn);
      color: var(--c-warn);
      background: var(--c-warn);
    }

    .metric-card__badge {
      color: var(--c-warn);
      background: var(--c-warn-bg);
    }

    &.is-active {
      border-color: color-mix(in srgb, var(--metric-flow-color) 68%, var(--c-border));
    }
  }

  &.is-info {
    --metric-flow-color: var(--c-info);
    &::before {
      background: linear-gradient(135deg, var(--c-info-bg), transparent 70%);
    }

    .metric-card__dot {
      --metric-dot-color: var(--c-info);
      color: var(--c-info);
      background: var(--c-info);
    }

    .metric-card__badge {
      color: var(--c-info);
      background: var(--c-info-bg);
    }

    &.is-active {
      border-color: color-mix(in srgb, var(--metric-flow-color) 68%, var(--c-border));
    }
  }

  &.is-success {
    --metric-flow-color: var(--c-success);
    &::before {
      background: linear-gradient(135deg, var(--c-success-bg), transparent 70%);
    }

    .metric-card__dot {
      --metric-dot-color: var(--c-success);
      color: var(--c-success);
      background: var(--c-success);
    }

    .metric-card__badge {
      color: var(--c-success);
      background: var(--c-success-bg);
    }

    &.is-active {
      border-color: color-mix(in srgb, var(--metric-flow-color) 68%, var(--c-border));
    }
  }
}

.metric-card__head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}

.metric-card__label {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--c-text-secondary);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
}

.metric-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  .metric-card.is-active & {
    animation: metric-card-pulse 1.6s ease-in-out infinite;
  }
}

@keyframes metric-card-border-flow {
  from {
    --metric-flow-angle: 0deg;
  }
  to {
    --metric-flow-angle: 360deg;
  }
}

@keyframes metric-card-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--metric-dot-color) 0%, transparent);
  }
  50% {
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--metric-dot-color) 22%, transparent);
  }
}

.metric-card__badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  white-space: nowrap;
}

.metric-card__value {
  position: relative;
  z-index: 1;
  color: var(--c-text);
  font-size: 28px;
  font-weight: var(--fw-bold);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.list-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--section-gap);
  min-height: 0;
}

.table-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--c-bg-card) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-border) 72%, transparent);
  border-radius: var(--r-xl);
  box-shadow: 0 14px 36px color-mix(in srgb, var(--c-primary) 7%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.42);
  -webkit-backdrop-filter: blur(16px) saturate(1.18);
  backdrop-filter: blur(16px) saturate(1.18);
}

.table-panel__body {
  flex: 1;
  min-height: 0;
  height: auto;
  overflow: hidden;
}

.risk-table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 148px;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}

.risk-table-empty__icon {
  color: var(--c-text-muted);
  font-size: 38px;
  opacity: 0.72;
}

.table-panel__pagination {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  margin: var(--section-gap) var(--sp-3) var(--sp-3);
}

.pager-info {
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  white-space: nowrap;
}

.type-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  max-width: 100%;
  padding: 0 8px;
  border: 1px solid transparent;
  color: var(--c-info);
  background: var(--c-info-bg);
  border-radius: var(--r-sm);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  white-space: nowrap;

  &__priority {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }

  &__divider {
    width: 1px;
    height: 12px;
    margin: 0 7px;
    background: currentColor;
    opacity: 0.28;
  }

  &::before {
    width: 5px;
    height: 5px;
    margin-right: 6px;
    content: '';
    background: currentColor;
    border-radius: 50%;
    box-shadow: 0 0 8px color-mix(in srgb, currentColor 48%, transparent);
  }

  /* 颜色只由 priority 决定，事件类型名称可以由用户自由配置。 */
  &.is-p0 {
    color: #c2410c;
    background: color-mix(in srgb, #c2410c 14%, var(--c-bg-card));
    border-color: color-mix(in srgb, #c2410c 42%, transparent);
    box-shadow: inset 3px 0 0 #c2410c;
    border-style: solid;
  }

  &.is-p0-tone-0,
  &.is-p0-tone-1,
  &.is-p0-tone-2,
  &.is-p0-tone-3 {
    border-style: solid;
  }

  &.is-p0-tone-0 {
    color: #c2410c;
    background: color-mix(in srgb, #c2410c 14%, var(--c-bg-card));
    border-color: color-mix(in srgb, #c2410c 42%, transparent);
    box-shadow: inset 3px 0 0 #c2410c;
  }

  &.is-p0-tone-1 {
    color: #ea580c;
    background: color-mix(in srgb, #ea580c 14%, var(--c-bg-card));
    border-color: color-mix(in srgb, #ea580c 42%, transparent);
    box-shadow: inset 3px 0 0 #ea580c;
  }

  &.is-p0-tone-2 {
    color: #9a3412;
    background: color-mix(in srgb, #9a3412 14%, var(--c-bg-card));
    border-color: color-mix(in srgb, #9a3412 42%, transparent);
    box-shadow: inset 3px 0 0 #9a3412;
  }

  &.is-p0-tone-3 {
    color: #d97706;
    background: color-mix(in srgb, #d97706 14%, var(--c-bg-card));
    border-color: color-mix(in srgb, #d97706 42%, transparent);
    box-shadow: inset 3px 0 0 #d97706;
  }

  &.is-p1 {
    color: #d97706;
    background: color-mix(in srgb, #f59e0b 14%, var(--c-bg-card));
    border-color: color-mix(in srgb, #f59e0b 42%, transparent);
    box-shadow: inset 3px 0 0 #f59e0b;
  }

  &.is-p2 {
    color: #2563eb;
    background: color-mix(in srgb, #3b82f6 12%, var(--c-bg-card));
    border-color: color-mix(in srgb, #3b82f6 38%, transparent);
    box-shadow: inset 3px 0 0 #3b82f6;
  }
}

:root:not([data-theme='light']) .type-tag.is-p0 {
  color: #fdba74;
  background: color-mix(in srgb, #c2410c 24%, var(--c-bg-card));
  border-color: color-mix(in srgb, #fb923c 46%, transparent);
  box-shadow: inset 3px 0 0 #fb923c;
}

:root:not([data-theme='light']) .type-tag.is-p0-tone-0 {
  color: #fdba74;
  background: color-mix(in srgb, #c2410c 24%, var(--c-bg-card));
  border-color: color-mix(in srgb, #fdba74 46%, transparent);
  box-shadow: inset 3px 0 0 #fdba74;
}

:root:not([data-theme='light']) .type-tag.is-p0-tone-1 {
  color: #fb923c;
  background: color-mix(in srgb, #ea580c 24%, var(--c-bg-card));
  border-color: color-mix(in srgb, #fb923c 46%, transparent);
  box-shadow: inset 3px 0 0 #fb923c;
}

:root:not([data-theme='light']) .type-tag.is-p0-tone-2 {
  color: #fed7aa;
  background: color-mix(in srgb, #9a3412 30%, var(--c-bg-card));
  border-color: color-mix(in srgb, #fed7aa 46%, transparent);
  box-shadow: inset 3px 0 0 #fed7aa;
}

:root:not([data-theme='light']) .type-tag.is-p0-tone-3 {
  color: #fbbf24;
  background: color-mix(in srgb, #d97706 26%, var(--c-bg-card));
  border-color: color-mix(in srgb, #fbbf24 46%, transparent);
  box-shadow: inset 3px 0 0 #fbbf24;
}

:root:not([data-theme='light']) .type-tag.is-p1 {
  color: #fbbf24;
  background: color-mix(in srgb, #d97706 24%, var(--c-bg-card));
  border-color: color-mix(in srgb, #fbbf24 46%, transparent);
  box-shadow: inset 3px 0 0 #fbbf24;
}

:root:not([data-theme='light']) .type-tag.is-p2 {
  color: #60a5fa;
  background: color-mix(in srgb, #2563eb 22%, var(--c-bg-card));
  border-color: color-mix(in srgb, #60a5fa 44%, transparent);
  box-shadow: inset 3px 0 0 #60a5fa;
}

.risk-name-cell {
  display: block;
  overflow: hidden;
  color: var(--c-text);
  font-size: var(--fs-base);
  font-weight: var(--fw-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-cell {
  color: var(--c-text-secondary);
  font-variant-numeric: tabular-nums;
}

.status-text {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);

  &.is-pending {
    color: var(--c-warn);
    background: var(--c-warn-bg);
    border-color: color-mix(in srgb, var(--c-warn) 24%, transparent);
  }

  &.is-done {
    color: var(--c-success);
    background: var(--c-success-bg);
    border-color: color-mix(in srgb, var(--c-success) 24%, transparent);
  }
}

:deep(.el-table__body tr:hover > td.el-table__cell) {
  background: color-mix(in srgb, var(--c-primary-bg) 42%, var(--c-bg-card)) !important;
}

:deep(.el-table__body tr.is-alert-focus > td.el-table__cell) {
  background: color-mix(in srgb, var(--c-danger-bg) 85%, var(--c-bg-card)) !important;
  box-shadow: inset 3px 0 0 var(--c-danger);
}

.op-muted {
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}

.op-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.op-cell :deep(.el-button) {
  border-radius: 9px;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 14px color-mix(in srgb, var(--c-primary) 14%, transparent);
  }
}

.op-cell :deep(.el-button--success) {
  color: var(--c-success);
  background: var(--c-success-bg);
  border-color: color-mix(in srgb, var(--c-success) 34%, transparent);
}

.op-link {
  padding: 0;
  color: var(--c-primary-light);
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: var(--fs-sm);
  white-space: nowrap;

  &:hover {
    color: var(--c-primary);
  }
}

@media (max-width: 1280px) {
  .metric-row {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .metric-card__badge {
    height: 20px;
    padding: 0 6px;
    font-size: 11px;
  }
}

@media (max-width: 900px) {
  .risk-monitor-page {
    padding: var(--section-gap) var(--sp-4);
  }

  .metric-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .list-controls {
    align-items: stretch;
  }

  .filter-dim {
    width: 100%;
  }

  .filter-reset-btn {
    margin-left: 0;
  }

  .filter-select--priority,
  .filter-select--type,
  .filter-select--status,
  .filter-select--time {
    width: auto;
    flex: 1 1 140px;
  }

  .table-panel__pagination {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
