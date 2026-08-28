<template>
  <!-- 关键漏洞验证结果区 -->
  <div class="critical-vuln-verify-govern">
    <p v-if="verifyTaskName" class="critical-vuln-verify-govern__intro">
      当前验证任务：{{ verifyTaskName }}
    </p>

    <div class="critical-vuln-verify-govern__body">
      <LedgerLoading
        :visible="loadingResults || submitting"
        :text="submittingLoadingText"
      />
      <!-- 验证任务：轮询进度 -->
      <div
        v-if="showProgressPanel"
        class="critical-vuln-verify-govern__progress-panel"
      >
        <div class="critical-vuln-verify-govern__progress-bar">
          <div
            class="critical-vuln-verify-govern__progress-inner"
            :style="{ width: `${scanProgressPercent}%` }"
          />
        </div>
        <p class="critical-vuln-verify-govern__progress-tip">
          扫描任务进行中，请稍候…（{{ scanProgressPercent }}%）
        </p>
      </div>

      <!-- 任务概览 -->
      <div
        v-if="!loadingResults && hasTaskInfo"
        class="critical-vuln-verify-govern__summary"
      >
        <div class="critical-vuln-verify-govern__summary-head">
          <div class="critical-vuln-verify-govern__summary-target">
            <span class="critical-vuln-verify-govern__summary-target-label">
              扫描目标
            </span>
            <span class="critical-vuln-verify-govern__summary-target-value">
              {{ taskInfo.target || '-' }}
            </span>
          </div>
          <span class="critical-vuln-verify-govern__summary-title">
            任务概览
          </span>
          <RiskStatusBadge
            :status="taskStatusBadge.status"
            :label="taskStatusBadge.label"
          />
        </div>

        <div class="critical-vuln-verify-govern__summary-grid">
          <div
            class="critical-vuln-verify-govern__summary-item critical-vuln-verify-govern__summary-item--full"
          >
            <span class="critical-vuln-verify-govern__summary-label">
              扫描目标
            </span>
            <span class="critical-vuln-verify-govern__summary-value">
              {{ taskInfo.target || '-' }}
            </span>
          </div>
          <div class="critical-vuln-verify-govern__summary-item">
            <span class="critical-vuln-verify-govern__summary-label">
              发现漏洞
            </span>
            <span
              class="critical-vuln-verify-govern__summary-value critical-vuln-verify-govern__summary-value--count"
            >
              {{ taskInfo.vuln_count || 0 }}
            </span>
          </div>
          <div class="critical-vuln-verify-govern__summary-item">
            <span class="critical-vuln-verify-govern__summary-label">
              开始时间
            </span>
            <span class="critical-vuln-verify-govern__summary-value">
              {{ formatDateTime(taskInfo.started_at) }}
            </span>
          </div>
          <div class="critical-vuln-verify-govern__summary-item">
            <span class="critical-vuln-verify-govern__summary-label">
              结束时间
            </span>
            <span class="critical-vuln-verify-govern__summary-value">
              {{ formatDateTime(taskInfo.finished_at) }}
            </span>
          </div>
          <div class="critical-vuln-verify-govern__summary-item">
            <span class="critical-vuln-verify-govern__summary-label">
              执行时长
            </span>
            <span class="critical-vuln-verify-govern__summary-value">
              {{ formatDuration(taskInfo.started_at, taskInfo.finished_at) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 扫描结果列表 -->
      <div
        v-if="resultRows.length"
        class="critical-vuln-verify-govern__result-list"
      >
        <el-card
          v-for="(resultRow, resultIndex) in resultRows"
          :key="resultRow.id || `cv-result-${resultIndex}`"
          shadow="never"
          class="critical-vuln-verify-govern__result-card"
        >
          <div
            slot="header"
            class="critical-vuln-verify-govern__result-card-head"
          >
            <span class="critical-vuln-verify-govern__result-card-title">
              {{ resultRow.title || '检测结果' }}
            </span>
            <div class="critical-vuln-verify-govern__result-card-tags">
              <span
                class="critical-vuln-verify-govern__result-tag"
                :class="
                  isVulnResult(resultRow)
                    ? 'critical-vuln-verify-govern__result-tag--danger'
                    : 'critical-vuln-verify-govern__result-tag--success'
                "
              >
                {{ isVulnResult(resultRow) ? '存在漏洞' : '未发现' }}
              </span>
              <span
                class="critical-vuln-verify-govern__result-tag"
                :class="
                  isWeakPasswordResult(resultRow)
                    ? 'critical-vuln-verify-govern__result-tag--warn'
                    : 'critical-vuln-verify-govern__result-tag--danger'
                "
              >
                {{
                  isWeakPasswordResult(resultRow) ? '弱口令漏洞' : '关键漏洞'
                }}
              </span>
            </div>
          </div>

          <div
            v-if="!isVulnResult(resultRow)"
            class="critical-vuln-verify-govern__result-empty"
          >
            <div class="critical-vuln-verify-govern__result-empty-title">
              未发现漏洞
            </div>
            <div class="critical-vuln-verify-govern__result-empty-row">
              <span>漏洞名称</span>
              <strong>{{ resultRow.title || '-' }}</strong>
            </div>
            <div class="critical-vuln-verify-govern__result-empty-row">
              <span>目标端口</span>
              <strong>
                {{ resultRow.target || '-' }}:{{ resultRow.port || '-' }}
              </strong>
            </div>
          </div>

          <div v-else class="critical-vuln-verify-govern__result-detail">
            <div class="critical-vuln-verify-govern__result-row">
              <span class="critical-vuln-verify-govern__result-label">
                目标
              </span>
              <span class="critical-vuln-verify-govern__result-value">
                {{ resultRow.target || '-' }}
              </span>
            </div>
            <div class="critical-vuln-verify-govern__result-row">
              <span class="critical-vuln-verify-govern__result-label">
                端口
              </span>
              <span class="critical-vuln-verify-govern__result-value">
                {{ resultRow.port || '-' }}
              </span>
            </div>
            <div
              v-if="!isWeakPasswordResult(resultRow)"
              class="critical-vuln-verify-govern__result-row"
            >
              <span class="critical-vuln-verify-govern__result-label">
                婕忔礊缂栧彿
              </span>
              <span class="critical-vuln-verify-govern__result-value">
                {{ resultRow.vuln_number || resultRow.cve_id || '-' }}
              </span>
            </div>
            <div
              v-if="!isWeakPasswordResult(resultRow)"
              class="critical-vuln-verify-govern__result-row"
            >
              <span class="critical-vuln-verify-govern__result-label">
                淇寤鸿
              </span>
              <span class="critical-vuln-verify-govern__result-value">
                {{ resultRow.solution || resultRow.url || '-' }}
              </span>
            </div>
            <div
              v-if="!isWeakPasswordResult(resultRow)"
              class="critical-vuln-verify-govern__result-row"
            >
              <span class="critical-vuln-verify-govern__result-label">
                婕忔礊鎻忚堪
              </span>
              <span class="critical-vuln-verify-govern__result-value">
                {{ resultRow.describe || '-' }}
              </span>
            </div>
            <div
              v-if="isWeakPasswordResult(resultRow)"
              class="critical-vuln-verify-govern__result-row"
            >
              <span class="critical-vuln-verify-govern__result-label">
                账号
              </span>
              <span class="critical-vuln-verify-govern__result-value">
                {{ getWeakPasswordUsername(resultRow) }}
              </span>
            </div>
            <div
              v-if="isWeakPasswordResult(resultRow)"
              class="critical-vuln-verify-govern__result-row"
            >
              <span class="critical-vuln-verify-govern__result-label">
                密码
              </span>
              <span class="critical-vuln-verify-govern__result-value">
                {{ getWeakPasswordPassword(resultRow) }}
              </span>
            </div>
            <div class="critical-vuln-verify-govern__result-row">
              <span class="critical-vuln-verify-govern__result-label">
                扫描时间
              </span>
              <span class="critical-vuln-verify-govern__result-value">
                {{ formatScanTime(resultRow.scanned_at) }}
              </span>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 空态 -->
      <div v-else-if="showEmpty" class="ledger-table-empty-icon" style="min-height: 200px;">
        <i class="iconfont icon-kongzhuangtai"></i>
        <span>暂无扫描结果</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessageBox } from 'element-plus'

import { ElMessage } from 'element-plus'

import { getVulnScanProgressAPI, portscanLogsAPI } from '@/api/criticalVuln'
import { getAssetScanResultsAPI } from '@/api/detection'
import { addHandRecordAPI } from '@/api/operation'
import { updataVulnStatusAPI } from '@/api/vuln'
import { hawkVulnVerifyAPI } from '@/api/vuln'
import { getHotVulnListAPI } from '@/api/vulnIntelligence'
import LedgerLoading from '@/components/ledgerLoading.vue'
import RiskStatusBadge from '@/components/RiskStatusBadge.vue'

/** 轮询间隔（毫秒） */
const POLL_INTERVAL_MS = 5000

function getProgressPercentFromPayload (payload) {
  const data = payload && typeof payload === 'object' ? payload : {}
  const status = String(data.status || data.task_status || '').toLowerCase()
  if (status === 'finished') return 100

  const progress = Number(data.progress)
  if (Number.isFinite(progress) && progress > 0) {
    return Math.min(100, Math.max(0, Math.round(progress)))
  }

  return 0
}

function formatDateTime (value) {
  if (!value || value === '-') return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function formatDuration (startTime, endTime) {
  if (!startTime || !endTime) return '-'
  const start = new Date(startTime)
  const end = new Date(endTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-'

  const diff = end.getTime() - start.getTime()
  if (diff < 0) return '-'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (hours > 0) return `${hours}时${minutes}分${seconds}秒`
  if (minutes > 0) return `${minutes}分${seconds}秒`
  return `${seconds}秒`
}

function hasOwnMetadata (row) {
  return !!(
    row &&
    Object.prototype.hasOwnProperty.call(row, 'metadata') &&
    row.metadata !== null &&
    row.metadata !== undefined
  )
}

export default {
  name: 'CriticalVulnVerifyGovern',
  components: { LedgerLoading, RiskStatusBadge },
  props: {
    // 验证上下文：传入 vulnItem 即可发起验证；历史任务传 mode + taskId
    verifyContext: {
      type: Object,
      default: () => ({})
    }
  },
  data () {
    return {
      mode: 'verify_poll',
      taskId: '',
      verifyTaskName: '',
      taskInfo: {},
      resultRows: [],
      submitting: false,
      loadingResults: false,
      polling: false,
      pollingCancelled: false,
      verifyTaskReachedHundred: false,
      scanProgressPercent: 0,
      relievedContext: {
        vulnId: ''
      },
      relievedUpdated: false,
      verifyResultEmitted: false,
      verifyRecordDone: false,
      lastBootstrapKey: ''
    }
  },
  computed: {
    submittingLoadingText () {
      if (this.submitting) {
        return '正在提交验证任务...'
      }
      return '加载扫描结果...'
    },
    // 是否展示进度区
    showProgressPanel () {
      return this.mode === 'verify_poll' && this.polling
    },
    // 无数据且非加载、非轮询时展示空态
    showEmpty () {
      return (
        !this.loadingResults &&
        !this.polling &&
        !this.submitting &&
        !(this.resultRows && this.resultRows.length)
      )
    },
    // 是否为弱口令验证模式
    isWeakPasswordVerifyMode () {
      const context =
        this.verifyContext && typeof this.verifyContext === 'object'
          ? this.verifyContext
          : {}
      return context.verifyType === 'weak_password'
    },
    // 是否为情报验证模式（风险监测页，直接使用表单组装的 taskPayload）
    isIntelligenceVerifyMode () {
      const context =
        this.verifyContext && typeof this.verifyContext === 'object'
          ? this.verifyContext
          : {}
      return context.verifyType === 'intelligence'
    },
    hasTaskInfo () {
      return !!(this.taskInfo && Object.keys(this.taskInfo).length)
    },
    // 任务状态徽章配置（复用 RiskStatusBadge 语义色）
    taskStatusBadge () {
      const taskStatus = String(this.taskInfo.task_status || '').toLowerCase()
      const statusBadgeMap = {
        finished: { status: '已修复', label: '已完成' },
        running: { status: '待验证', label: '进行中' },
        pending: { status: '待验证', label: '等待中' },
        failed: { status: '未修复', label: '失败' },
        cancelled: { status: '已忽略', label: '已取消' },
        scheduled: { status: '待验证', label: '待执行' }
      }
      return (
        statusBadgeMap[taskStatus] || {
          status: '已忽略',
          label: this.getStatusLabel(taskStatus)
        }
      )
    }
  },
  watch: {
    verifyContext: {
      immediate: true,
      deep: true,
      handler (contextValue) {
        this.bootstrapFromContext(contextValue)
      }
    }
  },
  beforeUnmount () {
    this.pollingCancelled = true
  },
  methods: {
    // 根据上下文初始化验证流程
    bootstrapFromContext (contextValue) {
      const context =
        contextValue && typeof contextValue === 'object' ? contextValue : {}
      const hasVulnItem = !!(
        context.vulnItem && typeof context.vulnItem === 'object'
      )
      const historyTaskId =
        context.taskId != null ? String(context.taskId).trim() : ''

      if (!hasVulnItem && !historyTaskId) {
        this.resetState()
        return
      }

      const bootstrapKey = String(
        context.verifyKey ||
          historyTaskId ||
          this.getVulnRequestId(context.vulnItem)
      )
      if (this.lastBootstrapKey === bootstrapKey) {
        return
      }
      this.lastBootstrapKey = bootstrapKey

      if (context.mode === 'history' && historyTaskId) {
        this.resetState()
        this.lastBootstrapKey = bootstrapKey
        this.mode = 'history'
        this.taskId = historyTaskId
        this.verifyTaskName = context.taskName
          ? String(context.taskName).trim()
          : ''
        const meta =
          context.meta && typeof context.meta === 'object' ? context.meta : {}
        this.relievedContext = {
          vulnId: meta.vulnId != null ? String(meta.vulnId).trim() : ''
        }
        this.verifyTaskReachedHundred = true
        this.fetchResultRows()
        return
      }

      if (hasVulnItem) {
        this.startVerifyFlow(context.vulnItem)
      }
    },

    // 获取漏洞请求 id
    getVulnRequestId (vulnItem) {
      if (!vulnItem || typeof vulnItem !== 'object') {
        return ''
      }
      return vulnItem.id || vulnItem.vuln_id || ''
    },

    // 从漏洞编号中解析 LVD 关键字
    extractLvdKeyword (vulnNumber) {
      const vulnNumberText = String(vulnNumber || '').trim()
      if (!vulnNumberText) {
        return ''
      }
      const lvdMatch = vulnNumberText.match(/LVD-\d{4}-\d+/i)
      return lvdMatch ? lvdMatch[0].toUpperCase() : ''
    },

    // 从 describe / suggestion 解析弱口令账号密码（notify detail 可能写在 suggestion）
    parseWeakPasswordCredentials (vulnItem) {
      const raw =
        typeof vulnItem === 'string' || vulnItem == null
          ? vulnItem
          : vulnItem.describe ||
            vulnItem.suggestion ||
            (vulnItem.username && vulnItem.password
              ? `${vulnItem.username}:${vulnItem.password}`
              : '')
      const text = String(raw || '').trim()
      if (!text) {
        return { username: '', password: '' }
      }
      const colonIndex = text.indexOf(':')
      if (colonIndex === -1) {
        return { username: text, password: '' }
      }
      return {
        username: text.slice(0, colonIndex).trim(),
        password: text.slice(colonIndex + 1).trim()
      }
    },

    getApiErrorMessage (error, fallback = '请求失败') {
      if (!error) return fallback
      return (
        error.message ||
        error.msg ||
        (error.response &&
          error.response.data &&
          (error.response.data.message || error.response.data.msg)) ||
        fallback
      )
    },

    // 弱口令验证：提交 portscanLogsAPI
    async startWeakPasswordVerifyFlow (vulnItem) {
      this.resetState()
      this.lastBootstrapKey = String(
        this.verifyContext && this.verifyContext.verifyKey
          ? this.verifyContext.verifyKey
          : this.getVulnRequestId(vulnItem)
      )
      this.mode = 'verify_poll'
      this.submitting = true
      this.$emit('submitting-change', true)

      const vulnRequestId = this.getVulnRequestId(vulnItem)
      this.relievedContext = {
        vulnId: vulnRequestId != null ? String(vulnRequestId).trim() : ''
      }

      try {
        const credentials = this.parseWeakPasswordCredentials(vulnItem)
        const assetIp = String(vulnItem.asset_ip || '').trim()
        const vulnName = String(vulnItem.vuln_name || '').trim()
        const pocId = String(vulnItem.poc_id || '').trim()

        if (!assetIp) {
          ElMessage.warning('缺少资产 IP，无法验证')
          return
        }
        if (!pocId) {
          ElMessage.warning('缺少 poc_id，无法验证')
          return
        }
        if (!credentials.username || !credentials.password) {
          ElMessage.warning('缺少账号或密码信息，无法验证')
          return
        }

        const taskResponse = await portscanLogsAPI({
          name: `弱口令 - 验证 - ${vulnName}`,
          target: assetIp,
          weak_password: {
            poc_id: pocId,
            username: credentials.username,
            password: credentials.password
          }
        })

        if (!taskResponse || Number(taskResponse.code) !== 0) {
          throw new Error(
            (taskResponse && (taskResponse.message || taskResponse.msg)) ||
              '提交验证任务失败'
          )
        }

        const nextTaskId =
          taskResponse.data && taskResponse.data.task_id
            ? String(taskResponse.data.task_id)
            : ''

        if (!nextTaskId) {
          ElMessage.warning('未返回任务 ID，无法查看扫描结果')
          return
        }

        this.taskId = nextTaskId
        this.verifyTaskName = `弱口令 - 验证 - ${vulnName}`
        this.verifyTaskReachedHundred = false
        this.scanProgressPercent = 0
        // 提交完成即关闭 loading，避免挡住进度条
        this.submitting = false
        this.$emit('submitting-change', false)
        await this.startPollingLoop()
      } catch (error) {
        ElMessage({
          type: 'error',
          message: this.getApiErrorMessage(error, '提交验证任务失败'),
          duration: 5000,
          showClose: true,
          zIndex: 5000
        })
      } finally {
        this.submitting = false
        this.$emit('submitting-change', false)
      }
    },

    // 发起完整验证流程：情报匹配 -> 提交任务 -> 轮询 -> 结果
    async startHawkDirectVerifyFlow (vulnItem) {
      this.resetState()
      this.mode = 'direct'
      this.submitting = true
      this.$emit('submitting-change', true)

      const vulnId = this.getVulnRequestId(vulnItem)
      const vulnName = String(vulnItem.vuln_name || '').trim()
      const pocId = String(vulnItem.poc_id || '').trim()
      const assetIp = String(
        vulnItem.asset_ip || vulnItem.affect_asset_ip || ''
      ).trim()
      const portText = String(
        vulnItem.port ?? vulnItem.affect_port ?? ''
      ).trim()
      const target = assetIp && portText ? `${assetIp}:${portText}` : ''
      const isWeak = this.isWeakPasswordVerifyMode

      try {
        if (!assetIp) {
          ElMessage.warning('缺少资产 IP，无法验证')
          return
        }
        if (!portText) {
          ElMessage.warning('缺少端口，无法验证')
          return
        }
        if (!pocId) {
          ElMessage.warning('缺少 poc_id，无法验证')
          return
        }

        const response = await hawkVulnVerifyAPI({
          target,
          plugin_id: pocId
        })
        if (!response || Number(response.code) !== 0) {
          throw new Error((response && response.msg) || '漏洞验证失败')
        }

        const payload = response.data || {}
        const exists = payload.vulnerability_exists === true
        const metadata = payload.vulnerability_metadata || null
        const now = new Date().toISOString()

        this.verifyTaskName = `${isWeak ? '弱口令' : '严重漏洞'} - 验证 - ${vulnName}`
        this.taskInfo = {
          target,
          vuln_count: exists ? 1 : 0,
          task_status: 'finished',
          started_at: now,
          finished_at: now
        }
        this.resultRows = [{
          id: `hawk-verify-${Date.now()}`,
          title: vulnName,
          target: assetIp,
          port: portText,
          is_vuln: exists,
          vulnerability_exists: exists,
          kind: isWeak ? 'weak' : 'critical',
          vuln_number: vulnItem.vuln_number || '',
          solution: vulnItem.solution || '',
          describe: vulnItem.describe || '',
          metadata: isWeak ? metadata : null
        }]

        await this.updateVulnStatusAfterVerify(vulnId, exists)
        await this.recordVerifyHandOperation()
        ElMessage.success(
          response.msg || (exists ? '漏洞验证成功' : '未发现漏洞')
        )
        this.emitVerifyResult(exists)
      } catch (error) {
        ElMessage.error(
          (error && (error.message || error.msg)) || '漏洞验证失败'
        )
      } finally {
        this.submitting = false
        this.$emit('submitting-change', false)
      }
    },

    async updateVulnStatusAfterVerify (vulnId, exists) {
      const statusIds = this.normalizeVulnStatusIds({ vulnId })
      if (!statusIds.length) return false
      try {
        const response = await updataVulnStatusAPI({
          id: statusIds,
          vuln_status: exists ? 0 : 3
        })
        if (response && Number(response.code) !== 0) return false
        this.$emit('status-updated', { ids: statusIds, vuln_status: exists ? 0 : 3 })
        return true
      } catch (error) {
        return false
      }
    },

    async startVerifyFlow (vulnItem) {
      if (this.isWeakPasswordVerifyMode) {
        await this.startHawkDirectVerifyFlow(vulnItem)
        return
      }
      if (this.isIntelligenceVerifyMode) {
        await this.startIntelligenceVerifyFlow(vulnItem)
        return
      }

      await this.startHawkDirectVerifyFlow(vulnItem)
      return

      this.resetState()
      this.lastBootstrapKey = String(
        this.verifyContext && this.verifyContext.verifyKey
          ? this.verifyContext.verifyKey
          : this.getVulnRequestId(vulnItem)
      )
      this.mode = 'verify_poll'
      this.submitting = true
      this.$emit('submitting-change', true)

      const vulnRequestId = this.getVulnRequestId(vulnItem)
      this.relievedContext = {
        vulnId: vulnRequestId != null ? String(vulnRequestId).trim() : ''
      }

      try {
        const lvdKeyword = this.extractLvdKeyword(vulnItem.vuln_number)
        if (!lvdKeyword) {
          ElMessage.warning('未从漏洞编号中解析到 LVD 编号，无法验证')
          return
        }

        const intelligenceResponse = await getHotVulnListAPI({
          page: 1,
          page_size: 1,
          keyword: lvdKeyword
        })
        if (!intelligenceResponse || Number(intelligenceResponse.code) !== 0) {
          throw new Error(
            (intelligenceResponse &&
              (intelligenceResponse.msg || intelligenceResponse.message)) ||
              '查询漏洞情报失败'
          )
        }

        const intelligenceList =
          (intelligenceResponse.data && intelligenceResponse.data.list) || []
        const intelligenceItem = intelligenceList[0]
        if (!intelligenceItem || intelligenceItem.id == null) {
          ElMessage.warning('未匹配到对应漏洞情报，无法验证')
          return
        }

        const vulnName = String(vulnItem.vuln_name || '').trim()
        const assetIp = String(
          vulnItem.asset_ip || vulnItem.affect_asset_ip || ''
        ).trim()
        const portText = String(
          vulnItem.port != null && vulnItem.port !== ''
            ? vulnItem.port
            : vulnItem.affect_port || ''
        ).trim()

        if (!assetIp || !portText) {
          ElMessage.warning('缺少资产 IP 或端口，无法验证')
          return
        }

        const taskResponse = await portscanLogsAPI({
          name: `关键漏洞 - 验证-${vulnName}`,
          target: assetIp,
          port_list: portText,
          vuln_ids: [String(intelligenceItem.id)],
          scan_mode: 'quick',
          scan_vuln: true,
          timeout_sec: 5,
          threads: 500
        })

        if (!taskResponse || Number(taskResponse.code) !== 0) {
          throw new Error(
            (taskResponse && (taskResponse.msg || taskResponse.message)) ||
              '提交验证任务失败'
          )
        }

        const nextTaskId =
          taskResponse.data && taskResponse.data.task_id
            ? String(taskResponse.data.task_id)
            : ''

        if (!nextTaskId) {
          ElMessage.warning('未返回任务 ID，无法查看扫描结果')
          return
        }

        this.taskId = nextTaskId
        this.verifyTaskName = `关键漏洞 - 验证-${vulnName}`
        this.verifyTaskReachedHundred = false
        this.scanProgressPercent = 0
        // 提交完成即关闭 loading，避免挡住进度条
        this.submitting = false
        this.$emit('submitting-change', false)
        await this.startPollingLoop()
      } catch (error) {
        ElMessage({
          type: 'error',
          message: this.getApiErrorMessage(error, '提交验证任务失败'),
          duration: 5000,
          showClose: true,
          zIndex: 5000
        })
      } finally {
        this.submitting = false
        this.$emit('submitting-change', false)
      }
    },

    // 情报验证：直接使用表单组装的 taskPayload，不再二次查询 /vulns
    async startIntelligenceVerifyFlow (vulnItem) {
      this.resetState()
      this.lastBootstrapKey = String(
        this.verifyContext && this.verifyContext.verifyKey
          ? this.verifyContext.verifyKey
          : this.getVulnRequestId(vulnItem)
      )
      this.mode = 'verify_poll'
      this.submitting = true
      this.$emit('submitting-change', true)

      // 情报库漏洞不做资产漏洞状态回写
      this.relievedContext = {
        vulnId: ''
      }

      try {
        const context =
          this.verifyContext && typeof this.verifyContext === 'object'
            ? this.verifyContext
            : {}
        const taskPayload =
          context.taskPayload && typeof context.taskPayload === 'object'
            ? context.taskPayload
            : null

        if (!taskPayload) {
          ElMessage.warning('缺少验证任务参数，无法验证')
          return
        }

        const vulnIds = Array.isArray(taskPayload.vuln_ids)
          ? taskPayload.vuln_ids.filter(Boolean).map(item => String(item))
          : []
        if (!vulnIds.length) {
          ElMessage.warning('缺少漏洞情报 ID，无法验证')
          return
        }

        const targetText = String(taskPayload.target || '').trim()
        if (!targetText) {
          ElMessage.warning('缺少扫描目标，无法验证')
          return
        }

        const vulnName = String(
          taskPayload.vuln_name ||
            (vulnItem && (vulnItem.vuln_name || vulnItem.title)) ||
            ''
        ).trim()
        const taskName =
          String(taskPayload.name || '').trim() ||
          `关键漏洞 - 验证 - ${vulnName}`

        const taskResponse = await portscanLogsAPI({
          ...taskPayload,
          name: taskName,
          target: targetText,
          scan_mode: taskPayload.scan_mode || 'quick',
          scan_vuln:
            taskPayload.scan_vuln == null ? true : !!taskPayload.scan_vuln,
          vuln_ids: vulnIds,
          timeout_sec: Number(taskPayload.timeout_sec) || 5,
          threads: Number(taskPayload.threads) || 500,
          description:
            taskPayload.description != null
              ? String(taskPayload.description)
              : '',
          vuln_name: vulnName
        })

        if (!taskResponse || Number(taskResponse.code) !== 0) {
          throw new Error(
            (taskResponse && (taskResponse.msg || taskResponse.message)) ||
              '提交验证任务失败'
          )
        }

        const nextTaskId =
          taskResponse.data && taskResponse.data.task_id
            ? String(taskResponse.data.task_id)
            : ''

        if (!nextTaskId) {
          ElMessage.warning('未返回任务 ID，无法查看扫描结果')
          return
        }

        this.taskId = nextTaskId
        this.verifyTaskName = taskName
        this.verifyTaskReachedHundred = false
        this.scanProgressPercent = 0
        // 提交完成即关闭 loading，避免挡住进度条
        this.submitting = false
        this.$emit('submitting-change', false)
        await this.startPollingLoop()
      } catch (error) {
        ElMessage({
          type: 'error',
          message: this.getApiErrorMessage(error, '提交验证任务失败'),
          duration: 5000,
          showClose: true,
          zIndex: 5000
        })
      } finally {
        this.submitting = false
        this.$emit('submitting-change', false)
      }
    },

    getResultMetadata (resultRow) {
      const metadata = resultRow && resultRow.metadata
      if (!metadata) return null
      if (typeof metadata === 'object') return metadata
      if (typeof metadata === 'string') {
        try {
          return JSON.parse(metadata)
        } catch (error) {
          return null
        }
      }
      return null
    },

    hasResultMetadata (resultRow) {
      return hasOwnMetadata(resultRow)
    },

    isWeakPasswordResult (resultRow) {
      return resultRow && (resultRow.kind === 'weak' || this.hasResultMetadata(resultRow))
    },

    isVulnResult (resultRow) {
      return !!(resultRow && resultRow.vulnerability_exists === true)
    },

    getWeakPasswordUsername (resultRow) {
      const metadata = this.getResultMetadata(resultRow) || {}
      return metadata.username || '-'
    },

    getWeakPasswordPassword (resultRow) {
      const metadata = this.getResultMetadata(resultRow) || {}
      return metadata.password || '-'
    },

    // 轮询任务进度直至完成
    async startPollingLoop () {
      this.polling = true
      this.loadingResults = false
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

      while (this.taskId && !this.pollingCancelled) {
        try {
          const response = await getVulnScanProgressAPI(this.taskId)
          if (this.pollingCancelled || !this.taskId) return

          if (!response || !response.data) {
            ElMessage.error(
              (response && (response.message || response.msg)) ||
                '获取任务进度失败'
            )
            break
          }

          if (response.code !== 0) {
            ElMessage.error(
              (response && (response.message || response.msg)) ||
                '获取任务进度失败'
            )
            break
          }

          const progressData = response.data || {}
          this.scanProgressPercent = getProgressPercentFromPayload(progressData)
          const status = String(progressData.status || '').toLowerCase()

          if (status === 'failed' || status === 'cancelled') {
            ElMessage.error('扫描任务已失败或已取消')
            this.verifyTaskReachedHundred = true
            this.emitVerifyResult(false)
            break
          }

          if (this.scanProgressPercent >= 100 || status === 'finished') {
            this.verifyTaskReachedHundred = true
            this.polling = false
            await this.recordVerifyHandOperation()
            await this.fetchResultRows()
            return
          }

          await sleep(POLL_INTERVAL_MS)
        } catch (error) {
          if (!this.pollingCancelled) {
            ElMessage.error('查询任务进度失败')
          }
          break
        }
      }
      this.polling = false
    },

    // 拉取漏洞扫描结果列表
    async fetchResultRows () {
      if (!this.taskId) return
      this.loadingResults = true
      try {
        const response = await getAssetScanResultsAPI(this.taskId)
        if (response && response.code === 0 && response.data) {
          const { hosts = [], task = {} } = response.data

          this.taskInfo = task || {}
          const vulnRows = this.parseVulnRowsFromHosts(hosts)
          this.resultRows = vulnRows

          const hasNoVulnResult = this.isEmptyScanResult(task, hosts, vulnRows)
          if (hasNoVulnResult) {
            await this.tryUpdateVulnRelievedOnEmptyResult()
          }

          this.emitVerifyResult(!hasNoVulnResult)
          return
        }

        ElMessage.error(
          (response && (response.message || response.msg)) || '获取扫描结果失败'
        )
      } catch (error) {
        ElMessage.error('获取扫描结果失败')
      } finally {
        this.loadingResults = false
      }
    },

    // 解析 hosts 中的漏洞结果
    parseVulnRowsFromHosts (hosts) {
      const hostList = Array.isArray(hosts) ? hosts : []
      const vulnRows = []

      for (const hostItem of hostList) {
        const { target, ports = [] } = hostItem
        const portList = Array.isArray(ports) ? ports : []
        for (const portInfo of portList) {
          const { port, vulns: portVulns = [] } = portInfo
          const vulnList = Array.isArray(portVulns) ? portVulns : []
          for (const vulnItem of vulnList) {
            vulnRows.push({
              ...vulnItem,
              target,
              port
            })
          }
        }
      }

      return vulnRows
    },

    // 判断扫描结果是否为空
    isEmptyScanResult (task, hosts, vulnRows) {
      const taskInfo = task && typeof task === 'object' ? task : {}
      const hostList = Array.isArray(hosts) ? hosts : []
      const resultRows = Array.isArray(vulnRows) ? vulnRows : []

      if (!hostList.length || !resultRows.length) {
        return true
      }

      const vulnCount = Number(taskInfo.vuln_count)
      if (
        taskInfo.vuln_count == null ||
        taskInfo.vuln_count === '' ||
        (Number.isFinite(vulnCount) && vulnCount === 0)
      ) {
        return true
      }

      return false
    },

    // 记录验证操作数量
    async recordVerifyHandOperation () {
      if (this.verifyRecordDone) {
        return
      }
      this.verifyRecordDone = true
      try {
        await addHandRecordAPI({
          recordType: '关键漏洞验证',
          criticalVulnVerifyCount: 1,
          criticalVulnRepairCount: 1
        })
      } catch (error) {
        // 记录失败不阻断结果展示
      }
    },

    // 关闭弹框前确认（验证任务未完成时）
    handleBeforeClose (done) {
      const needConfirm =
        this.mode === 'verify_poll' && !this.verifyTaskReachedHundred

      if (!needConfirm) {
        this.pollingCancelled = true
        done()
        return
      }

      ElMessageBox.confirm(
        '扫描任务还未结束，后续相关结果可在历史扫描任务的关键漏洞列表中查看。',
        '提示',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
          closeOnClickModal: false
        }
      )
        .then(() => {
          this.pollingCancelled = true
          done()
        })
        .catch(() => {})
    },

    // 返回漏洞列表
    handleBack () {
      this.pollingCancelled = true
      this.polling = false
      this.submitting = false
      this.lastBootstrapKey = ''
      this.$emit('submitting-change', false)
      this.$emit('back')
    },

    // 重置内部状态
    resetState () {
      this.pollingCancelled = true
      this.mode = 'verify_poll'
      this.taskId = ''
      this.verifyTaskName = ''
      this.taskInfo = {}
      this.resultRows = []
      this.submitting = false
      this.polling = false
      this.loadingResults = false
      this.scanProgressPercent = 0
      this.verifyTaskReachedHundred = false
      this.relievedContext = { vulnId: '' }
      this.relievedUpdated = false
      this.verifyResultEmitted = false
      this.verifyRecordDone = false
      this.pollingCancelled = false
      this.lastBootstrapKey = ''
    },

    emitVerifyResult (hasVuln) {
      if (!['verify_poll', 'direct'].includes(this.mode) || this.verifyResultEmitted) return
      this.verifyResultEmitted = true
      this.$emit('verify-result', {
        hasVuln: !!hasVuln,
        taskId: this.taskId
      })
    },

    // 验证结果为空时更新漏洞状态为已修复
    async tryUpdateVulnRelievedOnEmptyResult () {
      if (this.relievedUpdated) return
      const statusIds = this.normalizeVulnStatusIds(this.relievedContext)
      if (!statusIds.length) return
      this.relievedUpdated = true
      try {
        const response = await updataVulnStatusAPI({
          id: statusIds,
          vuln_status: 3
        })
        if (!response || Number(response.code) === 0) {
          this.$emit('status-updated', { ids: statusIds })
        }
      } catch (error) {
        // 状态更新失败不阻断结果展示
      }
    },

    normalizeVulnStatusIds (source) {
      const context = source && typeof source === 'object' ? source : {}
      const vulnId = Number(context.vulnId)
      return Number.isFinite(vulnId) && vulnId > 0 ? [vulnId] : []
    },

    formatScanTime (value) {
      return formatDateTime(value)
    },

    formatDateTime,

    formatDuration,

    getStatusLabel (status) {
      const labelMap = {
        finished: '已完成',
        running: '进行中',
        pending: '等待中',
        failed: '失败',
        cancelled: '已取消',
        scheduled: '待执行'
      }
      return labelMap[status] || status || '-'
    }
  }
}
</script>

<style scoped lang="scss">
.critical-vuln-verify-govern {
  &__intro {
    margin: 0 0 var(--sp-4);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }

  &__body {
    position: relative;
    min-height: 280px;
  }

  &__progress-panel {
    margin-bottom: var(--sp-4);
    padding: var(--sp-4);
    border: 1px solid var(--c-border-light);
    border-radius: var(--r-lg);
    background: var(--c-bg-hover);
  }

  &__progress-bar {
    overflow: hidden;
    height: 8px;
    border-radius: 999px;
    background: var(--c-border-light);
  }

  &__progress-inner {
    height: 100%;
    border-radius: 999px;
    background: var(--c-primary);
    transition: width 0.25s ease;
  }

  &__progress-tip {
    margin: var(--sp-3) 0 0;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    text-align: center;
    line-height: 1.5;
  }

  &__summary {
    margin-bottom: var(--sp-4);
    padding: var(--sp-4);
    border: 1px solid var(--c-border-light);
    border-radius: var(--r-lg);
    background: var(--c-bg-card);
  }

  &__summary-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sp-3);
  }

  &__summary-target {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-width: 0;
  }

  &__summary-target-label {
    flex-shrink: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }

  &__summary-target-value {
    min-width: 0;
    color: var(--c-text);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    word-break: break-all;
  }

  &__summary-title {
    display: none;
    color: var(--c-text);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }

  &__summary-grid {
    display: none;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0;
    overflow: hidden;
    border: 1px solid var(--c-border-light);
    border-radius: var(--r-md);
  }

  &__summary-item {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 40px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--c-border-light);
    border-right: 1px solid var(--c-border-light);

    &:nth-child(2n) {
      border-right: none;
    }

    &:nth-last-child(-n + 2) {
      border-bottom: none;
    }

    &--full {
      grid-column: 1 / -1;
      border-right: none;
    }
  }

  &__summary-label {
    flex-shrink: 0;
    width: 72px;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 1.4;
  }

  &__summary-value {
    flex: 1;
    min-width: 0;
    color: var(--c-text);
    font-size: var(--fs-xs);
    line-height: 1.4;
    word-break: break-all;
    font-family: var(--font-mono);

    &--count {
      color: var(--c-primary);
      font-size: var(--fs-md);
      font-weight: var(--fw-bold);
    }
  }

  &__result-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    max-height: 360px;
    overflow-y: auto;
  }

  &__result-card {
    border: 1px solid var(--c-border-light);
    border-radius: var(--r-lg);
    background: var(--c-bg-card);

    ::v-deep .el-card__header {
      padding: var(--sp-3) var(--sp-4);
      border-bottom: none;
      background: var(--c-bg-hover);
    }

    ::v-deep .el-card__body {
      padding: var(--sp-4) var(--sp-3);
    }
  }

  &__result-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    flex-wrap: wrap;
    padding-bottom: var(--sp-3);
    border-bottom: 1px solid var(--c-border-light);
  }

  &__result-card-title {
    flex: 1;
    min-width: 0;
    color: var(--c-text);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    word-break: break-word;
  }

  &__result-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    flex-shrink: 0;
  }

  &__result-tag {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    font-size: 11px;
    font-weight: var(--fw-semibold);
    line-height: 1;
    border-radius: var(--r-sm);
    border: 1px solid transparent;

    &--danger {
      color: var(--c-danger);
      background: var(--c-danger-bg);
      border-color: rgba(248, 113, 113, 0.35);
    }

    &--success {
      color: var(--c-success);
      background: var(--c-success-bg);
      border-color: rgba(52, 211, 153, 0.35);
    }

    &--warn {
      color: var(--c-warn);
      background: var(--c-warn-bg);
      border-color: rgba(251, 191, 36, 0.35);
    }
  }

  &__result-detail {
    padding-top: var(--sp-2);
  }

  &__result-empty {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: var(--sp-3) 0 0;
  }

  &__result-empty-title {
    color: var(--c-success);
    font-size: var(--fs-sm);
    font-weight: var(--fw-semibold);
  }

  &__result-empty-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-4);
    padding-bottom: 10px;
    border-bottom: 1px dashed var(--c-border-light);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);

    strong {
      color: var(--c-text);
      font-family: var(--font-mono);
      font-weight: var(--fw-medium);
      text-align: right;
      word-break: break-all;
    }
  }

  &__result-row {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-4);
    padding: 8px 0;
    border-bottom: 1px dashed var(--c-border-light);

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  }

  &__result-label {
    flex-shrink: 0;
    width: 56px;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 1.5;
  }

  &__result-value {
    flex: 1;
    min-width: 0;
    color: var(--c-text);
    font-size: var(--fs-xs);
    line-height: 1.5;
    word-break: break-all;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 220px;
    padding: var(--sp-6);
    border: 1px dashed var(--c-border);
    border-radius: var(--r-lg);
    background: var(--c-bg-hover);
    text-align: center;
  }

  &__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    margin-bottom: var(--sp-3);
    color: var(--c-text-muted);
    font-size: 24px;
    border-radius: var(--r-lg);
    background: var(--c-bg-card);
  }

  &__empty-title {
    color: var(--c-text);
    font-size: var(--fs-md);
    font-weight: var(--fw-medium);
    line-height: 1.4;
  }

  &__empty-desc {
    margin-top: var(--sp-2);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 1.5;
  }
}
</style>

<style lang="scss">
:root[data-theme='light'] {
  .critical-vuln-verify-govern__summary,
  .critical-vuln-verify-govern__result-card {
    background: #ffffff;
    border-color: #ebeef5;
  }

  .critical-vuln-verify-govern__summary-grid,
  .critical-vuln-verify-govern__summary-item {
    border-color: #ebeef5;
  }

  .critical-vuln-verify-govern__progress-panel,
  .critical-vuln-verify-govern__empty {
    background: #f8f9fb;
    border-color: #ebeef5;
  }

  .critical-vuln-verify-govern__result-card .el-card__header {
    background: #f8f9fb;
    border-bottom-color: #ebeef5;
  }

  .critical-vuln-verify-govern__empty-icon {
    background: #eef2f7;
    color: #909399;
  }
}
</style>
