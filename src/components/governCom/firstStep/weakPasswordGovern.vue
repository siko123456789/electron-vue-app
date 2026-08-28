<template>
  <!-- 弱口令治理弹框 -->
  <div class="weak-password-govern">
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
        class="weak-password-govern__back-row"
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
        <p class="weak-password-govern__intro">
          弱口令指资产上存在可被轻易猜解的账号密码组合，攻击者可直接登录系统并进一步横向渗透。
        </p>

        <div v-if="!singleTaskMode" class="weak-password-govern__summary">
          <i class="iconfont icon-alert-triangle" />
          <span class="weak-password-govern__summary-text">
            当前资产中存在
            <strong class="weak-password-govern__summary-count">{{
              vulnList.length
            }}</strong>
            个弱口令风险
          </span>
        </div>

        <div class="weak-password-govern__section-title">风险详情</div>

        <div class="weak-password-govern__list">
          <LedgerLoading :visible="loading" text="加载中..." />

          <div
            v-for="(vulnItem, vulnIndex) in vulnList"
            :key="vulnItem.id || vulnItem.task_id || vulnIndex"
            class="weak-password-govern__card"
            :class="{
              'weak-password-govern__card--expanded': isCardExpanded(
                vulnItem,
                vulnIndex
              )
            }"
          >
            <div
              class="weak-password-govern__card-header"
              @click="toggleCardExpand(vulnItem, vulnIndex)"
            >
              <div class="weak-password-govern__card-icon">
                <i class="iconfont icon-alert-triangle" />
              </div>
              <div class="weak-password-govern__card-info">
                <div class="weak-password-govern__card-title">
                  {{ vulnItem.vuln_name }}
                </div>
                <div class="weak-password-govern__card-meta">
                  <span class="weak-password-govern__meta-item">
                    <span class="weak-password-govern__meta-label"
                      >资产 IP</span
                    >
                    <span class="weak-password-govern__meta-value font-mono">{{
                      vulnItem.asset_ip || '--'
                    }}</span>
                  </span>
                  <span class="weak-password-govern__meta-dot">·</span>
                  <span class="weak-password-govern__meta-item">
                    <span class="weak-password-govern__meta-label">端口</span>
                    <span class="weak-password-govern__meta-value font-mono">{{
                      vulnItem.port || '--'
                    }}</span>
                  </span>
                </div>
              </div>

              <div class="weak-password-govern__card-actions">
                <div
                  class="weak-password-govern__vuln-level"
                  :class="`is-level-${getVulnLevelRank(vulnItem.vuln_level)}`"
                >
                  <span class="weak-password-govern__vuln-level-bars" aria-hidden="true">
                    <i
                      v-for="barIndex in 5"
                      :key="barIndex"
                      :class="{
                        'is-on': barIndex <= getVulnLevelRank(vulnItem.vuln_level)
                      }"
                    />
                  </span>
                  <span class="weak-password-govern__vuln-level-text">
                    {{ formatVulnLevel(vulnItem.vuln_level) }}
                  </span>
                </div>
                <RiskStatusBadge :status="vulnItem.vuln_status" />
                <i
                  class="weak-password-govern__card-arrow"
                  :class="
                    isCardExpanded(vulnItem, vulnIndex)
                      ? 'el-icon-arrow-up'
                      : 'el-icon-arrow-down'
                  "
                />
              </div>
            </div>

            <div
              v-show="isCardExpanded(vulnItem, vulnIndex)"
              class="weak-password-govern__card-body"
            >
              <div class="weak-password-govern__detail-list">
                <div class="weak-password-govern__detail-row">
                  <span class="weak-password-govern__detail-label"
                    >漏洞编号</span
                  >
                  <span class="weak-password-govern__detail-value font-mono">
                    {{ vulnItem.vuln_number || '-' }}
                  </span>
                </div>

                <div
                  class="weak-password-govern__detail-row weak-password-govern__detail-row--credentials"
                >
                  <span class="weak-password-govern__detail-label"
                    >弱口令凭证</span
                  >
                  <div class="weak-password-govern__credentials">
                    <div class="weak-password-govern__credential-row">
                      <span class="weak-password-govern__credential-label"
                        >账号</span
                      >
                      <span
                        class="weak-password-govern__credential-tag font-mono"
                      >
                        {{ getWeakPasswordAccount(vulnItem) }}
                      </span>
                    </div>
                    <div class="weak-password-govern__credential-row">
                      <span
                        class="weak-password-govern__credential-label font-mono"
                        >密码</span
                      >
                      <span class="weak-password-govern__credential-tag">
                        {{ getWeakPasswordSecret(vulnItem) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="canShowGovernActions(vulnItem) || isVulnRepaired(vulnItem)"
                class="weak-password-govern__card-footer"
              >
                <el-button
                  v-if="!isVulnRepaired(vulnItem)"
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
            <span>暂无弱口令数据</span>
          </div>
        </div>

        <RiskGovernanceAiAdvicePanel
          ref="riskAiAdvice"
          :show="!loading && vulnList.length > 0"
          risk-type="weak_password"
          :risk-data="vulnList"
          v-model:outer-dialog-visible="dialogVisible"
          file-name-prefix="弱口令"
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
import EmailNotif from '@/components/governCom/secondStep/emailNotif.vue'
import GeneralReport from '@/components/governCom/secondStep/generalReport.vue'
import LedgerLoading from '@/components/ledgerLoading.vue'
import RiskStatusBadge from '@/components/RiskStatusBadge.vue'
import RiskGovernanceAiAdvicePanel from '@/components/governCom/com/RiskGovernanceAiAdvicePanel.vue'
import { taskListNewAPI } from '@/api/riskOperations'
import { createWorkOrderEvent } from '@/utils/workOrderNotify'

export default {
  name: 'WeakPasswordGovern',
  components: {
    ServiceConvergenceGovern,
    CriticalVulnVerify,
    EmailNotif,
    GeneralReport,
    LedgerLoading,
    RiskStatusBadge,
    RiskGovernanceAiAdvicePanel
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
      showConvergencePanel: false,
      showVerifyPanel: false,
      showEmailNotifyPanel: false,
      showReportPanel: false,
      convergenceContext: null,
      verifyContext: null,
      emailNotifyContext: null,
      reportContext: null,
      verifySubmittingVulnId: '',
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
        return '扫描结果'
      }
      if (this.showEmailNotifyPanel) {
        return '邮件通知'
      }
      if (this.showReportPanel) {
        return '生成报告'
      }
      return '弱口令治理'
    }
  },
  mounted () {
    if (this.visible) {
      this.handleDialogOpen()
    }
  },
  methods: {
    getVulnCardId (vulnItem, vulnIndex) {
      return vulnItem.id || vulnItem.task_id || vulnIndex
    },
    getVulnRequestId (vulnItem) {
      return vulnItem.id || vulnItem.vuln_id
    },
    // 获取生成工单请求 id
    getWorkOrderRequestId (vulnItem) {
      return vulnItem.id || vulnItem.task_id
    },
    // 仅未修复(0)时展示收敛/验证等操作
    canShowGovernActions (vulnItem = {}) {
      return Number(vulnItem.vuln_status) === 0
    },
    isVulnRepaired (vulnItem = {}) {
      return Number(vulnItem.vuln_status) === 3
    },
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
      return String(level)
    },
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
      return 1
    },
    isCardExpanded (vulnItem, vulnIndex) {
      return !!this.expandedVulnIds[this.getVulnCardId(vulnItem, vulnIndex)]
    },
    toggleCardExpand (vulnItem, vulnIndex) {
      const cardId = this.getVulnCardId(vulnItem, vulnIndex)
      this.expandedVulnIds[cardId] = !this.expandedVulnIds[cardId]
    },
    expandFirstVulnCard () {
      const firstVulnItem = this.vulnList[0]
      if (!firstVulnItem) {
        return
      }
      const firstVulnId = this.getVulnCardId(firstVulnItem, 0)
      this.expandedVulnIds[firstVulnId] = true
    },
    parseWeakPasswordCredentials (vulnItem) {
      const metadata = vulnItem && vulnItem.metadata
      let parsedMetadata = metadata
      if (typeof metadata === 'string') {
        try {
          parsedMetadata = JSON.parse(metadata)
          if (typeof parsedMetadata === 'string') {
            parsedMetadata = JSON.parse(parsedMetadata)
          }
        } catch (error) {
          parsedMetadata = null
        }
      }
      if (parsedMetadata && typeof parsedMetadata === 'object') {
        const account = String(
          parsedMetadata.username || parsedMetadata.account || ''
        ).trim()
        const password = String(parsedMetadata.password || '').trim()
        if (account || password) {
          return { account, password }
        }
      }

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
        return { account: '', password: '' }
      }
      const colonIndex = text.indexOf(':')
      if (colonIndex === -1) {
        return { account: text, password: '' }
      }
      return {
        account: text.slice(0, colonIndex).trim(),
        password: text.slice(colonIndex + 1).trim()
      }
    },
    getWeakPasswordAccount (vulnItem) {
      const credentials = this.parseWeakPasswordCredentials(vulnItem)
      return credentials.account || '--'
    },
    getWeakPasswordSecret (vulnItem) {
      const credentials = this.parseWeakPasswordCredentials(vulnItem)
      return credentials.password || '--'
    },
    resetSubPanels () {
      this.showConvergencePanel = false
      this.showVerifyPanel = false
      this.showEmailNotifyPanel = false
      this.showReportPanel = false
      this.convergenceContext = null
      this.verifyContext = null
      this.emailNotifyContext = null
      this.reportContext = null
      this.verifySubmittingVulnId = ''
    },
    async handleDialogOpen () {
      if (this.suppressDialogOpenRefresh) {
        this.suppressDialogOpenRefresh = false
        return
      }
      this.expandedVulnIds = {}
      this.resetSubPanels()
      if (this.$refs.riskAiAdvice) {
        this.$refs.riskAiAdvice.reset()
      }
      await this.fetchWeakPasswordList()
    },
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
    handleOpenConvergence (vulnItem) {
      if (!vulnItem) {
        return
      }
      this.resetSubPanels()
      this.convergenceContext = {
        assetIp: vulnItem.asset_ip,
        port: vulnItem.port,
        vulnItem
      }
      this.showConvergencePanel = true
    },
    // 返回弱口令列表并刷新数据
    async handleBackFromConvergence () {
      this.showConvergencePanel = false
      this.convergenceContext = null
      await this.fetchWeakPasswordList()
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
    handleOpenVerify (vulnItem) {
      if (!vulnItem) {
        return
      }
      this.resetSubPanels()
      this.verifyContext = {
        vulnItem: { ...vulnItem },
        verifyKey: Date.now(),
        verifyType: 'weak_password'
      }
      this.showVerifyPanel = true
    },
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
    handleBackFromVerify () {
      this.showVerifyPanel = false
      this.verifyContext = null
      this.verifySubmittingVulnId = ''
    },
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
      if (!Array.isArray(this.externalTaskList)) {
        this.fetchWeakPasswordList()
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
    handleOpenEmailNotify (vulnItem) {
      if (!vulnItem) {
        return
      }
      const vulnRequestId = this.getVulnRequestId(vulnItem)
      this.resetSubPanels()
      this.emailNotifyContext = {
        vulnItem: { ...vulnItem },
        vulnIds: vulnRequestId ? [vulnRequestId] : [],
        assetIp: vulnItem.asset_ip || '',
        notifyKey: Date.now()
      }
      this.showEmailNotifyPanel = true
    },
    handleBackFromEmailNotify () {
      this.showEmailNotifyPanel = false
      this.emailNotifyContext = null
    },
    handleEmailNotifySent () {
      this.$emit('email-notify-sent')
    },
    handleOpenReport (vulnItem) {
      if (!vulnItem) {
        return
      }
      const vulnRequestId = this.getVulnRequestId(vulnItem)
      this.resetSubPanels()
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
          category: '弱口令',
          id: workOrderRequestId
        })
      } finally {
        this.workOrderCreatingId = ''
      }
    },
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
    async fetchWeakPasswordList () {
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
          category: '弱口令',
          task_type: '风险处置',
          status: 0
        })
        if (!result || Number(result.code) !== 0) {
          throw new Error((result && result.msg) || '获取弱口令列表失败')
        }
        this.vulnList = this.normalizeTaskList(
          (result.data && result.data.list) || []
        )
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
            '获取弱口令列表失败'
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

