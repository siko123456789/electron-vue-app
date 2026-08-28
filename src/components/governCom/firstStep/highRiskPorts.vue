<template>
  <!-- 高危端口治理弹框 -->
  <div class="high-risk-ports-govern">
    <el-dialog
      v-model="dialogVisible"
      :width="dialogWidth"
      :title="dialogTitle"
      append-to-body
      :close-on-click-modal="false"
      :before-close="handleDialogBeforeClose"
      @open="handleDialogOpen"
    >
      <div
        v-if="showConvergencePanel || showVerifyPanel || showEmailNotifyPanel"
        class="high-risk-ports-govern__back-row"
      >
        <el-button link class="govern-back-btn" @click="handleSecondStepBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>

      <service-convergence-govern
        v-if="showConvergencePanel"
        :convergence-context="convergenceContext"
        @back="handleBackFromConvergence"
        @success="handleConvergenceSuccess"
      />

      <high-risk-port-verify
        v-else-if="showVerifyPanel"
        ref="verifyGovernRef"
        :verify-context="verifyContext"
        @back="handleBackFromVerify"
        @verify-result="handleVerifyResult"
      />

      <email-notif
        v-else-if="showEmailNotifyPanel"
        :notify-context="emailNotifyContext"
        @back="handleBackFromEmailNotify"
        @sent="handleEmailNotifySent"
      />

      <general-report
        v-else-if="showReportPanel"
        :report-context="reportContext"
        @back="handleBackFromReport"
      />

      <template v-else>
        <p class="high-risk-ports-govern__intro">
          {{ portIntroText }}
        </p>

        <div v-if="!singleTaskMode" class="high-risk-ports-govern__summary">
          <i class="iconfont icon-square-terminal" />
          <span class="high-risk-ports-govern__summary-text">
            当前资产中存在
            <strong class="high-risk-ports-govern__summary-count">{{
              portList.length
            }}</strong>
            {{ portSummarySuffix }}
          </span>
        </div>

        <div class="high-risk-ports-govern__section-title">风险详情</div>

        <div class="high-risk-ports-govern__list">
          <LedgerLoading :visible="loading" text="加载中..." />

          <div
            v-for="(portItem, portIndex) in portList"
            :key="getPortCardId(portItem, portIndex)"
            class="high-risk-ports-govern__card"
            :class="{
              'high-risk-ports-govern__card--expanded': isCardExpanded(
                portItem,
                portIndex
              )
            }"
          >
            <div
              class="high-risk-ports-govern__card-header"
              @click="toggleCardExpand(portItem, portIndex)"
            >
              <div class="high-risk-ports-govern__card-icon">
                <i class="iconfont icon-square-terminal" />
              </div>

              <div class="high-risk-ports-govern__card-info">
                <div class="high-risk-ports-govern__card-title-row">
                  <span class="high-risk-ports-govern__card-title">
                    {{ getPortDisplayText(portItem) }}
                  </span>
                  <span :class="getWeakerStatusTagClass(portItem)">
                    {{ getWeakerStatusText(portItem) }}
                  </span>
                  <span
                    class="high-risk-ports-govern__alive-tag"
                    :class="
                      getIsPortAlive(portItem) ? 'is-live' : 'is-dead'
                    "
                  >
                    {{ getAliveStatusText(portItem) }}
                  </span>
                </div>
                <div class="high-risk-ports-govern__card-meta">
                  <span class="high-risk-ports-govern__meta-item">
                    <span class="high-risk-ports-govern__meta-label"
                      >资产 IP</span
                    >
                    <span
                      class="high-risk-ports-govern__meta-value font-mono"
                      >{{ portItem.asset_ip || '--' }}</span
                    >
                  </span>
                  <span class="high-risk-ports-govern__meta-dot">·</span>
                  <span class="high-risk-ports-govern__meta-item">
                    <span class="high-risk-ports-govern__meta-label">服务</span>
                    <span
                      class="high-risk-ports-govern__meta-value font-mono"
                      >{{ getServiceText(portItem) }}</span
                    >
                  </span>
                </div>
              </div>

              <div class="high-risk-ports-govern__card-actions">
                <span class="high-risk-ports-govern__vuln-count">
                  {{ (portItem.vulns && portItem.vulns.length) || 0 }} 个漏洞
                </span>
                <i
                  class="high-risk-ports-govern__card-arrow"
                  :class="
                    isCardExpanded(portItem, portIndex)
                      ? 'el-icon-arrow-up'
                      : 'el-icon-arrow-down'
                  "
                />
              </div>
            </div>

            <div
              v-show="isCardExpanded(portItem, portIndex)"
              class="high-risk-ports-govern__card-body"
            >
              <div
                class="high-risk-ports-govern__vuln-panel"
                :class="{
                  'high-risk-ports-govern__vuln-panel--loading':
                    portItem.vulnLoading
                }"
              >
                <div
                  v-for="(vulnItem, vulnIndex) in portItem.vulns || []"
                  :key="vulnItem.id || vulnIndex"
                  class="high-risk-ports-govern__vuln-item"
                >
                  <div class="high-risk-ports-govern__vuln-name">
                    {{ vulnItem.vuln_name || '--' }}
                  </div>
                  <div
                    class="high-risk-ports-govern__vuln-level"
                    :class="`is-level-${getVulnLevelRank(vulnItem.vuln_level)}`"
                  >
                    <span class="high-risk-ports-govern__vuln-level-bars" aria-hidden="true">
                      <i
                        v-for="barIndex in 5"
                        :key="barIndex"
                        :class="{
                          'is-on': barIndex <= getVulnLevelRank(vulnItem.vuln_level)
                        }"
                      />
                    </span>
                    <span class="high-risk-ports-govern__vuln-level-text">
                      {{ formatVulnLevel(vulnItem.vuln_level) }}
                    </span>
                  </div>
                  <RiskStatusBadge :status="vulnItem.vuln_status" />
                </div>

                <div
                  v-if="!(portItem.vulns && portItem.vulns.length)"
                  class="ledger-table-empty-icon"
                >
                  <i class="iconfont icon-kongzhuangtai"></i>
                  <span>暂无关联漏洞</span>
                </div>
              </div>

              <div
                v-if="canShowGovernActions(portItem) || canBatchUpdateVulns(portItem)"
                class="high-risk-ports-govern__card-footer"
              >
                <template v-if="canShowGovernActions(portItem)">
                <el-button
                  class="high-risk-ports-govern__action-converge"
                  @click.stop="handleOpenConvergence(portItem)"
                >
                  收敛
                </el-button>
                <el-button
                  class="high-risk-ports-govern__action-verify"
                  :loading="portItem._verifyLoading"
                  @click.stop="handleVerifyAlive(portItem)"
                >
                  验证是否存活
                </el-button>
                <!-- <el-button @click.stop="handleOpenVerify(portItem)">
                  验证
                </el-button> -->
                <el-button
                  class="high-risk-ports-govern__action-notify"
                  @click.stop="handleOpenEmailNotify(portItem)"
                >
                  通知
                </el-button>
                <el-button
                  class="high-risk-ports-govern__action-report"
                  @click.stop="handleOpenReport(portItem)"
                >
                  生成报告
                </el-button>
                <el-button
                  class="high-risk-ports-govern__action-work-order"
                  :loading="
                    workOrderCreatingId === getWorkOrderRequestId(portItem)
                  "
                  @click.stop="handleCreateWorkOrder(portItem)"
                >
                  生成事件
                </el-button>
                </template>
                <el-dropdown
                  v-if="canBatchUpdateVulns(portItem)"
                  class="high-risk-ports-govern__batch-dropdown"
                  trigger="click"
                  popper-class="high-risk-ports-govern__batch-popper"
                  @command="statusValue => handleBatchUpdateVulnStatus(portItem, statusValue)"
                >
                  <el-button
                    class="high-risk-ports-govern__btn-batch-vuln"
                    :loading="portItem._batchStatusLoading"
                    @click.stop
                  >
                    批量处置漏洞
                    <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :command="3">标为已修复</el-dropdown-item>
                      <el-dropdown-item :command="2">标为忽略</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
            </div>
          </div>
          </div>

          <div
            v-if="!loading && portList.length === 0"
            class="ledger-table-empty-icon"
          >
            <i class="iconfont icon-kongzhuangtai"></i>
            <span>{{ portEmptyDescription }}</span>
          </div>
        </div>

        <RiskGovernanceAiAdvicePanel
          ref="riskAiAdvice"
          :show="!loading && portList.length > 0"
          :risk-type="riskGovernanceType"
          :risk-data="portList"
          v-model:outer-dialog-visible="dialogVisible"
          :file-name-prefix="riskGovernanceFileNamePrefix"
          @suppress-outer-open="handleAiSuppressOuterOpen"
        />
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'

