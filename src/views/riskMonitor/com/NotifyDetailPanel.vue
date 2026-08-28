<!--
  风险详情弹窗：扫描探测、新漏洞利用行为共用。
  两类日志字段结构和封禁/隔离/忽略处置动作一致，统一在此维护。
  新资产发现类数据在本组件内切换为访问关系确认视图。
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
import {
  applyAttackEventDispose,
  batchAddRuleById,
  fetchNotifyDetail,
  updateFlowProcessStatus,
  updateAttackEventProcessStatus,
  type RiskMonitorItem,
} from '@/api/riskMonitor'
import { formatTime } from '@/utils/validator'

const visible = defineModel<boolean>({ default: false })

const props = defineProps<{
  row: RiskMonitorItem | null
}>()

const emit = defineEmits<{
  'detail-updated': [row: RiskMonitorItem]
}>()

type DetailShape = {
  action?: string
  attack_type?: string
  count?: number
  dest_ip?: string
  dest_port?: number | string
  signature?: string
  src_ip?: string
  timestamp?: string
  event_type?: string
  dst_port?: number | string
  src_ips?: string[]
  upstream_active?: boolean
  display_hint?: string
  process_status?: string | string[]
}

type AssetDiscoveryDetail = {
  eventType: string
  destIp: string
  destPort: number
  srcIps: string[]
  lastSeen: string
}

type BlockedAccessDetail = {
  timestamp: string
  srcIp: string
  dstIp: string
  dstPort: string
  ruleId: string
  agentId: string
  count: string
}

function formatDetailTime(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw || raw === '-') return '-'
  // 后端可能返回 6 位微秒（例如 .090809Z），浏览器 Date 只稳定支持毫秒，先截取到 3 位
  const normalized = raw.replace(/(\.\d{3})\d+(?=Z$|[+-]\d{2}:?\d{2}$)/, '$1')
  const formatted = formatTime(normalized)
  return formatted === '-' ? raw : formatted
}

const detail = computed<DetailShape>(() => {
  const rawValue = props.row?.detail
  const raw = Array.isArray(rawValue) ? rawValue[0] : rawValue
  const detailValue = raw && typeof raw === 'object' ? (raw as DetailShape) : {}
  return {
    ...detailValue,
    dest_ip: detailValue.dest_ip || props.row?.dest_ip,
    dst_port: detailValue.dst_port || props.row?.dst_port,
    src_ips: detailValue.src_ips || props.row?.src_ips,
  }
})

const assetDetail = computed<AssetDiscoveryDetail | null>(() => {
  const raw = detail.value
  const srcIps = Array.isArray(raw.src_ips) ? raw.src_ips.filter(Boolean).map(String) : []
  const destIp = String(raw.dest_ip || '').trim()
  const destPort = Number(raw.dst_port ?? raw.dest_port)
  if (!srcIps.length || !destIp || !Number.isFinite(destPort)) return null
  return {
    eventType: String(raw.event_type || props.row?.event_type_name || props.row?.event_type || '访问关系异常'),
    destIp,
    destPort,
    srcIps,
    // Keep the original value for active upstream records. The display-only
    // state formats it in the template below.
    lastSeen: String(raw.last_seen || props.row?.occurred_at || '-'),
  }
})

const blockedAccessDetail = computed<BlockedAccessDetail | null>(() => {
  const raw = detail.value as DetailShape & {
    dst_ip?: string
    rule_id?: number | string
    agent_id?: number | string
    probe_types?: string
  }
  const eventType = String(raw.event_type || props.row?.event_type_name || props.row?.event_type || '')
  if (!eventType.includes('被拦截的访问行为')) return null

  return {
    timestamp: formatDetailTime(raw.timestamp || props.row?.occurred_at),
    srcIp: String(raw.src_ip || '-'),
    dstIp: String(raw.dst_ip || raw.dest_ip || '-'),
    dstPort: String(raw.dst_port ?? raw.dest_port ?? '-'),
    ruleId: String(raw.rule_id ?? '-'),
    agentId: String(raw.agent_id ?? '-'),
    count: String(raw.count ?? 0),
  }
})

const assetBatchMode = ref(false)
const selectedSrcIps = ref<string[]>([])
const confirmedSrcIps = ref<string[]>([])
const assetSubmitting = ref(false)
const whitelistSubmitting = ref(false)

