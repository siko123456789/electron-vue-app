<template>
  <el-dialog
    v-model="dialogVisible"
    :width="disposeDialogShellWidth"
    custom-class="dispose-risk-dialog dispose-risk-dialog--weak dispose-workbench-shell"
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
      <span v-else>弱口令 详情</span>
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
      <el-empty v-if="!weakCardRows.length" description="暂无弱口令数据" :image-size="72" />
      <template v-else>
        <div v-for="row in weakCardRows" :key="row.rowKey" class="dispose-weak-card">
          <div class="dispose-weak-card-head">
            <div class="dispose-weak-card-head-main">
              <h4 class="dispose-weak-title">
                {{
                row.weakItem.title ||
                (taskRow && row.weakIndex === 0 && taskRow.vuln_name) ||
                '弱口令风险'
                }}
              </h4>
            </div>
            <el-button link class="dispose-weak-toggle" @click="toggleExpand(row.expandKey)">
              {{ expandedIds.includes(row.expandKey) ? '收起' : '详情' }}
              <i
                :class="
                  expandedIds.includes(row.expandKey)
                    ? 'el-icon-arrow-up'
                    : 'el-icon-arrow-right'
                "
              ></i>
            </el-button>
          </div>
          <el-collapse-transition>
            <div v-show="expandedIds.includes(row.expandKey)" class="dispose-weak-expand">
              <div
                v-if="
                  getWeakItemAssetIp(row.weakItem, row.weakIndex) ||
                  getWeakItemPort(row.weakItem, row.weakIndex) ||
                  (row.weakIndex === 0 &&
                    taskRow &&
                    (taskRow.protocol ||
                      taskRow.task_create_time ||
                      taskRow.task_update_time))
                "
                class="dispose-risk-meta"
              >
                <span
                  v-if="getWeakItemAssetIp(row.weakItem, row.weakIndex)"
                  class="dispose-risk-meta-item"
                >
                  <span class="dispose-risk-meta-k">资产 IP</span>
                  <span class="dispose-risk-meta-v">
                    {{
                    getWeakItemAssetIp(row.weakItem, row.weakIndex)
                    }}
                  </span>
                </span>
                <span
                  v-if="getWeakItemPort(row.weakItem, row.weakIndex)"
                  class="dispose-risk-meta-item"
                >
                  <span class="dispose-risk-meta-k">端口</span>
                  <span class="dispose-risk-meta-v">
                    {{
                    getWeakItemPort(row.weakItem, row.weakIndex)
                    }}
                  </span>
                </span>
                <span
                  v-if="row.weakIndex === 0 && taskRow && taskRow.protocol"
                  class="dispose-risk-meta-item"
                >
                  <span class="dispose-risk-meta-k">协议</span>
                  <span class="dispose-risk-meta-v">
                    {{
                    taskRow.protocol
                    }}
                  </span>
                </span>
                <span
                  v-if="
                    row.weakIndex === 0 && taskRow && taskRow.task_create_time
                  "
                  class="dispose-risk-meta-item"
                >
                  <span class="dispose-risk-meta-k">创建</span>
                  <span class="dispose-risk-meta-v">
                    {{
                    taskRow.task_create_time
                    }}
                  </span>
                </span>
                <span
                  v-if="
                    row.weakIndex === 0 && taskRow && taskRow.task_update_time
                  "
                  class="dispose-risk-meta-item"
                >
                  <span class="dispose-risk-meta-k">更新</span>
                  <span class="dispose-risk-meta-v">
                    {{
                    taskRow.task_update_time
                    }}
                  </span>
                </span>
              </div>

              <div
                v-if="
                  row.credential.plainHint ||
                  row.credential.account ||
                  row.credential.password
                "
                class="dispose-weak-credential"
              >
                <div
                  v-if="row.credential.plainHint"
                  class="dispose-weak-credential-item dispose-weak-credential-item--full"
                >
                  <span class="dispose-weak-credential-k">凭证说明</span>
                  <code class="dispose-weak-credential-v">
                    {{
                    row.credential.plainHint
                    }}
                  </code>
                </div>
                <span v-if="row.credential.account" class="dispose-weak-credential-item">
                  <span class="dispose-weak-credential-k">账号</span>
                  <code class="dispose-weak-credential-v">
                    {{
                    row.credential.account
                    }}
                  </code>
                </span>
                <span v-if="row.credential.password" class="dispose-weak-credential-item">
                  <span class="dispose-weak-credential-k">密码</span>
                  <code class="dispose-weak-credential-v">
                    {{
                    row.credential.password
                    }}
                  </code>
                </span>
              </div>

              <div class="dispose-weak-actions">
                <el-button
                  size="small"
                  type="success"
                  plain
                  @click="emitConvergenceForItem(row.weakItem)"
                >收敛</el-button>
                <el-button
                  size="small"
                  plain
                  :loading="!!verifyLoadingMap[row.expandKey]"
                  @click="
                    handleWeakVerifyClick(
                      row.weakItem,
                      row.weakIndex,
                      row.expandKey
                    )
                  "
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
                      @click="emitNotifyForItem(row.weakItem)"
                    >通知</el-button>
                  </span>
                </el-tooltip>
                <el-button
                  size="small"
                  type="primary"
                  @click="emitDownloadReport(row.weakItem)"
                >生成报告</el-button>
              </div>
            </div>
          </el-collapse-transition>
        </div>
      </template>
    </div>
    <template #footer>
      <span
      v-if="embeddedEmailContext || embeddedConvergenceContext"
      class="dialog-footer"
    >
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
    <el-dialog
      v-model="verifyResultDialog.visible"
      width="520px"
      append-to-body
      title="验证结果"
      class="ledger-unified-dialog"
    >
      <div class="weak-verify-result">
        <div
          :class="[
            'weak-verify-result-banner',
            verifyResultDialog.success ? 'is-success' : 'is-fail'
          ]"
        >
          <i
            :class="
              verifyResultDialog.success
                ? 'el-icon-success'
                : 'el-icon-warning-outline'
            "
          ></i>
          <div class="weak-verify-result-banner-text">
            <div class="weak-verify-result-title">
              {{
                verifyResultDialog.success
                  ? '发现弱口令风险'
                  : '未发现弱口令风险'
              }}
            </div>
            <div class="weak-verify-result-subtitle">
              {{ verifyResultDialog.message || '验证完成' }}
            </div>
          </div>
        </div>
        <div v-if="verifyResultDialog.records.length" class="weak-verify-result-list">
          <div
            v-for="(record, recordIndex) in verifyResultDialog.records"
            :key="`weak-verify-record-${recordIndex}`"
            class="weak-verify-result-card"
          >
            <div class="weak-verify-result-card-head">
              <span class="weak-verify-result-card-title">验证目标 {{ recordIndex + 1 }}</span>
              <span
                :class="[
                  'weak-verify-result-pill',
                  record.does_tt_exist ? 'is-danger' : 'is-safe'
                ]"
              >{{ record.does_tt_exist ? '漏洞存在' : '漏洞不存在' }}</span>
            </div>
            <div class="weak-verify-result-grid">
              <div class="weak-verify-result-item">
                <span class="label">IP</span>
                <span class="value">{{ record.ip || '-' }}</span>
              </div>
              <div class="weak-verify-result-item">
                <span class="label">端口</span>
                <span class="value">
                  {{
                  record.port != null ? record.port : '-'
                  }}
                </span>
              </div>
              <div class="weak-verify-result-item">
                <span class="label">协议</span>
                <span class="value">{{ record.protocol || '-' }}</span>
              </div>
              <div class="weak-verify-result-item">
                <span class="label">端口状态</span>
                <span class="value">{{ record.status || '-' }}</span>
              </div>
              <div class="weak-verify-result-item">
                <span class="label">存活探测</span>
                <span class="value">{{
                  record.is_alive ? '存活' : '未存活'
                }}</span>
              </div>
              <div class="weak-verify-result-item">
                <span class="label">验证结论</span>
                <span class="value strong">
                  {{
                  record.does_tt_exist ? '存在弱口令风险' : '未发现弱口令风险'
                  }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
        <el-button
          type="primary"
          class="primary-class"
          @click="verifyResultDialog.visible = false"
        >知道了</el-button>
        </span>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script lang="ts">
// @ts-nocheck
import { ArrowLeft } from '@element-plus/icons-vue'
import DisposeEmailNotifyPanel from './DisposeEmailNotifyPanel.vue'
import ServiceConvergencePanel from './ServiceConvergencePanel.vue'
import { verifyBruteCredentialAPI } from '@/api/aiGovernance'

export default {
  name: "WeakPasswordRiskDisposeDialog",
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
  data() {
    return {
      expandedIds: [],
      /** 收敛视图中 Agent 是否安装 */
      convergenceAgentInstalled: false,
      /** 弱口令验证请求中（key: weakCardRows.expandKey） */
      verifyLoadingMap: {},
      verifyResultDialog: {
        visible: false,
        success: false,
        message: "",
        records: []
      }
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
      const fromItems = list.some(entry => {
        const vid =
          entry && entry.id != null && entry.id !== "" ? Number(entry.id) : NaN;
        return Number.isFinite(vid) && vid > 0;
      });
      return !fromItems;
    },
    notifyEligibleReason() {
      if (!this.notifyEligibleDisabled) return "";
      return "暂时无法进行通知操作（缺少漏洞ID）";
    },
    /**
     * 列表行数据：稳定 rowKey/expandKey（避免多条 id 重复）、预解析凭证减少模板重复计算
     */
    weakCardRows() {
      const list = Array.isArray(this.displayList) ? this.displayList : [];
      return list.map((weakItem, weakIndex) => {
        const expandKey = `weak-dispose-${weakIndex}-${
          weakItem && weakItem.id != null ? String(weakItem.id) : "na"
        }`;
        return {
          rowKey: expandKey,
          expandKey,
          weakItem,
          weakIndex,
          credential: this.parseWeakCredentialDisplay(
            this.getWeakDescribeForItem(weakItem, weakIndex)
          )
        };
      });
    }
  },
  watch: {
    visible(value) {
      if (!value) {
        this.expandedIds = [];
        this.convergenceAgentInstalled = false;
        this.verifyLoadingMap = {};
        this.verifyResultDialog = {
          visible: false,
          success: false,
          message: "",
          records: []
        };
      } else {
        // 方法用途：弹框打开时默认仅展开第一条（expandKey 与 v-for 一致）
        const rows = this.weakCardRows;
        this.expandedIds =
          rows.length > 0 && rows[0].expandKey ? [rows[0].expandKey] : [];
      }
    }
  },
  methods: {
    /** 单条弱口令对应的数据源：优先 rawData（攻击面/接口），否则条目自身（工作台） */
    getWeakRowData(weakItem) {
      if (
        weakItem &&
        weakItem.rawData &&
        typeof weakItem.rawData === "object"
      ) {
        return weakItem.rawData;
      }
      return weakItem || {};
    },
    /** 展示用资产 IP：支持 affect_asset_ip / asset_ip，首条可回落 taskRow */
    getWeakItemAssetIp(weakItem, weakIndex) {
      const src = this.getWeakRowData(weakItem);
      let ip =
        src.affect_asset_ip != null ? String(src.affect_asset_ip).trim() : "";
      if (!ip && src.asset_ip != null) ip = String(src.asset_ip).trim();
      if (
        !ip &&
        weakIndex === 0 &&
        this.taskRow &&
        this.taskRow.asset_ip != null
      ) {
        ip = String(this.taskRow.asset_ip).trim();
      }
      return ip;
    },
    /** 展示用端口：支持 affect_port / port，首条可回落 taskRow */
    getWeakItemPort(weakItem, weakIndex) {
      const src = this.getWeakRowData(weakItem);
      let port =
        src.affect_port != null && src.affect_port !== ""
          ? String(src.affect_port)
          : "";
      if (!port && src.port != null && src.port !== "") {
        port = String(src.port);
      }
      if (
        !port &&
        weakIndex === 0 &&
        this.taskRow &&
        this.taskRow.port != null &&
        this.taskRow.port !== ""
      ) {
        port = String(this.taskRow.port);
      }
      return port;
    },
    /** 用于解析账号密码的 describe 文案 */
    getWeakDescribeForItem(weakItem, weakIndex) {
      const src = this.getWeakRowData(weakItem);
      const fromSrc = src.describe != null ? String(src.describe).trim() : "";
      if (fromSrc) return fromSrc;
      const fromItem = (weakItem && weakItem.description
        ? String(weakItem.description)
        : ""
      ).trim();
      if (fromItem) return fromItem;
      /** 方法用途：工作台单条任务兜底，首条可回落 taskRow.describe */
      if (
        weakIndex === 0 &&
        this.taskRow &&
        this.taskRow.describe != null &&
        String(this.taskRow.describe).trim() !== ""
      ) {
        return String(this.taskRow.describe).trim();
      }
      return "";
    },
    /**
     * 解析 describe：含冒号按 账号:密码；无冒号整段作为「凭证说明」（如「空密码」）
     */
    parseWeakCredentialDisplay(describeText) {
      const trimmed = String(describeText || "").trim();
      if (!trimmed) {
        return { account: "", password: "", plainHint: "" };
      }
      const normalized = trimmed.replace(/：/g, ":");
      const colonIdx = normalized.indexOf(":");
      if (colonIdx < 0) {
        return { account: "", password: "", plainHint: normalized };
      }
      return {
        account: normalized.slice(0, colonIdx).trim(),
        password: normalized.slice(colonIdx + 1).trim(),
        plainHint: ""
      };
    },
    /** 提取弱口令协议：优先条目 protocol，其次首条回落 taskRow.protocol */
    getWeakItemProtocol(weakItem, weakIndex) {
      const src = this.getWeakRowData(weakItem);
      let protocol = src.protocol != null ? String(src.protocol).trim() : "";
      if (
        !protocol &&
        weakIndex === 0 &&
        this.taskRow &&
        this.taskRow.protocol != null
      ) {
        protocol = String(this.taskRow.protocol).trim();
      }
      return protocol;
    },
    /**
     * 运营中心列表常不返回 protocol；按漏洞名称推断，最后默认 tcp（弱口令扫描多为 TCP 服务）
     */
    resolveWeakVerifyProtocol (weakItem, weakIndex) {
      const direct = this.getWeakItemProtocol(weakItem, weakIndex)
      if (direct) return direct
      const src = this.getWeakRowData(weakItem)
      const name = String(
        (src && src.vuln_name) || (weakItem && weakItem.title) || ''
      )
        .toUpperCase()
        .trim()
      if (!name) return 'tcp'
      if (name.includes('SSH')) return 'tcp'
      if (name.includes('REDIS')) return 'tcp'
      if (name.includes('TELNET')) return 'tcp'
      if (name.includes('DOCKER')) return 'tcp'
      if (name.includes('JENKINS')) return 'tcp'
      if (name.includes('RABBIT')) return 'tcp'
      if (name.includes('NACOS')) return 'tcp'
      if (name.includes('CASSANDRA')) return 'tcp'
      if (name.includes('PHPMYADMIN') || name.includes('MYSQL')) return 'tcp'
      if (name.includes('GRAFANA')) return 'tcp'
      if (name.includes('HTTP') || name.includes('HTTPS')) return 'tcp'
      return 'tcp'
    },
    /**
     * 组装弱口令验证参数：仅传 verifyBruteCredential 所需字段（与治理中心批量验证一致）
     * 必填：ip、port(number)、protocol；可选：username、password（describe 解析成功时）
     */
    buildWeakVerifyPayload (weakItem, weakIndex) {
      const ip = this.getWeakItemAssetIp(weakItem, weakIndex)
      const port = this.getWeakItemPort(weakItem, weakIndex)
      const protocol = this.resolveWeakVerifyProtocol(weakItem, weakIndex)
      const describeText = this.getWeakDescribeForItem(weakItem, weakIndex)
      const credential = this.parseWeakCredentialDisplay(describeText)
      if (!ip || !port) {
        return null
      }
      const portNum = Number(port)
      if (!Number.isFinite(portNum)) {
        return null
      }
      const payload = {
        ip: String(ip).trim(),
        port: portNum,
        protocol: String(protocol).trim()
      }
      if (credential.account && credential.password) {
        payload.username = String(credential.account).trim();
        payload.password = String(credential.password).trim();
      }
      return payload;
    },
    /** 弱口令验证：调用 verifyBruteCredentialAPI */
    normalizeWeakVerifyRecords(responseData) {
      const list = Array.isArray(responseData && responseData.data)
        ? responseData.data
        : responseData &&
          responseData.data &&
          typeof responseData.data === 'object'
        ? [responseData.data]
        : []
      return list.map(item => ({
        ip: (item && item.ip) || (item && item.asset_ip) ? String((item && item.ip) || (item && item.asset_ip)) : '',
        port: item && item.port != null ? item.port : '',
        protocol: item && item.protocol ? String(item.protocol) : '',
        status: item && item.status ? String(item.status) : '',
        is_alive: !!(item && item.is_alive),
        does_tt_exist: !!(item && item.does_tt_exist)
      }));
    },
    openWeakVerifyResultDialog(responseData) {
      const records = this.normalizeWeakVerifyRecords(responseData);
      const success = records.some(item => item.does_tt_exist);
      this.verifyResultDialog = {
        visible: true,
        success,
        message:
          responseData && responseData.msg
            ? String(responseData.msg).trim()
            : "验证完成",
        records
      };
    },
    handleWeakVerifyClick(weakItem, weakIndex, expandKey) {
      const loadingKey = expandKey || `weak-verify-${weakIndex}`;
      if (this.verifyLoadingMap[loadingKey]) return;
      const payload = this.buildWeakVerifyPayload(weakItem, weakIndex);
      if (!payload) {
        this.$message.warning(
          '当前弱口令缺少验证参数（资产 IP / 端口），无法执行验证'
        )
        return
      }
      this.verifyLoadingMap[loadingKey] = true;
      verifyBruteCredentialAPI([payload])
        .then(responseData => {
          if (responseData && responseData.code === 0) {
            const baseMsg =
              responseData.msg != null && String(responseData.msg).trim()
                ? String(responseData.msg).trim()
                : "验证完成";
            const records = this.normalizeWeakVerifyRecords(responseData);
            const successFlag = records.length
              ? records.some(item => item.does_tt_exist)
              : responseData.data &&
                typeof responseData.data === "object" &&
                responseData.data.success != null
              ? !!responseData.data.success
              : null
            const resultText =
              successFlag == null ? '' : successFlag ? '漏洞存在' : '漏洞不存在'
            this.$message.success(
              resultText ? `${baseMsg}:${resultText}` : baseMsg
            );
            this.openWeakVerifyResultDialog(responseData);
          } else {
            this.$message.error(
              (responseData && responseData.msg) || "验证失败"
            );
          }
        })
        .catch(() => {
          this.$message.error("验证失败");
        })
        .finally(() => {
          this.verifyLoadingMap[loadingKey] = false;
        });
    },
    /** 切换展开（参数为 weakCardRows 的 expandKey） */
    toggleExpand(expandKey) {
      const index = this.expandedIds.indexOf(expandKey);
      if (index >= 0) {
        this.expandedIds.splice(index, 1);
      } else {
        this.expandedIds.push(expandKey);
      }
    },
    handleClose() {
      this.$emit("close");
    },
    emitDownloadReport(weakItem) {
      const row = weakItem || {};
      const titleText =
        row.title != null && String(row.title).trim()
          ? String(row.title).trim()
          : "弱口令风险";
      const raw =
        (row.rawData && typeof row.rawData === "object" && row.rawData) || row;
      const idRaw = raw.id != null ? raw.id : row.id != null ? row.id : null;
      const idNum = idRaw != null && idRaw !== "" ? Number(idRaw) : NaN;
      const vulnIds = Number.isFinite(idNum) && idNum > 0 ? [idNum] : [];
      this.$emit("download-report", { title: titleText, vulnIds });
    },
    /** 打开邮件通知 */
    emitNotifyForItem(weakRow) {
      this.$emit("notify", weakRow);
    },
    emitEmbeddedSubViewBack() {
      if (this.embeddedEmailContext) {
        this.$emit("notify-back");
      } else if (this.embeddedConvergenceContext) {
        this.convergenceAgentInstalled = false;
        this.$emit("convergence-back");
      }
    },
    emitConvergenceForItem(weakRow) {
      this.$emit("convergence-open", weakRow);
    },
    handleConvergenceConfirmClick () {
      const panel = this.$refs.convergencePanelRef
      if (!panel) return
      // 方法用途：复用收敛面板内“两段式确认优化”交互（首次预览、二次下发）
      panel
        .submitHostConfirmOptimize()
        .then(result => {
          if (result && result.preview) return
          this.$emit('convergence-confirm', result)
        })
        .catch(() => {})
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
  scrollbar-color: rgba(124, 58, 237, 0.35) #e5e7eb;
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(124, 58, 237, 0.35);
    border-radius: 8px;
  }
}

.dispose-weak-card {
  margin-bottom: 14px;
  border: 1px solid #ddd6fe;
  border-radius: 10px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06),
    0 4px 14px rgba(124, 58, 237, 0.08);
  border-left: 4px solid #7c3aed;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  &:last-child {
    margin-bottom: 0;
  }
  &:hover {
    border-color: #c4b5fd;
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.12);
  }
}