import ServiceConvergenceGovern from '@/components/governCom/secondStep/serviceConvergenceGovern.vue'
import HighRiskPortVerify from '@/components/governCom/secondStep/highRiskPortVerify.vue'
import EmailNotif from '@/components/governCom/secondStep/emailNotif.vue'
import GeneralReport from '@/components/governCom/secondStep/generalReport.vue'
import LedgerLoading from '@/components/ledgerLoading.vue'
import RiskStatusBadge from '@/components/RiskStatusBadge.vue'
import RiskGovernanceAiAdvicePanel from '@/components/governCom/com/RiskGovernanceAiAdvicePanel.vue'
import { taskListNewAPI } from '@/api/riskOperations'
import { portStatusAPI } from '@/api/assets'
import { updataVulnStatusAPI } from '@/api/vuln'
import { createWorkOrderEvent } from '@/utils/workOrderNotify'

export default {
  name: 'HighRiskPortsGovern',
  components: {
    ServiceConvergenceGovern,
    HighRiskPortVerify,
    EmailNotif,
    GeneralReport,
    LedgerLoading,
    RiskStatusBadge,
    RiskGovernanceAiAdvicePanel,
    ArrowDown
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    // AI 自动化分析处置：仅展示单条任务并隐藏汇总提示
    singleTaskMode: {
      type: Boolean,
      default: false
    },
    // 攻击面资产页传入的端口列表，存在时不再请求 taskListNewAPI
    externalTaskList: {
      type: Array,
      default: null
    },
    // 端口治理类型：highRisk 高危端口 / normal 常规端口
    portGovernType: {
      type: String,
      default: 'highRisk'
    }
  },
  data () {
    return {
      loading: false,
      portList: [],
      expandedPortIds: {},
      showConvergencePanel: false,
      showVerifyPanel: false,
      showEmailNotifyPanel: false,
      showReportPanel: false,
      convergenceContext: null,
      verifyContext: null,
      emailNotifyContext: null,
      reportContext: null,
      workOrderCreatingId: '',
      suppressDialogOpenRefresh: false
    }
  },
  watch: {
    // 风险监测传入的详情更新后，同步刷新弹窗内风险详情卡片
    externalTaskList: {
      deep: true,
      handler (list) {
        if (!Array.isArray(list)) return
        this.portList = this.normalizeTaskList(list).map(item =>
          this.normalizePortTaskItem(item)
        )
      }
    }
  },
  computed: {
    dialogVisible: {
      get () {
        return this.visible
      },
      set (value) {
        this.$emit('update:visible', value)
      }
    },
    dialogWidth () {
      if (
        this.showConvergencePanel ||
        this.showVerifyPanel ||
        this.showEmailNotifyPanel ||
        this.showReportPanel
      ) {
        return this.showConvergencePanel ||
          this.showVerifyPanel ||
          this.showReportPanel
          ? '960px'
          : '760px'
      }
      return '760px'
    },
    dialogTitle () {
      if (this.showConvergencePanel) {
        return '服务收敛治理'
      }
      if (this.showVerifyPanel) {
        const portText = String(
          (this.verifyContext &&
            this.verifyContext.portItem &&
            this.verifyContext.portItem.port) ||
            ''
        ).trim()
        return portText ? `端口验证（${portText}）` : '端口验证'
      }
      if (this.showEmailNotifyPanel) {
        return '邮件通知'
      }
      if (this.showReportPanel) {
        return '生成报告'
      }
      return this.portGovernType === 'normal'
        ? '非高危端口治理'
        : '高危端口治理'
    },
    // 汇总区域端口数量后缀文案
    portSummarySuffix () {
      return this.portGovernType === 'normal' ? '个常规端口' : '个高危端口'
    },
    // 空状态文案
    portEmptyDescription () {
      return this.portGovernType === 'normal'
        ? '暂无常规端口数据'
        : '暂无高危端口数据'
    },
    // 弹窗说明文案
    portIntroText () {
      return this.portGovernType === 'normal'
        ? '常规端口指资产对外暴露的一般服务端口，虽风险等级相对较低，仍建议结合业务必要性收敛暴露面并及时处置关联漏洞。'
        : '高危端口指对外暴露的高风险服务端口，攻击者可利用关联漏洞发起入侵，建议尽快收敛暴露面并修复漏洞。'
    },
    // AI 治理建议 WebSocket type
    riskGovernanceType () {
      return this.portGovernType === 'normal' ? 'normal_port' : 'high_risk_port'
    },
    // AI 报告下载文件名前缀
    riskGovernanceFileNamePrefix () {
      return this.portGovernType === 'normal' ? '常规端口' : '高危端口'
    }
  },
  mounted () {
    if (this.visible) {
      this.handleDialogOpen()
    }
  },
  methods: {
    // 获取端口卡片唯一标识
    getPortCardId (portItem, portIndex) {
      return (
        portItem.task_id ||
        `${portItem.asset_ip || ''}-${portItem.port || ''}-${portIndex}`
      )
    },
    // 获取生成工单请求 id
    getWorkOrderRequestId (portItem) {
      return portItem.id || portItem.task_id
    },
    // 获取生成工单分类
    getWorkOrderCategory () {
      return this.portGovernType === 'normal' ? '常规端口' : '高危端口'
    },
    // 获取端口展示文案
    getPortDisplayText (portItem) {
      const portText = String(portItem.port || '').trim()
      return portText || '--'
    },
    // 判断是否已收敛
    getIsWeakerConverged (portItem = {}) {
      return Number(portItem.is_weaker) === 1
    },
    // 已收敛时不展示收敛/验证等操作
    canShowGovernActions (portItem = {}) {
      return !this.getIsWeakerConverged(portItem)
    },
    // 获取收敛状态标签样式
    getWeakerStatusTagClass (portItem) {
      return this.getIsWeakerConverged(portItem)
        ? 'status-tag-green'
        : 'status-tag-gray'
    },
    // 获取收敛状态文案
    getWeakerStatusText (portItem) {
      return this.getIsWeakerConverged(portItem) ? '已收敛' : '未收敛'
    },
    // 判断端口是否存活（status：1 存活，0 不存活）
    getIsPortAlive (portItem = {}) {
      return Number(portItem.status) === 1
    },
    // 获取是否存活展示文案
    getAliveStatusText (portItem) {
      if (
        portItem.status === undefined ||
        portItem.status === null ||
        portItem.status === ''
      ) {
        return '存活未知'
      }
      return this.getIsPortAlive(portItem) ? '存活' : '不存活'
    },
    // 获取服务展示文案
    getServiceText (portItem) {
      const serviceText = String(portItem.service || '').trim()
      const protocolText = String(portItem.protocol || '').trim()
      if (serviceText && protocolText) {
        return `${serviceText} / ${protocolText.toUpperCase()}`
      }
      return serviceText || protocolText.toUpperCase() || '--'
    },
    // 获取关联漏洞数量（与列表同源，避免 vuln_ids 有值但 vulns 为空时出现空白）
    getRelatedVulnCount (portItem) {
      return this.getPortRelatedVulns(portItem).length
    },
    // 解析端口关联漏洞：兼容数组 / JSON 字符串 / detail.vulns
    getPortRelatedVulns (portItem = {}) {
      const candidates = [
        portItem.vulns,
        portItem.related_vulns,
        portItem.detail && portItem.detail.vulns,
        portItem.detail && portItem.detail.related_vulns
      ]
      for (const raw of candidates) {
        const list = this.parseVulnList(raw)
        if (list.length) return list
      }
      return []
    },
    parseVulnList (raw) {
      if (Array.isArray(raw)) {
        return raw.filter(item => item && typeof item === 'object')
      }
      if (typeof raw === 'string' && raw.trim()) {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            return parsed.filter(item => item && typeof item === 'object')
          }
        } catch {
          return []
        }
      }
      return []
    },
    // 漏洞等级：0低危 1中危 2高危 3紧急 4关键漏洞
    formatVulnLevel (level) {
      const map = {
        0: '低危',
        1: '中危',
        2: '高危',
        3: '紧急',
        4: '关键漏洞'
      }
      if (level === undefined || level === null || level === '') return '-'
      if (Object.prototype.hasOwnProperty.call(map, Number(level))) {
        return map[Number(level)]
      }
      const text = String(level)
      if (/关键漏洞|critical.?vuln/i.test(text)) return '关键漏洞'
      if (/紧急|critical/i.test(text)) return '紧急'
      if (/高危|high/i.test(text)) return '高危'
      if (/中危|medium/i.test(text)) return '中危'
      if (/低危|low/i.test(text)) return '低危'
      return text
    },
    // 等级对应点亮条数（1~5）
    getVulnLevelRank (level) {
      const map = {
        0: 1,
        1: 2,
        2: 3,
        3: 4,
        4: 5
      }
      if (Object.prototype.hasOwnProperty.call(map, Number(level))) {
        return map[Number(level)]
      }
      const label = this.formatVulnLevel(level)
      if (label === '关键漏洞') return 5
      if (label === '紧急') return 4
      if (label === '高危') return 3
      if (label === '中危') return 2
      if (label === '低危') return 1
      return 1
    },
    // 规范化外部传入的端口任务（补齐 asset_ip，强制落地 vulns 副本）
    normalizePortTaskItem (portItem = {}) {
      const source =
        portItem && typeof portItem === 'object'
          ? JSON.parse(JSON.stringify(portItem))
          : {}
      const vulns = this.getPortRelatedVulns(source)
      return {
        ...source,
        asset_ip:
          source.asset_ip || source.ip || source.affect_asset_ip || '',
        port: source.port || source.lan_port || source.affect_port || '',
        vulns
      }
    },
    // 判断卡片是否展开
    isCardExpanded (portItem, portIndex) {
      return !!this.expandedPortIds[this.getPortCardId(portItem, portIndex)]
    },
    // 切换卡片展开状态
    toggleCardExpand (portItem, portIndex) {
      const cardId = this.getPortCardId(portItem, portIndex)
      this.expandedPortIds[cardId] = !this.expandedPortIds[cardId]
    },
    // 重置二级面板状态
    resetSubPanels () {
      this.showConvergencePanel = false
      this.showVerifyPanel = false
      this.showEmailNotifyPanel = false
      this.showReportPanel = false
      this.convergenceContext = null
      this.verifyContext = null
      this.emailNotifyContext = null
      this.reportContext = null
    },
    // 构建治理上下文使用的漏洞对象
    buildPortGovernVulnItem (portItem) {
      const firstVulnItem = (this.getPortRelatedVulns(portItem) || [])[0] || {}
      return {
        ...firstVulnItem,
        id: firstVulnItem.id,
        vuln_id: firstVulnItem.id,
        asset_ip: portItem.asset_ip || firstVulnItem.affect_asset_ip || '',
        port: portItem.port || firstVulnItem.affect_port || '',
        vuln_name: firstVulnItem.vuln_name || portItem.vuln_name || '',
        describe: firstVulnItem.describe || portItem.describe || '',
        vuln_number: firstVulnItem.vuln_number || ''
      }
    },
    // 获取端口关联漏洞 id 列表
    getPortVulnIds (portItem) {
      const taskVulnIds = Array.isArray(portItem.vuln_ids)
        ? portItem.vuln_ids
        : []
      if (taskVulnIds.length) {
        return taskVulnIds
      }
      return this.getPortRelatedVulns(portItem)
        .map(vulnItem => vulnItem.id)
        .filter(Boolean)
    },
    // 端口不存活且存在关联漏洞时，显示批量处置入口
    canBatchUpdateVulns (portItem = {}) {
      return (
        !this.getIsPortAlive(portItem) &&
        Array.isArray(portItem.vulns) &&
        portItem.vulns.length > 0
      )
    },
    // 只处理仍处于待处置状态的漏洞，避免重复覆盖已忽略/已修复状态
    getBatchableVulnIds (portItem = {}) {
      const relatedVulns = this.getPortRelatedVulns(portItem)
      if (relatedVulns.length) {
        return relatedVulns
          .filter(vulnItem => ![2, 3].includes(Number(vulnItem.vuln_status)))
          .map(vulnItem => vulnItem.id || vulnItem.vuln_id)
          .filter(Boolean)
      }
      return Array.isArray(portItem.vuln_ids)
        ? portItem.vuln_ids.filter(Boolean)
        : []
    },
    getBatchStatusLabel (statusValue) {
      return Number(statusValue) === 3 ? '已修复' : '忽略'
    },
    escapeBatchHtml (value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    },
    buildBatchUpdateConfirmHtml (portItem, vulnCount, statusLabel) {
      const assetIp = this.escapeBatchHtml(portItem.asset_ip || '--')
      const port = this.escapeBatchHtml(
        portItem.lan_port ?? portItem.port ?? '--'
      )
      const target = assetIp + ':' + port
      return '<div class="batch-vuln-confirm">' +
        '<div class="batch-vuln-confirm__lead">' +
          '<span class="batch-vuln-confirm__icon">!</span>' +
          '<span>确认批量修改该端口下的关联漏洞状态。</span>' +
        '</div>' +
        '<div class="batch-vuln-confirm__summary">' +
          '<div class="batch-vuln-confirm__row"><span>端口</span>' +
            '<strong>' + target + '</strong></div>' +
          '<div class="batch-vuln-confirm__divider"></div>' +
          '<div class="batch-vuln-confirm__row"><span>关联漏洞</span>' +
            '<strong>' + vulnCount + '<em> 条</em></strong></div>' +
        '</div>' +
        '<div class="batch-vuln-confirm__result">确认后将标为「' +
          this.escapeBatchHtml(statusLabel) + '」</div>' +
        '</div>'
    },
    syncLocalVulnStatus (portItem, vulnIds, statusValue) {
      const idSet = new Set(vulnIds.map(id => String(id)))
      const updateList = list =>
        (Array.isArray(list) ? list : []).map(vulnItem => {
          const vulnId = vulnItem && (vulnItem.id || vulnItem.vuln_id)
          return idSet.has(String(vulnId))
            ? { ...vulnItem, vuln_status: Number(statusValue) }
            : vulnItem
        })

      if (Array.isArray(portItem.vulns)) {
        portItem.vulns = updateList(portItem.vulns)
      }
      if (Array.isArray(portItem.related_vulns)) {
        portItem.related_vulns = updateList(portItem.related_vulns)
      }
    },
    async handleBatchUpdateVulnStatus (portItem, statusValue) {
      if (!portItem || portItem._batchStatusLoading) return false

      const vulnIdList = this.getBatchableVulnIds(portItem)
      const statusNumber = Number(statusValue)
      if (!vulnIdList.length) {
        ElMessage.warning('暂无可处置的关联漏洞')
        return false
      }
      if (![2, 3].includes(statusNumber)) {
        ElMessage.warning('仅支持标为已修复或忽略')
        return false
      }

      const statusLabel = this.getBatchStatusLabel(statusNumber)
      try {
        await ElMessageBox.confirm(
          this.buildBatchUpdateConfirmHtml(portItem, vulnIdList.length, statusLabel),
          '批量处置漏洞',
          {
            confirmButtonText: '标为' + statusLabel,
            cancelButtonText: '取消',
            dangerouslyUseHTMLString: true,
            customClass: 'batch-vuln-status-dialog',
            closeOnClickModal: false
          }
        )
      } catch {
        return false
      }

      portItem._batchStatusLoading = true
      try {
        const result = await updataVulnStatusAPI({
          id: vulnIdList,
          vuln_status: statusNumber
        })
        if (!result || Number(result.code) !== 0) {
          throw new Error((result && result.msg) || '批量更改状态失败')
        }

        this.syncLocalVulnStatus(portItem, vulnIdList, statusNumber)
        ElMessage.success('已成功将 ' + vulnIdList.length + ' 条漏洞标为“' + statusLabel + '”')
        return true
      } catch (error) {
        ElMessage.error(
          (error && error.message) || '批量更改状态失败'
        )
        return false
      } finally {
        portItem._batchStatusLoading = false
      }
    },
    // 弹框关闭前拦截（验证未完成时提示）
    handleDialogBeforeClose (done) {
      if (this.showVerifyPanel && this.$refs.verifyGovernRef) {
        this.$refs.verifyGovernRef.handleBeforeClose(done)
        return
      }
      if (this.$refs.riskAiAdvice) {
        this.$refs.riskAiAdvice.dispose()
      }
      done()
    },
    // 弹框打开时拉取端口列表
    async handleDialogOpen () {
      if (this.suppressDialogOpenRefresh) {
        this.suppressDialogOpenRefresh = false
        return
      }
      this.expandedPortIds = {}
      this.resetSubPanels()
      if (this.$refs.riskAiAdvice) {
        this.$refs.riskAiAdvice.reset()
      }
      await this.fetchHighRiskPortList()
    },
    // HTML 预览关闭后恢复外层时跳过重新拉数
    handleAiSuppressOuterOpen () {
      this.suppressDialogOpenRefresh = true
    },
    // 打开服务收敛治理页
    handleOpenConvergence (portItem) {
      if (!portItem) {
        return
      }
      this.resetSubPanels()
      const governVulnItem = this.buildPortGovernVulnItem(portItem)
      this.convergenceContext = {
        assetIp: portItem.asset_ip || governVulnItem.asset_ip,
        port: portItem.port || governVulnItem.port,
        vulnItem: governVulnItem
      }
      this.showConvergencePanel = true
    },
    // 验证端口是否存活（与资产详情端口列表一致）
    async handleVerifyAlive (portItem) {
      if (!portItem) {
        return
      }

      const lanIp = String(portItem.asset_ip || '').trim()
      const lanPort =
        portItem.lan_port !== undefined && portItem.lan_port !== null
          ? portItem.lan_port
          : portItem.port

      if (
        !lanIp ||
        lanPort === undefined ||
        lanPort === null ||
        lanPort === ''
      ) {
        ElMessage.warning('缺少资产 IP 或端口，无法验证')
        return
      }

      portItem._verifyLoading = true
      try {
        const { data } = await portStatusAPI({
          id: portItem.id,
          lan_ip: lanIp,
          lan_port: lanPort
        })
        const isAlive = data === 'success'
        // 同步更新存活状态：1 存活，0 不存活
        portItem.status = isAlive ? 1 : 0
        ElMessage[isAlive ? 'success' : 'warning'](
          isAlive ? '端口存活' : '未开启或不可达'
        )
      } finally {
        portItem._verifyLoading = false
      }
    },
    // 返回端口列表并刷新数据
    async handleBackFromConvergence () {
      this.showConvergencePanel = false
      this.convergenceContext = null
      await this.fetchHighRiskPortList()
      this.$emit('refresh')
    },
    // 收敛策略下发成功：通知外层刷新 list，并回填风险详情
    handleConvergenceSuccess () {
      this.$emit('refresh')
    },
    // 第二层收敛/验证/通知统一返回入口
    handleSecondStepBack () {
      if (this.showVerifyPanel && this.$refs.verifyGovernRef) {
        this.$refs.verifyGovernRef.handleBack()
        return
      }
      if (this.showConvergencePanel) {
        this.handleBackFromConvergence()
        return
      }
      if (this.showEmailNotifyPanel) {
        this.handleBackFromEmailNotify()
      }
    },
    // 打开端口验证页
    handleOpenVerify (portItem) {
      if (!portItem) {
        return
      }
      this.resetSubPanels()
      this.verifyContext = {
        portItem: { ...portItem },
        verifyKey: Date.now()
      }
      this.showVerifyPanel = true
    },
    // 返回端口列表
    handleBackFromVerify () {
      this.showVerifyPanel = false
      this.verifyContext = null
    },
    // 验证结果回调
    handleVerifyResult () {
      this.$emit('verify-result')
    },
    // 打开邮件通知页
    handleOpenEmailNotify (portItem) {
      if (!portItem) {
        return
      }
      const governVulnItem = this.buildPortGovernVulnItem(portItem)
      const vulnIds = this.getPortVulnIds(portItem)
      this.resetSubPanels()
      this.emailNotifyContext = {
        vulnItem: governVulnItem,
        vulnIds,
        assetIp: portItem.asset_ip || governVulnItem.asset_ip || '',
        notifyKey: Date.now()
      }
      this.showEmailNotifyPanel = true
    },
    // 返回端口列表
    handleBackFromEmailNotify () {
      this.showEmailNotifyPanel = false
      this.emailNotifyContext = null
    },
    // 邮件通知发送成功
    handleEmailNotifySent () {
      this.$emit('email-notify-sent')
    },
    // 打开生成报告页
    handleOpenReport (portItem) {
      if (!portItem) {
        return
      }
      const governVulnItem = this.buildPortGovernVulnItem(portItem)
      const vulnIds = this.getPortVulnIds(portItem)
      this.resetSubPanels()
      this.reportContext = {
        vulnItem: governVulnItem,
        vulnIds,
        reportKey: Date.now()
      }
      this.showReportPanel = true
    },
    // 返回端口列表
    handleBackFromReport () {
      this.showReportPanel = false
      this.reportContext = null
    },
    // 生成工单事件
    async handleCreateWorkOrder (portItem) {
      if (!portItem) {
        return
      }

      const workOrderRequestId = this.getWorkOrderRequestId(portItem)
      if (!workOrderRequestId) {
        ElMessage.warning('缺少任务标识，无法生成事件')
        return
      }

      this.workOrderCreatingId = workOrderRequestId
      try {
        await createWorkOrderEvent(this, {
          ip: portItem.asset_ip || '',
          task_type: '风险处置',
          category: this.getWorkOrderCategory(),
          id: workOrderRequestId
        })
      } finally {
        this.workOrderCreatingId = ''
      }
    },
    // 根据模式裁剪任务列表
    normalizeTaskList (taskList = []) {
      const normalizedList = Array.isArray(taskList) ? taskList : []
      if (this.singleTaskMode && normalizedList.length) {
        return [normalizedList[0]]
      }
      return normalizedList
    },
    // 默认展开第一个端口卡片
    expandFirstPortCard () {
      const firstPortItem = this.portList[0]
      if (!firstPortItem) {
        return
      }
      const firstPortId = this.getPortCardId(firstPortItem, 0)
      this.expandedPortIds[firstPortId] = true
    },
    // 获取高危/常规端口任务列表
    async fetchHighRiskPortList () {
      this.loading = true
      const categoryName = this.getWorkOrderCategory()
      try {
        if (Array.isArray(this.externalTaskList)) {
          // 外部列表（风险监测 detail）规范化后使用，保留 detail.vulns
          this.portList = this.normalizeTaskList(this.externalTaskList).map(
            item => this.normalizePortTaskItem(item)
          )
          this.expandFirstPortCard()
          this.$nextTick(() => {
            if (this.$refs.riskAiAdvice) {
              this.$refs.riskAiAdvice.startAdvice()
            }
          })
          return
        }

        const result = await taskListNewAPI({
          category: categoryName,
          task_type: '风险处置',
          status: 0
        })
        if (!result || Number(result.code) !== 0) {
          throw new Error(
            (result && result.msg) || `获取${categoryName}列表失败`
          )
        }

        // 风险详情 list 规范化后展示，保留 vulns
        this.portList = this.normalizeTaskList(
          (result.data && result.data.list) || []
        ).map(item => this.normalizePortTaskItem(item))
        this.expandFirstPortCard()
        this.$nextTick(() => {
          if (this.$refs.riskAiAdvice) {
            this.$refs.riskAiAdvice.startAdvice()
          }
        })
      } catch (error) {
        this.portList = []
        if (this.$refs.riskAiAdvice) {
          this.$refs.riskAiAdvice.reset()
        }
        ElMessage.error(
          (error && error.msg) ||
            (error && error.message) ||
            `获取${categoryName}列表失败`
        )
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  .el-dialog__body {
    padding: var(--sp-5) 40px !important;
  }
}

.high-risk-ports-govern {
  &__back-row {
    margin-bottom: var(--sp-2);
  }

  &__intro {
    margin: 0 0 14px;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.7;
  }

  &__summary {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-radius: var(--r-lg);
    color: var(--info);
    background: var(--info-soft);

    .iconfont {
      flex-shrink: 0;
      color: inherit;
      font-size: 16px;
    }
  }

  &__summary-text {
    color: inherit;
    font-size: var(--fs-base);
    line-height: 1.5;
  }

  &__summary-count {
    margin: 0 2px;
    color: inherit;
    font-weight: var(--fw-bold);
  }

  &__section-title {
    margin-bottom: 12px;
    color: var(--c-text);
    font-size: var(--fs-md);
    font-weight: var(--fw-bold);
    line-height: 1.4;
  }

  &__list {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 360px;
    min-height: 120px;
    overflow-x: hidden;
    overflow-y: auto;
    -ms-overflow-style: none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__card {
    flex-shrink: 0;
    border: 1px solid var(--rule, #2a3245);
    border-radius: 8px;
    background: var(--bg2, #0f1626);
    overflow: hidden;
    transition: border-color 0.15s ease;

    &--expanded {
      border-color: var(--c-border);
    }
  }

  &__card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.15s ease;

    &:hover {
      background: var(--c-bg-hover, #1a2238);
    }
  }

  &__card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    color: var(--info);
    font-size: 16px;
    background: var(--info-soft);

    .iconfont {
      font-size: 16px;
      line-height: 1;
    }
  }

  &__card-info {
    flex: 1;
    min-width: 0;
  }

  &__card-title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  &__card-title {
    color: var(--info);
    font-size: var(--fs-xl);
    font-weight: var(--fw-medium);
    font-family: var(--font-mono);
    line-height: 1.4;
  }

  &__alive-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    border-radius: var(--r-sm);
    font-size: var(--fs-xs);
    line-height: 18px;
    white-space: nowrap;

    &.is-live {
      color: var(--c-success);
      background: var(--c-success-bg);
      border: 1px solid rgba(5, 150, 105, 0.2);
    }

    &.is-dead {
      color: var(--c-text-muted);
      background: var(--c-neutral-bg, transparent);
      border: 1px solid var(--c-border-strong);
    }
  }

  &__card-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
    font-size: var(--fs-xs);
    line-height: 1.4;
  }

  &__meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__meta-label {
    color: var(--c-text-muted);
    font-weight: var(--fw-normal);
  }

  &__meta-value {
    color: var(--c-text);
    font-weight: var(--fw-medium);
  }

  &__meta-dot {
    color: var(--c-text-muted);
    font-weight: var(--fw-normal);
  }

  &__card-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 10px;
  }

  &__vuln-count {
    padding: 2px 8px;
    color: var(--info);
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    line-height: 1.4;
    border-radius: var(--r-sm);
    background: var(--info-soft);
    white-space: nowrap;
  }

  &__card-arrow {
    color: var(--c-text-muted);
    font-size: 12px;
  }

  &__card-body {
    padding: 0 16px 14px;
    border-top: 1px solid var(--c-border-light);
  }

  &__vuln-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    min-height: 40px;
    margin-top: 12px;
    padding-right: 4px;
    overflow-x: hidden;
    overflow-y: auto;

    &--loading {
      min-height: 120px;
    }
  }

  &__vuln-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-shrink: 0;
    min-height: 36px;
    padding: 8px 10px;
    border-radius: var(--r-md);
    border: 1px solid var(--c-border-light);
    background: var(--c-bg-hover);
  }

  &__vuln-name {
    flex: 1;
    min-width: 0;
    color: var(--c-text);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__vuln-level {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    gap: 8px;
    color: var(--c-neutral);
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    line-height: 1;
    white-space: nowrap;

    &.is-level-1 {
      color: var(--c-neutral);
    }

    &.is-level-2 {
      color: var(--c-info);
    }

    &.is-level-3 {
      color: var(--c-warn);
    }

    &.is-level-4,
    &.is-level-5 {
      color: var(--c-danger);
    }
  }

  &__vuln-level-bars {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    height: 12px;

    i {
      display: block;
      width: 3px;
      border-radius: 1px;
      background: currentColor;
      opacity: 0.25;

      &:nth-child(1) {
        height: 4px;
      }

      &:nth-child(2) {
        height: 6px;
      }

      &:nth-child(3) {
        height: 8px;
      }

      &:nth-child(4) {
        height: 10px;
      }

      &:nth-child(5) {
        height: 12px;
      }

      &.is-on {
        opacity: 1;
      }
    }
  }

  &__vuln-level-text {
    min-width: 2em;
  }

  &__card-footer {
    display: flex;
    flex-wrap: nowrap;
    flex-shrink: 0;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--c-border-light);
    overflow-x: auto;

    :deep(> .el-button),
    :deep(> .el-dropdown) {
      flex: 0 0 auto;
    }

    :deep(> .high-risk-ports-govern__action-converge) {
      order: 1;
    }

    :deep(> .high-risk-ports-govern__action-verify) {
      order: 2;
    }

    :deep(> .high-risk-ports-govern__batch-dropdown) {
      order: 3;
    }

    :deep(> .high-risk-ports-govern__action-notify) {
      order: 4;
    }

    :deep(> .high-risk-ports-govern__action-report) {
      order: 5;
    }

    :deep(> .high-risk-ports-govern__action-work-order) {
      order: 6;
    }
  }

  &__batch-footer {
    display: contents;
  }

  &__btn-batch-vuln {
    color: var(--c-danger);
    border-color: color-mix(in srgb, var(--c-danger) 35%, transparent);
    background: color-mix(in srgb, var(--c-danger) 8%, transparent);
  }
}
</style>