.weak-password-govern {
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
    border: 1px solid rgba(251, 191, 36, 0.28);
    border-radius: var(--r-lg);
    color: var(--warn);
    background: var(--warn-soft);

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
    font-weight: var(--fw-medium);
    line-height: 1.4;
  }

  &__list {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
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
    color: #f97316;
    font-size: 16px;
    background: rgba(249, 115, 22, 0.1);

    .iconfont {
      font-size: 16px;
      line-height: 1;
    }
  }

  &__card-info {
    flex: 1;
    min-width: 0;
  }

  &__card-title {
    color: var(--c-text);
    font-size: var(--fs-base);
    font-weight: var(--fw-semibold);
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

      &:nth-child(1) { height: 4px; }
      &:nth-child(2) { height: 6px; }
      &:nth-child(3) { height: 8px; }
      &:nth-child(4) { height: 10px; }
      &:nth-child(5) { height: 12px; }

      &.is-on {
        opacity: 1;
      }
    }
  }

  &__vuln-level-text {
    min-width: 2em;
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

    &--credentials {
      align-items: center;
    }
  }

  &__detail-label {
    flex-shrink: 0;
    width: 70px;
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

  &__credentials {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-3);
    min-width: 0;
  }

  &__credential-row {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }

  &__credential-label {
    flex-shrink: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 1.4;
  }

  &__credential-tag {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 2px 10px;
    color: var(--danger);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    line-height: 1.5;
    word-break: break-all;
    border: 1px solid rgba(234, 88, 12, 0.35);
    border-radius: 999px;
    background: var(--danger-soft);
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
:root[data-theme='light'] {
  .weak-password-govern__summary {
    background: rgba(251, 191, 36, 0.1);
    border-color: rgba(251, 191, 36, 0.35);
    color: #ca8a04;
  }

  .weak-password-govern__card {
    background: #ffffff;
    border-color: #ebeef5;
  }

  .weak-password-govern__card-header:hover {
    background: #f8f9fb;
  }

  .weak-password-govern__card--expanded {
    border-color: #e4e7ed;
  }

  .weak-password-govern__card-icon {
    color: #f97316;
    background: rgba(249, 115, 22, 0.08);
  }

  .weak-password-govern__meta-label,
  .weak-password-govern__meta-dot {
    color: #909399;
  }

  .weak-password-govern__meta-value,
  .weak-password-govern__card-title,
  .weak-password-govern__detail-value {
    color: #303133;
  }

  .weak-password-govern__card-body {
    border-top-color: #ebeef5;
  }

  .weak-password-govern__detail-row {
    border-bottom-color: #ebeef5;
  }

  .weak-password-govern__detail-label {
    color: #909399;
  }
}
</style>
