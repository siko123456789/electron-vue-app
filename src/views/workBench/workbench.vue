<template>
  <main
    class="workbench-v3-page"
    :class="{ 'workbench-v3-page--ai-open': workbenchAiQaPanelVisible }"
  >
    <!-- 管道区 + WorkbenchAiQaModule（底部输入与对话区） -->
    <div class="workbench-v3-inner">
      <!-- AI 智能作战中心 主卡 -->
      <section
        class="ops-center-card"
        :class="{ 'ops-center-card--ai-open': workbenchAiQaPanelVisible }"
      >
        <div class="ops-center-bg-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"
            />
            <path d="M9 13a4.5 4.5 0 0 0 3-4" />
            <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
            <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
            <path d="M6 18a4 4 0 0 1-1.967-.516" />
            <path d="M12 13h4" />
            <path d="M12 18h6a2 2 0 0 1 2 2v1" />
            <path d="M12 8h8" />
            <path d="M16 8V5a2 2 0 0 1 2-2" />
            <circle cx="16" cy="13" r=".5" />
            <circle cx="18" cy="3" r=".5" />
            <circle cx="20" cy="21" r=".5" />
            <circle cx="20" cy="8" r=".5" />
          </svg>
        </div>

        <div class="ops-center-content">
          <!-- 标题行 -->
          <div class="ops-header">
            <div class="ops-header-left">
              <div class="ops-header-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="26"
                  height="26"
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
                  />
                  <path d="M9 13a4.5 4.5 0 0 0 3-4" />
                  <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
                  <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
                  <path d="M6 18a4 4 0 0 1-1.967-.516" />
                  <path d="M12 13h4" />
                  <path d="M12 18h6a2 2 0 0 1 2 2v1" />
                  <path d="M12 8h8" />
                  <path d="M16 8V5a2 2 0 0 1 2-2" />
                  <circle cx="16" cy="13" r=".5" />
                  <circle cx="18" cy="3" r=".5" />
                  <circle cx="20" cy="21" r=".5" />
                  <circle cx="20" cy="8" r=".5" />
                </svg>
              </div>
              <div>
                <h2 class="ops-title">
                  AI 智能作战中心
                  <!-- <span class="ops-badge">v3.0 Pro</span> -->
                </h2>
                <p class="ops-subtitle">实时自动化威胁研判与处置链路</p>
              </div>
            </div>
            <div class="ops-status-pill">
              <span class="ops-status-dot-wrap">
                <span class="ops-status-dot-ping"></span>
                <span class="ops-status-dot-solid"></span>
              </span>
              AI 引擎持续守护中
            </div>
          </div>

          <!-- 态势评估区 -->
          <div class="posture-section">
            <div class="posture-grid">
              <div class="posture-left">
                <div class="posture-level-label">当前安全等级</div>
                <div class="posture-level-value">
                  {{ postureLevelGrade }}
                  <span
                    class="posture-level-desc"
                  >/ {{ postureLevelRiskDesc }}</span>
                </div>
                <div class="posture-stats">
                  <div class="posture-stat">
                    <div class="posture-stat-icon posture-stat-icon--blue">
                      <i class="el-icon-aim"></i>
                    </div>
                    <div>
                      <div class="posture-stat-label">治理完成率</div>
                      <div class="posture-stat-value">{{ postureGovernanceRateText }}</div>
                    </div>
                  </div>
                  <!-- MTTR 统计已隐藏；若需展示可恢复本块并补回 postureMttrText 计算属性 -->
                </div>
              </div>
              <div class="posture-cards">
                <div class="posture-card">
                  <div class="posture-card-head">
                    <i class="iconfont icon-zujian"></i>
                    <span>攻击面治理</span>
                  </div>
                  <p
                    class="posture-card-desc posture-card-desc--api"
                    v-html="postureCardBodyHtml('attackSurface')"
                  ></p>
                </div>
                <div class="posture-card">
                  <div class="posture-card-head">
                    <i class="iconfont icon-erji-zichanloudongsaomiaobaobiao"></i>
                    <span>风险评估</span>
                  </div>
                  <p
                    class="posture-card-desc posture-card-desc--api"
                    v-html="postureCardBodyHtml('riskAssessment')"
                  ></p>
                </div>
                <div class="posture-card">
                  <div class="posture-card-head">
                    <i class="iconfont icon-xinhao" style="font-size: 17px"></i>
                    <span>事件与基线</span>
                  </div>
                  <p
                    class="posture-card-desc posture-card-desc--api"
                    v-html="postureCardBodyHtml('eventAndBaseline')"
                  ></p>
                </div>
              </div>
            </div>
          </div>

          <!-- 管道区与 AI 问答叠层：展开时铺满 posture 以下区域并盖住管道网格 -->
          <div class="pipeline-ai-stack">
            <WorkbenchPipelineAiStack
              ref="pipelineAiStack"
              class="workbench-pipeline-ai-slot"
              :loading="false"
              :current-task="pipelineCurrentTask"
              :risk-cards="pipelineRiskInsightCards"
              :resolve-submitting="pipelineResolveSubmitting"
              @notify="handlePipelineDispositionNotify"
              @generate-event="handleWorkbenchGenerateEvent"
              @generate-report="handlePipelineDispositionGenerateReport($event)"
              @risk-card-click="handleRiskCardClick"
              @govern-emergency="handleWorkbenchGovernEmergency"
              @pipeline-task-sync="handlePipelineTaskSync"
            />

            <!-- AI 问答 + 底部输入：独立组件（WebSocket / Markdown / 样式内聚） -->
            <WorkbenchAiQaModule @panel-visible="onWorkbenchAiQaPanelVisible" />
          </div>
          <!-- /pipeline-ai-stack -->
        </div>
      </section>

      <section
        class="ops-lower-card"
        :class="{ 'ops-lower-card--ai-open': workbenchAiQaPanelVisible }"
      >
        <div class="pipeline-ai-stack">
          <WorkbenchPipelineAiStack
            ref="pipelineAiStack"
            class="workbench-pipeline-ai-slot"
            :loading="false"
            :current-task="pipelineCurrentTask"
            :risk-cards="pipelineRiskInsightCards"
            :resolve-submitting="pipelineResolveSubmitting"
            @notify="handlePipelineDispositionNotify"
            @generate-event="handleWorkbenchGenerateEvent"
            @generate-report="handlePipelineDispositionGenerateReport($event)"
            @risk-card-click="handleRiskCardClick"
            @govern-emergency="handleWorkbenchGovernEmergency"
            @pipeline-task-sync="handlePipelineTaskSync"
          />

          <WorkbenchAiQaModule @panel-visible="onWorkbenchAiQaPanelVisible" />
        </div>
      </section>
    </div>

    <!-- AI 处置：分类详情（独立封装，便于复用） -->
    <VulnRiskDisposeDialog
      v-model:visible="vulnRiskDisposeVisible"
      :items="pipelineCriticalVulnItems"
      :enable-threat-rule-generation="true"
      :embedded-email-context="vulnEmbeddedEmailContext"
      :embedded-convergence-context="vulnEmbeddedConvergenceContext"
      @download-report="handleDisposeDetailDownloadReport"
      @notify="handleDisposeItemNotify('vuln', $event)"
      @notify-back="handleDisposeNotifyBack"
      @notify-sent="handleDisposeNotifySent"
      @convergence-open="handleDisposeConvergenceOpen('vuln', $event)"
      @convergence-back="handleDisposeConvergenceBack"
      @convergence-confirm="handleDisposeConvergenceConfirm"
    />
    <WeakPasswordRiskDisposeDialog
      v-model:visible="weakPasswordRiskDisposeVisible"
      :items="pipelineWeakPwdItems"
      :embedded-email-context="weakEmbeddedEmailContext"
      :embedded-convergence-context="weakEmbeddedConvergenceContext"
      @download-report="handleDisposeDetailDownloadReport"
      @notify="handleDisposeItemNotify('weak', $event)"
      @notify-back="handleDisposeNotifyBack"
      @notify-sent="handleDisposeNotifySent"
      @convergence-open="handleDisposeConvergenceOpen('weak', $event)"
      @convergence-back="handleDisposeConvergenceBack"
      @convergence-confirm="handleDisposeConvergenceConfirm"
    />
    <PortRiskDisposeDialog
      v-model:visible="portRiskDisposeVisible"
      :items="pipelinePortDialogItems"
      :task-row="pipelineCurrentTask"
      :port-risk-title-label="pipelinePortRiskTitleLabel"
      :embedded-email-context="portEmbeddedEmailContext"
      :embedded-convergence-context="portEmbeddedConvergenceContext"
      @download-report="handleDisposeDetailDownloadReport"
      @notify="handleDisposeItemNotify('port', $event)"
      @notify-back="handleDisposeNotifyBack"
      @notify-sent="handleDisposeNotifySent"
      @convergence-open="handleDisposeConvergenceOpen('port', $event)"
      @convergence-back="handleDisposeConvergenceBack"
      @convergence-confirm="handleDisposeConvergenceConfirm"
    />
    <AiDisposeReportDialog
      v-model:visible="disposeReportVisible"
      :report-data="disposeReportData"
      @download-html="downloadDisposeReportHtml"
    />
  </main>