<style lang="scss">
:root[data-theme='light'] {
  .high-risk-ports-govern__summary {
    background: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.2);
    color: #2563eb;
  }

  .high-risk-ports-govern__card {
    background: #ffffff;
    border-color: #ebeef5;
  }

  .high-risk-ports-govern__card-header:hover {
    background: #f8f9fb;
  }

  .high-risk-ports-govern__card--expanded {
    border-color: #e4e7ed;
  }

  .high-risk-ports-govern__card-icon {
    color: #2563eb;
    background: rgba(59, 130, 246, 0.08);
  }

  .high-risk-ports-govern__card-title {
    color: #2563eb;
  }

  .high-risk-ports-govern__vuln-count {
    color: #2563eb;
    background: rgba(59, 130, 246, 0.08);
  }

  .high-risk-ports-govern__meta-label,
  .high-risk-ports-govern__meta-dot {
    color: #909399;
  }

  .high-risk-ports-govern__meta-value {
    color: #303133;
  }

  .high-risk-ports-govern__card-body {
    border-top-color: #ebeef5;
  }

  .high-risk-ports-govern__card-footer {
    border-top-color: #ebeef5;
  }

  .high-risk-ports-govern__vuln-item {
    background: #fafbfc;
  }

  .high-risk-ports-govern__vuln-name {
    color: #303133;
  }
}

