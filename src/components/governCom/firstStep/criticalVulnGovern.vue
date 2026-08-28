<template>
  <!-- 关键漏洞治理弹框 -->
  <div class="critical-vuln-govern">
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
        class="critical-vuln-govern__back-row"
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

      <critical-vuln-verify
        v-else-if="showVerifyPanel"
        ref="verifyGovernRef"
        :verify-context="verifyContext"
        @back="handleBackFromVerify"
        @submitting-change="handleVerifySubmittingChange"
        @verify-result="handleVerifyResult"
        @status-updated="handleVerifyStatusUpdated"
      />

      <threat-rule-govern
        v-else-if="showThreatRulePanel"
        :rule-context="threatRuleContext"
        @back="handleBackFromThreatRule"
        @success="handleThreatRuleSuccess"
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
        <!-- 说明文案 -->
        <p class="critical-vuln-govern__intro">
          关键漏洞指 CVSS 评分 ≥ 9.0
          的高危漏洞，可能造成系统被完全控制或大规模数据泄露。
        </p>

        <!-- 漏洞数量汇总 -->
        <div v-if="!singleTaskMode" class="critical-vuln-govern__summary">
          <i class="iconfont icon-alert-triangle" />
          <span class="critical-vuln-govern__summary-text">
            当前资产中存在
            <strong class="critical-vuln-govern__summary-count">{{
              vulnList.length
            }}</strong>
            个关键漏洞
          </span>
        </div>

        <!-- 风险详情标题 -->
        <div class="critical-vuln-govern__section-title">风险详情</div>

        <!-- 漏洞卡片列表 -->
        <div class="critical-vuln-govern__list">
          <LedgerLoading :visible="loading" text="加载中..." />
          <div
            v-for="(vulnItem, vulnIndex) in vulnList"
            :key="vulnItem.id || vulnItem.task_id || vulnIndex"
            class="critical-vuln-govern__card"
            :class="{
              'critical-vuln-govern__card--expanded': isCardExpanded(
                vulnItem,
                vulnIndex
              )
            }"
          >
            <!-- 卡片头部 -->
            <div
              class="critical-vuln-govern__card-header"
              @click="toggleCardExpand(vulnItem, vulnIndex)"
            >
              <div
                class="critical-vuln-govern__card-icon"
                :class="
                  Number(vulnItem.cvss || vulnItem.cvss_score) >= 9
                    ? 'critical-vuln-govern__card-icon--danger'
                    : 'critical-vuln-govern__card-icon--warn'
                "
              >
                <i class="iconfont icon-alert-triangle" />
              </div>
              <div class="critical-vuln-govern__card-info">
                <div class="critical-vuln-govern__card-title">
                  {{ vulnItem.vuln_name }}
                </div>
                <div class="critical-vuln-govern__card-meta">
                  <span class="critical-vuln-govern__meta-item">
                    <span class="critical-vuln-govern__meta-label"
                      >资产 IP</span
                    >
                    <span class="critical-vuln-govern__meta-value">{{
                      vulnItem.asset_ip || '--'
                    }}</span>
                  </span>
                  <span class="critical-vuln-govern__meta-dot">·</span>
                  <span class="critical-vuln-govern__meta-item">
                    <span class="critical-vuln-govern__meta-label">端口</span>
                    <span class="critical-vuln-govern__meta-value">{{
                      vulnItem.port || '--'
                    }}</span>
                  </span>
                </div>
              </div>

              <div class="critical-vuln-govern__card-actions">
                <RiskStatusBadge :status="vulnItem.vuln_status" />
                <i
                  class="critical-vuln-govern__card-arrow"
                  :class="
                    isCardExpanded(vulnItem, vulnIndex)
                      ? 'el-icon-arrow-up'
                      : 'el-icon-arrow-down'
                  "
                />
              </div>
            </div>

            <!-- 展开详情 -->
            <div
              v-show="isCardExpanded(vulnItem, vulnIndex)"
              class="critical-vuln-govern__card-body"
            >
              <div class="critical-vuln-govern__detail-list">
                <div class="critical-vuln-govern__detail-row">
                  <span class="critical-vuln-govern__detail-label"
                    >漏洞编号</span
                  >
                  <span class="critical-vuln-govern__detail-value font-mono">
                    {{ vulnItem.vuln_number || '-' }}
                  </span>
                </div>
                <div class="critical-vuln-govern__detail-row">
                  <span class="critical-vuln-govern__detail-label"
                    >修复建议</span
                  >
                  <span class="critical-vuln-govern__detail-value">
                    {{ getRepairSuggestionText(vulnItem) }}
                  </span>
                </div>

                <div class="critical-vuln-govern__detail-row">
                  <span class="critical-vuln-govern__detail-label"
                    >漏洞描述</span
                  >
                  <span class="critical-vuln-govern__detail-value">
                    {{ vulnItem.describe || '-' }}
                  </span>
                </div>
              </div>

              <div
                v-if="canShowGovernActions(vulnItem) || isVulnRepaired(vulnItem)"
                class="critical-vuln-govern__card-footer"
              >
                <el-button
                  v-if="!isVulnConverged(vulnItem) && !isVulnRepaired(vulnItem)"
                  @click.stop="handleOpenConvergence(vulnItem)"
                >
                  收敛
                </el-button>
                <el-button
                  :loading="
                    verifySubmittingVulnId === getVulnRequestId(vulnItem)
                  "
                  @click.stop="handleOpenVerify(vulnItem)"
                >
                  验证
                </el-button>
                <el-button
                  v-if="!isVulnRepaired(vulnItem)"
                  :loading="
                    threatRuleLoadingVulnId === getVulnRequestId(vulnItem)
                  "
                  @click.stop="handleOpenThreatRule(vulnItem)"
                >
                  生成威胁检测规则
                </el-button>
                <el-button
                  v-if="!isVulnRepaired(vulnItem)"
                  @click.stop="handleOpenEmailNotify(vulnItem)"
                >
                  通知
                </el-button>
                <el-button
                  v-if="!isVulnRepaired(vulnItem)"
                  @click.stop="handleOpenReport(vulnItem)"
                >
                  生成报告
                </el-button>
                <el-button
                  v-if="!isVulnRepaired(vulnItem)"
                  :loading="
                    workOrderCreatingId === getWorkOrderRequestId(vulnItem)
                  "
                  @click.stop="handleCreateWorkOrder(vulnItem)"
                >
                  生成事件
                </el-button>
              </div>
            </div>
          </div>

          <div
            v-if="!loading && vulnList.length === 0"
            class="ledger-table-empty-icon"
          >
            <i class="iconfont icon-kongzhuangtai"></i>
            <span>暂无关键漏洞数据</span>
          </div>
        </div>

        <RiskGovernanceAiAdvicePanel
          ref="riskAiAdvice"
          :show="!loading && vulnList.length > 0"
          risk-type="critical_vulnerability"
          :risk-data="vulnList"
          v-model:outer-dialog-visible="dialogVisible"
          file-name-prefix="关键漏洞"
          @suppress-outer-open="handleAiSuppressOuterOpen"
        />
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus'

