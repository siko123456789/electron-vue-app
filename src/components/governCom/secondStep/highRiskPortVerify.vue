<template>
  <!-- 高危端口验证结果区 -->
  <div class="high-risk-port-verify">
    <p v-if="verifyTargetText" class="high-risk-port-verify__intro">
      当前验证目标：{{ verifyTargetText }}
    </p>

    <div class="high-risk-port-verify__body">
      <LedgerLoading
        :visible="connecting"
        text="正在连接验证服务..."
      />

      <!-- 验证进度 -->
      <div
        v-if="showProgressPanel"
        class="high-risk-port-verify__progress-panel"
      >
        <div class="high-risk-port-verify__progress-head">
          <span class="high-risk-port-verify__progress-title">验证进度</span>
          <div class="high-risk-port-verify__progress-status">
            <span class="high-risk-port-verify__progress-msg">
              {{ scanMsg || '等待扫描响应...' }}
            </span>
            <span
              v-if="scanProgress >= 100"
              class="high-risk-port-verify__progress-done"
            >
              完成
            </span>
          </div>
        </div>

        <div class="high-risk-port-verify__progress-bar">
          <div
            class="high-risk-port-verify__progress-inner"
            :style="{ width: `${scanProgress}%` }"
          />
        </div>

        <p class="high-risk-port-verify__progress-tip">
          扫描进度 {{ scanProgress }}%
        </p>
      </div>

      <!-- 验证结果表格 -->
      <div
        v-if="showResultPanel"
        class="high-risk-port-verify__result-panel"
      >
        <div class="high-risk-port-verify__result-title">
          验证结果（{{ vulnResultList.length }}）
        </div>

        <el-table
          :data="vulnResultList"
          border
          stripe
          max-height="420"
          class="high-risk-port-verify__result-table"
        >
          <el-table-column
            prop="vuln_name"
            label="漏洞名称"
            min-width="280"
            show-overflow-tooltip
          />
          <el-table-column label="漏洞级别" width="120" align="center">
            <template #default="scope">
              <RiskLevel :level="scope.row.vuln_level" />
            </template>
          </el-table-column>
          <el-table-column label="漏洞状态" width="100" align="center">
            <template #default="scope">
              <RiskStatusBadge :status="scope.row.vuln_status" />
            </template>
          </el-table-column>
          <el-table-column
            label="修复建议"
            min-width="160"
            show-overflow-tooltip
          >
            <template #default="scope">
              {{ getRepairSuggestionText(scope.row) }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 扫描完成但无漏洞 -->
      <div
        v-else-if="showEmptyResult"
        class="ledger-table-empty-icon"
      >
        <i class="iconfont icon-kongzhuangtai"></i>
        <span>扫描完成，未发现漏洞</span>
      </div>

      <!-- 连接异常 -->
      <div
        v-else-if="showErrorResult"
        class="ledger-table-empty-icon"
      >
        <i class="iconfont icon-kongzhuangtai"></i>
        <span>{{ errorMessage || '验证失败' }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { buildWebSocketUrl } from '@/utils/webSocketUrl'
import { ElMessageBox } from 'element-plus'

import LedgerLoading from '@/components/ledgerLoading.vue'
import RiskLevel from '@/components/RiskLevel.vue'
import RiskStatusBadge from '@/components/RiskStatusBadge.vue'

export default {
  name: 'HighRiskPortVerify',
  components: { LedgerLoading, RiskLevel, RiskStatusBadge },
  props: {
    // 验证上下文：portItem 包含 asset_ip、port
    verifyContext: {
      type: Object,
      default: () => ({})
    }
  },
  data () {
    return {
      connecting: false,
      scanning: false,
      scanMsg: '',
      scanProgress: 0,
      vulnResultList: [],
      errorMessage: '',
      verifySocket: null,
      lastBootstrapKey: ''
    }
  },
  computed: {
    // 当前端口任务
    currentPortItem () {
      const context =
        this.verifyContext && typeof this.verifyContext === 'object'
          ? this.verifyContext
          : {}
      return context.portItem && typeof context.portItem === 'object'
        ? context.portItem
        : {}
    },
    // 验证目标展示文案
    verifyTargetText () {
      const assetIp = String(this.currentPortItem.asset_ip || '').trim()
      const portText = String(this.currentPortItem.port || '').trim()
      if (assetIp && portText) {
        return `${assetIp}:${portText}`
      }
      return assetIp || portText || ''
    },
    // 是否展示进度面板
    showProgressPanel () {
      return (
        !this.showErrorResult &&
        (this.connecting ||
          this.scanning ||
          this.scanProgress > 0 ||
          !!this.scanMsg)
      )
    },
    // 是否展示结果表格
    showResultPanel () {
      return (
        this.scanProgress >= 100 &&
        Array.isArray(this.vulnResultList) &&
        this.vulnResultList.length > 0
      )
    },
    // 扫描完成且无漏洞
    showEmptyResult () {
      return (
        this.scanProgress >= 100 &&
        !this.errorMessage &&
        (!this.vulnResultList || !this.vulnResultList.length)
      )
    },
    // 是否展示错误态
    showErrorResult () {
      return !!this.errorMessage && !this.scanning && !this.connecting
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
    this.closeVerifyWebSocket()
  },
  methods: {
    // 构建 WebSocket 连接地址
    buildVerifyWebSocketUrl () {
      return buildWebSocketUrl('websocket/sysVulnRetest')
    },
    // 获取修复建议展示文案
    getRepairSuggestionText (vulnItem = {}) {
      const suggestionText = String(
        vulnItem.solution || vulnItem.mitigation_measures || ''
      ).trim()
      return suggestionText || '-'
    },
    // 重置验证状态
    resetVerifyState () {
      this.closeVerifyWebSocket()
      this.connecting = false
      this.scanning = false
      this.scanMsg = ''
      this.scanProgress = 0
      this.vulnResultList = []
      this.errorMessage = ''
    },
    // 关闭 WebSocket 连接
    closeVerifyWebSocket () {
      if (!this.verifySocket) {
        return
      }
      this.verifySocket.onopen = null
      this.verifySocket.onmessage = null
      this.verifySocket.onerror = null
      this.verifySocket.onclose = null
      if (
        this.verifySocket.readyState === WebSocket.OPEN ||
        this.verifySocket.readyState === WebSocket.CONNECTING
      ) {
        this.verifySocket.close()
      }
      this.verifySocket = null
    },
    // 根据上下文初始化验证流程
    bootstrapFromContext (contextValue) {
      const context =
        contextValue && typeof contextValue === 'object' ? contextValue : {}
      const portItem =
        context.portItem && typeof context.portItem === 'object'
          ? context.portItem
          : null
      if (!portItem) {
        this.resetVerifyState()
        this.lastBootstrapKey = ''
        return
      }

      const bootstrapKey = String(
        context.verifyKey ||
          `${portItem.asset_ip || ''}-${portItem.port || ''}`
      )
      if (this.lastBootstrapKey === bootstrapKey) {
        return
      }
      this.lastBootstrapKey = bootstrapKey
      this.startPortVerify(portItem)
    },
    // 构建 WebSocket 请求参数
    buildVerifyRequestPayload (portItem = {}) {
      return {
        options: {
          customPorts: true,
          scanPrinter: false,
          targets: String(portItem.asset_ip || '').trim(),
          tcpPorts: String(portItem.port || '').trim()
        }
      }
    },
    // 解析 WebSocket 消息
    parseWebSocketPayload (event) {
      try {
        const payload = JSON.parse(event.data)
        return payload && typeof payload === 'object' ? payload : null
      } catch (error) {
        return null
      }
    },
    // 处理 WebSocket 进度消息
    handleWebSocketMessage (payload = {}) {
      const messageText = String(payload.msg || '').trim()
      const progressValue = Number(payload.process)
      const vulnList = Array.isArray(payload.vulns) ? payload.vulns : []

      if (messageText) {
        this.scanMsg = messageText
      }
      if (Number.isFinite(progressValue)) {
        this.scanProgress = Math.min(
          100,
          Math.max(0, Math.round(progressValue))
        )
      }

      if (this.scanProgress >= 100) {
        this.scanning = false
        this.connecting = false
        this.vulnResultList = vulnList
        this.closeVerifyWebSocket()
        this.$emit('verify-result', {
          portItem: this.currentPortItem,
          vulnList: vulnList
        })
      }
    },
    // 发起端口验证 WebSocket 请求
    startPortVerify (portItem = {}) {
      const assetIp = String(
        portItem.asset_ip || portItem.affect_asset_ip || ''
      ).trim()
      const portText = String(
        portItem.port || portItem.lan_port || portItem.affect_port || ''
      ).trim()
      if (!assetIp || !portText) {
        this.resetVerifyState()
        this.errorMessage = '缺少资产 IP 或端口，无法发起验证'
        return
      }

      // 统一补齐验证组件内部使用的字段
      const normalizedPortItem = {
        ...portItem,
        asset_ip: assetIp,
        port: portText
      }

      this.resetVerifyState()
      this.connecting = true
      this.scanning = true
      this.scanMsg = '正在建立连接...'

      try {
        const socket = new WebSocket(this.buildVerifyWebSocketUrl())
        this.verifySocket = socket

        socket.onopen = () => {
          this.connecting = false
          this.scanMsg = '扫描任务已提交，等待进度...'
          socket.send(
            JSON.stringify(this.buildVerifyRequestPayload(normalizedPortItem))
          )
        }

        socket.onmessage = event => {
          const payload = this.parseWebSocketPayload(event)
          if (!payload) {
            this.errorMessage = '验证进度解析失败'
            this.scanning = false
            this.closeVerifyWebSocket()
            return
          }
          this.handleWebSocketMessage(payload)
        }

        socket.onerror = () => {
          this.connecting = false
          this.scanning = false
          this.errorMessage = '验证服务连接异常'
          this.closeVerifyWebSocket()
        }

        socket.onclose = () => {
          if (this.scanning && this.scanProgress < 100) {
            this.scanning = false
            if (!this.errorMessage) {
              this.errorMessage = '验证连接已关闭'
            }
          }
          this.connecting = false
        }
      } catch (error) {
        this.connecting = false
        this.scanning = false
        this.errorMessage =
          (error && error.message) || '无法建立验证连接'
      }
    },
    // 关闭前拦截（扫描未完成时提示）
    handleBeforeClose (done) {
      if (this.scanning || this.connecting) {
        ElMessageBox.confirm('验证尚未完成，确认关闭吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
          .then(() => {
            this.resetVerifyState()
            done()
          })
          .catch(() => {})
        return
      }
      done()
    },
    // 返回端口列表
    handleBack () {
      if (this.scanning || this.connecting) {
        ElMessageBox.confirm('验证尚未完成，确认返回吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
          .then(() => {
            this.resetVerifyState()
            this.$emit('back')
          })
          .catch(() => {})
        return
      }
      this.resetVerifyState()
      this.$emit('back')
    }
  }
}
</script>

<style scoped lang="scss">
.high-risk-port-verify {
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

  &__progress-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    margin-bottom: var(--sp-3);
  }

  &__progress-title {
    color: var(--c-text);
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
    line-height: 1.4;
  }

  &__progress-status {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  &__progress-msg {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.4;
  }

  &__progress-done {
    flex-shrink: 0;
    color: var(--c-success);
    font-size: var(--fs-sm);
    font-weight: var(--fw-semibold);
    line-height: 1.4;
  }

  &__progress-bar {
    overflow: hidden;
    height: 10px;
    border-radius: 999px;
    background: var(--c-border-light);
  }

  &__progress-inner {
    height: 100%;
    border-radius: 999px;
    background: var(--accent);
    transition: width 0.25s ease;
  }

  &__progress-tip {
    margin: var(--sp-3) 0 0;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    text-align: center;
    line-height: 1.5;
  }

  &__result-panel {
    margin-top: var(--sp-2);
  }

  &__result-title {
    margin-bottom: var(--sp-3);
    color: var(--c-text);
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
    line-height: 1.4;
  }

  &__result-table {
    width: 100%;
  }
}
</style>

<style lang="scss">
:root[data-theme='light'] {
  .high-risk-port-verify__progress-panel {
    background: #f8f9fb;
    border-color: #ebeef5;
  }

  .high-risk-port-verify__progress-inner {
    background: #7c3aed;
  }
}
</style>