:root:not([data-theme='light']) {
  .high-risk-ports-govern__card {
    border-color: #2a3656;
  }

  .high-risk-ports-govern__card--expanded,
  .high-risk-ports-govern__card-body,
  .high-risk-ports-govern__card-footer {
    border-color: #24314f;
  }

  .high-risk-ports-govern__vuln-item {
    border-color: #2a3656;
  }

  .high-risk-ports-govern__batch-popper {
    border: 1px solid #3a4a70 !important;
    background: #141b2e !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35) !important;
  }

  .high-risk-ports-govern__batch-popper .el-dropdown-menu {
    border: 0;
    background: transparent;
  }

  .high-risk-ports-govern__batch-popper .el-dropdown-menu__item {
    color: #b8c2dc;
  }

  .high-risk-ports-govern__batch-popper .el-dropdown-menu__item:hover {
    color: #e6ecff;
    background: #243252;
  }

  .high-risk-ports-govern__batch-popper .el-popper__arrow::before {
    border-color: #3a4a70 !important;
    background: #141b2e !important;
  }
}

:root[data-theme='light'] .high-risk-ports-govern__batch-popper {
  border: 1px solid #dcdfe6 !important;
  background: #ffffff !important;
}

.batch-vuln-status-dialog {
  width: min(520px, calc(100vw - 32px)) !important;
  padding: 0 !important;
  overflow: hidden;
  border-radius: 12px !important;
}