const pendingSrcIps = computed(() => {
  const srcIps = assetDetail.value?.srcIps || []
  // 已全部确认状态下，访问关系仍需完整展示，不能受本次弹窗的临时确认数组影响
  if (upstreamInactive.value) return srcIps
  return srcIps.filter((ip) => !confirmedSrcIps.value.includes(ip))
})

// When upstream access is already inactive, the relationship is already
// confirmed and this panel must be display-only.
const upstreamInactive = computed(() => detail.value.upstream_active === false)

const allSrcIpsSelected = computed(
  () => pendingSrcIps.value.length > 0 && pendingSrcIps.value.every((ip) => selectedSrcIps.value.includes(ip)),
)

watch(
  () => props.row?.id,
  () => {
    assetBatchMode.value = false
    selectedSrcIps.value = []
    confirmedSrcIps.value = []
  },
)

const priorityText = computed(() => {
  const p = Number(props.row?.priority)
  if (p === 0) return 'P0'
  if (p === 1) return 'P1'
  if (p === 2) return 'P2'
  return Number.isFinite(p) ? `P${p}` : '-'
})

const processStatus = computed(() => {
  const value = detail.value.process_status
  if (Array.isArray(value)) return String(value[value.length - 1] || '').toLowerCase()
  return String(value || '').toLowerCase()
})

const statusText = computed(() => {
  const labels: Record<string, string> = {
    unprocessed: '待处理',
    ignored: '已忽略',
    blocked: '已封禁',
    isolated: '已隔离',
  }
  return labels[processStatus.value] || '-'
})

const statusClass = computed(() =>
  processStatus.value === 'unprocessed' ? 'is-pending' : processStatus.value ? 'is-done' : 'is-pending',
)

const srcIp = computed(() => detail.value.src_ip || parseSummary(props.row?.summary || '').source || '-')

const destEndpoint = computed(() => {
  if (detail.value.dest_ip) {
    const port = detail.value.dest_port
    return port !== undefined && port !== null && port !== ''
      ? `${detail.value.dest_ip}:${port}`
      : String(detail.value.dest_ip)
  }
  return parseSummary(props.row?.summary || '').target || '-'
})

/** signature 即风险名称/标题 */
const titleText = computed(() => detail.value.signature || props.row?.title || '告警详情')

function parseSummary(summary: string) {
  const text = (summary || '').trim()
  if (!text) return { source: '', target: '' }
  const matched = text.match(/^(\S+)\s*->\s*(\S+)/)
  if (matched) return { source: matched[1], target: matched[2] }
  return { source: text, target: '' }
}

function enterAssetBatchMode() {
  assetBatchMode.value = true
  selectedSrcIps.value = [...pendingSrcIps.value]
}

function toggleAllAssetIps() {
  selectedSrcIps.value = allSrcIpsSelected.value ? [] : [...pendingSrcIps.value]
}

function toggleAssetIp(ip: string) {
  selectedSrcIps.value = selectedSrcIps.value.includes(ip)
    ? selectedSrcIps.value.filter((item) => item !== ip)
    : [...selectedSrcIps.value, ip]
}

async function confirmAssetIps(ips: string[]) {
  const target = assetDetail.value
  if (!target || !ips.length || assetSubmitting.value) return
  assetSubmitting.value = true
  try {
    const res = await updateFlowProcessStatus({
      dest_ip: target.destIp,
      dest_port: target.destPort,
      src_ips: ips,
    })
    if (res?.code !== 0) throw new Error(res?.msg || '确认访问关系失败')
    confirmedSrcIps.value = [...new Set([...confirmedSrcIps.value, ...ips])]
    selectedSrcIps.value = selectedSrcIps.value.filter((ip) => !ips.includes(ip))
    const updatedDetail: DetailShape = {
      ...detail.value,
      upstream_active: false,
      display_hint: '该访问关系已在 NDR 确定，不再属于基线异常',
      src_ips: [...new Set([...target.srcIps, ...ips])],
      dest_ip: target.destIp,
      dst_port: target.destPort,
    }
    emit('detail-updated', {
      ...props.row,
      detail: updatedDetail,
    } as RiskMonitorItem)
    ElMessage.success(`已确认 ${ips.length} 条访问关系`)
    if (!pendingSrcIps.value.length) visible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '确认访问关系失败')
  } finally {
    assetSubmitting.value = false
  }
}

