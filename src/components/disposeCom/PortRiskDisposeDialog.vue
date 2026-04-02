<template>
  <!-- 高危端口治理弹框 -->
  <div>
    <el-dialog
      v-model="dialogVisible"
      :width="disposeDialogShellWidth"
      :custom-class="'dispose-risk-dialog dispose-risk-dialog--port dispose-workbench-shell'"
      append-to-body
      @close="handleClose"
    >
      <template #header>
        <div
          v-if="embeddedEmailContext || embeddedConvergenceContext"
          class="dispose-risk-dialog-title-row"
        >
          <el-button
            link
            class="dispose-risk-back-btn"
            :icon="ArrowLeft"
            @click="emitEmbeddedSubViewBack"
          >返回详情</el-button>
          <span class="dispose-risk-dialog-heading">
            {{
            embeddedSubViewTitle
            }}
          </span>
        </div>
        <span v-else>{{ portDialogTitleText }} 详情</span>
      </template>
      <div v-if="embeddedEmailContext" class="dispose-email-notify-panel-host">
        <DisposeEmailNotifyPanel
          :notify-context="embeddedEmailContext"
          embedded
          @sent="handleEmbeddedNotifySent"
        />
      </div>
      <div v-else-if="embeddedConvergenceContext" class="dispose-service-convergence-host">
        <ServiceConvergencePanel
          ref="convergencePanelRef"
          embedded
          :asset-summary="embeddedConvergenceContext.assetSummary"
          :convergence-context="embeddedConvergenceContext"
          @agent-installed-change="handleConvergenceAgentInstalledChange"
        />
      </div>
      <div v-else class="dispose-risk-dialog-body">
        <el-empty v-if="!displayList.length" description="暂无端口数据" :image-size="72" />
        <template v-else>
          <div
            v-for="(portItem, portIndex) in displayList"
            :key="'port-card-' + portIndex + '-' + String(portItem.id)"
            class="dispose-port-card"
          >
            <div class="dispose-port-card-head">
              <div class="dispose-port-card-head-main">
                <div class="dispose-port-title-row">
                  <h4 class="dispose-port-title">{{ portDialogTitleText }} {{ portItem.port }}</h4>
                  <el-tag
                    v-if="getPortConvergenceLabel(portItem) !== null"
                    size="small"
                    :type="
                    getPortConvergenceStatus(portItem) === 1 ? 'success' : 'info'
                  "
                    effect="plain"
                    class="dispose-port-convergence-tag"
                  >{{ getPortConvergenceLabel(portItem) }}</el-tag>
                </div>
                <div
                  v-if="shouldShowPortCardAssetSubtitle(portItem)"
                  class="dispose-risk-title-sub"
                >
                  <span v-if="getPortCardAssetIpText()" class="dispose-risk-title-sub-item">
                    <span class="dispose-risk-title-sub-k">资产 IP</span>
                    <span class="dispose-risk-title-sub-v">
                      {{
                      getPortCardAssetIpText()
                      }}
                    </span>
                  </span>
                  <span
                    v-if="getPortCardAssetIpText() && getPortCardServiceText(portItem)"
                    class="dispose-risk-title-sub-sep"
                  >•</span>
                  <span v-if="getPortCardServiceText(portItem)" class="dispose-risk-title-sub-item">
                    <span class="dispose-risk-title-sub-k">服务</span>
                    <span class="dispose-risk-title-sub-v">
                      {{
                      getPortCardServiceText(portItem)
                      }}
                    </span>
                  </span>
                </div>
              </div>
              <el-button link class="dispose-port-toggle" @click="toggleExpand(portItem.id)">
                {{ expandedIds.includes(portItem.id) ? '收起' : '详情' }}
                <el-icon>
                  <ArrowUp v-if="expandedIds.includes(portItem.id)" />
                  <ArrowRight v-else />
                </el-icon>
              </el-button>
            </div>
            <el-collapse-transition>
              <div v-show="expandedIds.includes(portItem.id)" class="dispose-port-expand">
                <div v-if="getPortCardProtocolText(portItem)" class="dispose-risk-meta">
                  <span class="dispose-risk-meta-item">
                    <span class="dispose-risk-meta-k">协议</span>
                    <span class="dispose-risk-meta-v">
                      {{
                      getPortCardProtocolText(portItem)
                      }}
                    </span>
                  </span>
                </div>
                <!-- 每条端口按 portItem.vulns 的漏洞 id 合并请求 GetVulnInfo，再按端口拆分展示 -->
                <div
                  v-if="shouldUseApiVulnListForPort(portItem)"
                  class="dispose-port-vuln-api-outer"
                >
                  <div class="dispose-port-vuln-api-head">
                    <span class="dispose-port-vuln-api-head-title">关联漏洞</span>
                    <el-tag
                      size="small"
                      type="warning"
                      effect="plain"
                    >共 {{ normalizePortItemVulnIds(portItem).length }} 个</el-tag>
                  </div>
                  <div
                    v-loading="portTaskVulnLoading"
                    class="dispose-port-vuln-api-wrap"
                    element-loading-text="加载关联漏洞..."
                  >
                    <el-card
                      v-for="vulnApiRow in getPortTaskVulnListForPort(
                      portItem,
                      portIndex
                    )"
                      :key="
                      'api-vuln-' +
                      String(portItem.id) +
                      '-' +
                      String(vulnApiRow.id)
                    "
                      shadow="never"
                      class="dispose-port-vuln-api-card"
                    >
                      <div class="dispose-port-vuln-api-card-body">
                        <span class="dispose-port-vuln-api-name">
                          {{
                          vulnApiRow.vuln_name || '—'
                          }}
                        </span>
                        <el-tag
                          size="small"
                          :type="getLevelTagType(vulnApiRow.vuln_level)"
                          effect="plain"
                        >{{ formatVerifyVulnLevel(vulnApiRow.vuln_level) }}</el-tag>
                      </div>
                    </el-card>
                    <div
                      v-if="
                      !portTaskVulnLoading &&
                      !getPortTaskVulnListForPort(portItem, portIndex)
                        .length &&
                      normalizePortItemVulnIds(portItem).length
                    "
                      class="dispose-port-empty"
                    >未查询到漏洞详情</div>
                  </div>
                </div>
                <template v-else>
                  <div
                    v-for="vulnRow in portItem.vulns || []"
                    :key="vulnRow.id"
                    class="dispose-port-vuln-row"
                  >
                    <span class="dispose-port-vuln-name">
                      {{
                      vulnRow.title
                      }}
                    </span>
                  </div>
                  <div
                    v-if="!(portItem.vulns && portItem.vulns.length)"
                    class="dispose-port-empty"
                  >暂无关联漏洞</div>
                </template>
                <div class="dispose-port-actions">
                  <el-button
                    size="small"
                    type="success"
                    plain
                    @click="emitConvergenceForItem(portItem)"
                  >收敛</el-button>
                  <el-button
                    size="small"
                    plain
                    :loading="!!verifyLoadingMap[portItem.id]"
                    @click="handlePortVerifyClick(portItem)"
                  >验证</el-button>
                  <el-tooltip
                    :disabled="!notifyEligibleDisabled"
                    :content="notifyEligibleReason"
                    placement="top"
                  >
                    <span class="dispose-risk-btn-tooltip-wrap">
                      <el-button
                        size="small"
                        type="primary"
                        plain
                        :disabled="notifyEligibleDisabled"
                        @click="emitNotifyForItem(portItem)"
                      >通知</el-button>
                    </span>
                  </el-tooltip>
                  <el-button size="small" type="primary" @click="emitDownloadReport(portItem)">生成报告</el-button>
                </div>
              </div>
            </el-collapse-transition>
          </div>
        </template>
      </div>
      <template #footer>
        <span v-if="embeddedEmailContext || embeddedConvergenceContext" class="dialog-footer">
          <el-button @click="emitEmbeddedSubViewBack">返回详情</el-button>
          <el-button
            v-if="embeddedConvergenceContext && convergenceAgentInstalled"
            type="primary"
            @click="handleConvergenceConfirmClick"
          >确认优化</el-button>
        </span>
        <span v-else class="dialog-footer">
          <el-button type="primary" @click="dialogVisible = false">关 闭</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog
      v-model="verifyDialogVisible"
      :title="verifyDialogTitle"
      width="880px"
      append-to-body
      :close-on-click-modal="false"
      :before-close="handleVerifyDialogBeforeClose"
      @close="handleVerifyDialogClose"
      class="ledger-unified-dialog"
    >
      <div class="port-verify-dialog">
        <div class="port-verify-progress">
          <div class="port-verify-progress__head">
            <span class="port-verify-progress__label">验证进度</span>
            <span class="port-verify-progress__status">{{ verifyStatusMsg || '准备中' }}</span>
          </div>
          <el-progress
            :percentage="verifyProgress"
            :stroke-width="14"
            :format="formatVerifyProgress"
          />
        </div>

        <div v-if="verifyResultReady" class="port-verify-result">
          <div
            v-if="verifyResultRows.length"
            class="port-verify-result__title"
          >验证结果（{{ verifyResultRows.length }}）</div>
          <div v-else class="port-verify-result__title">验证结果</div>
          <el-empty
            v-if="!verifyResultRows.length"
            :image-size="64"
            :description="verifyEmptyDescription"
          />
          <el-table
            v-else
            :data="verifyResultRows"
            stripe
            border
            max-height="420"
            class="table-class"
          >
            <el-table-column prop="name" label="漏洞名称" min-width="280" show-overflow-tooltip />
            <el-table-column prop="level" label="漏洞级别" width="120">
              <template #default="{ row }">
                <el-tag
                  size="small"
                  :type="getLevelTagType(row.level)"
                  effect="plain"
                >{{ formatVerifyVulnLevel(row.level) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="vulnStatus" label="漏洞状态" width="120">
              <template #default="{ row }">
                <span
                  :class="[
                    'verify-result-tag',
                    'verify-result-tag--status',
                    getVerifyVulnStatusClass(row.vulnStatus)
                  ]"
                >{{ formatVerifyVulnStatus(row.vulnStatus) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="advice" label="修复建议" min-width="220" show-overflow-tooltip />
            <!-- <el-table-column
              prop="desc"
              label="漏洞描述"
              min-width="260"
              show-overflow-tooltip
            />-->
          </el-table>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="requestCloseVerifyDialog">关闭</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
// @ts-nocheck
import { ArrowLeft } from "@element-plus/icons-vue";
import DisposeEmailNotifyPanel from "./DisposeEmailNotifyPanel.vue";
import ServiceConvergencePanel from "./ServiceConvergencePanel.vue";
import { GetVulnInfo } from "@/api/vuln";

export default {
  name: "PortRiskDisposeDialog",
  components: { ArrowLeft, DisposeEmailNotifyPanel, ServiceConvergencePanel },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    /** 工作台透传：当前 todo 原始对象（后续处置链路可直接使用） */
    taskRow: {
      type: Object,
      default: null
    },
    items: {
      type: Array,
      default: null
    },
    /** 弹框标题前缀（如攻击面「非高危端口」复用本组件时） */
    portRiskTitleLabel: {
      type: String,
      default: "高危端口"
    },
    embeddedEmailContext: {
      type: Object,
      default: null
    },
    embeddedConvergenceContext: {
      type: Object,
      default: null
    },
    sourceViewLabel: {
      type: String,
      default: ""
    }
  },
    emits: [
    'update:visible',
    'close',
    'download-report',
    'notify',
    'notify-back',
    'notify-sent',
    'convergence-open',
    'convergence-back',
    'convergence-confirm'
  ],
  data() {
    return {
      expandedIds: [],
      /** 收敛视图中 Agent 是否安装 */
      convergenceAgentInstalled: false,
      /** 端口维度验证请求中（key: portItem.id） */
      verifyLoadingMap: {},
      /** 各端口下标 → GetVulnInfo 返回的漏洞行（避免多条端口共用同一 id 时覆盖） */
      portTaskVulnListsByIndex: [],
      portTaskVulnLoading: false,
      /** 端口验证进度弹窗 */
      verifyDialogVisible: false,
      verifyDialogTitle: "端口验证",
      verifyPortText: "",
      verifyProgress: 0,
      verifyStatusMsg: "",
      verifyResultRows: [],
      verifyWebsocket: null,
      verifyRunning: false,
      verifyStoppedByUser: false,
      /** 合并同一轮内多次触发的 GetVulnInfo 调度 */
      vulnFetchDebounceTimer: null,
      /** 最近一次已成功拉取的漏洞 id 指纹（用于去重） */
      lastVulnFetchFingerprint: "",
      /** 当前进行中的请求对应的指纹 */
      vulnFetchInFlightFingerprint: ""
    };
  },
  computed: {
    dialogVisible: {
      get() {
        return this.visible;
      },
      set(value) {
        this.$emit("update:visible", value);
      }
    },
    displayList() {
      return Array.isArray(this.items) && this.items.length ? this.items : [];
    },
    portDialogTitleText() {
      const label = (this.portRiskTitleLabel || "").trim();
      return label || "高危端口";
    },
    embeddedSubViewTitle() {
      if (this.embeddedEmailContext) return "发送通知";
      if (this.embeddedConvergenceContext) return "服务收敛治理";
      return "";
    },
    disposeDialogShellWidth() {
      return this.embeddedConvergenceContext ? "960px" : "720px";
    },
    notifyEligibleDisabled() {
      const row = this.taskRow || {};
      const ids = Array.isArray(row.vuln_ids) ? row.vuln_ids : [];
      const fromTask = ids
        .map(item => (item != null && item !== "" ? Number(item) : NaN))
        .filter(num => Number.isFinite(num) && num > 0);
      if (fromTask.length > 0) return false;
      const list = Array.isArray(this.displayList) ? this.displayList : [];
      const fromPorts = list.some(portItem => {
        return this.normalizePortItemVulnIds(portItem).length > 0;
      });
      return !fromPorts;
    },
    notifyEligibleReason() {
      if (!this.notifyEligibleDisabled) return "";
      return "暂时无法进行通知操作（缺少漏洞ID）";
    },
    verifyResultReady() {
      return Number(this.verifyProgress) >= 100;
    },
    verifyEmptyDescription() {
      const statusMsg = String(this.verifyStatusMsg || "").trim();
      if (statusMsg.indexOf("已标记漏洞为缓解") > -1) {
        return statusMsg;
      }
      if (
        statusMsg.indexOf("扫描结束") > -1 ||
        statusMsg.indexOf("完成") > -1
      ) {
        return this.verifyPortText
          ? `${this.verifyPortText} 端口下未发现漏洞`
          : "未发现漏洞";
      }
      return this.verifyPortText
        ? `${this.verifyPortText} 端口下无漏洞`
        : "端口下无漏洞";
    }
  },
  watch: {
    visible(value) {
      if (!value) {
        this.clearVulnFetchDebounceTimer();
        this.expandedIds = [];
        this.convergenceAgentInstalled = false;
        this.verifyLoadingMap = {};
        this.portTaskVulnListsByIndex = [];
        this.portTaskVulnLoading = false;
        this.lastVulnFetchFingerprint = "";
        this.vulnFetchInFlightFingerprint = "";
        this.verifyDialogVisible = false;
        this.resetVerifyProgressState();
      } else {
        // 方法用途：弹框打开时默认仅展开第一条，其余收起
        const safeList = Array.isArray(this.displayList)
          ? this.displayList
          : [];
        const firstRow = safeList.length > 0 ? safeList[0] : null;
        const firstId = firstRow && firstRow.id != null ? firstRow.id : null;
        this.expandedIds = firstId != null && firstId !== "" ? [firstId] : [];
        // 与 taskRow 的 watch 合并为一次请求（见 scheduleFetchPortTaskVulnDetails）
        this.scheduleFetchPortTaskVulnDetails();
      }
    },
    /** 端口列表变化时重新拉取（与 items 同源，避免仅依赖 taskRow） */
    items: {
      deep: true,
      handler() {
        if (this.visible) {
          this.scheduleFetchPortTaskVulnDetails();
        }
      }
    }
  },
  beforeUnmount() {
    this.clearVulnFetchDebounceTimer();
  },
  methods: {
    /** 端口收敛状态：is_weaker 0 未收敛 1 已收敛（与 queryAssetPortInfoList 一致） */
    getPortConvergenceStatus(portItem) {
      const item = portItem || {};
      const raw =
        item.rawData && typeof item.rawData === "object" ? item.rawData : {};
      const valueRaw =
        item.is_weaker != null && item.is_weaker !== ""
          ? item.is_weaker
          : raw.is_weaker;
      if (valueRaw === null || valueRaw === undefined || valueRaw === "") {
        return null;
      }
      const num = Number(valueRaw);
      if (!Number.isFinite(num)) return null;
      return num === 1 ? 1 : 0;
    },
    /** 收敛状态文案：已收敛 / 未收敛 */
    getPortConvergenceLabel(portItem) {
      const status = this.getPortConvergenceStatus(portItem);
      if (status === null) return null;
      return status === 1 ? "已收敛" : "未收敛";
    },
    /** 是否展示资产 IP / 服务副标题行 */
    shouldShowPortCardAssetSubtitle(portItem) {
      const hasIp = this.getPortCardAssetIpText() !== "";
      const hasService = this.getPortCardServiceText(portItem) !== "";
      return hasIp || hasService;
    },
    /** 资产 IP：taskRow 与攻击面一致为资产维度，各卡共用 */
    getPortCardAssetIpText() {
      const row =
        this.taskRow && typeof this.taskRow === "object" ? this.taskRow : null;
      const ip = row && row.asset_ip != null ? String(row.asset_ip).trim() : "";
      return ip;
    },
    /** 当前端口服务文案（勿用 taskRow.service，多端口时仅为首条端口） */
    getPortCardServiceText(portItem) {
      const item = portItem || {};
      const serviceRaw =
        item.service != null ? String(item.service).trim() : "";
      if (serviceRaw === "" || serviceRaw === "—") {
        return "";
      }
      return serviceRaw;
    },
    /** 协议：与 RemediationDialog buildSurfaceTodoRowFromPortItem 一致 */
    getPortCardProtocolText(portItem) {
      const item = portItem || {};
      const raw =
        item.rawData && typeof item.rawData === "object" ? item.rawData : {};
      const serviceStr = this.getPortCardServiceText(portItem);
      const rawProtocol =
        raw.protocol != null && String(raw.protocol).trim() !== ""
          ? String(raw.protocol).trim()
          : "";
      if (!rawProtocol) return "";
      if (serviceStr && rawProtocol === serviceStr) return "";
      return rawProtocol;
    },
    /** 单端口下关联漏洞 id（兼容 vuln_id） */
    normalizePortItemVulnIds(portItem) {
      const vulnRows = (portItem && portItem.vulns) || [];
      return vulnRows
        .map(vulnRow => {
          if (!vulnRow || typeof vulnRow !== "object") return NaN;
          const rawId =
            vulnRow.id != null
              ? vulnRow.id
              : vulnRow.vuln_id != null
              ? vulnRow.vuln_id
              : null;
          return rawId != null && rawId !== "" ? Number(rawId) : NaN;
        })
        .filter(num => Number.isFinite(num) && num > 0);
    },
    /** 当前端口是否走 GetVulnInfo 展示等级 */
    shouldUseApiVulnListForPort(portItem) {
      return this.normalizePortItemVulnIds(portItem).length > 0;
    },
    /**
     * 当前端口对应的漏洞详情行（按下标取，避免多条端口 entry.id 重复导致覆盖）
     */
    getPortTaskVulnListForPort(portItem, portIndex) {
      const idx =
        typeof portIndex === "number" && portIndex >= 0 ? portIndex : -1;
      const lists = this.portTaskVulnListsByIndex;
      if (!Array.isArray(lists) || idx < 0 || idx >= lists.length) {
        return [];
      }
      const list = lists[idx];
      return Array.isArray(list) ? list : [];
    },
    /** 组装 GetVulnInfo 查询体（ids 为漏洞主键列表） */
    buildPortVulnListQueryPayload(ids) {
      return {
        ids,
        page: 1,
        size: 10000,
        vuln_name: "",
        has_poc: [],
        has_exp: [],
        affect_asset_ip: [],
        affect_port: [],
        vuln_level: [],
        vuln_status: [],
        risk_type: [""],
        is_verify: [],
        sort_field: "id",
        sort_order: "desc"
      };
    },
    /**
     * 方法用途：合并 visible / items 在同一事件循环内的多次触发，只发一次 GetVulnInfo
     */
    scheduleFetchPortTaskVulnDetails() {
      this.clearVulnFetchDebounceTimer();
      this.vulnFetchDebounceTimer = setTimeout(() => {
        this.vulnFetchDebounceTimer = null;
        this.fetchPortTaskVulnDetails();
      }, 0);
    },
    /** 清除合并调度的定时器 */
    clearVulnFetchDebounceTimer() {
      if (this.vulnFetchDebounceTimer != null) {
        clearTimeout(this.vulnFetchDebounceTimer);
        this.vulnFetchDebounceTimer = null;
      }
    },
    /**
     * 汇总所有端口 vuln id 一次 GetVulnInfo，再按端口下标写入 portTaskVulnListsByIndex
     */
    fetchPortTaskVulnDetails() {
      const list = Array.isArray(this.displayList) ? this.displayList : [];
      if (!this.visible) {
        this.portTaskVulnListsByIndex = [];
        this.lastVulnFetchFingerprint = "";
        return;
      }
      const mergedIds = [];
      const seen = new Set();
      list.forEach(portItem => {
        this.normalizePortItemVulnIds(portItem).forEach(vid => {
          if (!seen.has(vid)) {
            seen.add(vid);
            mergedIds.push(vid);
          }
        });
      });
      if (!mergedIds.length) {
        this.portTaskVulnListsByIndex = [];
        this.lastVulnFetchFingerprint = "";
        return;
      }
      const fingerprint = mergedIds
        .slice()
        .sort((a, b) => a - b)
        .join(",");
      const listsHasData =
        Array.isArray(this.portTaskVulnListsByIndex) &&
        this.portTaskVulnListsByIndex.length > 0 &&
        this.portTaskVulnListsByIndex.some(
          block => Array.isArray(block) && block.length > 0
        );
      if (fingerprint === this.lastVulnFetchFingerprint && listsHasData) {
        return;
      }
      if (
        this.portTaskVulnLoading &&
        fingerprint === this.vulnFetchInFlightFingerprint
      ) {
        return;
      }
      this.vulnFetchInFlightFingerprint = fingerprint;
      this.portTaskVulnLoading = true;
      const requestPayload = this.buildPortVulnListQueryPayload(mergedIds);
      GetVulnInfo(requestPayload)
        .then(responseData => {
          if (!responseData || responseData.code !== 0 || !responseData.data) {
            this.portTaskVulnListsByIndex = [];
            this.lastVulnFetchFingerprint = "";
            if (this.$message && responseData && responseData.msg) {
              this.$message.warning(responseData.msg);
            }
            return;
          }
          const dataBlock = responseData.data;
          const rawList = Array.isArray(dataBlock.data_vlun)
            ? dataBlock.data_vlun
            : [];
          const rowById = new Map();
          rawList.forEach(row => {
            if (row && row.id != null) {
              rowById.set(Number(row.id), row);
            }
          });
          const nextLists = list.map(portItem => {
            const idsForPort = this.normalizePortItemVulnIds(portItem);
            return idsForPort
              .map(vulnId => rowById.get(Number(vulnId)))
              .filter(Boolean);
          });
          this.portTaskVulnListsByIndex = nextLists;
          this.lastVulnFetchFingerprint = fingerprint;
        })
        .catch(() => {
          this.portTaskVulnListsByIndex = [];
          this.lastVulnFetchFingerprint = "";
          this.$message.error("关联漏洞列表加载失败");
        })
        .finally(() => {
          this.portTaskVulnLoading = false;
          this.vulnFetchInFlightFingerprint = "";
        });
    },
    /** 切换展开 */
    toggleExpand(itemId) {
      // 方法用途：切换端口详情展示
      const index = this.expandedIds.indexOf(itemId);
      if (index >= 0) {
        this.expandedIds.splice(index, 1);
      } else {
        this.expandedIds.push(itemId);
      }
    },
    handleClose() {
      this.$emit("close");
    },
    handleVerifyDialogClose() {
      this.resetVerifyProgressState();
    },
    isVerifyWsActive() {
      return (
        this.verifyRunning &&
        this.verifyWebsocket &&
        (this.verifyWebsocket.readyState === WebSocket.OPEN ||
          this.verifyWebsocket.readyState === WebSocket.CONNECTING)
      );
    },
    stopVerifyWsByUser() {
      this.verifyStoppedByUser = true;
      if (!this.verifyWebsocket) return;
      try {
        this.verifyWebsocket.close();
      } catch (error) {
        this.verifyRunning = false;
      }
    },
    confirmCloseVerifyDialog(onConfirm) {
      if (!this.isVerifyWsActive()) {
        onConfirm();
        return;
      }
      this.$confirm(
        "当前扫描进行中，关闭弹窗将停止本次扫描，是否继续关闭？",
        "提示",
        {
          confirmButtonText: "继续关闭",
          cancelButtonText: "取消",
          type: "warning"
        }
      )
        .then(() => {
          this.stopVerifyWsByUser();
          onConfirm();
        })
        .catch(() => {});
    },
    handleVerifyDialogBeforeClose(done) {
      this.confirmCloseVerifyDialog(() => done());
    },
    requestCloseVerifyDialog() {
      this.confirmCloseVerifyDialog(() => {
        this.verifyDialogVisible = false;
      });
    },
    resetVerifyProgressState() {
      this.verifyPortText = "";
      this.verifyProgress = 0;
      this.verifyStatusMsg = "";
      this.verifyResultRows = [];
    },
    formatVerifyProgress(percentage) {
      return Number(percentage) >= 100 ? "完成" : `${percentage}%`;
    },
    formatVerifyVulnLevel(level) {
      const levelMap = {
        0: "低危",
        1: "中危",
        2: "高危",
        3: "紧急",
        4: "关键"
      };
      const numericLevel = Number(level);
      if (Number.isFinite(numericLevel) && levelMap[numericLevel] != null) {
        return levelMap[numericLevel];
      }
      return level || "-";
    },
    getLevelTagType(level) {
      const text = String(this.formatVerifyVulnLevel(level) || "");
      if (text.includes("鍏抽敭") || text.includes("绱ф")) return "danger";
      if (text.includes("楂樺嵄")) return "warning";
      if (text.includes("涓嵄")) return "";
      return "info";
    },
    resolveVerifyVulnLevel(plugin, item) {
      if (
        plugin &&
        plugin.levelStr !== undefined &&
        plugin.levelStr !== null &&
        plugin.levelStr !== ""
      ) {
        return plugin.levelStr;
      }
      if (
        item &&
        item.vuln_level !== undefined &&
        item.vuln_level !== null &&
        item.vuln_level !== ""
      ) {
        return item.vuln_level;
      }
      if (
        item &&
        item.level !== undefined &&
        item.level !== null &&
        item.level !== ""
      ) {
        return item.level;
      }
      return "";
    },
    resolveVerifyVulnStatus(item) {
      if (
        item &&
        item.vuln_status !== undefined &&
        item.vuln_status !== null &&
        item.vuln_status !== ""
      ) {
        return item.vuln_status;
      }
      if (
        item &&
        item.vulnStatus !== undefined &&
        item.vulnStatus !== null &&
        item.vulnStatus !== ""
      ) {
        return item.vulnStatus;
      }
      if (
        item &&
        item.status !== undefined &&
        item.status !== null &&
        item.status !== ""
      ) {
        return item.status;
      }
      return "";
    },
    getVerifySeverityClass(severity) {
      if (severity === "关键" || severity === "紧急" || severity === "高危") {
        return "verify-result-tag--danger";
      }
      if (severity === "中危") return "verify-result-tag--warning";
      return "verify-result-tag--default";
    },
    formatVerifyVulnStatus(status) {
      const code = String(status == null ? "" : status).trim();
      if (code === "0") return "未修复";
      if (code === "1") return "已收敛";
      if (code === "2") return "忽略";
      if (code === "3") return "已修复";
      return "-";
    },
    getVerifyVulnStatusClass(status) {
      const code = String(status == null ? "" : status).trim();
      if (code === "0") return "verify-result-tag--danger";
      if (code === "1") return "verify-result-tag--warning";
      if (code === "2") return "verify-result-tag--muted";
      if (code === "3") return "verify-result-tag--success";
      return "verify-result-tag--default";
    },
    toVerifyResultRows(vulns) {
      const list = Array.isArray(vulns) ? vulns : [];
      return list.map((item, idx) => {
        const plugin = item && item.plugin ? item.plugin : {};
        return {
          id: item && item.id != null ? item.id : `verify-vuln-${idx}`,
          name:
            plugin.nameCN || item.vuln_name || item.name || item.title || "-",
          level: this.formatVerifyVulnLevel(
            this.resolveVerifyVulnLevel(plugin, item)
          ),
          vulnStatus: this.resolveVerifyVulnStatus(item),
          advice:
            plugin.adviceCN ||
            item.adviceCN ||
            item.suggestion ||
            item.repair_suggestion ||
            "-",
          desc: plugin.descCN || item.describe || item.desc || "-"
        };
      });
    },
    emitDownloadReport(portItem) {
      const item = portItem || {};
      const portLabel =
        item.port != null && item.port !== "" ? String(item.port) : "—";
      const titleText = `${this.portDialogTitleText} ${portLabel}`;
      const vulnIdList = this.collectVulnIdsForPortVerify(item);
      this.$emit("download-report", { title: titleText, vulnIds: vulnIdList });
    },
    /** 打开邮件通知 */
    emitNotifyForItem(portRow) {
      this.$emit("notify", portRow);
    },
    emitEmbeddedSubViewBack() {
      if (this.embeddedEmailContext) {
        this.$emit("notify-back");
      } else if (this.embeddedConvergenceContext) {
        this.convergenceAgentInstalled = false;
        this.$emit("convergence-back");
      }
    },
    emitConvergenceForItem(portRow) {
      this.$emit("convergence-open", portRow);
    },
    /** 收集当前端口卡片对应的漏洞 ID 列表（优先当前卡片 vulns，再兜底 taskRow.vuln_ids 工作台单端口） */
    collectVulnIdsForPortVerify(portItem) {
      // 方法用途：攻击面多端口时每条卡片自带 vulns；工作台单任务可仅透传 taskRow.vuln_ids
      const vulnRows = (portItem && portItem.vulns) || [];
      const fromPort = vulnRows
        .map(row => {
          if (!row || typeof row !== "object") return NaN;
          const rawId =
            row.id != null ? row.id : row.vuln_id != null ? row.vuln_id : null;
          return rawId != null && rawId !== "" ? Number(rawId) : NaN;
        })
        .filter(num => Number.isFinite(num) && num > 0);
      if (fromPort.length) return fromPort;
      const task =
        this.taskRow && typeof this.taskRow === "object" ? this.taskRow : null;
      if (task && Array.isArray(task.vuln_ids) && task.vuln_ids.length) {
        return task.vuln_ids
          .map(rawId => Number(rawId))
          .filter(num => Number.isFinite(num) && num > 0);
      }
      return [];
    },
    /** 将字符串/数组中的值标准化为去重列表（支持逗号、中文逗号、空白分隔） */
    normalizeCsvValues(rawValue) {
      if (rawValue == null || rawValue === "") return [];
      if (Array.isArray(rawValue)) {
        const flattened = [];
        rawValue.forEach(item => {
          flattened.push(...this.normalizeCsvValues(item));
        });
        return flattened;
      }
      if (typeof rawValue === "object") {
        const maybePortLike = [
          rawValue.lan_port,
          rawValue.port,
          rawValue.affect_port,
          rawValue.dst_port
        ];
        const flattened = [];
        maybePortLike.forEach(item => {
          flattened.push(...this.normalizeCsvValues(item));
        });
        return flattened;
      }
      return String(rawValue)
        .replace(/\[|\]/g, "")
        .split(/[,\uFF0C;\s]+/)
        .map(item => item.trim())
        .filter(Boolean);
    },
    /** 组装端口复测目标 IP（支持多值） */
    collectPortRetestTargets(portItem) {
      const task =
        this.taskRow && typeof this.taskRow === "object" ? this.taskRow : null;
      const rawCandidates = [
        task && task.asset_ip,
        portItem && portItem.asset_ip,
        portItem && portItem.affect_asset_ip,
        portItem &&
          portItem.rawData &&
          (portItem.rawData.asset_ip || portItem.rawData.affect_asset_ip)
      ];
      const merged = [];
      rawCandidates.forEach(raw => {
        merged.push(...this.normalizeCsvValues(raw));
      });
      return Array.from(new Set(merged));
    },
    /** 组装端口复测端口号（支持多值） */
    collectPortRetestPorts(portItem) {
      const task =
        this.taskRow && typeof this.taskRow === "object" ? this.taskRow : null;
      const rawCandidates = [
        portItem && portItem.port,
        task && task.port,
        portItem && portItem.affect_port,
        portItem &&
          portItem.rawData &&
          (portItem.rawData.port ||
            portItem.rawData.lan_port ||
            portItem.rawData.affect_port)
      ];
      const merged = [];
      rawCandidates.forEach(raw => {
        merged.push(...this.normalizeCsvValues(raw));
      });
      return Array.from(new Set(merged));
    },
    /** 构造 sysVulnRetest WebSocket 地址 */
    buildSysVulnRetestWsUrl() {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const isLocalDevHost =
        location.hostname === "localhost" || location.hostname === "127.0.0.1";
      const wsHost =
        process.env.NODE_ENV === "development" && isLocalDevHost
          ? process.env.VUE_APP_SYS_VULN_RETEST_WS_HOST || "10.10.20.130:8888"
          : location.host;
      return `${protocol}//${wsHost}/api/websocket/sysVulnRetest`;
    },
    /** 判断 sysVulnRetest 消息是否已完成 */
    isSysVulnRetestDone(message) {
      if (!message || typeof message !== "object") return false;
      const msgText = String(message.msg || "");
      return /完成|扫描结束|已标记漏洞为缓解|failed|error/i.test(msgText);
    },
    /** 通过 WebSocket 发送端口复测请求，持续回调进度并在完成时返回 */
    sendPortRetestWsRequest(payload, onProgress) {
      return new Promise((resolve, reject) => {
        let settled = false;
        let ws = null;
        this.verifyStoppedByUser = false;
        this.verifyRunning = true;
        const finish = (handler, value) => {
          if (settled) return;
          settled = true;
          if (ws) {
            ws.onopen = null;
            ws.onmessage = null;
            ws.onerror = null;
            ws.onclose = null;
            if (
              ws.readyState === WebSocket.OPEN ||
              ws.readyState === WebSocket.CONNECTING
            ) {
              ws.close();
            }
          }
          this.verifyWebsocket = null;
          this.verifyRunning = false;
          handler(value);
        };
        try {
          ws = new WebSocket(this.buildSysVulnRetestWsUrl());
          this.verifyWebsocket = ws;
          ws.onopen = () => {
            ws.send(JSON.stringify(payload));
          };
          ws.onmessage = event => {
            let parsed = null;
            try {
              parsed = JSON.parse(event.data);
            } catch (error) {
              parsed = { raw: event.data };
            }
            if (typeof onProgress === "function") onProgress(parsed);
            if (this.isSysVulnRetestDone(parsed)) {
              finish(resolve, parsed);
            }
          };
          ws.onerror = () => {
            finish(reject, new Error("ws error"));
          };
          ws.onclose = () => {
            if (!settled) finish(reject, new Error("ws closed"));
          };
        } catch (error) {
          finish(reject, error);
        }
      });
    },
    /** 高危端口：改为 WebSocket /api/websocket/sysVulnRetest 触发复测 */
    handlePortVerifyClick(portItem) {
      const loadingKey =
        portItem && portItem.id != null ? portItem.id : "verify-port-default";
      const targets = this.collectPortRetestTargets(portItem);
      const tcpPorts = this.collectPortRetestPorts(portItem);
      if (!targets.length) {
        this.$message.warning("当前端口缺少可验证的目标IP");
        return;
      }
      if (!tcpPorts.length) {
        this.$message.warning("当前端口缺少可验证的端口号");
        return;
      }
      const requestPayload = {
        options: {
          customPorts: true,
          scanPrinter: false,
          targets: targets.join(","),
          tcpPorts: tcpPorts.join(",")
        }
      };
      this.resetVerifyProgressState();
      this.verifyPortText = tcpPorts.join(",");
      this.verifyDialogTitle = `端口验证（${tcpPorts.join(",")}）`;
      this.verifyDialogVisible = true;
      this.verifyLoadingMap[loadingKey] = true;
      this.sendPortRetestWsRequest(requestPayload, responseData => {
        if (!responseData || typeof responseData !== "object") return;
        if (responseData.msg) this.verifyStatusMsg = String(responseData.msg);
        const process = Number(responseData.process);
        if (Number.isFinite(process)) {
          this.verifyProgress = Math.max(0, Math.min(100, process));
        }
        if (Array.isArray(responseData.vulns)) {
          this.verifyResultRows = this.toVerifyResultRows(responseData.vulns);
        }
      })
        .then(responseData => {
          if (
            this.verifyProgress < 100 &&
            responseData &&
            (Number(responseData.code) === 0 ||
              Number(responseData.process) >= 100)
          ) {
            this.verifyProgress = 100;
          }
          if (
            responseData &&
            responseData.code != null &&
            Number(responseData.code) === 0
          ) {
            this.$message.success(responseData.msg || "验证请求已提交");
          } else if (responseData && responseData.code != null) {
            this.$message.error(
              (responseData && responseData.msg) || "验证失败"
            );
          }
        })
        .catch(() => {
          if (this.verifyStoppedByUser) {
            this.$message.warning("已停止当前扫描");
            return;
          }
          this.$message.error("验证失败");
        })
        .finally(() => {
          this.verifyStoppedByUser = false;
          this.verifyLoadingMap[loadingKey] = false;
        });
    },
    handleConvergenceConfirmClick() {
      const panel = this.$refs.convergencePanelRef;
      if (!panel) return;
      // 方法用途：复用收敛面板内“两段式确认优化”交互（首次预览、二次下发）
      panel
        .submitHostConfirmOptimize()
        .then(result => {
          if (result && result.preview) return;
          this.$emit("convergence-confirm", result);
        })
        .catch(() => {});
    },
    /** 同步收敛面板 Agent 安装状态 */
    handleConvergenceAgentInstalledChange(installed) {
      this.convergenceAgentInstalled = !!installed;
    },
    handleEmbeddedNotifySent(payload) {
      this.$emit("notify-sent", payload);
    }
  }
};
</script>

<style lang="scss" scoped>
.dispose-risk-dialog-body {
  max-height: 60vh;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(245, 158, 11, 0.45) #e5e7eb;
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(245, 158, 11, 0.4);
    border-radius: 8px;
  }
}

.dispose-port-card {
  margin-bottom: 14px;
  border: 1px solid #fde68a;
  border-radius: 10px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06),
    0 4px 14px rgba(245, 158, 11, 0.1);
  border-left: 4px solid #f59e0b;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  &:last-child {
    margin-bottom: 0;
  }
  &:hover {
    border-color: #fcd34d;
    box-shadow: 0 4px 20px rgba(245, 158, 11, 0.14);
  }
}