.batch-vuln-status-dialog .el-message-box__header {
  padding: 18px 22px 16px;
  border-bottom: 1px solid var(--c-border-light);
}

.batch-vuln-status-dialog .el-message-box__title {
  color: var(--c-text);
  font-size: 15px;
  font-weight: 600;
}

.batch-vuln-status-dialog .el-message-box__headerbtn {
  top: 14px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--c-bg-hover);
}

.batch-vuln-status-dialog .el-message-box__close {
  color: var(--c-text-muted);
  font-size: 18px;
}

.batch-vuln-status-dialog .el-message-box__content {
  padding: 20px 24px 14px;
}

.batch-vuln-status-dialog .el-message-box__message {
  width: 100%;
  margin: 0;
  color: var(--c-text);
}

.batch-vuln-confirm__lead {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  line-height: 1.5;
}

.batch-vuln-confirm__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #c88900;
  font-size: 16px;
  font-weight: 700;
  background: rgba(245, 190, 60, 0.18);
}

.batch-vuln-confirm__summary {
  margin: 14px 0 16px 38px;
  padding: 12px 14px;
  border: 1px solid var(--c-border-light);
  border-radius: 8px;
  background: var(--c-bg-hover);
}

.batch-vuln-confirm__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--c-text-muted);
  font-size: 12px;
}