async function copyText(text: string, label: string) {
  const value = (text || '').trim()
  if (!value || value === '-') {
    ElMessage.warning('暂无可复制内容')
    return
  }
  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success(`已复制${label}`)
  } catch {
    ElMessage.error('复制失败')
  }
}

async function handleAddToWhitelist() {
  const target = blockedAccessDetail.value
  if (!target || whitelistSubmitting.value) return
  const ruleId = Number(target.ruleId)
  if (!Number.isInteger(ruleId)) {
    ElMessage.warning('缺少有效的规则 ID，无法加入白名单')
    return
  }

  whitelistSubmitting.value = true
  try {
    const res = await batchAddRuleById({ ids: [ruleId] })
    if (res?.code === 1001) {
      throw new Error(res.msg || '没有规则被添加')
    }
    if (res?.code !== 0) {
      throw new Error(res?.msg || '加入白名单失败')
    }
    ElMessage.success('已加入白名单')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加入白名单失败')
  } finally {
    whitelistSubmitting.value = false
  }
}

async function handleDispose(action: 'ignored' | 'blocked' | 'isolated') {
  if (!props.row) return
  const row = props.row
  const detail = row.detail || {}
  const summary = parseSummary(row.summary)
  const source = String(detail.src_ip || row.src_ip || summary.source || '').trim().replace(/:\d+$/, '')
  const target = String(detail.dest_ip || row.dest_ip || summary.target || '').trim().replace(/:\d+$/, '')
  const esId = String(detail.es_id || row.es_id || '').trim()
  const esIndex = String(detail.es_index || row.es_index || '').trim()
  const msg = String(detail.signature || row.title || row.event_type_name || '告警处置')

  try {
    if (!esId || !esIndex) throw new Error('告警缺少 es_id 或 es_index，无法执行处置')

    const syncRule =
      action === 'blocked'
        ? { msg, rule_type: 'custom-ban-srcip' as const, ip: source }
        : action === 'isolated'
          ? { msg, rule_type: 'custom-ban-dstip' as const, ip: target }
          : undefined
    if (syncRule && !syncRule.ip) {
      throw new Error(action === 'blocked' ? '缺少攻击源 IP，无法封禁' : '缺少受害主机 IP，无法隔离')
    }

    const disposeRes = await applyAttackEventDispose({
      es_id: esId,
      es_index: esIndex,
      process_status: action,
      ...(syncRule ? { sync_rule: syncRule } : {}),
    })
    if (disposeRes?.code !== 0) throw new Error(disposeRes?.msg || '告警处置失败')

    if (action !== 'ignored') {
      const statusRes = await updateAttackEventProcessStatus({
        es_id: esId,
        es_index: esIndex,
        process_status: action,
      })
      if (statusRes?.code !== 0) throw new Error(statusRes?.msg || '更新处理状态失败')
    }

    // 处置成功后重新获取一次详情，确保弹窗显示后端最新状态。
    const detailRes = await fetchNotifyDetail({
      id: Number(row.id),
      event_type: String(row.event_type || ''),
    })
    if (detailRes?.code !== 0 || !detailRes.data) {
      throw new Error(detailRes?.msg || '获取最新告警详情失败')
    }

    const latestDetailValue =
      detailRes.data.detail ?? detailRes.data.detail_json ?? row.detail
    const latestDetail = Array.isArray(latestDetailValue)
      ? latestDetailValue[0]
      : latestDetailValue
    const refreshedDetail: Record<string, unknown> = {
      ...(latestDetail && typeof latestDetail === 'object' ? latestDetail : {}),
      // 处置接口已成功，本次操作状态立即回填到弹窗。
      process_status: [action],
    }

    const labels = { ignored: '忽略', blocked: '封禁源 IP', isolated: '隔离受害主机' }
    ElMessage.success(`${labels[action]}成功`)
    emit('detail-updated', {
      ...row,
      ...detailRes.data,
      detail: refreshedDetail,
      detail_json: detailRes.data.detail_json ?? row.detail_json,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(message || '告警处置失败')
  }
}

function handleClose() {
  assetBatchMode.value = false
  selectedSrcIps.value = []
  confirmedSrcIps.value = []
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    class="ledger-form-dialog dialog-width-wide"
    append-to-body
    :close-on-click-modal="false"
    destroy-on-close
    @closed="handleClose"
  >
    <template #header>
      <div class="dialog-head">
        <div class="dialog-head__title">{{ titleText }}</div>
        <div class="dialog-head__sub">
          <span>ID: {{ row?.id ?? '-' }}</span>
          <span class="dialog-head__chip" :class="`is-p${row?.priority}`">
            {{ priorityText }} {{ row?.event_type_name || row?.event_type || '' }}
          </span>
          <span>来源：{{ row?.source || '-' }}</span>
        </div>
      </div>
    </template>

    <div v-if="assetDetail" class="asset-discovery-body">
      <div class="asset-discovery-summary">
        <div class="asset-discovery-summary__icon">⌁</div>
        <div>
          <div class="asset-discovery-summary__title">{{ assetDetail.eventType }}</div>
          <div class="asset-discovery-summary__desc">
            发现目标 <code>{{ assetDetail.destIp }}:{{ assetDetail.destPort }}</code>
            的访问关系变化
          </div>
          <div class="asset-discovery-summary__time">
            {{ formatDetailTime(assetDetail.lastSeen) }}
          </div>
        </div>
      </div>

      <div class="asset-discovery-list-head">
        <span>{{ upstreamInactive ? '访问关系已全部确认' : '新增受众对象' }}</span>
        <template v-if="!upstreamInactive && assetBatchMode">
          <el-checkbox :model-value="allSrcIpsSelected" @change="toggleAllAssetIps">全选</el-checkbox>
          <span class="asset-discovery-count">已选 {{ selectedSrcIps.length }}/{{ pendingSrcIps.length }}</span>
        </template>
        <el-button v-else-if="!upstreamInactive" link type="primary" @click="enterAssetBatchMode">
          批量设置正常访问
        </el-button>
      </div>

      <div class="asset-discovery-list">
        <div
          v-for="ip in pendingSrcIps"
          :key="ip"
          class="asset-discovery-item"
          :class="{ 'is-readonly': upstreamInactive }"
        >
          <template v-if="upstreamInactive">
            <div class="asset-discovery-endpoint is-source">
              <span class="asset-discovery-endpoint__label">源</span>
              <code>{{ ip }}</code>
            </div>
            <div class="asset-discovery-relation" aria-label="访问关系">
              <span class="asset-discovery-relation__arrow">→</span>
              <span>访问</span>
            </div>
            <div class="asset-discovery-endpoint is-target">
              <span class="asset-discovery-endpoint__label">目的</span>
              <code>{{ assetDetail.destIp }}<em> :{{ assetDetail.destPort }}</em></code>
            </div>
          </template>
          <template v-else>
            <el-checkbox
              v-if="assetBatchMode"
              :model-value="selectedSrcIps.includes(ip)"
              @change="toggleAssetIp(ip)"
            />
            <code class="asset-discovery-source-ip">{{ ip }}</code>
            <el-button v-if="!assetBatchMode" link type="primary" @click="confirmAssetIps([ip])">
              确认访问关系
            </el-button>
          </template>
        </div>
        <div v-if="!upstreamInactive && !pendingSrcIps.length" class="asset-discovery-empty">访问关系已全部确认</div>
      </div>
    </div>

    <div v-else-if="blockedAccessDetail" class="blocked-access-body">
      <div class="blocked-access-summary">
        <div class="blocked-access-summary__icon">!</div>
        <div>
          <div class="blocked-access-summary__title">被拦截的访问行为</div>
          <div class="blocked-access-summary__desc">系统已拦截该访问请求</div>
          <div class="blocked-access-summary__time">{{ blockedAccessDetail.timestamp }}</div>
        </div>
      </div>

      <div class="blocked-access-grid">
        <div class="blocked-access-field">
          <span class="el-dialog__label">访问源 IP</span>
          <code>{{ blockedAccessDetail.srcIp }}</code>
        </div>
        <div class="blocked-access-field">
          <span class="el-dialog__label">目标 IP &amp; 端口</span>
          <code>{{ blockedAccessDetail.dstIp }}:{{ blockedAccessDetail.dstPort }}</code>
        </div>
        <div class="blocked-access-field">
          <span class="el-dialog__label">规则 ID</span>
          <code>{{ blockedAccessDetail.ruleId }}</code>
        </div>
        <div class="blocked-access-field">
          <span class="el-dialog__label">命中次数</span>
          <strong>{{ blockedAccessDetail.count }}</strong>
        </div>
      </div>
    </div>

    <div v-else-if="row" class="detail-body">
      <div class="meta-row">
        <div class="meta-item">
          <span class="el-dialog__label">防护动作</span>
          <span class="meta-item__value is-action">{{ detail.action || '-' }}</span>
        </div>
        <div class="meta-item">
          <span class="el-dialog__label">处置状态</span>
          <span class="meta-item__value" :class="statusClass">
            {{ statusText }}
          </span>
        </div>
        <div class="meta-item">
          <span class="el-dialog__label">攻击类型</span>
          <span class="el-dialog__value">{{ detail.attack_type || '-' }}</span>
        </div>
        <div class="meta-item">
          <span class="el-dialog__label">告警时间</span>
          <span class="el-dialog__value">{{ row.occurred_at || detail.timestamp || '-' }}</span>
        </div>
      </div>

      <div class="endpoint-row">
        <div class="endpoint-card">
          <span class="el-dialog__label">攻击源 IP</span>
          <div class="endpoint-card__value">
            <code>{{ srcIp }}</code>
            <button type="button" class="icon-btn" title="复制" @click="copyText(srcIp, '攻击源 IP')">
              <el-icon :size="14"><CopyDocument /></el-icon>
            </button>
          </div>
        </div>
        <div class="endpoint-card">
          <span class="el-dialog__label">目标端点 & 端口</span>
          <div class="endpoint-card__value">
            <code>{{ destEndpoint }}</code>
            <button
              type="button"
              class="icon-btn"
              title="复制"
              @click="copyText(destEndpoint, '目标端点')"
            >
              <el-icon :size="14"><CopyDocument /></el-icon>
            </button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div v-if="assetDetail" class="asset-discovery-footer">
        <template v-if="!upstreamInactive">
          <el-button v-if="assetBatchMode" @click="assetBatchMode = false">取消</el-button>
          <el-button
            type="primary"
            :disabled="!selectedSrcIps.length"
            :loading="assetSubmitting"
            @click="confirmAssetIps(selectedSrcIps)"
          >
            确认设置正常访问
          </el-button>
        </template>
      </div>
      <span v-else-if="blockedAccessDetail" class="dialog-footer">
        <el-button
          type="primary"
          :loading="whitelistSubmitting"
          @click="handleAddToWhitelist"
        >
          加入白名单
        </el-button>
      </span>
      <span v-else class="dialog-footer">
        <el-button v-if="processStatus !== 'blocked'" type="danger" @click="handleDispose('blocked')">
          封禁源 IP
        </el-button>
        <el-button v-if="processStatus !== 'isolated'" type="primary" @click="handleDispose('isolated')">
          隔离受害主机
        </el-button>
        <el-button v-if="processStatus !== 'ignored'" @click="handleDispose('ignored')">忽略</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.asset-discovery-body {
  padding: 4px 0 0;
}

.blocked-access-body {
  padding: 4px 0 0;
}

.blocked-access-summary {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  background: color-mix(in srgb, var(--c-danger-bg) 52%, var(--c-bg-card));
  border: 1px solid color-mix(in srgb, var(--c-danger) 22%, var(--c-border));
  border-radius: 12px;
}

.blocked-access-summary__icon {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  place-items: center;
  color: var(--c-danger);
  font-size: 22px;
  font-weight: 800;
  background: var(--c-danger-bg);
  border-radius: 10px;
}

.blocked-access-summary__title {
  color: var(--c-text);
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
}

.blocked-access-summary__desc,
.blocked-access-summary__time {
  margin-top: 4px;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}

.blocked-access-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.blocked-access-field {
  display: flex;
  min-height: 62px;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 10px 14px;
  background: var(--c-bg-hover);
  border: 1px solid var(--c-border);
  border-radius: 10px;
}

.blocked-access-field code,
.blocked-access-field strong,
.blocked-access-field__text {
  overflow: hidden;
  color: var(--c-text);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .blocked-access-grid {
    grid-template-columns: 1fr;
  }
}

.asset-discovery-summary {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  background: color-mix(in srgb, var(--c-warn-bg) 52%, var(--c-bg-card));
  border: 1px solid color-mix(in srgb, var(--c-warn) 22%, var(--c-border));
  border-radius: 12px;
}

.asset-discovery-summary__icon {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  place-items: center;
  color: var(--c-warn);
  font-size: 24px;
  background: var(--c-warn-bg);
  border-radius: 10px;
}

.asset-discovery-summary__title {
  color: var(--c-text);
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
}

.asset-discovery-summary__desc,
.asset-discovery-summary__time {
  margin-top: 4px;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}

.asset-discovery-summary code,
.asset-discovery-item code {
  color: var(--c-primary);
  font-family: var(--font-mono);
}

.asset-discovery-list-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  padding-bottom: 10px;
  color: var(--c-text-secondary);
  border-bottom: 1px solid var(--c-border);
}

.asset-discovery-list-head > span:first-child {
  flex: 1;
  font-weight: var(--fw-semibold);
}

.asset-discovery-count {
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
}

.asset-discovery-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
}

.asset-discovery-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  background: color-mix(in srgb, var(--c-bg-card) 82%, var(--c-primary-bg));
  border: 1px solid var(--c-border);
  border-radius: 10px;
}