</template>

<script lang="ts">
// @ts-nocheck
import { defineComponent } from "vue";
import { securityOverviewTextAPI, resolveTaskAPI } from "@/api/aiGovernance";
import WorkbenchPipelineAiStack from "./com/WorkbenchPipelineAiStack.vue";
import WorkbenchAiQaModule from "./com/WorkbenchAiQaModule.vue";
import VulnRiskDisposeDialog from "@/components/disposeCom/VulnRiskDisposeDialog.vue";
import WeakPasswordRiskDisposeDialog from "@/components/disposeCom/WeakPasswordRiskDisposeDialog.vue";
import PortRiskDisposeDialog from "@/components/disposeCom/PortRiskDisposeDialog.vue";
import AiDisposeReportDialog from "@/components/disposeCom/AiDisposeReportDialog.vue";

type AnyRecord = Record<string, any>;

export default defineComponent({
  name: "DashboardWorkbenchV3",
  components: {
    WorkbenchPipelineAiStack,
    WorkbenchAiQaModule,
    VulnRiskDisposeDialog,
    WeakPasswordRiskDisposeDialog,
    PortRiskDisposeDialog,
    AiDisposeReportDialog
  },
  data() {
    return {
      /** 与 WorkbenchAiQaModule 同步：用于主卡/页面 padding 的 --ai-open 样式 */
      workbenchAiQaPanelVisible: false,
      /** 与 DashboardIndex 一致：/api/analy/securityOverviewText */
      securityOverview: {} as AnyRecord,
      /** 管道区：与 WorkbenchPipelineAiStack 处置区首条 todo 同步（由子组件 emit，不再重复请求 todo/list） */
      pipelineCurrentTask: null as AnyRecord | null,
      pipelineResolveSubmitting: false,
      /** 风险分类详情弹框（disposeCom） */
      vulnRiskDisposeVisible: false,
      weakPasswordRiskDisposeVisible: false,
      portRiskDisposeVisible: false,
      /** 生成报告预览 */
      disposeReportVisible: false,
      disposeReportData: null as AnyRecord | null,
      /** 嵌入风险详情弹框内的邮件通知上下文（与 DisposeEmailNotifyPanel 一致） */
      disposeEmailNotifyContext: null as AnyRecord | null,
      /** 嵌入风险详情弹框内的服务收敛治理上下文 */
      disposeConvergenceContext: null as AnyRecord | null,
      /** 当前打开的风险分类（用于端口服务/其他端口共用详情弹框） */
      currentRiskCategoryKey: ""
    };
  },
  computed: {
    /** 当前安全等级展示值 */
    postureLevelGrade() {
      const grade = this.securityOverview.currentSecurityLevel;
      return grade != null && grade !== "" ? String(grade) : "—";
    },
    /** 风险描述，如「中等风险」 */
    postureLevelRiskDesc() {
      return this.securityOverview.riskDescription || "暂无";
    },
    /** 治理完成率百分比文案 */
    postureGovernanceRateText() {
      const rate = this.securityOverview.governanceCompletionRate;
      if (rate == null || rate === "") return "--";
      return `${rate}%`;
    },
    pipelineTaskAssetLine() {
      const taskRow = this.pipelineCurrentTask;
      if (!taskRow) return "—";
      const assetIp = taskRow.asset_ip || "—";
      const assetName =
        taskRow.asset_name ||
        taskRow.asset_nickname ||
        taskRow.asset_label ||
        "";
      const trimmedName = String(assetName).trim();
      return trimmedName ? `${assetIp} (${trimmedName})` : assetIp;
    },
    pipelineTaskRiskScore() {
      const taskRow = this.pipelineCurrentTask;
      if (!taskRow) return 0;
      const fromApi =
        taskRow.risk_score ??
        taskRow.risk_value ??
        taskRow.risk ??
        taskRow.score;
      const parsed = Number(fromApi);
      if (!Number.isNaN(parsed) && parsed > 0) return Math.round(parsed);
      const seed = Number(taskRow.id) || 0;
      return 400 + (seed % 500);
    },
    pipelineRiskInsightCards() {
      const taskRow = this.pipelineCurrentTask;
      if (!taskRow) return [];
      const countSummary = taskRow.counts || {};
      const criticalVulnCount = Number(countSummary.critical_vuln_count) || 0;
      const weakPwdCount = Number(countSummary.weak_pwd_count) || 0;
      const highRiskPortCount = Number(countSummary.high_risk_port_count) || 0;
      const otherPortCount = Number(countSummary.other_port_count) || 0;

      return [
        {
          key: "critical_vuln",
          title: "关键漏洞",
          count: criticalVulnCount,
          clickable: criticalVulnCount > 0,
          countText: String(criticalVulnCount),
          detailText: `高危: ${criticalVulnCount} | 中危: 0`,
          variant: "critical",
          iconClass: "iconfont icon-loudong11"
        },
        {
          key: "weak_password",
          title: "弱口令",
          count: weakPwdCount,
          clickable: weakPwdCount > 0,
          countText: String(weakPwdCount),
          detailText: `极高风险: ${weakPwdCount}`,
          variant: "weak",
          iconClass: "el-icon-lock"
        },
        {
          key: "port_service",
          title: "端口服务",
          count: highRiskPortCount,
          clickable: highRiskPortCount > 0,
          countText: String(highRiskPortCount),
          detailText: `高危端口: ${highRiskPortCount}`,
          variant: "port",
          iconClass: "iconfont icon-xinhao"
        },
        {
          key: "other_port",
          title: "非高风险端口",
          count: otherPortCount,
          clickable: otherPortCount > 0,
          countText: String(otherPortCount),
          detailText: `非高风险端口: ${otherPortCount}`,
          variant: "other-port",
          iconClass: "el-icon-more-outline"
        }
      ];
    },
    /** 关键漏洞列表：从 pipelineCurrentTask 原始数据映射到弹框字段 */
    pipelineCriticalVulnItems() {
      const taskRow = this.pipelineCurrentTask || {};
      const vulnList = Array.isArray(taskRow.critical_vulns)
        ? taskRow.critical_vulns
        : [];
      return vulnList.map(vulnRow => ({
        id: vulnRow.id,
        title: vulnRow.vuln_name || "关键漏洞",
        severity: this.mapVulnLevelLabel(vulnRow.vuln_level),
        cvss: Number(vulnRow.risk_score) || 0,
        description: `编号：${vulnRow.vuln_number ||
          "-"}；影响资产：${vulnRow.affect_asset_ip ||
          "-"}；影响端口：${vulnRow.affect_port ||
          "-"}；风险类型：${vulnRow.risk_type || "-"}`,
        vuln_id: vulnRow.id,
        rawData: vulnRow
      }));
    },
    /** 弱口令列表：从 pipelineCurrentTask 原始数据映射到弹框字段 */
    pipelineWeakPwdItems() {
      const taskRow = this.pipelineCurrentTask || {};
      const weakPwdList = Array.isArray(taskRow.weak_pwd_vulns)
        ? taskRow.weak_pwd_vulns
        : [];
      return weakPwdList.map(weakPwdRow => ({
        id: weakPwdRow.id,
        title: weakPwdRow.vuln_name || "弱口令风险",
        port: weakPwdRow.affect_port || "-",
        account: weakPwdRow.affect_asset_ip || "-",
        description: `编号：${weakPwdRow.vuln_number ||
          "-"}；风险分：${weakPwdRow.risk_score || 0}`,
        rawData: weakPwdRow
      }));
    },
    /** 高危端口列表映射 */
    pipelineHighRiskPortItems() {
      return this.mapPortRowsToDialogItems(
        this.pipelineCurrentTask && this.pipelineCurrentTask.high_risk_ports,
        true
      );
    },
    /** 其他端口列表映射 */
    pipelineOtherPortItems() {
      return this.mapPortRowsToDialogItems(
        this.pipelineCurrentTask && this.pipelineCurrentTask.other_ports,
        false
      );
    },
    /** 端口详情弹框列表：按当前卡片分类返回对应数据 */
    pipelinePortDialogItems() {
      return this.currentRiskCategoryKey === "other_port"
        ? this.pipelineOtherPortItems
        : this.pipelineHighRiskPortItems;
    },
    /** 端口治理弹框标题：高危端口 / 非高危端口（与攻击面 RemediationDialog 一致） */
    pipelinePortRiskTitleLabel() {
      return this.currentRiskCategoryKey === "other_port"
        ? "非高危端口"
        : "高危端口";
    },
    /** 漏洞详情弹框内嵌邮件视图：仅当前弹框打开且上下文为漏洞 */
    vulnEmbeddedEmailContext() {
      if (!this.vulnRiskDisposeVisible || !this.disposeEmailNotifyContext) {
        return null;
      }
      return this.disposeEmailNotifyContext.category === "vuln"
        ? this.disposeEmailNotifyContext
        : null;
    },
    /** 弱口令详情弹框内嵌邮件视图 */
    weakEmbeddedEmailContext() {
      if (
        !this.weakPasswordRiskDisposeVisible ||
        !this.disposeEmailNotifyContext
      ) {
        return null;
      }
      return this.disposeEmailNotifyContext.category === "weak"
        ? this.disposeEmailNotifyContext
        : null;
    },
    /** 端口详情弹框内嵌邮件视图 */
    portEmbeddedEmailContext() {
      if (!this.portRiskDisposeVisible || !this.disposeEmailNotifyContext) {
        return null;
      }
      return this.disposeEmailNotifyContext.category === "port"
        ? this.disposeEmailNotifyContext
        : null;
    },
    /** 漏洞详情弹框内嵌服务收敛视图 */
    vulnEmbeddedConvergenceContext() {
      if (!this.vulnRiskDisposeVisible || !this.disposeConvergenceContext) {
        return null;
      }
      return this.disposeConvergenceContext.category === "vuln"
        ? this.disposeConvergenceContext
        : null;
    },
    weakEmbeddedConvergenceContext() {
      if (
        !this.weakPasswordRiskDisposeVisible ||
        !this.disposeConvergenceContext
      ) {
        return null;
      }
      return this.disposeConvergenceContext.category === "weak"
        ? this.disposeConvergenceContext
        : null;
    },
    portEmbeddedConvergenceContext() {
      if (!this.portRiskDisposeVisible || !this.disposeConvergenceContext) {
        return null;
      }
      return this.disposeConvergenceContext.category === "port"
        ? this.disposeConvergenceContext
        : null;
    }
  },
  watch: {
    vulnRiskDisposeVisible(visible) {
      if (!visible) {
        this.clearDisposeEmailContextForCategory("vuln");
        this.clearDisposeConvergenceContextForCategory("vuln");
      }
    },
    weakPasswordRiskDisposeVisible(visible) {
      if (!visible) {
        this.clearDisposeEmailContextForCategory("weak");
        this.clearDisposeConvergenceContextForCategory("weak");
      }
    },
    portRiskDisposeVisible(visible) {
      if (!visible) {
        this.clearDisposeEmailContextForCategory("port");
        this.clearDisposeConvergenceContextForCategory("port");
      }
    }
  },
  mounted() {
    this.loadSecurityOverviewFromApi();
  },
  methods: {
    /** 子组件 AI 问答区显隐，用于主布局 class */
    onWorkbenchAiQaPanelVisible(visible: boolean) {
      this.workbenchAiQaPanelVisible = !!visible;
    },
    /** 关闭对应风险弹框时清理内嵌邮件上下文，避免下次打开仍停留在通知页 */
    clearDisposeEmailContextForCategory(category: string) {
      if (
        this.disposeEmailNotifyContext &&
        this.disposeEmailNotifyContext.category === category
      ) {
        this.disposeEmailNotifyContext = null;
      }
    },
    /** 关闭风险弹框时清理内嵌收敛上下文 */
    clearDisposeConvergenceContextForCategory(category: string) {
      if (
        this.disposeConvergenceContext &&
        this.disposeConvergenceContext.category === category
      ) {
        this.disposeConvergenceContext = null;
      }
    },
    /** 拉取工作台顶部态势（与 DashboardIndex.getSecurityOverviewText 同源） */
    loadSecurityOverviewFromApi() {
      securityOverviewTextAPI()
        .then(({ data }) => {
          console.log("[workbench] securityOverviewTextAPI response:", data);
          this.securityOverview = data || {};
        })
        .catch(error => {
          console.error("[workbench] securityOverviewTextAPI error:", error);
          this.securityOverview = {};
        });
    },
    escapeHtml(str: string) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },
    /**
     * 三张态势卡片正文：取接口 text 中「：」后正文，关键词标签规则与 DashboardIndex.sectionContentHtml 一致。
     */
    postureCardBodyHtml(sectionKey: string) {
      const textBlock = this.securityOverview.text || {};
      const rawText = textBlock[sectionKey];
      const sectionTitleFallback = {
        attackSurface: "攻击面治理",
        riskAssessment: "风险评估",
        eventAndBaseline: "事件与基线"
      };
      if (!rawText || typeof rawText !== "string") {
        return `<span class="posture-api-fallback">${sectionTitleFallback[
          sectionKey
        ] || ""}暂无数据</span>`;
      }
      const colonIndex = rawText.indexOf("：");
      let bodyHtml = colonIndex >= 0 ? rawText.slice(colonIndex + 1) : rawText;
      bodyHtml = this.escapeHtml(bodyHtml.trim());
      const keywordTagList = [
        { label: "弱口令", type: "orange" },
        { label: "关键漏洞", type: "red" },
        { label: "漏洞利用风险", type: "red", display: "漏洞利用行为" },
        { label: "新增资产发现", type: "blue" },
        { label: "基线偏离", type: "orange" }
      ];
      for (const tagItem of keywordTagList) {
        const { label, type, display } = tagItem;
        if (!bodyHtml.includes(label)) continue;
        const displayText =
          display != null ? this.escapeHtml(display) : this.escapeHtml(label);
        const tagSpan = `<span class="tag-inline tag--${type}">${displayText}</span>`;
        bodyHtml = bodyHtml.split(label).join(tagSpan);
      }
      return bodyHtml;
    },
    /** 生成事件：由 WorkbenchPipelineAiStack 内已调用 createWorkOrderAPI，此处预留给父级刷新扩展 */
    handleWorkbenchGenerateEvent() {},
    /** 紧急风险「立即治理」：优先打开可点的端口服务风险卡 */
    handleWorkbenchGovernEmergency() {
      const portRiskCard = this.pipelineRiskInsightCards.find(
        card => card.key === "port_service" && card.clickable
      );
      if (portRiskCard) {
        this.handleRiskCardClick(portRiskCard);
        return;
      }
      const firstClickable = this.pipelineRiskInsightCards.find(
        card => card.clickable
      );
      if (firstClickable) {
        this.handleRiskCardClick(firstClickable);
        return;
      }
      if ((this as any).$message) {
        (this as any).$message.info("当前暂无可一键治理的风险项");
      }
    },
    /**
     * 刷新管道当前任务：委托子组件 loadDispositionWaterfall（与初始化共用同一次 todo/list 瀑布）
     */
    async loadPipelineCurrentTask() {
      await (this as any).$nextTick();
      const stack = (this.$refs as AnyRecord).pipelineAiStack as AnyRecord;
      if (!stack || typeof stack.loadDispositionWaterfall !== "function") {
        return;
      }
      await stack.loadDispositionWaterfall();
    },
    /** 子组件处置区加载完成后同步首条 todo 行，供左侧态势卡/风险洞察等使用 */
    handlePipelineTaskSync(rawRow) {
      this.pipelineCurrentTask = rawRow != null ? rawRow : null;
    },
    /** 挂起当前管道任务 */
    async handlePipelineTaskSuspend() {
      if (!this.pipelineCurrentTask || this.pipelineResolveSubmitting) return;
      const taskId = this.pipelineCurrentTask.task_id;
      this.pipelineResolveSubmitting = true;
      try {
        const response = await resolveTaskAPI({
          ids: [taskId],
          status: 2
        });
        if (response && response.code === 0) {
          if ((this as any).$message) {
            (this as any).$message.success("任务已挂起");
          }
          this.pipelineCurrentTask = null;

          await this.loadPipelineCurrentTask();
        } else if ((this as any).$message) {
          (this as any).$message.warning(
            (response && response.msg) || "挂起失败"
          );
        }
      } catch (error) {
        if ((this as any).$message) {
          (this as any).$message.error("挂起失败");
        }
      } finally {
        this.pipelineResolveSubmitting = false;
      }
    },
    /**
     * 执行当前管道任务：标记为已执行（resolve）
     */
    async handlePipelineTaskExecute() {
      if (!this.pipelineCurrentTask || this.pipelineResolveSubmitting) return;
      await this.submitPipelineTaskExecuted();
    },
    /**
     * 非关键漏洞类任务：标记为已执行（resolve 动作名若与后端不一致请改 action）
     */
    async submitPipelineTaskExecuted() {
      if (!this.pipelineCurrentTask || this.pipelineResolveSubmitting) return;
      const taskId = this.pipelineCurrentTask.id;
      this.pipelineResolveSubmitting = true;
      try {
        const response = await resolveTaskAPI({
          ids: [taskId],
          action: "executed"
        });
        if (response && response.code === 0) {
          if ((this as any).$message) {
            (this as any).$message.success("任务已执行");
          }
          this.pipelineCurrentTask = null;
          await this.loadPipelineCurrentTask();
        } else if ((this as any).$message) {
          (this as any).$message.warning(
            (response && response.msg) || "执行失败"
          );
        }
      } catch (error) {
        if ((this as any).$message) {
          (this as any).$message.error("执行失败");
        }
      } finally {
        this.pipelineResolveSubmitting = false;
      }
    },
    /** 头部「通知」占位，后续可对接消息中心 */
    handlePipelineDispositionNotify() {
      if ((this as any).$message) {
        (this as any).$message.info("已记录通知请求（可与消息中心对接）");
      }
    },
    /**
     * 组装报告数据（摘要来自当前任务；风险详情条目由业务后续接入真实数据）
     * @param {string} [optionalTitleSuffix] 标题后缀
     * @param {Object} [taskRowOverride] 子组件处置区传入的映射任务，缺省用 pipelineCurrentTask
     */
    buildDisposeReportPayload(
      optionalTitleSuffix?: string,
      taskRowOverride?: AnyRecord | null
    ) {
      const taskRow =
        taskRowOverride != null ? taskRowOverride : this.pipelineCurrentTask;
      let assetLine = "—";
      let riskScore = 754;
      if (taskRow) {
        if (taskRow._todoRaw != null) {
          const ip = taskRow.asset_ip || taskRow._todoRaw.task_key || "—";
          assetLine = ip;
          const score = Number(taskRow.risk_score);
          riskScore = Number.isFinite(score) ? score : 0;
        } else {
          assetLine = this.pipelineTaskAssetLine;
          riskScore = this.pipelineTaskRiskScore;
        }
      }
      const summaryText =
        taskRow && taskRow.content && String(taskRow.content).trim()
          ? String(taskRow.content)
              .trim()
              .slice(0, 500)
          : taskRow && taskRow.title && String(taskRow.title).trim()
          ? String(taskRow.title)
              .trim()
              .slice(0, 500)
          : "该资产存在多项风险，建议按报告条目逐项处置与验证。";
      const defaultTitle =
        assetLine !== "—"
          ? `${assetLine} - 综合安全风险分析报告`
          : "综合安全风险分析报告";
      const reportTitle = optionalTitleSuffix
        ? `${optionalTitleSuffix} - 安全风险分析报告`
        : defaultTitle;
      return {
        title: reportTitle,
        date: new Date().toLocaleString("zh-CN"),
        asset: assetLine,
        riskScore,
        summary: summaryText,
        items: []
      };
    },
    /** 「生成报告」：打开预览弹窗（可接收子组件传入的处置区任务） */
    handlePipelineDispositionGenerateReport(
      dispositionTaskFromChild?: AnyRecord | null
    ) {
      const fromWorkbenchStack =
        dispositionTaskFromChild != null &&
        typeof dispositionTaskFromChild === "object";
      const effectiveTask = fromWorkbenchStack
        ? dispositionTaskFromChild
        : this.pipelineCurrentTask;
      if (!effectiveTask) return;
      this.disposeReportData = this.buildDisposeReportPayload(
        undefined,
        fromWorkbenchStack ? dispositionTaskFromChild : undefined
      );
      this.disposeReportVisible = true;
    },
    /** 漏洞等级映射中文 */
    mapVulnLevelLabel(vulnLevelValue: number | string) {
      const levelNum = Number(vulnLevelValue);
      if (levelNum >= 10) return "严重";
      if (levelNum >= 7) return "高危";
      if (levelNum >= 4) return "中危";
      if (levelNum > 0) return "低危";
      return "未知";
    },
    /** 漏洞等级 → 端口弹框 vulns 行的 severity 文案（与 Workbench buildPortDisposeItems 一致） */
    mapVulnLevelToPortSeverity(rawLevel: number | string) {
      const levelText = this.mapVulnLevelLabel(rawLevel);
      if (levelText === "严重" || levelText === "高危") return "高危";
      if (levelText === "中危") return "中危";
      if (levelText === "低危") return "低危";
      return "中危";
    },
    /** 端口列表映射到端口详情弹框结构（含 vulns id，供 GetVulnInfo 展示等级） */
    mapPortRowsToDialogItems(
      portRows: AnyRecord[] | null | undefined,
      isHighRiskPort: boolean
    ) {
      const normalizedPortRows = Array.isArray(portRows) ? portRows : [];
      return normalizedPortRows.map(portRow => {
        const vulnRowsFromApi = Array.isArray(portRow.vulns)
          ? portRow.vulns
          : [];
        const vulns = vulnRowsFromApi
          .map(vulnRow => {
            if (!vulnRow || typeof vulnRow !== "object") return null;
            const rawId =
              vulnRow.id != null
                ? vulnRow.id
                : vulnRow.vuln_id != null
                ? vulnRow.vuln_id
                : null;
            const numId = rawId != null && rawId !== "" ? Number(rawId) : NaN;
            if (!Number.isFinite(numId) || numId <= 0) return null;
            return {
              id: numId,
              title: vulnRow.vuln_name || "关联漏洞",
              severity: this.mapVulnLevelToPortSeverity(vulnRow.vuln_level)
            };
          })
          .filter(Boolean);
        return {
          id: portRow.id,
          port: portRow.lan_port || portRow.port || "-",
          service: portRow.service || "未知服务",
          isHighRisk:
            isHighRiskPort || Number(portRow.is_high_risk) === 1 ? true : false,
          vulns,
          rawData: portRow
        };
      });
    },
    /** 获取四类风险原始数据，统一透传给后续子流程 */
    buildRiskRawDataPayload() {
      const taskRow = this.pipelineCurrentTask || {};
      return {
        critical_vulns: Array.isArray(taskRow.critical_vulns)
          ? taskRow.critical_vulns
          : [],
        weak_pwd_vulns: Array.isArray(taskRow.weak_pwd_vulns)
          ? taskRow.weak_pwd_vulns
          : [],
        high_risk_ports: Array.isArray(taskRow.high_risk_ports)
          ? taskRow.high_risk_ports
          : [],
        other_ports: Array.isArray(taskRow.other_ports)
          ? taskRow.other_ports
          : []
      };
    },
    /** 按当前分类获取对应的原始风险数组 */
    getRiskItemsByCategory(category: string) {
      const taskRow = this.pipelineCurrentTask || {};
      if (category === "vuln") {
        return Array.isArray(taskRow.critical_vulns)
          ? taskRow.critical_vulns
          : [];
      }
      if (category === "weak") {
        return Array.isArray(taskRow.weak_pwd_vulns)
          ? taskRow.weak_pwd_vulns
          : [];
      }
      if (category === "port") {
        const isOtherPort = this.currentRiskCategoryKey === "other_port";
        const portListKey = isOtherPort ? "other_ports" : "high_risk_ports";
        return Array.isArray(taskRow[portListKey]) ? taskRow[portListKey] : [];
      }
      return [];
    },
    /** 风险卡片点击：数量为 0 时不打开详情 */
    handleRiskCardClick(riskCard) {
      if (!riskCard || !riskCard.clickable) return;
      this.openRiskCategoryDialog(riskCard.key);
    },
    /** 点击底部风险卡：打开对应分类详情弹窗 */
    openRiskCategoryDialog(categoryKey) {
      const selectedRiskCard = this.pipelineRiskInsightCards.find(
        riskCard => riskCard.key === categoryKey
      );
      if (!selectedRiskCard || !selectedRiskCard.clickable) return;
      this.currentRiskCategoryKey = categoryKey;
      this.vulnRiskDisposeVisible = categoryKey === "critical_vuln";
      this.weakPasswordRiskDisposeVisible = categoryKey === "weak_password";
      this.portRiskDisposeVisible =
        categoryKey === "port_service" || categoryKey === "other_port";
    },
    /**
     * 风险详情内「通知」：打开公用邮件弹框（弱口令/端口或演示数据走演示发送；漏洞且具备资产 IP 与数值 vuln_id 时可走真实接口）
     */
    handleDisposeItemNotify(category, item) {
      this.disposeConvergenceContext = null;
      const assetIpRaw =
        this.pipelineCurrentTask && this.pipelineCurrentTask.asset_ip != null
          ? String(this.pipelineCurrentTask.asset_ip).trim()
          : "";
      const vulnIdRaw = item && (item.vuln_id != null ? item.vuln_id : item.id);
      const vulnIdNum =
        vulnIdRaw != null && vulnIdRaw !== "" ? Number(vulnIdRaw) : NaN;
      const hasRealVulnNumericId =
        category === "vuln" && Number.isFinite(vulnIdNum) && vulnIdNum > 0;
      const backendDisabled =
        category !== "vuln" || !hasRealVulnNumericId || !assetIpRaw;
      this.disposeEmailNotifyContext = {
        category,
        item,
        assetIp: assetIpRaw,
        backendDisabled
      };
    },
    /**
     * 风险详情内「收敛」：打开嵌套的 ServiceConvergencePanel
     */
    handleDisposeConvergenceOpen(category, item) {
      this.disposeEmailNotifyContext = null;
      const assetIp =
        this.pipelineCurrentTask && this.pipelineCurrentTask.asset_ip != null
          ? String(this.pipelineCurrentTask.asset_ip).trim()
          : "";
      const riskItems = this.getRiskItemsByCategory(category);
      const summaryParts = [];
      if (assetIp) summaryParts.push(assetIp);
      if (category === "vuln" && item && item.title)
        summaryParts.push(item.title);
      if (category === "weak" && item && item.title)
        summaryParts.push(item.title);
      if (category === "port" && item) {
        if (item.port != null) summaryParts.push(`端口 ${item.port}`);
        if (item.service) summaryParts.push(String(item.service));
      }
      this.disposeConvergenceContext = {
        category,
        item,
        assetIp,
        riskItems,
        assetSummary: summaryParts.length ? summaryParts.join(" · ") : "—"
      };
    },
    /** 从收敛视图返回风险列表 */
    handleDisposeConvergenceBack() {
      this.disposeConvergenceContext = null;
    },
    /**
     * 收敛视图「确认优化」：已通过面板校验源 IP，此处可对接接口
     */
    handleDisposeConvergenceConfirm(payload) {
      const sourceIp = payload && payload.sourceIp ? payload.sourceIp : "";
      const policyType =
        payload && payload.policyType
          ? payload.policyType
          : ""(this as any).$message.success(
              `已提交优化申请（${
                policyType === "host" ? "主机策略" : "旁路策略"
              } · 源 IP ${sourceIp}）`
            );
      this.disposeConvergenceContext = null;
    },
    /** 从邮件视图返回风险列表 */
    handleDisposeNotifyBack() {
      this.disposeEmailNotifyContext = null;
    },
    /** 邮件发送完成：退出邮件视图 */
    handleDisposeNotifySent() {
      this.disposeEmailNotifyContext = null;
    },
    /** 分类详情内「生成报告」：关闭分类弹窗并打开报告预览 */
    handleDisposeDetailDownloadReport(payload: AnyRecord) {
      this.vulnRiskDisposeVisible = false;
      this.weakPasswordRiskDisposeVisible = false;
      this.portRiskDisposeVisible = false;
      const titleSuffix =
        typeof payload === "string"
          ? payload
          : payload && payload.title != null
          ? String(payload.title)
          : "";
      this.disposeReportData = this.buildDisposeReportPayload(titleSuffix);
      this.disposeReportVisible = true;
    },
    /** 报告预览弹窗内「下载 HTML」 */
    downloadDisposeReportHtml() {
      const reportPayload = this.disposeReportData;
      if (!reportPayload) return;
      const escapeForHtml = text =>
        String(text ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      const itemsBlock = (reportPayload.items || [])
        .map((item, itemIndex) => {
          const name = escapeForHtml(item.name);
          const location = escapeForHtml(item.location);
          const level = escapeForHtml(item.level);
          const desc = escapeForHtml(item.desc);
          const remediation = escapeForHtml(item.remediation);
          return `
          <div style="margin-bottom:20px;border:1px solid #ede9fe;border-radius:12px;padding:16px;">
            <h3 style="margin:0 0 12px;font-size:15px;color:#1e1b4b;">${itemIndex +
              1}. ${name}</h3>
            <p style="font-size:12px;color:#6b7280;">${location} · ${level}</p>
            <p style="font-size:13px;line-height:1.6;color:#374151;">${desc}</p>
            <pre style="white-space:pre-wrap;font-size:13px;background:#ecfdf5;padding:12px;border-radius:8px;border:1px solid #a7f3d0;">${remediation}</pre>
          </div>`;
        })
        .join("");
      const htmlDocument = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${escapeForHtml(reportPayload.title)}</title>
</head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f6;padding:24px;">
  <div style="max-width:800px;margin:0 auto;background:#fff;padding:24px;border-radius:16px;">
    <h1 style="color:#111827;">${escapeForHtml(reportPayload.title)}</h1>
    <p style="color:#7c3aed;">生成时间: ${escapeForHtml(reportPayload.date)}</p>
    <p><strong>评估资产</strong> ${escapeForHtml(reportPayload.asset)}</p>
    <p><strong>综合风险评分</strong> ${escapeForHtml(
      String(reportPayload.riskScore)
    )} / 1000</p>
    <p style="line-height:1.6;">${escapeForHtml(reportPayload.summary)}</p>
    <h2 style="border-bottom:1px solid #ede9fe;padding-bottom:8px;">风险详情列表</h2>
    ${itemsBlock}
    <p style="text-align:center;font-size:12px;color:#9ca3af;">本报告由 AI 安全运营中心自动生成</p>
  </div>
</body>
</html>`;
      const blob = new Blob([htmlDocument], {
        type: "text/html;charset=utf-8"
      });
      const blobUrl = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement("a");
      const safeAsset = String(reportPayload.asset || "report").replace(
        /[^\w\u4e00-\u9fa5.-]/g,
        "_"
      );
      downloadAnchor.href = blobUrl;
      downloadAnchor.download = `安全报告_${safeAsset}.html`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(blobUrl);
      if ((this as any).$message) {
        (this as any).$message.success("已开始下载 HTML");
      }
    }
  }
});
</script>
<style lang="scss" scoped>
.workbench-v3-page {
  --wb-page-x: clamp(16px, 2vw, 28px);
  --wb-page-y: clamp(16px, 2.2vw, 36px);
  --wb-page-bottom: 120px;
  --wb-page-bottom-ai: 136px;
  --wb-card-radius: clamp(22px, 2vw, 34px);
  --wb-card-padding: clamp(18px, 1.6vw, 24px);
  --wb-gap: clamp(16px, 1.5vw, 22px);
  --wb-fs-caption: clamp(11px, 0.62vw, 13px);
  --wb-fs-body: clamp(12px, 0.72vw, 14px);
  --wb-fs-body-lg: clamp(13px, 0.86vw, 16px);
  --wb-fs-title: clamp(20px, 1.2vw, 26px);
  --wb-fs-display: clamp(34px, 2.6vw, 52px);
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  padding: var(--wb-page-y) var(--wb-page-x) var(--wb-page-bottom);
  background: radial-gradient(
      circle at top left,
      rgba(177, 132, 255, 0.12),
      transparent 28%
    ),
    linear-gradient(180deg, #fcfbfe 0%, #faf7fd 100%);
  animation: workbenchFadeIn 0.45s ease;
  transition: padding-bottom 0.25s ease;

  &--ai-open {
    padding-bottom: var(--wb-page-bottom-ai);
  }
}

@keyframes workbenchFadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.workbench-v3-inner {
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--wb-gap);
}

.ops-center-card,
.ops-lower-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--wb-card-radius);
  background: linear-gradient(180deg, #ffffff 0%, #fdfbff 100%);
  border: 1px solid #efe7fb;
  box-shadow: 0 20px 50px rgba(77, 37, 123, 0.08);
}

.ops-center-card {
  padding: var(--wb-card-padding);
  color: #1f2430;
}

.ops-center-card--ai-open,
.ops-lower-card--ai-open {
  box-shadow: 0 20px 50px rgba(77, 37, 123, 0.12);
}

.ops-center-bg-icon {
  position: absolute;
  top: 28px;
  right: 30px;
  pointer-events: none;
  opacity: 0.06;

  svg {
    width: clamp(180px, 18vw, 260px);
    height: clamp(180px, 18vw, 260px);
    color: #b58cff;
  }
}

.ops-center-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: clamp(18px, 2vw, 28px);
}

.ops-center-content > .pipeline-ai-stack {
  display: none;
}

.ops-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.ops-header-left {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.ops-header-icon {
  width: clamp(48px, 3vw, 58px);
  height: clamp(48px, 3vw, 58px);
  flex-shrink: 0;
  border-radius: clamp(14px, 1.2vw, 18px);
  background: linear-gradient(180deg, #fbf7ff 0%, #f5edff 100%);
  border: 1px solid #eadcff;
  box-shadow: 0 8px 20px rgba(159, 85, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ops-title {
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--wb-fs-title);
  line-height: 1.2;
  font-weight: 800;
  color: #1f2430;
  letter-spacing: -0.03em;
}

.ops-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: #f4ebff;
  border: 1px solid #eadcff;
  color: #9f55ff;
  font-size: 11px;
  font-weight: 700;
}

.ops-subtitle {
  margin: 0;
  font-size: var(--wb-fs-body);
  line-height: 1.6;
  color: #7d8597;
}

.ops-status-pill {
  min-height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  color: #9f55ff;
  font-size: var(--wb-fs-body);
  font-weight: 700;
  background: linear-gradient(180deg, #faf5ff 0%, #f4ebff 100%);
  border: 1px solid #eadcff;
  box-shadow: 0 8px 18px rgba(159, 85, 255, 0.08);
}

.ops-status-dot-wrap {
  position: relative;
  width: 8px;
  height: 8px;
  display: inline-flex;
  flex-shrink: 0;
}

.ops-status-dot-ping,
.ops-status-dot-solid {
  background: #9f55ff;
  border-radius: 50%;
}

.ops-status-dot-ping {
  position: absolute;
  inset: 0;
  opacity: 0.75;
  animation: statusPingRing 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.ops-status-dot-solid {
  position: relative;
  width: 8px;
  height: 8px;
}

@keyframes statusPingRing {
  75%,
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.posture-section {
  padding-bottom: clamp(18px, 1.8vw, 24px);
  border-bottom: 1px solid #f1e9fb;
}

.posture-grid {
  display: grid;
  grid-template-columns: minmax(260px, 1.05fr) minmax(0, 2fr);
  gap: clamp(18px, 2vw, 28px);
  align-items: stretch;
}

.posture-left {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
}

.posture-level-label {
  margin-bottom: 8px;
  font-size: var(--wb-fs-caption);
  color: #9f55ff;
}

.posture-level-value {
  font-size: var(--wb-fs-display);
  line-height: 1;
  font-weight: 800;
  color: #1f2430;

  .posture-level-desc {
    font-size: var(--wb-fs-body-lg);
    font-weight: 600;
    color: #8d95a7;
  }
}

.posture-stats {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.posture-stat {
  display: flex;
  align-items: center;
  gap: 12px;
}

.posture-stat-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;

  &--blue {
    color: #336dff;
    background: #eef4ff;
    border: 1px solid #dce8ff;
  }

  &--orange {
    color: #ff7d2d;
    background: #fff4ea;
    border: 1px solid #ffe1ca;
  }
}

.posture-stat-label {
  font-size: var(--wb-fs-caption);
  color: #9aa1b2;
}

.posture-stat-value {
  font-size: var(--wb-fs-body-lg);
  font-weight: 700;
  color: #1f2430;
}

.posture-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.posture-card {
  min-height: 140px;
  padding: clamp(14px, 1.4vw, 20px);
  border-radius: clamp(16px, 1.4vw, 22px);
  background: linear-gradient(180deg, #fff 0%, #fdfbff 100%);
  border: 1px solid #f2edf8;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 24px rgba(77, 37, 123, 0.08);
  }
}

.posture-card-head {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--wb-fs-body-lg);
  font-weight: 800;
  color: #1f2430;

  .iconfont {
    font-size: 16px;
    color: #9f55ff;
  }
}

.posture-card-desc {
  margin: 0;
  font-size: var(--wb-fs-body);
  line-height: 1.7;
  color: #7b8294;

  .text-orange {
    color: #ff7b42;
    font-weight: 700;
  }

  .text-rose {
    color: #ff335f;
    font-weight: 700;
  }

  .text-blue {
    color: #5184ff;
    font-weight: 700;
  }
}

.posture-card-desc--api {
  :deep(.tag-inline) {
    font-weight: 700;
  }

  :deep(.tag--red) {
    color: #ff335f;
  }

  :deep(.tag--orange) {
    color: #ff7b42;
  }

  :deep(.tag--blue) {
    color: #5184ff;
  }
}

.pipeline-ai-stack {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--wb-gap);
  min-height: 0;
}

.workbench-pipeline-ai-slot {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ops-lower-card {
  padding: var(--wb-card-padding);
}

// @media (max-width: 1200px) {
//   .posture-grid,
//   .posture-cards {
//     grid-template-columns: 1fr;
//   }
// }

@media (max-width: 768px) {
  .posture-grid,
  .posture-cards {
    grid-template-columns: 1fr;
  }
  .workbench-v3-page {
    --wb-page-x: 14px;
    --wb-page-y: 18px;
    --wb-page-bottom: 132px;
    --wb-page-bottom-ai: 146px;
    --wb-card-padding: 16px;
    --wb-card-radius: 24px;
    --wb-gap: 14px;
    --wb-fs-title: clamp(18px, 4.8vw, 22px);
    --wb-fs-display: clamp(30px, 10vw, 42px);
  }

  .ops-header {
    flex-direction: column;
    align-items: stretch;
  }

  .ops-header-left {
    gap: 12px;
  }

  .ops-status-pill {
    min-height: 38px;
    width: fit-content;
    max-width: 100%;
  }

  .ops-center-bg-icon {
    top: 18px;
    right: 18px;
  }

  .posture-card {
    min-height: 0;
  }
}

@media (max-height: 760px) {
  .workbench-v3-page {
    --wb-page-y: 14px;
    --wb-page-bottom: 110px;
    --wb-page-bottom-ai: 124px;
    --wb-card-padding: 16px;
    --wb-gap: 14px;
    --wb-fs-display: clamp(28px, 2.2vw, 40px);
  }

  .ops-center-content {
    gap: 18px;
  }

  .posture-section {
    padding-bottom: 16px;
  }

  .posture-left,
  .posture-stats,
  .posture-cards {
    gap: 14px;
  }

  .posture-card {
    min-height: 0;
  }
}
</style>