.dispose-port-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
}

.dispose-port-card-head-main {
  flex: 1;
  min-width: 0;
}

.dispose-port-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.dispose-port-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #111827;
  line-height: 1.45;
}

.dispose-port-convergence-tag {
  flex-shrink: 0;
}

/* 仅展示真实数据：去掉演示 meta 标签区域 */
.dispose-port-meta {
  display: none;
}

.dispose-port-toggle {
  flex-shrink: 0;
  padding: 4px 0;
  color: #d97706 !important;
  font-weight: 700;
  font-size: 12px;
  &:hover {
    color: #b45309 !important;
  }
}

.dispose-port-expand {
  padding: 12px 18px 16px;
  border-top: 1px solid #f3f4f6;
  background: #f9fafb;
}

.dispose-risk-title-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  font-size: 12px;
  color: rgba(17, 24, 39, 0.6);
}

.dispose-risk-title-sub-item {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}

.dispose-risk-title-sub-k {
  color: rgba(17, 24, 39, 0.45);
}

.dispose-risk-title-sub-v {
  font-weight: 700;
  color: rgba(17, 24, 39, 0.9);
}

.dispose-risk-title-sub-sep {
  color: rgba(17, 24, 39, 0.18);
}

/* 复用关键漏洞弹框同款元信息样式 */
.dispose-risk-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-bottom: 10px;
  font-size: 12px;
  color: rgba(17, 24, 39, 0.7);
}