.asset-discovery-item.is-readonly {
  gap: 12px;
  min-height: 58px;
  padding: 8px 12px;
  background: var(--c-bg-card);
}

.asset-discovery-source-ip {
  flex: 1;
  color: var(--c-primary);
  font-family: var(--font-mono);
}

.asset-discovery-endpoint {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  background: var(--c-bg-hover);
  border: 1px solid var(--c-border-light);
  border-radius: 10px;

  &.is-source {
    flex: 1;
  }

  &.is-target {
    flex: 1.2;
  }
}

.asset-discovery-endpoint__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 28px;
  padding: 0 7px;
  color: var(--c-primary);
  background: var(--c-primary-bg);
  border-radius: 6px;
  font-size: var(--fs-sm);
}

.is-target .asset-discovery-endpoint__label {
  color: var(--c-success);
  background: var(--c-success-bg);
}

.asset-discovery-endpoint code {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-discovery-endpoint em {
  color: var(--c-primary);
  font-style: normal;
  font-weight: var(--fw-regular);
}

.asset-discovery-relation {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 0 0 48px;
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
  line-height: 16px;
}

.asset-discovery-relation__arrow {
  color: var(--c-text-secondary);
  font-size: 24px;
  line-height: 20px;
}

.asset-discovery-empty {
  padding: 28px 0;
  color: var(--c-success);
  text-align: center;
}

.asset-discovery-footer {
  display: flex;
  gap: 10px;
  width: 100%;
}

.asset-discovery-footer .el-button:last-child {
  flex: 1;
}

.dialog-head__title {
  color: var(--c-text);
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  line-height: 22px;
}

.dialog-head__sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: var(--sp-1);
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
  line-height: 18px;
}