.dispose-weak-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
}

.dispose-weak-card-head-main {
  flex: 1;
  min-width: 0;
}

.dispose-weak-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 800;
  color: #111827;
  line-height: 1.45;
}

/* 演示标签区域若存在则隐藏；详情/收起需保留展示 */
.dispose-weak-tags {
  display: none;
}

.dispose-weak-toggle {
  flex-shrink: 0;
  padding: 4px 0 4px 8px !important;
  font-weight: 700;
  color: #7c3aed !important;

  &:hover {
    color: #5b21b6 !important;
  }
}

.dispose-weak-expand {
  padding: 10px 18px 16px;
  border-top: 1px solid #f3f4f6;
  background: #f9fafb;
}

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

.dispose-weak-credential {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  margin: 4px 0 12px;
}

.dispose-weak-credential-item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.dispose-weak-credential-item--full {
  flex-basis: 100%;
  align-items: flex-start;
}

.dispose-weak-credential-k {
  font-size: 12px;
  color: rgba(17, 24, 39, 0.55);
}

.dispose-weak-credential-v {
  padding: 4px 10px;
  background: rgba(255, 241, 242, 0.75);
  border-radius: 8px;
  border: 1px solid rgba(254, 205, 211, 0.9);
  color: #be123c;
  font-size: 12px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
}