.dispose-risk-meta-item {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}

.dispose-risk-meta-k {
  color: rgba(17, 24, 39, 0.55);
}

.dispose-risk-meta-v {
  font-weight: 700;
  color: rgba(17, 24, 39, 0.92);
}

.dispose-port-vuln-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.dispose-port-vuln-name {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  flex: 1;
  min-width: 0;
}

.dispose-port-empty {
  font-size: 12px;
  color: #9ca3af;
  padding: 10px 0;
}

.dispose-port-vuln-api-outer {
  margin-bottom: 10px;
}

.dispose-port-vuln-api-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.dispose-port-vuln-api-head-title {
  font-size: 12px;
  font-weight: 700;
  color: #4b5563;
}

.dispose-port-vuln-api-wrap {
  min-height: 40px;
  max-height: min(240px, 38vh);
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(245, 158, 11, 0.45) #e5e7eb;
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(245, 158, 11, 0.4);
    border-radius: 8px;
  }
}

.dispose-port-vuln-api-card {
  margin-bottom: 10px;
  border-radius: 10px !important;
  border: 1px solid #e5e7eb !important;
  &:last-child {
    margin-bottom: 0;
  }
}

.dispose-port-vuln-api-card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dispose-port-vuln-api-name {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  flex: 1;
  min-width: 0;
  line-height: 1.45;
}