.dialog-head__chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);

  &.is-p0 {
    color: var(--c-danger);
    background: var(--c-danger-bg);
  }

  &.is-p1 {
    color: var(--c-warn);
    background: var(--c-warn-bg);
  }

  &.is-p2 {
    color: var(--c-info);
    background: var(--c-info-bg);
  }
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.meta-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-3) var(--sp-5);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.meta-item__value {
  color: var(--c-text);
  font-size: var(--fs-base);
  font-weight: var(--fw-semibold);

  &.is-action {
    color: var(--c-warn);
  }

  &.is-pending {
    color: var(--c-info);
  }

  &.is-done {
    color: var(--c-success);
  }
}

.endpoint-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-3);
}

.endpoint-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: var(--sp-3);
  background: var(--c-bg-hover);
  border: 1px solid var(--c-border-light);
  border-radius: var(--r-md);
}

.endpoint-card__value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;

  code {
    overflow: hidden;
    color: var(--c-text);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--c-text-muted);
  background: transparent;
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  cursor: pointer;

  &:hover {
    color: var(--c-primary);
    border-color: var(--c-primary);
    background: var(--c-primary-bg);
  }
}

.dialog-footer {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

@media (max-width: 720px) {
  .meta-row,
  .endpoint-row {
    grid-template-columns: 1fr;
  }

  .asset-discovery-item {
    flex-wrap: wrap;
  }

  .asset-discovery-endpoint {
    flex: 1 1 calc(50% - 30px) !important;
  }

  .asset-discovery-relation {
    flex-basis: 36px;
  }
}
</style>