.batch-vuln-confirm__row strong {
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
}

.batch-vuln-confirm__row:last-child strong {
  color: var(--c-primary);
}

.batch-vuln-confirm__row em {
  color: var(--c-text-muted);
  font-family: inherit;
  font-size: 12px;
  font-style: normal;
}

.batch-vuln-confirm__divider {
  height: 1px;
  margin: 10px 0;
  background: var(--c-border-light);
}

.batch-vuln-confirm__result {
  margin-left: 0;
  color: var(--c-text-muted);
  font-size: 12px;
}

.batch-vuln-status-dialog .el-message-box__btns {
  gap: 8px;
  padding: 14px 16px 16px;
  border-top: 1px solid var(--c-border-light);
}

.batch-vuln-status-dialog .el-message-box__btns .el-button {
  min-width: 100px;
  height: 36px;
  margin-left: 0;
  border-radius: 8px;
  font-size: 13px;
}

.batch-vuln-status-dialog .el-message-box__btns .el-button--primary {
  border-color: var(--c-primary);
  background: var(--c-primary);
}

:root:not([data-theme='light']) .batch-vuln-status-dialog {
  border: 1px solid #2a3656;
  background: #141b2e;
}

:root:not([data-theme='light']) .batch-vuln-status-dialog .el-message-box__header,
:root:not([data-theme='light']) .batch-vuln-status-dialog .el-message-box__btns {
  border-color: #2a3656;
}

:root[data-theme='light'] .batch-vuln-status-dialog {
  border: 1px solid #e5e7eb;
  background: #ffffff;
}
</style>