.dispose-weak-desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.75;
  color: #374151;
}

.dispose-weak-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}

.dispose-risk-dialog-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dispose-risk-back-btn {
  padding: 0 !important;
  color: #7c3aed !important;
  font-weight: 700;
  &:hover {
    color: #5b21b6 !important;
  }
}

.dispose-risk-dialog-heading {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
}

.weak-verify-result {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.weak-verify-result-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 14px;
  border: 1px solid transparent;
}

.weak-verify-result-banner i {
  font-size: 26px;
}

.weak-verify-result-banner.is-success {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #be123c;
}

.weak-verify-result-banner.is-fail {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #475569;
}

.weak-verify-result-title {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
}

.weak-verify-result-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.weak-verify-result-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.weak-verify-result-card {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 16px 18px;
  background: #fff;
}

.weak-verify-result-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.weak-verify-result-card-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.weak-verify-result-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.weak-verify-result-pill.is-danger {
  background: #fff1f2;
  color: #be123c;
}

.weak-verify-result-pill.is-safe {
  background: #ecfeff;
  color: #0f766e;
}

.weak-verify-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}

.weak-verify-result-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.weak-verify-result-item .label {
  font-size: 12px;
  color: #64748b;
}

.weak-verify-result-item .value {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  word-break: break-word;
}

.weak-verify-result-item .value.strong {
  color: #7c3aed;
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
</style>

<style lang="scss">
@import "./disposeDialogWorkbench.scss";

.dispose-risk-dialog--weak.dispose-workbench-shell {
  .el-dialog__body {
    padding: 14px 20px 10px;
  }

  .dispose-weak-tags .el-tag--primary.el-tag--plain {
    background: #f5f3ff;
    border-color: #ddd6fe;
    color: #6d28d9;
    font-weight: 600;
  }

  .dispose-weak-tags .el-tag--danger.el-tag--plain {
    background: #fff1f2;
    border-color: #fecdd3;
    color: #be123c;
    font-weight: 700;
  }

  .dispose-weak-actions .el-button--primary:not(.is-plain) {
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    border-color: #7c3aed;
    color: #fff;
  }
}

</style>