import ServiceConvergenceGovern from '@/components/governCom/secondStep/serviceConvergenceGovern.vue'
import CriticalVulnVerify from '@/components/governCom/secondStep/criticalVulnVerify.vue'
import threatRuleGovern from '@/components/governCom/secondStep/threatRuleGovern.vue'
import EmailNotif from '@/components/governCom/secondStep/emailNotif.vue'
import GeneralReport from '@/components/governCom/secondStep/generalReport.vue'
import LedgerLoading from '@/components/ledgerLoading.vue'
import RiskStatusBadge from '@/components/RiskStatusBadge.vue'
import RiskGovernanceAiAdvicePanel from '@/components/governCom/com/RiskGovernanceAiAdvicePanel.vue'
import {
  queryRepairSuggestionByVulnId,
  taskListNewAPI
} from '@/api/riskOperations'
import { createWorkOrderEvent } from '@/utils/workOrderNotify'
import { getDetectRuleByPluginIdAPI } from '@/api/vulnIntelligence'

export default {
  name: 'CriticalVulnGovern',
  components: {
    ServiceConvergenceGovern,
    CriticalVulnVerify,
    threatRuleGovern,
    EmailNotif,
    GeneralReport,
    LedgerLoading,
    RiskStatusBadge,
    RiskGovernanceAiAdvicePanel
  },
  props: {
    // 弹框显示状态
    visible: {
      type: Boolean,
      default: false
    },
    // AI 自动化分析处置：仅展示单条任务并隐藏汇总提示
    singleTaskMode: {
      type: Boolean,
      default: false
    },
    // 攻击面资产页传入的任务列表，存在时不再请求 taskListNewAPI
    externalTaskList: {
      type: Array,
      default: null
    }
  },
  data () {
    return {
      loading: false,
      vulnList: [],
      expandedVulnIds: {},
      repairSuggestionMap: {},
      showConvergencePanel: false,
      showVerifyPanel: false,
      showThreatRulePanel: false,
      showEmailNotifyPanel: false,
      showReportPanel: false,
      convergenceContext: null,
      verifyContext: null,
      threatRuleContext: null,
      emailNotifyContext: null,
      reportContext: null,
      verifySubmittingVulnId: '',
      threatRuleLoadingVulnId: '',
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
        this.vulnList = this.normalizeTaskList(list)
      }
    }
  },
  computed: {
    // 双向绑定弹框显示状态
    dialogVisible: {
      get () {
        return this.visible
      },
      set (value) {
        this.$emit('update:visible', value)
      }
    },
    // 弹框宽度
    dialogWidth () {
      if (
        this.showConvergencePanel ||
        this.showVerifyPanel ||
        this.showThreatRulePanel ||
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
    // 弹框标题
    dialogTitle () {
      if (this.showConvergencePanel) {
        return '服务收敛治理'
      }
      if (this.showVerifyPanel) {
        return '扫描结果'
      }
      if (this.showThreatRulePanel) {
        return '生成威胁检测规则'
      }
      if (this.showEmailNotifyPanel) {
        return '邮件通知'
      }
      if (this.showReportPanel) {
        return '生成报告'
      }
      return '关键漏洞治理'
    }
  },
  mounted () {
    // v-if 新建时若 visible 已是 true，el-dialog 可能不触发 @open
    if (this.visible) {
      this.handleDialogOpen()
    }
  },
  methods: {
    // 获取卡片唯一标识
    getVulnCardId (vulnItem, vulnIndex) {
      return vulnItem.id || vulnItem.task_id || vulnIndex
    },
    // 获取修复建议请求参数 id
    getVulnRequestId (vulnItem) {
      return vulnItem.id || vulnItem.vuln_id
    },
    // 获取生成工单请求 id
    getWorkOrderRequestId (vulnItem) {
      return vulnItem.id || vulnItem.task_id
    },
    // 已修复(3)时仅保留验证；已收敛(1)时隐藏收敛
    canShowGovernActions (vulnItem = {}) {
      return Number(vulnItem.vuln_status) !== 3
    },
    isVulnConverged (vulnItem = {}) {
      return Number(vulnItem.vuln_status) === 1
    },
    isVulnRepaired (vulnItem = {}) {
      return Number(vulnItem.vuln_status) === 3
    },
    // 判断卡片是否展开
    isCardExpanded (vulnItem, vulnIndex) {
      return !!this.expandedVulnIds[this.getVulnCardId(vulnItem, vulnIndex)]
    },
    // 切换卡片展开/折叠状态
    toggleCardExpand (vulnItem, vulnIndex) {
      const cardId = this.getVulnCardId(vulnItem, vulnIndex)
      const willExpand = !this.expandedVulnIds[cardId]
      this.expandedVulnIds[cardId] = willExpand
      if (willExpand) {
        this.fetchRepairSuggestion(vulnItem)
      }
    },
    // 默认展开第一个漏洞卡片
    expandFirstVulnCard () {
      const firstVulnItem = this.vulnList[0]
      if (!firstVulnItem) {
        return
      }
      const firstVulnId = this.getVulnCardId(firstVulnItem, 0)
      this.expandedVulnIds[firstVulnId] = true
      this.fetchRepairSuggestion(firstVulnItem)
    },
    // 获取修复建议展示文案
    getRepairSuggestionText (vulnItem) {
      const vulnRequestId = this.getVulnRequestId(vulnItem)
      const suggestionItem = this.repairSuggestionMap[vulnRequestId]
      if (suggestionItem && suggestionItem.loading) {
        return '加载中...'
      }
      if (!suggestionItem || !suggestionItem.loaded) {
        return '-'
      }
      return suggestionItem.suggestion || '-'
    },
    // 根据漏洞 id 获取修复建议
    async fetchRepairSuggestion (vulnItem) {
      const vulnRequestId = this.getVulnRequestId(vulnItem)
      if (!vulnRequestId) {
        return
      }

      const cachedSuggestion = this.repairSuggestionMap[vulnRequestId]
      if (
        cachedSuggestion &&
        (cachedSuggestion.loading || cachedSuggestion.loaded)
      ) {
        return
      }

      this.repairSuggestionMap[vulnRequestId] = {
        loading: true,
        suggestion: '',
        loaded: false
      }

      try {
        const result = await queryRepairSuggestionByVulnId({
          id: vulnRequestId
        })
        if (!result || Number(result.code) !== 0) {
          throw new Error((result && result.msg) || '获取修复建议失败')
        }
        this.repairSuggestionMap[vulnRequestId] = {
          loading: false,
          suggestion: (result.data && result.data.suggestion) || '--',
          loaded: true
        }
      } catch (error) {
        this.repairSuggestionMap[vulnRequestId] = {
          loading: false,
          suggestion: '--',
          loaded: true
        }
      }
    },
    // 弹框打开时拉取关键漏洞列表
    async handleDialogOpen () {
      if (this.suppressDialogOpenRefresh) {
        this.suppressDialogOpenRefresh = false
        return
      }
      this.expandedVulnIds = {}
      this.repairSuggestionMap = {}
      this.showConvergencePanel = false
      this.showVerifyPanel = false
      this.showThreatRulePanel = false
      this.showEmailNotifyPanel = false
      this.showReportPanel = false
      this.convergenceContext = null
      this.verifyContext = null
      this.threatRuleContext = null
      this.emailNotifyContext = null
      this.reportContext = null
      this.verifySubmittingVulnId = ''
      if (this.$refs.riskAiAdvice) {
        this.$refs.riskAiAdvice.reset()
      }
      await this.fetchCriticalVulnList()
    },
    // 弹框关闭前拦截（验证轮询未完成时提示）
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
    // HTML 预览关闭后恢复外层时跳过重新拉数
    handleAiSuppressOuterOpen () {
      this.suppressDialogOpenRefresh = true
    },
    // 打开服务收敛治理页
    handleOpenConvergence (vulnItem) {
      if (!vulnItem) {
        return
      }
      this.showVerifyPanel = false
      this.verifyContext = null
      this.showThreatRulePanel = false
      this.threatRuleContext = null
      this.showEmailNotifyPanel = false
      this.emailNotifyContext = null
      this.showReportPanel = false
      this.reportContext = null
      this.convergenceContext = {
        assetIp: vulnItem.asset_ip,
        port: vulnItem.port,
        vulnItem
      }
      this.showConvergencePanel = true
    },
    // 返回漏洞列表并刷新数据
    async handleBackFromConvergence () {
      this.showConvergencePanel = false
      this.convergenceContext = null
      await this.fetchCriticalVulnList()
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
    // 打开关键漏洞验证页
    handleOpenVerify (vulnItem) {
      if (!vulnItem) {
        return
      }

      this.showConvergencePanel = false
      this.convergenceContext = null
      this.showThreatRulePanel = false
      this.threatRuleContext = null
      this.showEmailNotifyPanel = false
      this.emailNotifyContext = null
      this.showReportPanel = false
      this.reportContext = null
      this.verifyContext = {
        vulnItem: { ...vulnItem },
        verifyKey: Date.now()
      }
      this.showVerifyPanel = true
    },
    // 验证提交状态变更
    handleVerifySubmittingChange (isSubmitting) {
      const currentVulnItem =
        this.verifyContext && this.verifyContext.vulnItem
          ? this.verifyContext.vulnItem
          : null
      this.verifySubmittingVulnId =
        isSubmitting && currentVulnItem
          ? this.getVulnRequestId(currentVulnItem)
          : ''
    },
    // 返回漏洞列表
    handleBackFromVerify () {
      this.showVerifyPanel = false
      this.verifyContext = null
      this.verifySubmittingVulnId = ''
    },
    // 验证结果回调
    handleVerifyResult () {
      this.$emit('verify-result')
    },
    // 验证后漏洞状态更新：同步卡片状态，并通知外层刷新
    handleVerifyStatusUpdated (payload = {}) {
      const ids = Array.isArray(payload.ids)
        ? payload.ids.map(Number).filter(id => Number.isFinite(id) && id > 0)
        : []
      if (ids.length) {
        this.applyVulnStatusToList(ids, 3)
      }
      // 外部单条任务没有独立风险详情列表接口，直接改本地；工单模式再拉接口
      if (!Array.isArray(this.externalTaskList)) {
        this.fetchCriticalVulnList()
      }
      this.$emit('status-updated', { ...payload, ids, vuln_status: 3 })
    },
    // 把验证后的漏洞状态写回风险详情卡片
    applyVulnStatusToList (ids = [], vulnStatus = 3) {
      const idSet = new Set(ids.map(Number))
      this.vulnList = (this.vulnList || []).map(item => {
        const itemId = Number(item.id || item.vuln_id)
        if (!idSet.has(itemId)) return item
        return {
          ...item,
          vuln_status: vulnStatus
        }
      })
    },
    // 打开生成威胁检测规则页
    async handleOpenThreatRule (vulnItem) {
      if (!vulnItem) {
        return
      }

      const pocId = String(vulnItem.poc_id || '').trim()
      if (!pocId) {
        ElMessage.warning('缺少 poc_id，无法生成威胁检测规则')
        return
      }

      const vulnRequestId = this.getVulnRequestId(vulnItem)
      if (this.threatRuleLoadingVulnId) return
      this.threatRuleLoadingVulnId = vulnRequestId

      try {
        const response = await getDetectRuleByPluginIdAPI({ plugin_id: pocId })
        if (!response || Number(response.code) !== 0) {
          ElMessage.error('查询检测规则失败，请稍后重试')
          return
        }

        const rawRules = this.flattenDetectRules(
          response.data && response.data.detect_rule
        )
        if (!rawRules.length) {
          ElMessage.warning('未查询到检测规则，无法生成威胁检测规则')
          return
        }

        this.showConvergencePanel = false
        this.convergenceContext = null
        this.showVerifyPanel = false
        this.verifyContext = null
        this.showEmailNotifyPanel = false
        this.emailNotifyContext = null
        this.showReportPanel = false
        this.reportContext = null
        this.threatRuleContext = {
          vulnItem: { ...vulnItem },
          rawRules,
          pluginId: pocId
        }
        this.showThreatRulePanel = true
      } catch (error) {
        ElMessage.error('查询检测规则失败，请稍后重试')
      } finally {
        this.threatRuleLoadingVulnId = ''
      }
    },

    flattenDetectRules (value) {
      if (Array.isArray(value)) {
        return value.flatMap(item => this.flattenDetectRules(item))
      }
      if (value === undefined || value === null) return []

      const text = String(value).trim()
      if (!text) return []
      try {
        const parsed = JSON.parse(text)
        if (parsed !== value) return this.flattenDetectRules(parsed)
      } catch (error) {
        // 普通 Suricata 多行规则按换行拆分
      }
      return text.split(/\r?\n+/).map(item => item.trim()).filter(Boolean)
    },
    // 返回漏洞列表
    handleBackFromThreatRule () {
      this.showThreatRulePanel = false
      this.threatRuleContext = null
    },
    // 威胁检测规则生成成功
    handleThreatRuleSuccess () {
      this.$emit('threat-rule-success')
    },
    // 打开邮件通知页
    handleOpenEmailNotify (vulnItem) {
      if (!vulnItem) {
        return
      }

      const vulnRequestId = this.getVulnRequestId(vulnItem)
      this.showConvergencePanel = false
      this.convergenceContext = null
      this.showVerifyPanel = false
      this.verifyContext = null
      this.showThreatRulePanel = false
      this.threatRuleContext = null
      this.showReportPanel = false
      this.reportContext = null
      this.emailNotifyContext = {
        vulnItem: { ...vulnItem },
        vulnIds: vulnRequestId ? [vulnRequestId] : [],
        assetIp: vulnItem.asset_ip || '',
        notifyKey: Date.now()
      }
      this.showEmailNotifyPanel = true
    },
    // 返回漏洞列表
    handleBackFromEmailNotify () {
      this.showEmailNotifyPanel = false
      this.emailNotifyContext = null
    },
    // 邮件通知发送成功
    handleEmailNotifySent () {
      this.$emit('email-notify-sent')
    },
    // 打开生成报告页
    handleOpenReport (vulnItem) {
      if (!vulnItem) {
        return
      }

      const vulnRequestId = this.getVulnRequestId(vulnItem)
      this.showConvergencePanel = false
      this.convergenceContext = null
      this.showVerifyPanel = false
      this.verifyContext = null
      this.showThreatRulePanel = false
      this.threatRuleContext = null
      this.showEmailNotifyPanel = false
      this.emailNotifyContext = null
      this.reportContext = {
        vulnItem: { ...vulnItem },
        vulnIds: vulnRequestId ? [vulnRequestId] : [],
        reportKey: Date.now()
      }
      this.showReportPanel = true
    },
    // 生成工单事件
    async handleCreateWorkOrder (vulnItem) {
      if (!vulnItem) {
        return
      }

      const workOrderRequestId = this.getWorkOrderRequestId(vulnItem)
      if (!workOrderRequestId) {
        ElMessage.warning('缺少任务标识，无法生成事件')
        return
      }

      this.workOrderCreatingId = workOrderRequestId
      try {
        await createWorkOrderEvent(this, {
          ip: vulnItem.asset_ip || '',
          task_type: '风险处置',
          category: '关键漏洞',
          id: workOrderRequestId
        })
      } finally {
        this.workOrderCreatingId = ''
      }
    },
    // 返回漏洞列表
    handleBackFromReport () {
      this.showReportPanel = false
      this.reportContext = null
    },
    // 根据模式裁剪任务列表
    normalizeTaskList (taskList = []) {
      const normalizedList = Array.isArray(taskList) ? taskList : []
      if (this.singleTaskMode && normalizedList.length) {
        return [normalizedList[0]]
      }
      return normalizedList
    },
    // 获取关键漏洞任务列表
    async fetchCriticalVulnList () {
      this.loading = true
      try {
        if (Array.isArray(this.externalTaskList)) {
          this.vulnList = this.normalizeTaskList(this.externalTaskList)
          this.expandFirstVulnCard()
          this.$nextTick(() => {
            if (this.$refs.riskAiAdvice) {
              this.$refs.riskAiAdvice.startAdvice()
            }
          })
          return
        }

        const result = await taskListNewAPI({
          category: '关键漏洞',
          task_type: '风险处置',
          status: 0
        })
        if (!result || Number(result.code) !== 0) {
          throw new Error((result && result.msg) || '获取关键漏洞列表失败')
        }
        const taskList = this.normalizeTaskList(
          (result.data && result.data.list) || []
        )
        this.vulnList = taskList
        this.expandFirstVulnCard()
        this.$nextTick(() => {
          if (this.$refs.riskAiAdvice) {
            this.$refs.riskAiAdvice.startAdvice()
          }
        })
      } catch (error) {
        this.vulnList = []
        if (this.$refs.riskAiAdvice) {
          this.$refs.riskAiAdvice.reset()
        }
        ElMessage.error(
          (error && error.msg) ||
            (error && error.message) ||
            '获取关键漏洞列表失败'
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

.critical-vuln-govern {
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
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: var(--r-lg);
    color: var(--danger, #ef4444);
    background: rgba(239, 68, 68, 0.08);

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
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    color: var(--c-text);
    font-size: var(--fs-md);
    font-weight: var(--fw-medium);
    line-height: 1.4;
  }

  &__list {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 15px;
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
    font-size: 16px;
    line-height: 1;

    .iconfont {
      font-size: 16px;
      line-height: 1;
    }

    &--danger {
      color: var(--danger, #ef4444);
      background: rgba(239, 68, 68, 0.08);
    }

    &--warn {
      color: #f97316;
      background: rgba(249, 115, 22, 0.1);
    }
  }

  &__card-info {
    flex: 1;
    min-width: 0;
  }

  &__card-title {
    color: var(--c-text);
    font-size: var(--fs-base);
    font-weight: var(--fw-medium);
    line-height: 1.5;
    word-break: break-all;
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
    font-weight: var(--fw-normal);
    font-family: var(--font-mono);
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

  &__card-arrow {
    color: var(--c-text-muted);
    font-size: 12px;
  }

  &__card-body {
    padding: 0 16px 14px;
    border-top: 1px solid var(--c-border-light);
    overflow: visible;
  }

  &__detail-list {
    padding-top: 2px;
  }

  &__detail-row {
    display: flex;
    align-items: flex-start;
    gap: 32px;
    padding: 8px 15px;
    border-bottom: 1px dashed var(--c-border-light);

    &:last-child {
      padding-bottom: 12px;
    }
  }

  &__detail-label {
    flex-shrink: 0;
    width: 56px;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.5;
  }

  &__detail-value {
    flex: 1;
    min-width: 0;
    color: var(--c-text);
    font-size: var(--fs-sm);
    line-height: 1.5;
    word-break: break-all;
  }

  &__card-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 8px;
    flex-shrink: 0;
  }
}
</style>

<style lang="scss">
/* 浅色主题样式还原 */
:root[data-theme='light'] {
  .critical-vuln-govern__summary {
    background: rgba(239, 68, 68, 0.06);
    border-color: rgba(239, 68, 68, 0.2);
    color: #dc2626;
  }

  .critical-vuln-govern__card {
    background: #ffffff;
    border-color: #ebeef5;
  }

  .critical-vuln-govern__card-header:hover {
    background: #f8f9fb;
  }

  .critical-vuln-govern__card--expanded {
    border-color: #e4e7ed;
  }

  .critical-vuln-govern__card-icon--danger {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.06);
  }

  .critical-vuln-govern__card-icon--warn {
    color: #f97316;
    background: rgba(249, 115, 22, 0.08);
  }

  .critical-vuln-govern__card-meta {
    color: #909399;
  }

  .critical-vuln-govern__meta-label,
  .critical-vuln-govern__meta-dot {
    color: #909399;
  }

  .critical-vuln-govern__meta-value {
    color: #303133;
  }

  .critical-vuln-govern__card-title {
    color: #303133;
  }

  .critical-vuln-govern__card-body {
    border-top-color: #ebeef5;
  }

  .critical-vuln-govern__detail-row {
    border-bottom-color: #ebeef5;
  }

  .critical-vuln-govern__detail-label {
    color: #909399;
  }

  .critical-vuln-govern__detail-value {
    color: #303133;
  }
}
</style>