.dispose-port-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 8px;
}

.dispose-risk-dialog-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dispose-risk-back-btn {
  padding: 0 !important;
  color: #d97706 !important;
  font-weight: 700;
  &:hover {
    color: #b45309 !important;
  }
}

.dispose-risk-dialog-heading {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
}

.dispose-service-convergence-host {
  max-height: min(62vh, 680px);
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(124, 58, 237, 0.35) #e5e7eb;
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(124, 58, 237, 0.35);
    border-radius: 8px;
  }
}

.port-verify-dialog {
  .port-verify-progress {
    margin-bottom: 18px;
    padding: 12px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: #f8fafc;
  }

  .port-verify-progress__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    gap: 10px;
  }

  .port-verify-progress__label {
    font-size: 13px;
    font-weight: 700;
    color: #374151;
  }

  .port-verify-progress__status {
    font-size: 12px;
    color: #6b7280;
    max-width: 70%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .port-verify-result {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 12px;
    background: #fff;
  }

  .port-verify-result__title {
    font-size: 13px;
    font-weight: 700;
    color: #374151;
    margin-bottom: 10px;
  }

  .verify-result-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 58px;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 20px;
    font-weight: 600;
  }

  .verify-result-tag--danger {
    background: #fef0f0;
    color: #f56c6c;
  }

  .verify-result-tag--warning {
    background: #fdf6ec;
    color: #e6a23c;
  }

  .verify-result-tag--success {
    background: #f0f9eb;
    color: #67c23a;
  }

  .verify-result-tag--muted {
    background: #f4f4f5;
    color: #606266;
  }

  .verify-result-tag--default {
    background: #f4f4f5;
    color: #909399;
  }
}
</style>

<style lang="scss">
@import "./disposeDialogWorkbench.scss";

.dispose-risk-dialog--port.dispose-workbench-shell {
  .el-dialog__body {
    padding: 14px 20px 10px;
  }

  .dispose-port-meta .el-tag--warning.el-tag--plain {
    background: #fffbeb;
    border-color: #fde68a;
    color: #b45309;
    font-weight: 700;
  }

  .dispose-port-meta .dispose-port-count-tag.el-tag--info.el-tag--plain {
    background: #f8fafc;
    border-color: #e2e8f0;
    color: #475569;
    font-weight: 600;
  }

  .dispose-port-vuln-row .el-tag--danger.el-tag--plain {
    background: #fff1f2;
    border-color: #fecdd3;
    color: #be123c;
    font-weight: 700;
  }

  .dispose-port-vuln-row .el-tag--warning.el-tag--plain {
    background: #fffbeb;
    border-color: #fde68a;
    color: #b45309;
    font-weight: 700;
  }

  .dispose-port-actions .el-button--primary:not(.is-plain) {
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    border-color: #7c3aed;
    color: #fff;
  }
  .el-button {
    border-radius: 10px;
  }
}
</style>
