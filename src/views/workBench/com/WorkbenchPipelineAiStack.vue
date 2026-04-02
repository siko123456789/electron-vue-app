
<template>
  <div
    class="workbench-pipeline-ai-stack"
    v-loading="loading || dispositionLoading"
    element-loading-text="加载任务..."
    element-loading-background="rgba(15, 10, 40, 0.65)"
  >
    <!-- 对齐 React：深色底上的玻璃拟态双列（2/10 + 8/10） -->
    <el-row :gutter="12" class="pipeline-react-row" type="flex">
      <el-col :xs="24" :sm="5">
        <div
          class="pending-glass"
          role="button"
          tabindex="0"
          @click="openPendingTasksModal"
          @keyup.enter="openPendingTasksModal"
        >
          <div class="pending-glass-head">
            <div class="pending-glass-head-left">
              <span class="pending-glass-icon-wrap">
                <i class="iconfont icon-zhihangrenwu"></i>
              </span>
              <span class="pending-glass-title">待执行任务</span>
            </div>
            <i class="el-icon-arrow-right pending-glass-chevron"></i>
          </div>
          <div class="pending-glass-total">{{ pendingTotalDisplay }}</div>
          <div class="pending-glass-rows">
            <div
              v-for="row in pendingBreakdownRows"
              :key="row.key"
              class="pending-glass-row"
              :class="'pending-glass-row--' + row.variant"
            >
              <span class="pending-glass-row-label">{{ row.title }}</span>
              <span class="pending-glass-row-count">{{ row.countText }}</span>
            </div>
          </div>
          <div class="pending-glass-foot" @click.stop>
            <el-button
              size="small"
              class="pending-glass-export-btn"
              :loading="todoExportHtmlLoading"
              @click="handleExportClick"
            >
              <i class="iconfont icon-xiazaibaogao" aria-hidden="true"></i>
              <span>导出</span>
            </el-button>
            <el-tooltip
              content="导出功能会生成「两高一弱」专项报告（高危漏洞、高危端口、弱口令）。"
              placement="top"
            >
              <el-button
                size="small"
                class="pending-glass-info-btn"
                icon="el-icon-info"
                @click.stop
              ></el-button>
            </el-tooltip>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="19">
        <div class="disposition-glass">
          <div class="disposition-glass-head">
            <div class="disposition-glass-head-left">
              <span class="disposition-glass-icon-wrap">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="25"
                  height="25"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  style="color: #a78bfa"
                >
                  <path
                    d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"
                  ></path>
                  <path d="M9 13a4.5 4.5 0 0 0 3-4"></path>
                  <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"></path>
                  <path d="M3.477 10.896a4 4 0 0 1 .585-.396"></path>
                  <path d="M6 18a4 4 0 0 1-1.967-.516"></path>
                  <path d="M12 13h4"></path>
                  <path d="M12 18h6a2 2 0 0 1 2 2v1"></path>
                  <path d="M12 8h8"></path>
                  <path d="M16 8V5a2 2 0 0 1 2-2"></path>
                  <circle cx="16" cy="13" r=".5"></circle>
                  <circle cx="18" cy="3" r=".5"></circle>
                  <circle cx="20" cy="21" r=".5"></circle>
                  <circle cx="20" cy="8" r=".5"></circle>
                </svg>
              </span>
              <div class="disposition-glass-titles">
                <span class="disposition-glass-title">AI 自动化分析处置</span>
                <span class="disposition-glass-subtitle"
                  >智能研判与自动化响应</span
                >
              </div>
            </div>
            <div class="disposition-glass-actions">
              <el-tooltip
                :disabled="!workbenchNotifyDisabled"
                :content="workbenchNotifyDisabledReason"
                placement="top"
              >
                <span class="wb-glass-btn-tooltip-wrap">
                  <el-button
                    size="small"
                    class="wb-glass-btn wb-glass-btn--blue"
                    :disabled="workbenchNotifyDisabled"
                    @click="handleWorkbenchNotifyClick"
                    >通知</el-button
                  >
                </span>
              </el-tooltip>
              <el-button
                size="small"
                class="wb-glass-btn wb-glass-btn--amber"
                :disabled="
                  !dispositionDisplayTask ||
                  dispositionActionLoading ||
                  resolveSubmitting
                "
                @click="handleDispositionSuspend"
                >挂起任务</el-button
              >
              <el-button
                size="small"
                class="wb-glass-btn wb-glass-btn--emerald"
                :disabled="
                  !dispositionDisplayTask ||
                  dispositionActionLoading ||
                  resolveSubmitting ||
                  workOrderCreating
                "
                @click="handleGenerateWorkOrder"
                >生成事件</el-button
              >
              <el-tooltip
                :disabled="!workbenchReportDisabled"
                :content="workbenchReportDisabledReason"
                placement="top"
              >
                <span class="wb-glass-btn-tooltip-wrap">
                  <el-button
                    size="small"
                    class="wb-glass-btn wb-glass-btn--purple-solid"
                    :disabled="
                      workbenchReportDisabled ||
                      dispositionActionLoading ||
                      resolveSubmitting
                    "
                    @click="handleWorkbenchGenerateReportClick"
                    >生成报告</el-button
                  >
                </span>
              </el-tooltip>
            </div>
          </div>

          <div class="disposition-glass-body">
            <div
              v-if="!dispositionLoading && !dispositionDisplayTask"
              class="disposition-glass-empty"
            >
              <div class="disposition-glass-empty-inner">
                <div
                  class="disposition-glass-empty-icon-wrap"
                  aria-hidden="true"
                >
                  <i class="el-icon-check"></i>
                </div>
                <p class="disposition-glass-empty-title">暂无待执行任务</p>
                <p class="disposition-glass-empty-desc">
                  当前的筛选条件下没有待处置项，或已全部处理完毕
                </p>
              </div>
            </div>

            <div
              v-else-if="dispositionLoading"
              class="disposition-glass-loading-hint"
            >
              加载任务中…
            </div>

            <div v-else class="disposition-glass-scroll">
              <el-card shadow="never" class="emergency-card">
                <div
                  class="emergency-inner"
                  :class="'emergency-inner--' + dispositionCategoryKind"
                >
                  <div
                    v-if="emergencyCategoryTagText"
                    class="emergency-corner-tag"
                  >
                    <el-tag
                      :type="emergencyCategoryTagType"
                      effect="dark"
                      size="small"
                    >
                      {{ emergencyCategoryTagText }}
                    </el-tag>
                  </div>
                  <div class="emergency-header">
                    <i
                      class="iconfont icon-jingaojingbuzuduan emergency-header-icon"
                      aria-hidden="true"
                    ></i>
                    <div class="emergency-header-titles">
                      <div class="emergency-header-title">
                        {{ emergencyTaskTitle }}
                      </div>
                      <div
                        v-if="
                          emergencyTaskCreateTime || emergencyTaskUpdateTime
                        "
                        class="emergency-header-meta"
                      >
                        <span
                          v-if="emergencyTaskCreateTime"
                          class="emergency-meta-item"
                        >
                          <i class="el-icon-time" aria-hidden="true"></i>
                          创建：{{ emergencyTaskCreateTime }}
                        </span>
                        <span
                          v-if="emergencyTaskUpdateTime"
                          class="emergency-meta-item"
                        >
                          <i class="el-icon-refresh" aria-hidden="true"></i>
                          更新：{{ emergencyTaskUpdateTime }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    class="emergency-body"
                    :class="'emergency-body--' + dispositionCategoryKind"
                  >
                    <!-- 弱口令：风险名 + 风险分/等级 + IP/端口/协议 + 账号密码 -->
                    <template v-if="dispositionCategoryKind === 'weak'">
                      <div class="emergency-spot emergency-spot--weak">
                        <div class="emergency-spot-title">
                          {{ emergencyVulnName || '弱口令风险' }}
                        </div>
                        <div class="emergency-spot-chips">
                          <el-tag
                            v-if="emergencyRiskScoreDisplay !== ''"
                            size="small"
                            type="warning"
                            effect="dark"
                          >
                            风险分 {{ emergencyRiskScoreDisplay }}
                          </el-tag>
                          <el-tag
                            v-if="emergencyVulnLevelLabelForCard"
                            size="small"
                            effect="plain"
                            class="emergency-chip-level"
                          >
                            {{ emergencyVulnLevelLabelForCard }}
                          </el-tag>
                        </div>
                      </div>
                      <div class="emergency-kv-grid">
                        <div class="emergency-kv">
                          <span class="emergency-kv-k">资产 IP</span>
                          <span class="emergency-kv-v">{{
                            emergencyAssetIp || '—'
                          }}</span>
                        </div>
                        <div class="emergency-kv">
                          <span class="emergency-kv-k">端口</span>
                          <span class="emergency-kv-v">{{
                            emergencyPort || '—'
                          }}</span>
                        </div>
                        <div v-if="emergencyProtocol" class="emergency-kv">
                          <span class="emergency-kv-k">协议</span>
                          <span class="emergency-kv-v">{{
                            emergencyProtocol
                          }}</span>
                        </div>
                      </div>
                      <div
                        v-if="emergencyCredentialPair"
                        class="emergency-credential"
                      >
                        <span class="emergency-credential-item">
                          <span class="emergency-credential-k">账号</span>
                          <code class="emergency-credential-v">{{
                            emergencyCredentialPair.account
                          }}</code>
                        </span>
                        <span class="emergency-credential-item">
                          <span class="emergency-credential-k">密码</span>
                          <code class="emergency-credential-v">{{
                            emergencyCredentialPair.password
                          }}</code>
                        </span>
                      </div>
                      <div
                        v-else-if="emergencyDescribe"
                        class="emergency-desc emergency-desc--weak-fallback"
                      >
                        {{ emergencyDescribe }}
                      </div>
                    </template>

                    <!-- 关键漏洞：漏洞名 + CVE/编号 + IP/端口 + 等级 -->
                    <template
                      v-else-if="dispositionCategoryKind === 'critical'"
                    >
                      <div class="emergency-spot emergency-spot--critical">
                        <div
                          class="emergency-spot-title emergency-spot-title--critical"
                        >
                          {{ emergencyVulnName || '关键漏洞' }}
                        </div>
                        <div
                          v-if="emergencyCvePrimaryLine"
                          class="emergency-cve-primary"
                        >
                          {{ emergencyCvePrimaryLine }}
                        </div>
                        <div
                          v-if="emergencyCveExtraPart"
                          class="emergency-cve-rest"
                        >
                          {{ emergencyCveExtraPart }}
                        </div>
                      </div>
                      <div
                        class="emergency-kv-grid emergency-kv-grid--critical"
                      >
                        <div class="emergency-kv">
                          <span class="emergency-kv-k">资产 IP</span>
                          <span class="emergency-kv-v">{{
                            emergencyAssetIp || '—'
                          }}</span>
                        </div>
                        <div class="emergency-kv">
                          <span class="emergency-kv-k">端口</span>
                          <span class="emergency-kv-v">{{
                            emergencyPort || '—'
                          }}</span>
                        </div>
                        <div v-if="emergencyProtocol" class="emergency-kv">
                          <span class="emergency-kv-k">协议</span>
                          <span class="emergency-kv-v">{{
                            emergencyProtocol
                          }}</span>
                        </div>
                        <div class="emergency-kv">
                          <span class="emergency-kv-k">漏洞等级</span>
                          <span class="emergency-kv-v">{{
                            emergencyVulnLevelLabelForCard
                          }}</span>
                        </div>
                      </div>
                    </template>

                    <!-- 高危端口：端口 + 服务 + 资产 -->
                    <template v-else-if="dispositionCategoryKind === 'port'">
                      <div class="emergency-spot emergency-spot--port">
                        <div class="emergency-port-hero">
                          <span class="emergency-port-num">{{
                            emergencyPort || '—'
                          }}</span>
                          <span
                            v-if="emergencyService"
                            class="emergency-port-service"
                            >{{ emergencyService }}</span
                          >
                        </div>
                        <div class="emergency-port-sub">
                          <span class="emergency-kv-k">资产 IP</span>
                          <span class="emergency-kv-v">{{
                            emergencyAssetIp || '—'
                          }}</span>
                        </div>
                        <div
                          v-if="emergencyProtocol"
                          class="emergency-port-sub"
                        >
                          <span class="emergency-kv-k">协议</span>
                          <span class="emergency-kv-v">{{
                            emergencyProtocol
                          }}</span>
                        </div>
                      </div>
                    </template>

                    <!-- 其他类型：通用展示 -->
                    <template v-else>
                      <div
                        v-if="emergencyVulnName"
                        class="emergency-vuln-title"
                      >
                        {{ emergencyVulnName }}
                      </div>
                      <div class="emergency-meta-row">
                        <span class="emergency-meta-pair">
                          <span class="emergency-meta-k">资产 IP</span>
                          <span class="emergency-meta-v">{{
                            emergencyAssetIp || '—'
                          }}</span>
                        </span>
                        <span class="emergency-meta-sep">•</span>
                        <span class="emergency-meta-pair">
                          <span class="emergency-meta-k">端口</span>
                          <span class="emergency-meta-v">{{
                            emergencyPort || '—'
                          }}</span>
                        </span>
                        <template v-if="emergencyVulnNumber">
                          <span class="emergency-meta-sep">•</span>
                          <span
                            class="emergency-meta-pair emergency-meta-pair--wide"
                          >
                            <span class="emergency-meta-k">漏洞编号</span>
                            <span
                              class="emergency-meta-v emergency-meta-v--mono"
                              >{{ emergencyVulnNumber }}</span
                            >
                          </span>
                        </template>
                      </div>
                      <div v-if="emergencyDescribe" class="emergency-desc">
                        {{ emergencyDescribe }}
                      </div>
                    </template>
                  </div>

                  <div class="emergency-actions">
                    <el-button
                      type="danger"
                      size="small"
                      @click="emitGovernEmergency"
                    >
                      立即治理
                    </el-button>
                  </div>
                </div>
              </el-card>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <PendingTasksListModal
      :visible.sync="pendingTasksModalVisible"
      :covered="disposeDialogActive"
      :task-list="mergedPendingTasksForModal"
      @govern-task="onModalGovernTask"
    />

    <!-- 立即治理：按 category 打开不同治理弹框，并透传 todo 原始对象 -->
    <VulnRiskDisposeDialog
      :visible.sync="vulnDisposeDialogVisible"
      :items="governDisposeItems"
      :task-row="governSelectedTodoRow"
      :enable-threat-rule-generation="true"
      :embedded-email-context="vulnEmbeddedEmailContext"
      :embedded-convergence-context="vulnEmbeddedConvergenceContext"
      @notify="handleDisposeItemNotify('vuln', $event)"
      @notify-back="handleDisposeNotifyBack"
      @notify-sent="handleDisposeNotifySent"
      @download-report="handleDisposeDialogGenerateReport('vuln', $event)"
      @convergence-open="handleDisposeConvergenceOpen('vuln', $event)"
      @convergence-back="handleDisposeConvergenceBack"
      @convergence-confirm="handleDisposeConvergenceConfirm"
    />
    <PortRiskDisposeDialog
      :visible.sync="portDisposeDialogVisible"
      :items="governDisposeItems"
      :task-row="governSelectedTodoRow"
      :embedded-email-context="portEmbeddedEmailContext"
      :embedded-convergence-context="portEmbeddedConvergenceContext"
      @notify="handleDisposeItemNotify('port', $event)"
      @notify-back="handleDisposeNotifyBack"
      @notify-sent="handleDisposeNotifySent"
      @download-report="handleDisposeDialogGenerateReport('port', $event)"
      @convergence-open="handleDisposeConvergenceOpen('port', $event)"
      @convergence-back="handleDisposeConvergenceBack"
      @convergence-confirm="handleDisposeConvergenceConfirm"
    />
    <WeakPasswordRiskDisposeDialog
      :visible.sync="weakDisposeDialogVisible"
      :items="governDisposeItems"
      :task-row="governSelectedTodoRow"
      :embedded-email-context="weakEmbeddedEmailContext"
      :embedded-convergence-context="weakEmbeddedConvergenceContext"
      @notify="handleDisposeItemNotify('weak', $event)"
      @notify-back="handleDisposeNotifyBack"
      @notify-sent="handleDisposeNotifySent"
      @download-report="handleDisposeDialogGenerateReport('weak', $event)"
      @convergence-open="handleDisposeConvergenceOpen('weak', $event)"
      @convergence-back="handleDisposeConvergenceBack"
      @convergence-confirm="handleDisposeConvergenceConfirm"
    />

    <AiDisposeReportDialog
      :visible.sync="disposeReportVisible"
      :dialog-title="disposeReportDialogTitle"
      :html-content="disposeReportHtml"
      :report-data="null"
      @download-html="downloadDisposeReportHtml"
      @close="handleDisposeReportClose"
    />
  </div>
</template>

<script>
import PendingTasksListModal from './PendingTasksListModal.vue'
import {
  taskSummaryNewAPI,
  taskListNewAPI,
  generateReportAPI,
  exportTaskTodoHTMLAPI
} from '@/api/aiGovernance'
import { createWorkOrderAPI } from '@/api/operation'
import VulnRiskDisposeDialog from '@/components/disposeCom/VulnRiskDisposeDialog.vue'
import PortRiskDisposeDialog from '@/components/disposeCom/PortRiskDisposeDialog.vue'
import WeakPasswordRiskDisposeDialog from '@/components/disposeCom/WeakPasswordRiskDisposeDialog.vue'
import AiDisposeReportDialog from '@/components/disposeCom/AiDisposeReportDialog.vue'

/** 与 DashboardWorkbenchV3 管道任务 task_type 展示一致 */
const PIPELINE_TASK_TYPE_LABEL_MAP = {
  critical_vuln_unfixed: '关键漏洞',
  weak_password: '弱口令',
  high_risk_port: '高危端口',
  weak_credential: '弱口令'
}

/** 处置区瀑布请求顺序：先关键漏洞，依次弱口令、高危端口 */
const DISPOSITION_CATEGORY_ORDER = ['关键漏洞', '弱口令', '高危端口']
// const DISPOSITION_CATEGORY_ORDER = ['高危端口']
// const DISPOSITION_CATEGORY_ORDER = ['弱口令', '高危端口']

/** 接口 category → 管道 task_type（用于文案映射） */
const DISPOSITION_CATEGORY_TO_TASK_TYPE = {
  关键漏洞: 'critical_vuln_unfixed',
  弱口令: 'weak_password',
  高危端口: 'high_risk_port'
}

export default {
  name: 'WorkbenchPipelineAiStack',
  components: {
    PendingTasksListModal,
    VulnRiskDisposeDialog,
    PortRiskDisposeDialog,
    WeakPasswordRiskDisposeDialog,
    AiDisposeReportDialog
  },
  props: {
    /** 管道任务加载中 */
    loading: {
      type: Boolean,
      default: false
    },
    /** 父级旧管道任务（保留兼容；处置区以 taskListNewAPI 为准） */
    currentTask: {
      type: Object,
      default: null
    },
    /** 与父级 pipelineRiskInsightCards 结构一致 */
    riskCards: {
      type: Array,
      default: () => []
    },
    /** 挂起/报告等提交中 */
    resolveSubmitting: {
      type: Boolean,
      default: false
    },
    /** 待办弹框列表：有接口/预览数据时展示，否则为空 */
    previewPendingTasks: {
      type: Array,
      default: null
    }
  },
  data () {
    return {
      /** 待执行任务列表弹框（对齐 React showTaskModal） */
      pendingTasksModalVisible: false,
      /** 左侧卡片：taskSummaryNewAPI 返回的 data，成功后有 total_count 与各分项 */
      pendingSummary: null,
      /** 处置区：taskListNewAPI 当前分类下的 list */
      dispositionList: [],
      /** 当前展示条在 list 中的下标 */
      dispositionIndex: 0,
      /** 当前 list 对应的 category 中文 */
      dispositionCategory: '',
      /** 处置区首次/瀑布加载 */
      dispositionLoading: false,
      /** 挂起请求中 */
      dispositionActionLoading: false,
      /** 生成工单（生成事件）请求中 */
      workOrderCreating: false,
      /** 治理弹框：当前选中的任务原始对象（todo 接口整条） */
      governSelectedTodoRow: null,
      /** 治理弹框：关键漏洞 */
      vulnDisposeDialogVisible: false,
      /** 治理弹框：高危端口 */
      portDisposeDialogVisible: false,
      /** 治理弹框：弱口令 */
      weakDisposeDialogVisible: false,
      /** 治理弹框：传入的条目（适配既有 disposeCom 弹框 items 结构） */
      governDisposeItems: null,
      /** 处置弹框内嵌：服务收敛上下文（对应三个弹框） */
      vulnEmbeddedConvergenceContext: null,
      weakEmbeddedConvergenceContext: null,
      portEmbeddedConvergenceContext: null,
      /** 处置弹框内嵌：邮件通知上下文（对应三个弹框） */
      vulnEmbeddedEmailContext: null,
      weakEmbeddedEmailContext: null,
      portEmbeddedEmailContext: null,
      /** 报告预览弹框 */
      disposeReportVisible: false,
      disposeReportHtml: '',
      disposeReportFilename: '安全风险分析与处置报告.html',
      disposeReportDialogTitle: '报告预览',
      disposeReportLoading: false,
      /** 待执行任务区域导出 HTML 请求中 */
      todoExportHtmlLoading: false
    }
  },
  mounted () {
    this.fetchPendingTaskSummary()
    this.loadDispositionWaterfall()
  },
  computed: {
    /** 工作台右上角「通知」按钮禁用状态 */
    workbenchNotifyDisabled () {
      const check = this.getNotifyEligibilityByTodoRow(this.dispositionRawRow)
      return check.disabled
    },
    workbenchNotifyDisabledReason () {
      const check = this.getNotifyEligibilityByTodoRow(this.dispositionRawRow)
      return check.reason || '暂时无法进行通知操作'
    },
    /** 工作台右上角「生成报告」按钮禁用状态 */
    workbenchReportDisabled () {
      const check = this.getReportEligibilityByTodoRow(this.dispositionRawRow)
      return check.disabled
    },
    workbenchReportDisabledReason () {
      const check = this.getReportEligibilityByTodoRow(this.dispositionRawRow)
      return check.reason || '暂时无法生成报告'
    },
    /** 弹框内任务数据源 */
    mergedPendingTasksForModal () {
      if (
        Array.isArray(this.previewPendingTasks) &&
        this.previewPendingTasks.length > 0
      ) {
        return this.previewPendingTasks
      }
      return []
    },
    /** 无接口数据时，用右侧 riskCards 汇总三行（兜底） */
    pendingTotalFromRiskCards () {
      const byKey = this.riskCardsByKey
      const keys = ['critical_vuln', 'weak_password', 'port_service']
      return keys.reduce((sum, key) => {
        const card = byKey[key]
        return sum + (card ? Number(card.count) || 0 : 0)
      }, 0)
    },
    pendingTotalDisplay () {
      const summary = this.pendingSummary
      if (summary && summary.total_count != null) {
        return Number(summary.total_count) || 0
      }
      return this.pendingTotalFromRiskCards
    },
    /** 按 key 索引 riskCards，便于固定三行取数 */
    riskCardsByKey () {
      const map = {}
      const list = Array.isArray(this.riskCards) ? this.riskCards : []
      list.forEach(card => {
        if (card && card.key) map[card.key] = card
      })
      return map
    },
    /**
     * 左侧固定三行（设计稿）：关键漏洞 / 弱口令 / 高危端口；
     * 无任务数据时仍展示 0，避免卡片空白
     */
    pendingBreakdownRows () {
      const slotList = [
        { key: 'critical_vuln', title: '关键漏洞', variant: 'critical' },
        { key: 'weak_password', title: '弱口令', variant: 'weak' },
        { key: 'port_service', title: '高危端口', variant: 'high-port' }
      ]
      const summary = this.pendingSummary
      if (summary) {
        const countMap = {
          critical_vuln: Number(summary.critical_vuln_count) || 0,
          weak_password: Number(summary.weak_pwd_count) || 0,
          port_service: Number(summary.high_risk_port_count) || 0
        }
        return slotList.map(slot => ({
          key: slot.key,
          title: slot.title,
          countText: String(countMap[slot.key]),
          variant: slot.variant
        }))
      }
      const byKey = this.riskCardsByKey
      return slotList.map(slot => {
        const card = byKey[slot.key]
        const count = card ? Number(card.count) || 0 : 0
        const countText = String(
          card && card.countText != null ? card.countText : count
        )
        return {
          key: slot.key,
          title: slot.title,
          countText,
          variant: slot.variant
        }
      })
    },
    /** 当前条原始行（todo 接口） */
    dispositionRawRow () {
      const list = this.dispositionList
      const index = this.dispositionIndex
      if (!Array.isArray(list) || index < 0 || index >= list.length) {
        return null
      }
      return list[index]
    },
    /** 映射为原模板所需字段，供处置区展示 */
    dispositionDisplayTask () {
      return this.mapTodoRowToDispositionTask(
        this.dispositionRawRow,
        this.dispositionCategory
      )
    },
    /** 风险条百分比（0–100） */
    dispositionRiskBarPercent () {
      const task = this.dispositionDisplayTask
      if (!task) return 0
      const num = Number(task.risk_score)
      if (!Number.isFinite(num) || num < 0) return 0
      return Math.min(100, num)
    },
    /** 有处置数据时底部四卡仅高亮当前分类；否则用父级 riskCards */
    displayRiskCards () {
      if (this.dispositionRawRow && this.dispositionCategory) {
        return this.buildSyntheticRiskCards(this.dispositionCategory)
      }
      return this.riskCards
    },
    disposeDialogActive () {
      return !!(
        this.vulnDisposeDialogVisible ||
        this.portDisposeDialogVisible ||
        this.weakDisposeDialogVisible
      )
    },
    /** 处置区标题：来自 todo 接口 task_title */
    emergencyTaskTitle () {
      const row = this.dispositionRawRow
      if (!row) return '当前紧急风险'
      return row.task_title || '当前紧急风险'
    },
    /** 处置区标签文本：来自 todo 接口 category（无则不展示） */
    emergencyCategoryTagText () {
      const row = this.dispositionRawRow
      const category = row && row.category ? String(row.category).trim() : ''
      return category || ''
    },
    /** 处置区标签类型：按 category 映射 Element Tag type */
    emergencyCategoryTagType () {
      const category = this.emergencyCategoryTagText
      if (!category) return 'info'
      if (category.indexOf('关键') > -1) return 'danger'
      if (category.indexOf('弱口令') > -1) return 'warning'
      if (category.indexOf('端口') > -1) return 'primary'
      return 'info'
    },
    /** 当前任务大类：用于 el-card 内差异化布局与样式 */
    dispositionCategoryKind () {
      const category = this.emergencyCategoryTagText
      if (!category) return 'default'
      if (category.indexOf('弱口令') > -1) return 'weak'
      if (category.indexOf('关键') > -1) return 'critical'
      if (
        category.indexOf('高危端口') > -1 ||
        category.indexOf('非高危') > -1
      ) {
        return 'port'
      }
      return 'default'
    },
    emergencyTaskCreateTime () {
      const row = this.dispositionRawRow
      return row && row.task_create_time ? row.task_create_time : ''
    },
    emergencyTaskUpdateTime () {
      const row = this.dispositionRawRow
      return row && row.task_update_time ? row.task_update_time : ''
    },
    /** 关键字段：漏洞名称/编号、资产 IP、端口等 */
    emergencyVulnName () {
      const row = this.dispositionRawRow
      return row && row.vuln_name ? row.vuln_name : ''
    },
    emergencyVulnNumber () {
      const row = this.dispositionRawRow
      return row && row.vuln_number ? row.vuln_number : ''
    },
    emergencyAssetIp () {
      const row = this.dispositionRawRow
      if (row && row.asset_ip) return row.asset_ip
      const task = this.dispositionDisplayTask
      return task && task.asset_ip ? task.asset_ip : ''
    },
    emergencyPort () {
      const row = this.dispositionRawRow
      return row && row.port ? row.port : ''
    },
    emergencyDescribe () {
      const row = this.dispositionRawRow
      return row && row.describe ? row.describe : ''
    },
    emergencyProtocol () {
      const row = this.dispositionRawRow
      const text =
        row && row.protocol != null ? String(row.protocol).trim() : ''
      return text
    },
    emergencyService () {
      const row = this.dispositionRawRow
      const text = row && row.service != null ? String(row.service).trim() : ''
      return text
    },
    /** 风险分展示（接口 risk_score） */
    emergencyRiskScoreDisplay () {
      const row = this.dispositionRawRow
      if (!row || row.risk_score == null || row.risk_score === '') return ''
      return String(row.risk_score)
    },
    /** 漏洞等级中文（接口 vuln_level） */
    emergencyVulnLevelLabelForCard () {
      const row = this.dispositionRawRow
      if (!row) return ''
      const label = this.mapVulnLevelToLabel(row.vuln_level)
      return label === '—' ? '' : label
    },
    /** CVE 主行：优先取 CVE-xxxx，否则取编号首段 */
    emergencyCvePrimaryLine () {
      const raw = (this.emergencyVulnNumber || '').trim()
      if (!raw) return ''
      const parts = raw
        .split(/[,，]/)
        .map(s => s.trim())
        .filter(Boolean)
      const cvePart = parts.find(p => /CVE-\d+/i.test(p))
      if (cvePart) return cvePart
      return parts[0] || raw
    },
    /** 编号剩余（逗号后补充展示） */
    emergencyCveExtraPart () {
      const raw = (this.emergencyVulnNumber || '').trim()
      if (!raw) return ''
      const primary = this.emergencyCvePrimaryLine
      if (!primary) return ''
      const idx = raw.indexOf(primary)
      if (idx < 0) return ''
      const rest = raw
        .slice(idx + primary.length)
        .replace(/^[,，]\s*/, '')
        .trim()
      return rest
    },
    /** 弱口令 describe: root:admin -> { account, password } */
    emergencyCredentialPair () {
      const rawDescribe = (this.emergencyDescribe || '').trim()
      if (!rawDescribe) return null
      const normalized = rawDescribe.replace(/：/g, ':')
      const separatorIndex = normalized.indexOf(':')
      if (separatorIndex <= 0 || separatorIndex >= normalized.length - 1) {
        return null
      }
      const accountText = normalized.slice(0, separatorIndex).trim()
      const passwordText = normalized.slice(separatorIndex + 1).trim()
      if (!accountText || !passwordText) return null
      return {
        account: accountText,
        password: passwordText
      }
    },
    emergencyRiskTitle () {
      const task = this.dispositionDisplayTask
      if (!task) return '—'
      return task.title || this.pipelineTaskTypeLabel(task) || '待处置风险'
    },
    emergencyRiskLocation () {
      const task = this.dispositionDisplayTask
      if (!task) return '—'
      return this.pipelineTaskTypeLabel(task)
    },
    emergencyRiskDesc () {
      const task = this.dispositionDisplayTask
      if (!task) {
        return '—'
      }
      return (
        task.description ||
        `任务类型为「${this.pipelineTaskTypeLabel(
          task
        )}」，请结合下方风险卡片逐项处置并收敛暴露面。`
      )
    }
  },
  methods: {
    /** 报告能力判断：返回 { disabled, reason, vulnIds } */
    getReportEligibilityByTodoRow (todoRow) {
      /** 方法用途：根据 todoRow.category 与 id/vuln_ids 判断是否可生成报告，并返回 vulnIds */
      const base = this.getNotifyEligibilityByTodoRow(todoRow)
      if (base.disabled) {
        const reason =
          (base.reason || '').replace('通知', '生成报告') || '暂时无法生成报告'
        return { disabled: true, reason, vulnIds: [] }
      }
      return { disabled: false, reason: '', vulnIds: base.vulnIds || [] }
    },
    async handleWorkbenchGenerateReportClick () {
      /** 方法用途：工作台顶部「生成报告」按钮，校验可用性并调用接口生成 HTML 报告 */
      const check = this.getReportEligibilityByTodoRow(this.dispositionRawRow)
      if (check.disabled) {
        this.$message.warning(check.reason || '暂时无法生成报告')
        return
      }
      const todoRow = this.dispositionRawRow || {}
      const filename = this.buildReportFilename(todoRow)
      await this.fetchAndPreviewReportHtml(check.vulnIds, filename)
    },
    async handleDisposeDialogGenerateReport (category, payload) {
      /** 方法用途：处置弹框内点击「下载报告」时生成并预览 HTML 报告 */
      const titleText =
        typeof payload === 'string'
          ? payload
          : payload && payload.title != null
          ? String(payload.title)
          : ''
      const overrideIds =
        typeof payload === 'object' &&
        payload &&
        Array.isArray(payload.vulnIds) &&
        payload.vulnIds.length
          ? payload.vulnIds
          : null
      const todoRow = this.governSelectedTodoRow || this.dispositionRawRow || {}
      const check = overrideIds
        ? { disabled: false, reason: '', vulnIds: overrideIds }
        : this.getReportEligibilityByTodoRow(todoRow)
      if (check.disabled) {
        this.$message.warning(check.reason || '暂时无法生成报告')
        return
      }
      const filename = this.buildReportFilename(todoRow, titleText)
      await this.fetchAndPreviewReportHtml(check.vulnIds, filename)
    },
    buildReportFilename (todoRow, titleText) {
      /** 方法用途：生成报告文件名（避免非法字符） */
      const row = todoRow || {}
      const assetIp = row.asset_ip ? String(row.asset_ip).trim() : ''
      const category = row.category ? String(row.category).trim() : ''
      const base = titleText
        ? String(titleText).trim()
        : row.vuln_name ||
          row.task_title ||
          category ||
          '安全风险分析与处置报告'
      const name =
        [assetIp, base].filter(Boolean).join('_') || '安全风险分析与处置报告'
      return `${name}`.replace(/[\\/:*?"<>|]/g, '_') + '.html'
    },
    async fetchAndPreviewReportHtml (vulnIds, filename) {
      /** 方法用途：调用 generateReportAPI 获取 HTML，并在 AiDisposeReportDialog 中预览 */
      if (this.disposeReportLoading || this.todoExportHtmlLoading) return
      const ids = Array.isArray(vulnIds) ? vulnIds : []
      if (!ids.length) {
        this.$message.warning('缺少漏洞ID，暂时无法生成报告')
        return
      }
      this.disposeReportLoading = true
      try {
        const params = {
          vuln_ids: ids.length === 1 ? String(ids[0]) : ids.join(',')
        }
        const response = await generateReportAPI(params)
        const htmlText =
          typeof response === 'string'
            ? response
            : typeof (response && response.data) === 'string'
            ? response.data
            : ''
        if (!htmlText) {
          this.$message.error('报告生成失败（未获取到HTML内容）')
          return
        }
        this.disposeReportDialogTitle = '报告预览'
        this.disposeReportFilename = filename || '安全风险分析与处置报告.html'
        this.disposeReportHtml = htmlText
        this.disposeReportVisible = true
      } catch (error) {
        this.$message.error('报告生成失败')
      } finally {
        this.disposeReportLoading = false
      }
    },
    async fetchAndPreviewTodoExportHtml () {
      /** 方法用途：调用 exportTaskTodoHTMLAPI 获取待执行任务 HTML，预览后可下载或打印 */
      if (this.todoExportHtmlLoading || this.disposeReportLoading) return
      this.todoExportHtmlLoading = true
      try {
        const response = await exportTaskTodoHTMLAPI()
        const htmlText =
          typeof response === 'string'
            ? response
            : typeof (response && response.data) === 'string'
            ? response.data
            : ''
        if (!htmlText) {
          this.$message.error('导出失败（未获取到 HTML 内容）')
          return
        }
        this.disposeReportDialogTitle = '待执行任务导出预览'
        this.disposeReportFilename = '待执行任务导出.html'
        this.disposeReportHtml = htmlText
        this.disposeReportVisible = true
      } catch (error) {
        this.$message.error('待执行任务导出失败')
      } finally {
        this.todoExportHtmlLoading = false
      }
    },
    downloadDisposeReportHtml () {
      /** 方法用途：从预览弹框下载 HTML 文件 */
      const htmlText = String(this.disposeReportHtml || '')
      if (!htmlText) return
      const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' })
      const blobUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download =
        this.disposeReportFilename || '安全风险分析与处置报告.html'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(blobUrl)
    },
    handleDisposeReportClose () {
      /** 方法用途：关闭报告预览弹框时清理内容 */
      this.disposeReportVisible = false
      this.disposeReportHtml = ''
      this.disposeReportDialogTitle = '报告预览'
    },
    /** 通知能力判断：返回 { disabled, reason, vulnIds, categoryKey } */
    getNotifyEligibilityByTodoRow (todoRow) {
      /** 方法用途：根据 todoRow.category 与 id/vuln_ids 判断是否可通知，并返回 vulnIds */
      const row = todoRow || null
      if (!row) {
        return {
          disabled: true,
          reason: '暂无可通知的任务',
          vulnIds: [],
          categoryKey: ''
        }
      }
      const categoryText = row.category ? String(row.category).trim() : ''
      if (!categoryText) {
        return {
          disabled: true,
          reason: '任务类型缺失，暂时无法进行通知操作',
          vulnIds: [],
          categoryKey: ''
        }
      }
      if (categoryText.indexOf('关键') > -1) {
        const idNum = row.id != null && row.id !== '' ? Number(row.id) : NaN
        if (!Number.isFinite(idNum) || idNum <= 0) {
          return {
            disabled: true,
            reason: '暂时无法进行通知操作',
            vulnIds: [],
            categoryKey: 'vuln'
          }
        }
        return {
          disabled: false,
          reason: '',
          vulnIds: [idNum],
          categoryKey: 'vuln'
        }
      }
      if (categoryText.indexOf('端口') > -1) {
        const ids = Array.isArray(row.vuln_ids) ? row.vuln_ids : []
        const normalized = ids
          .map(item => (item != null && item !== '' ? Number(item) : NaN))
          .filter(num => Number.isFinite(num) && num > 0)
        if (!normalized.length) {
          return {
            disabled: true,
            reason: '暂时无法进行通知操作',
            vulnIds: [],
            categoryKey: 'port'
          }
        }
        return {
          disabled: false,
          reason: '',
          vulnIds: normalized,
          categoryKey: 'port'
        }
      }
      if (categoryText.indexOf('弱口令') > -1) {
        const idNum = row.id != null && row.id !== '' ? Number(row.id) : NaN
        if (!Number.isFinite(idNum) || idNum <= 0) {
          return {
            disabled: true,
            reason: '暂时无法进行通知操作',
            vulnIds: [],
            categoryKey: 'weak'
          }
        }
        return {
          disabled: false,
          reason: '',
          vulnIds: [idNum],
          categoryKey: 'weak'
        }
      }
      return {
        disabled: true,
        reason: `暂不支持的任务类型：${categoryText}`,
        vulnIds: [],
        categoryKey: ''
      }
    },
    handleWorkbenchNotifyClick () {
      /** 方法用途：工作台顶部「通知」按钮，校验可用性并打开对应处置弹框的通知视图 */
      const check = this.getNotifyEligibilityByTodoRow(this.dispositionRawRow)
      if (check.disabled) {
        this.$message.warning(check.reason || '暂时无法进行通知操作')
        return
      }
      const todoRow = this.dispositionRawRow
      const categoryText =
        todoRow && todoRow.category ? String(todoRow.category).trim() : ''
      // 复用治理弹框打开逻辑
      this.governSelectedTodoRow = todoRow
      this.vulnDisposeDialogVisible = false
      this.portDisposeDialogVisible = false
      this.weakDisposeDialogVisible = false
      this.governDisposeItems = null
      if (categoryText.indexOf('关键') > -1) {
        this.governDisposeItems = this.buildVulnDisposeItems(todoRow)
        this.vulnDisposeDialogVisible = true
        this.$nextTick(() => {
          const first = Array.isArray(this.governDisposeItems)
            ? this.governDisposeItems[0]
            : null
          this.handleDisposeItemNotify('vuln', first)
        })
        return
      }
      if (categoryText.indexOf('端口') > -1) {
        this.governDisposeItems = this.buildPortDisposeItems(todoRow)
        this.portDisposeDialogVisible = true
        this.$nextTick(() => {
          const first = Array.isArray(this.governDisposeItems)
            ? this.governDisposeItems[0]
            : null
          this.handleDisposeItemNotify('port', first)
        })
        return
      }
      if (categoryText.indexOf('弱口令') > -1) {
        this.governDisposeItems = this.buildWeakDisposeItems(todoRow)
        this.weakDisposeDialogVisible = true
        this.$nextTick(() => {
          const first = Array.isArray(this.governDisposeItems)
            ? this.governDisposeItems[0]
            : null
          this.handleDisposeItemNotify('weak', first)
        })
      }
    },
    /** 处置弹框内「通知」：打开嵌套的 DisposeEmailNotifyPanel */
    handleDisposeItemNotify (category, item) {
      /** 方法用途：处置弹框内点击通知时，构建 embeddedEmailContext 供弹框切换到通知视图 */
      this.handleDisposeConvergenceBack()
      const todoRow = this.governSelectedTodoRow || this.dispositionRawRow || {}
      const check = this.getNotifyEligibilityByTodoRow(todoRow)
      if (check.disabled) {
        this.$message.warning(check.reason || '暂时无法进行通知操作')
        return
      }
      const backendDisabled = false
      const context = {
        category,
        item,
        backendDisabled,
        taskRow: todoRow,
        vulnIds: check.vulnIds || []
      }
      this.vulnEmbeddedEmailContext = null
      this.weakEmbeddedEmailContext = null
      this.portEmbeddedEmailContext = null
      if (category === 'vuln') this.vulnEmbeddedEmailContext = context
      if (category === 'weak') this.weakEmbeddedEmailContext = context
      if (category === 'port') this.portEmbeddedEmailContext = context
    },
    /** 从通知视图返回风险列表 */
    handleDisposeNotifyBack () {
      /** 方法用途：关闭嵌入式通知视图，回到风险列表 */
      this.vulnEmbeddedEmailContext = null
      this.weakEmbeddedEmailContext = null
      this.portEmbeddedEmailContext = null
    },
    /** 邮件发送完成：退出通知视图 */
    handleDisposeNotifySent () {
      /** 方法用途：通知发送成功后退出通知视图 */
      this.handleDisposeNotifyBack()
    },
    /** 处置弹框内「收敛」：打开嵌套的 ServiceConvergencePanel */
    handleDisposeConvergenceOpen (category, item) {
      /** 方法用途：处置弹框内点击收敛时，构建 embeddedConvergenceContext 供弹框切换到收敛视图 */
      this.handleDisposeNotifyBack()
      const todoRow = this.governSelectedTodoRow || this.dispositionRawRow || {}
      const assetIp =
        todoRow.asset_ip != null ? String(todoRow.asset_ip).trim() : ''
      const riskItems = Array.isArray(this.governDisposeItems)
        ? this.governDisposeItems
        : []
      const summaryParts = []
      if (assetIp) summaryParts.push(assetIp)
      if ((category === 'vuln' || category === 'weak') && item && item.title) {
        summaryParts.push(item.title)
      }
      if (category === 'port' && item) {
        if (item.port != null) summaryParts.push(`端口 ${item.port}`)
        if (item.service) summaryParts.push(String(item.service))
      }
      const context = {
        category,
        item,
        assetIp,
        riskItems,
        assetSummary: summaryParts.length ? summaryParts.join(' · ') : '—'
      }
      this.vulnEmbeddedConvergenceContext = null
      this.weakEmbeddedConvergenceContext = null
      this.portEmbeddedConvergenceContext = null
      if (category === 'vuln') this.vulnEmbeddedConvergenceContext = context
      if (category === 'weak') this.weakEmbeddedConvergenceContext = context
      if (category === 'port') this.portEmbeddedConvergenceContext = context
    },
    /** 从收敛视图返回风险列表 */
    handleDisposeConvergenceBack () {
      /** 方法用途：关闭嵌入式收敛视图，回到风险列表 */
      this.vulnEmbeddedConvergenceContext = null
      this.weakEmbeddedConvergenceContext = null
      this.portEmbeddedConvergenceContext = null
    },
    /** 收敛视图「确认优化」 */
    handleDisposeConvergenceConfirm (payload) {
      /** 方法用途：收敛确认后给出提示，并退出收敛视图 */
      const sourceIp = payload && payload.sourceIp ? payload.sourceIp : ''
      const policyType = payload && payload.policyType ? payload.policyType : ''
      this.$message.success(
        `已提交优化申请（${
          policyType === 'host' ? '主机策略' : '旁路策略'
        } · 源 IP ${sourceIp}）`
      )
      this.handleDisposeConvergenceBack()
    },
    /** 将 todo 原始行映射为关键漏洞弹框 items */
    buildVulnDisposeItems (todoRow) {
      /** 方法用途：将接口返回的关键漏洞任务行，转换成治理弹框所需 items 结构 */
      const row = todoRow || {}
      return [
        {
          id: row.id != null ? String(row.id) : 'vuln-0',
          title: row.vuln_name || row.task_title || '关键漏洞',
          severity: this.mapVulnLevelToLabel(row.vuln_level),
          cvss:
            row.risk_score != null && row.risk_score !== ''
              ? String(row.risk_score)
              : '—',
          description: row.describe || ''
        }
      ]
    },
    /** 将 todo 原始行映射为高危端口弹框 items */
    buildPortDisposeItems (todoRow) {
      /** 方法用途：将接口返回的高危端口任务行，转换成治理弹框所需 items 结构 */
      const row = todoRow || {}
      const vulnTitle = row.vuln_name || ''
      const isWeakerRaw = row.is_weaker
      const isWeakerNum =
        isWeakerRaw != null && isWeakerRaw !== '' ? Number(isWeakerRaw) : null
      const isWeakerNormalized =
        Number.isFinite(isWeakerNum) && (isWeakerNum === 0 || isWeakerNum === 1)
          ? isWeakerNum
          : null
      /** 优先用 vuln_ids 生成可拉取详情的漏洞行；无 id 时退回仅标题展示 */
      const idList = Array.isArray(row.vuln_ids) ? row.vuln_ids : []
      let vulns = []
      if (idList.length) {
        vulns = idList
          .map(rawId => {
            const num = Number(rawId)
            if (!Number.isFinite(num) || num <= 0) return null
            return {
              id: num,
              title: vulnTitle || '关联漏洞',
              severity: this.mapVulnLevelToPortSeverity(row.vuln_level)
            }
          })
          .filter(Boolean)
      } else if (vulnTitle) {
        vulns = [
          {
            id: row.task_id != null ? `pv-${row.task_id}` : 'pv-0',
            title: vulnTitle,
            severity: this.mapVulnLevelToPortSeverity(row.vuln_level)
          }
        ]
      }
      return [
        {
          id: row.id != null ? String(row.id) : 'port-0',
          port:
            row.port != null && row.port !== ''
              ? Number(row.port) || row.port
              : '—',
          service: row.service || row.protocol || '—',
          isHighRisk: true,
          /** 是否收敛：0 未收敛 1 已收敛（与资产端口接口一致时透传） */
          is_weaker: isWeakerNormalized,
          vulns,
          rawData: row
        }
      ]
    },
    /** 将 todo 原始行映射为弱口令弹框 items */
    buildWeakDisposeItems (todoRow) {
      /** 方法用途：将接口返回的弱口令任务行，转换成治理弹框所需 items 结构 */
      const row = todoRow || {}
      return [
        {
          id: row.id != null ? String(row.id) : 'weak-0',
          title: row.vuln_name || row.task_title || '弱口令风险',
          account: '—',
          port:
            row.port != null && row.port !== ''
              ? Number(row.port) || row.port
              : '—',
          description: row.describe || ''
        }
      ]
    },
    /** 漏洞等级数值 → 文案 */
    mapVulnLevelToLabel (rawLevel) {
      /** 方法用途：把接口返回的 vuln_level 数值转为弹框展示文案 */
      const level = Number(rawLevel)
      /** 与 riskLevel.vue 对齐：0低危 1中危 2高危 3紧急 4关键漏洞 */
      if (!Number.isFinite(level)) return '—'
      if (level === 0) return '低危'
      if (level === 1) return '中危'
      if (level === 2) return '高危'
      if (level === 3) return '紧急'
      if (level === 4) return '关键漏洞'
      return '—'
    },
    /** 漏洞等级数值 → 端口弹框的 severity */
    mapVulnLevelToPortSeverity (rawLevel) {
      /** 方法用途：把接口返回的 vuln_level 映射成端口弹框内漏洞行的严重性文案 */
      const levelText = this.mapVulnLevelToLabel(rawLevel)
      if (
        levelText === '关键漏洞' ||
        levelText === '紧急' ||
        levelText === '高危'
      ) {
        return '高危'
      }
      if (levelText === '中危') return '中危'
      if (levelText === '低危') return '低危'
      return '中危'
    },
    /** 按分类请求 todo 列表，返回 list 数组 */
    async fetchDispositionListByCategory (category) {
      try {
        const response = await taskListNewAPI({
          category,
          task_type: '风险处置',
          status: 0
        })
        if (
          response &&
          response.code === 0 &&
          response.data &&
          Array.isArray(response.data.list)
        ) {
          return response.data.list
        }
      } catch (error) {
        // 单类失败则继续瀑布下一类
      }
      return []
    },
    /**
     * 瀑布加载：关键漏洞 → 弱口令 → 高危端口，取首个非空 list，仅展示一条由 dispositionIndex 控制
     */
    async loadDispositionWaterfall () {
      this.dispositionLoading = true
      try {
        this.dispositionList = []
        this.dispositionIndex = 0
        this.dispositionCategory = ''
        for (const category of DISPOSITION_CATEGORY_ORDER) {
          const list = await this.fetchDispositionListByCategory(category)
          if (list.length > 0) {
            this.dispositionList = list
            this.dispositionCategory = category
            this.dispositionIndex = 0
            return
          }
        }
      } finally {
        this.dispositionLoading = false
        /** 与父级 pipelineCurrentTask 对齐，避免父级再单独请求 todo/list */
        this.$emit('pipeline-task-sync', this.dispositionRawRow)
      }
    },
    /** todo 行 → 处置区展示对象 */
    mapTodoRowToDispositionTask (rawRow, categoryLabel) {
      if (!rawRow) return null
      const taskType =
        DISPOSITION_CATEGORY_TO_TASK_TYPE[categoryLabel] || 'weak_password'
      const scoreNum = Number(rawRow.risk_score)
      const riskScoreBar = Number.isFinite(scoreNum)
        ? Math.min(100, Math.max(0, scoreNum))
        : 0
      const titleText =
        (rawRow.vuln_name && String(rawRow.vuln_name).trim()) ||
        rawRow.task_title ||
        '—'
      return {
        asset_ip: rawRow.asset_ip || rawRow.task_key || '',
        title: titleText,
        task_type: taskType,
        status: rawRow.task_status,
        risk_score: riskScoreBar,
        create_time: rawRow.task_create_time,
        task_id: rawRow.task_id,
        id: rawRow.id,
        description: this.buildDispositionDescription(rawRow),
        _todoRaw: rawRow
      }
    },
    /** 紧急区风险描述摘要 */
    buildDispositionDescription (rawRow) {
      if (!rawRow) return '—'
      const segments = []
      if (
        rawRow.port !== undefined &&
        rawRow.port !== null &&
        rawRow.port !== ''
      ) {
        segments.push(`端口 ${rawRow.port}`)
      }
      if (rawRow.service && String(rawRow.service).trim()) {
        segments.push(`服务 ${rawRow.service}`)
      }
      if (rawRow.vuln_name && String(rawRow.vuln_name).trim()) {
        segments.push(String(rawRow.vuln_name).trim())
      }
      return segments.length > 0 ? segments.join('；') : '—'
    },
    /** 与当前 todo 分类对齐的底部四卡（仅当前类可点、数量为 1） */
    buildSyntheticRiskCards (categoryChinese) {
      const activeKey =
        categoryChinese === '关键漏洞'
          ? 'critical_vuln'
          : categoryChinese === '弱口令'
          ? 'weak_password'
          : 'port_service'
      const cardDefs = [
        {
          key: 'critical_vuln',
          title: '关键漏洞',
          variant: 'critical',
          iconClass: 'iconfont icon-loudong11'
        },
        {
          key: 'weak_password',
          title: '弱口令',
          variant: 'weak',
          iconClass: 'el-icon-lock'
        },
        {
          key: 'port_service',
          title: '端口服务',
          variant: 'port',
          iconClass: 'iconfont icon-xinhao'
        },
        {
          key: 'other_port',
          title: '非高风险端口',
          variant: 'other-port',
          iconClass: 'el-icon-more-outline'
        }
      ]
      return cardDefs.map(card => ({
        key: card.key,
        title: card.title,
        variant: card.variant,
        iconClass: card.iconClass,
        count: card.key === activeKey ? 1 : 0,
        countText: card.key === activeKey ? '1' : '0',
        clickable: card.key === activeKey,
        detailText: ''
      }))
    },
    /** 挂起成功后：同 list 下一条；否则重新瀑布请求 */
    async advanceAfterSuspend () {
      if (this.dispositionIndex < this.dispositionList.length - 1) {
        this.dispositionIndex++
        return
      }
      await this.loadDispositionWaterfall()
    },
    /** 挂起当前条并切换下一条（纯前端：不调用接口） */
    async handleDispositionSuspend () {
      const rawRow = this.dispositionRawRow
      if (!rawRow || this.dispositionActionLoading || this.resolveSubmitting) {
        return
      }
      this.dispositionActionLoading = true
      try {
        await this.advanceAfterSuspend()
        if (this.$message) {
          this.$message.success('已挂起，已切换到下一条任务')
        }
      } finally {
        this.dispositionActionLoading = false
      }
    },
    /** 待执行任务卡片数据汇总 */
    async fetchPendingTaskSummary () {
      try {
        const response = await taskSummaryNewAPI({
          task_type: '风险处置',
          status: 0,
          ip: '',
          system_name: ''
        })
        if (response && response.code === 0 && response.data) {
          this.pendingSummary = response.data
        }
      } catch (error) {
        // 左侧汇总失败可继续展示 riskCards 兜底
      }
    },
    /** 任务类型中文 */
    pipelineTaskTypeLabel (taskRow) {
      if (!taskRow || !taskRow.task_type) return '治理任务'
      return (
        PIPELINE_TASK_TYPE_LABEL_MAP[taskRow.task_type] ||
        String(taskRow.task_type)
      )
    },
    /** 状态文案 */
    taskStatusText (status) {
      const map = { 0: '待执行', 1: '已挂起', 2: '已执行' }
      const key = status != null ? Number(status) : -1
      return map[key] != null ? map[key] : '—'
    },
    /** 时间展示 MM-DD HH:mm */
    formatTaskTime (rawTime) {
      if (rawTime == null || rawTime === '') return '—'
      const normalized = String(rawTime).replace(/-/g, '/')
      const dateValue = new Date(normalized)
      if (Number.isNaN(dateValue.getTime())) return String(rawTime)
      const month = String(dateValue.getMonth() + 1).padStart(2, '0')
      const day = String(dateValue.getDate()).padStart(2, '0')
      const hour = String(dateValue.getHours()).padStart(2, '0')
      const minute = String(dateValue.getMinutes()).padStart(2, '0')
      return `${month}-${day} ${hour}:${minute}`
    },
    emitNotify () {
      this.$emit('notify')
    },
    emitGenerateReport () {
      this.$emit('generate-report', this.dispositionDisplayTask)
    },
    /** 生成事件：调用工单创建接口 */
    async handleGenerateWorkOrder () {
      /** 方法用途：根据当前处置 todo 行创建运营工单 */
      const row = this.dispositionRawRow
      if (!row) {
        this.$message.warning('暂无可生成工单的任务')
        return
      }
      const ip = row.asset_ip != null ? String(row.asset_ip).trim() : ''
      const category = row.category ? String(row.category).trim() : ''
      const idNum = row.id != null && row.id !== '' ? Number(row.id) : NaN
      if (!ip) {
        this.$message.warning('缺少资产 IP，无法生成工单')
        return
      }
      if (!category) {
        this.$message.warning('缺少任务分类，无法生成工单')
        return
      }
      if (!Number.isFinite(idNum) || idNum <= 0) {
        this.$message.warning('缺少有效任务 ID，无法生成工单')
        return
      }
      if (this.workOrderCreating) return
      this.workOrderCreating = true
      try {
        const response = await createWorkOrderAPI({
          ip,
          task_type: '风险处置',
          category,
          id: idNum
        })
        if (response && response.code === 0) {
          this.$message.success('工单已生成，可在运营活动页面查看详情')
          this.$emit('generate-event', response)
        } else {
          this.$message.error((response && response.msg) || '工单生成失败')
        }
      } catch (error) {
        this.$message.error('工单生成失败')
      } finally {
        this.workOrderCreating = false
      }
    },
    /** 打开待执行任务弹框 */
    openPendingTasksModal () {
      this.pendingTasksModalVisible = true
    },
    /** 弹框内「立即治理」：与右侧紧急区按钮一致，按 raw.category 打开对应治理弹框 */
    onModalGovernTask (displayRow) {
      const todoRow =
        displayRow &&
        typeof displayRow === 'object' &&
        displayRow.raw &&
        typeof displayRow.raw === 'object'
          ? displayRow.raw
          : displayRow
      this.openGovernDialogForTodoRow(todoRow)
    },
    /** 待执行任务区域：导出 HTML，先预览再下载/打印 */
    handleExportClick () {
      this.fetchAndPreviewTodoExportHtml()
    },
    emitGovernEmergency () {
      /** 方法用途：紧急卡片「立即治理」，使用当前处置瀑布选中的 todo 行 */
      this.openGovernDialogForTodoRow(this.dispositionRawRow)
    },
    /** 方法用途：根据 todo 行的 category 打开关键漏洞 / 高危端口 / 弱口令治理弹框 */
    openGovernDialogForTodoRow (todoRow) {
      if (!todoRow || typeof todoRow !== 'object') {
        this.$message.warning('暂无可治理的任务')
        return
      }
      const category = todoRow.category ? String(todoRow.category).trim() : ''
      if (!category) {
        this.$message.warning('任务类型缺失，无法打开治理弹框')
        return
      }
      this.governSelectedTodoRow = todoRow
      this.vulnDisposeDialogVisible = false
      this.portDisposeDialogVisible = false
      this.weakDisposeDialogVisible = false
      this.governDisposeItems = null

      if (category.indexOf('关键') > -1) {
        this.governDisposeItems = this.buildVulnDisposeItems(todoRow)
        this.vulnDisposeDialogVisible = true
        return
      }
      if (category.indexOf('端口') > -1) {
        this.governDisposeItems = this.buildPortDisposeItems(todoRow)
        this.portDisposeDialogVisible = true
        return
      }
      if (category.indexOf('弱口令') > -1) {
        this.governDisposeItems = this.buildWeakDisposeItems(todoRow)
        this.weakDisposeDialogVisible = true
        return
      }
      this.$message.warning(`暂不支持的任务类型：${category}`)
    },
    /** 风险卡片点击 */
    onRiskCardClick (riskCard) {
      if (!riskCard || !riskCard.clickable) return
      this.$emit('risk-card-click', riskCard)
    }
  }
}
</script>
<style lang="scss" scoped>
.workbench-pipeline-ai-stack,
.pipeline-ai-stack {
  --wbp-gap: 12px;
  --wbp-card-radius: 20px;
  --wbp-card-padding: 16px;
  --wbp-fs-caption: 12px;
  --wbp-fs-body: 12px;
  --wbp-fs-title: 20px;
  --wbp-fs-number: 24px;
}

.workbench-pipeline-ai-stack {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pipeline-react-row {
  flex: 1;
  min-height: 0;
  gap: var(--wbp-gap) 0;
}

.pipeline-react-row :deep(.el-col) {
  display: flex;
  flex-direction: column;
}

.pending-glass,
.disposition-glass {
  flex: 1;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  padding: var(--wbp-card-padding);
  border-radius: var(--wbp-card-radius);
  border: 1px solid #efe7fb;
  background: #fff;
}

.pending-glass-head,
.disposition-glass-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1e9fb;
}

.pending-glass-head-left,
.disposition-glass-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pending-glass-icon-wrap,
.disposition-glass-icon-wrap {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid #eadcff;
  background: linear-gradient(180deg, #fbf6ff 0%, #f5edff 100%);
  color: #9f55ff;
}

.pending-glass-title,
.disposition-glass-title,
.disposition-glass-empty-title,
.emergency-header-title {
  font-size: var(--wbp-fs-title);
  line-height: 1.2;
  font-weight: 800;
  color: #1f2430;
}

.disposition-glass-subtitle,
.disposition-glass-empty-desc,
.disposition-glass-loading-hint,
.emergency-header-meta,
.emergency-meta-k,
.emergency-credential-k,
.emergency-kv-k,
.pending-glass-row-label {
  font-size: var(--wbp-fs-caption);
  color: #8d95a7;
}

.pending-glass-chevron {
  color: #c7b4eb;
  font-size: 12px;
}

.pending-glass-total {
  margin-bottom: 12px;
  font-size: var(--wbp-fs-number);
  line-height: 1;
  font-weight: 900;
  color: #1f2430;
}

.pending-glass-rows {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pending-glass-row {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid transparent;

  .pending-glass-row-label {
    flex: 1;
    min-width: 0;
    font-size: var(--wbp-fs-body);
    font-weight: 700;
    color: #4e5567;
  }

  .pending-glass-row-count {
    font-size: 20px;
    line-height: 1;
    font-weight: 900;
  }

  &--critical {
    background: linear-gradient(180deg, #fff2f4 0%, #fff6f7 100%);
    border-color: #ffdbe2;
  }

  &--critical .pending-glass-row-label,
  &--critical .pending-glass-row-count {
    color: #ff335f;
  }

  &--weak {
    background: linear-gradient(180deg, #eef3ff 0%, #f5f7ff 100%);
    border-color: #dee6ff;
  }

  &--weak .pending-glass-row-label,
  &--weak .pending-glass-row-count {
    color: #6268ff;
  }

  &--high-port {
    background: linear-gradient(180deg, #fff8e8 0%, #fffaf1 100%);
    border-color: #ffe8ae;
  }

  &--high-port .pending-glass-row-label,
  &--high-port .pending-glass-row-count {
    color: #f59e0b;
  }
}

.pending-glass-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #f1e9fb;
}

.pending-glass-export-btn,
.pending-glass-info-btn,
.pending-glass-foot :deep(.wb-glass-btn),
.disposition-glass-actions :deep(.wb-glass-btn) {
  min-height: 32px;
  border-radius: 999px;
  font-size: var(--wbp-fs-body);
  font-weight: 700;
}

.pending-glass-export-btn {
  color: #fff !important;
  background: linear-gradient(180deg, #a320ff 0%, #8f1eff 100%) !important;
  border-color: transparent !important;
  box-shadow: 0 12px 22px rgba(159, 85, 255, 0.24);
}

.pending-glass-export-btn :deep(.iconfont) {
  margin-right: 4px;
}

.pending-glass-info-btn {
  width: 32px;
  min-width: 32px;
  padding: 0;
  color: #9aa1b2 !important;
  border: 1px solid #e6deef !important;
  background: #fff !important;
}

.disposition-glass-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.disposition-glass-actions :deep(.wb-glass-btn--blue),
.disposition-glass-actions :deep(.wb-glass-btn--amber),
.disposition-glass-actions :deep(.wb-glass-btn--emerald),
.disposition-glass-actions :deep(.wb-glass-btn--purple-solid) {
  color: #9f55ff !important;
  background: linear-gradient(180deg, #faf5ff 0%, #f4ebff 100%) !important;
  border: 1px solid #eadcff !important;
  box-shadow: none;
}

.disposition-glass-body,
.disposition-glass-scroll {
  flex: 1;
  min-height: 0;
}

.disposition-glass-scroll {
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 4px;
}

.disposition-glass-loading-hint,
.disposition-glass-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.disposition-glass-empty {
  min-height: 200px;
  padding: 16px 12px;
}

.disposition-glass-empty-inner {
  max-width: 360px;
  padding: 20px 16px;
  text-align: center;
  border-radius: 14px;
  border: 1px solid #e7f3eb;
  background: #fafcfb;
}

.disposition-glass-empty-icon-wrap {
  width: 44px;
  height: 44px;
  margin: 0 auto 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #22c55e;
  color: #fff;
  font-size: 20px;
  box-shadow: 0 8px 24px rgba(34, 197, 94, 0.35);
}

.emergency-card {
  margin-bottom: 12px;
  border-radius: 16px !important;
  border: 1px solid #f3dfe4 !important;
  background: #fff6f7 !important;
  box-shadow: none !important;
}

.emergency-card :deep(.el-card__body) {
  padding: 16px;
}

.emergency-inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px;
  gap: 12px;
  align-items: stretch;
  position: relative;
}

.emergency-inner--weak,
.emergency-inner--critical,
.emergency-inner--port {
  border-left: none;
  padding-left: 0;
  margin-left: 0;
}

.emergency-corner-tag {
  position: absolute;
  top: 0;
  right: 0;
}

.emergency-corner-tag :deep(.el-tag) {
  border: none;
  border-radius: 8px;
  font-weight: 800;
}

.emergency-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.emergency-header-icon {
  font-size: 16px;
  color: #ff6a7b;
}

.emergency-header-titles,
.emergency-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.emergency-header-meta,
.emergency-meta-row,
.emergency-port-hero,
.emergency-port-sub,
.emergency-spot-chips,
.emergency-credential {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
}

.emergency-meta-item,
.emergency-meta-v,
.emergency-kv-v,
.emergency-desc,
.emergency-cve-rest,
.emergency-port-service {
  font-size: var(--wbp-fs-body);
  color: #32394a;
  line-height: 1.5;
}

.emergency-vuln-title,
.emergency-spot-title {
  font-size: 16px;
  font-weight: 800;
  line-height: 1.4;
  color: #1f2430;
  word-break: break-word;
}

.emergency-meta-pair,
.emergency-credential-item,
.emergency-kv {
  min-width: 0;
}

.emergency-meta-v--mono,
.emergency-credential-v,
.emergency-cve-primary {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
}

.emergency-credential-v {
  padding: 3px 8px;
  border-radius: 8px;
  border: 1px solid #eadcff;
  background: #faf5ff;
  color: #7c3aed;
  font-size: var(--wbp-fs-body);
  font-weight: 700;
}

.emergency-spot {
  padding: 10px;
  border-radius: 12px;
  border: 1px solid #f0e4e8;
  background: rgba(255, 255, 255, 0.7);
}

.emergency-spot--weak {
  border-color: #ffe2ad;
  background: #fff8eb;
}

.emergency-spot--critical {
  border-color: #ffd7de;
  background: #fff1f4;
}

.emergency-spot--port {
  border-color: #d8e8ff;
  background: #f3f8ff;
}

.emergency-chip-level {
  background: #fff !important;
  border-color: #ffd7de !important;
  color: #ff4a68 !important;
}

.emergency-kv-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.emergency-cve-primary,
.emergency-port-num {
  color: #ff4a68;
  font-weight: 900;
}

.emergency-port-num {
  font-size: 24px;
  line-height: 1;
}

.emergency-desc,
.emergency-credential,
.emergency-actions {
  padding-top: 8px;
  margin-top: 4px;
  border-top: 1px solid #f3d4d9;
}

.emergency-actions {
  display: flex;
  align-items: center;
  justify-content: center;
}

.emergency-actions :deep(.el-button--danger) {
  width: min(220px, 100%);
  min-height: 44px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 900;
  background: linear-gradient(180deg, #ff0b52 0%, #ef0048 100%) !important;
  border-color: transparent !important;
  box-shadow: 0 18px 34px rgba(239, 0, 72, 0.24);
}

@media (max-width: 768px) {
  .workbench-pipeline-ai-stack,
  .pipeline-ai-stack {
    --wbp-gap: 10px;
    --wbp-card-radius: 16px;
    --wbp-card-padding: 14px;
    --wbp-fs-title: 18px;
    --wbp-fs-number: 22px;
  }

  .pending-glass,
  .disposition-glass {
    min-height: auto;
  }

  .pending-glass-row {
    min-height: 44px;
    padding: 0 10px;
  }

  .pending-glass-row .pending-glass-row-count {
    font-size: 18px;
  }

  .emergency-inner {
    grid-template-columns: 1fr;
  }

  .emergency-kv-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .emergency-actions :deep(.el-button--danger) {
    width: 100%;
    min-height: 40px;
  }
}

@media (max-height: 760px) {
  .workbench-pipeline-ai-stack,
  .pipeline-ai-stack {
    --wbp-gap: 10px;
    --wbp-card-padding: 14px;
    --wbp-fs-number: 22px;
  }

  .pending-glass-head,
  .disposition-glass-head {
    margin-bottom: 12px;
    padding-bottom: 12px;
  }

  .pending-glass-total {
    margin-bottom: 12px;
  }

  .pending-glass-row,
  .pending-glass-foot :deep(.wb-glass-btn),
  .disposition-glass-actions :deep(.wb-glass-btn) {
    min-height: 32px;
  }

  .emergency-actions :deep(.el-button--danger) {
    min-height: 40px;
  }
}
</style>
