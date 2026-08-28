<template>
  <div>
    <div v-if="show" class="risk-governance-ai">
      <div class="risk-governance-ai__section-title">
        治理与处置建议
        <span v-if="aiAdviceLoading" class="risk-governance-ai__streaming">
          AI 分析中<span class="risk-governance-ai__dots" aria-hidden="true">
            <i>.</i><i>.</i><i>.</i>
          </span>
        </span>
      </div>
      <div class="risk-governance-ai__panel">
        <LedgerLoading
          v-if="aiAdviceLoading && !aiAdviceText"
          :visible="true"
          text="AI 分析中..."
        />
        <template v-else-if="aiAdviceText || hasAiHtmlReportHint">
          <div
            v-if="displayAiAdviceText"
            class="risk-governance-ai__markdown ai-chat-md"
            v-html="renderedAiAdviceHtml"
          />
          <div
            v-if="hasAiHtmlReportHint || canShowAiHtmlActions"
            class="risk-governance-ai__download"
          >
            <div class="risk-governance-ai__download-title">
              📄 处置建议与治理流程报告
            </div>
            <div class="risk-governance-ai__download-row">
              <span class="risk-governance-ai__download-desc">
                点击可查看详细的完整报告
              </span>
              <template v-if="canShowAiHtmlActions">
                <el-button
                  type="primary"
                  size="small"
                  icon="el-icon-view"
                  @click="openAiHtmlPreview"
                >
                  预览 HTML 报告
                </el-button>
                <el-button
                  type="info"
                  size="small"
                  plain
                  icon="el-icon-download"
                  @click="downloadAiHtmlReport"
                >
                  下载 HTML 报告
                </el-button>
              </template>
              <span
                v-else-if="aiAdviceLoading"
                class="risk-governance-ai__download-wait"
              >
                完整报告生成中<span
                  class="risk-governance-ai__dots"
                  aria-hidden="true"
                >
                  <i>.</i><i>.</i><i>.</i>
                </span>
              </span>
            </div>
          </div>
        </template>
        <div
          v-else-if="isNoAvailableModelError"
          class="risk-governance-ai__empty-model"
        >
          <i class="iconfont icon-kongzhuangtai"></i>
          <span class="risk-governance-ai__empty-model-text">
            {{ aiAdviceError || '暂无可用模型' }}
          </span>
          <el-button
            type="primary"
            size="small"
            plain
            @click="goConfigureModel"
          >
            去配置模型
          </el-button>
        </div>
        <div v-else-if="aiAdviceError" class="risk-governance-ai__error">
          {{ aiAdviceError }}
        </div>
        <div v-else class="ledger-table-empty-icon">
          <i class="iconfont icon-kongzhuangtai"></i>
          <span>暂无 AI 建议</span>
        </div>
      </div>
    </div>

    <DepthAnalysisHtmlReportDialog
      v-model="aiHtmlPreviewVisible"
      :html-content="embeddedAiHtml"
      :file-name="aiHtmlReportFileName"
      title="处置建议与治理流程报告预览"
    />
  </div>
</template>

<script>
import { ElMessage } from 'element-plus'

import { downloadBlob } from '@/utils/download'
import LedgerLoading from '@/components/ledgerLoading.vue'
import DepthAnalysisHtmlReportDialog from '@/views/attackSurface/com/AttackSurfaceCom/DepthAnalysisHtmlReportDialog.vue'
import {
  isStreamEndPayload,
  normalizeAiWsChunkToPlainText
} from '@/utils/aiWsFrameParser'
import { normalizeAiWsPayloadToText } from '@/utils/aiWebSocket'
import { renderAiMarkdown } from '@/utils/aiMarkdown'
import { buildWebSocketUrl } from '@/utils/webSocketUrl'

export default {
  name: 'RiskGovernanceAiAdvicePanel',

  components: {
    LedgerLoading,
    DepthAnalysisHtmlReportDialog
  },

  props: {
    // 是否展示建议区域
    show: {
      type: Boolean,
      default: false
    },
    // WebSocket 请求 type，如 critical_vulnerability / high_risk_port
    riskType: {
      type: String,
      required: true
    },
    // 传给 AI 的风险列表 data
    riskData: {
      type: Array,
      default: () => []
    },
    // 外层治理弹窗显隐（预览 HTML 时关闭外层）
    outerDialogVisible: {
      type: Boolean,
      default: false
    },
    // 下载文件名前缀
    fileNamePrefix: {
      type: String,
      default: '风险治理'
    }
  },

  data () {
    return {
      riskGovernanceSocket: null,
      riskGovernancePingTimer: null,
      aiAdviceRequestId: 0,
      aiAdviceLoading: false,
      aiAdviceText: '',
      aiAdviceError: '',
      aiHtmlPreviewVisible: false,
      reopenOuterAfterHtmlPreview: false
    }
  },

  computed: {
    aiAdviceReportParts () {
      return this.splitAiAdviceReportAndHtml(this.aiAdviceText)
    },
    displayAiAdviceText () {
      return this.aiAdviceReportParts.textPart
    },
    embeddedAiHtml () {
      return this.aiAdviceReportParts.htmlPart
    },
    hasAiHtmlReportHint () {
      return this.aiAdviceReportParts.hasHtmlHint
    },
    renderedAiAdviceHtml () {
      return renderAiMarkdown(this.displayAiAdviceText, true)
    },
    canShowAiHtmlActions () {
      return !this.aiAdviceLoading && !!this.embeddedAiHtml
    },
    aiHtmlReportFileName () {
      const dateText = new Date().toISOString().slice(0, 10)
      const prefix =
        String(this.fileNamePrefix || '风险治理').trim() || '风险治理'
      return `${prefix}_处置建议与治理流程报告_${dateText}.html`
    },
    // 是否为「暂无可用模型」类错误，展示跳转配置入口
    isNoAvailableModelError () {
      return this.isNoAvailableModelMessage(this.aiAdviceError)
    }
  },

  watch: {
    // 关闭 HTML 预览后恢复外层治理弹窗
    aiHtmlPreviewVisible (visible) {
      if (visible || !this.reopenOuterAfterHtmlPreview) return
      this.reopenOuterAfterHtmlPreview = false
      this.$emit('suppress-outer-open')
      this.$emit('update:outerDialogVisible', true)
    }
  },

  beforeUnmount () {
    this.closeRiskGovernanceSocket()
  },

  methods: {
    // 方法用途：重置 AI 建议状态
    reset () {
      this.closeRiskGovernanceSocket()
      this.aiAdviceLoading = false
      this.aiAdviceText = ''
      this.aiAdviceError = ''
      this.aiHtmlPreviewVisible = false
      this.reopenOuterAfterHtmlPreview = false
    },

    // 方法用途：是否因 HTML 预览而临时关闭外层
    isPreviewClosingOuter () {
      return this.reopenOuterAfterHtmlPreview
    },

    // 方法用途：关闭 WebSocket（外层真正关闭时调用）
    dispose () {
      if (this.reopenOuterAfterHtmlPreview) return
      this.closeRiskGovernanceSocket()
    },

    // 方法用途：根据当前 riskData 发起 AI 治理建议请求
    startAdvice () {
      this.fetchAiGovernanceAdvice()
    },

    // 方法用途：构建风险治理 WebSocket 地址
    buildRiskGovernanceWsUrl () {
      return buildWebSocketUrl('websocket/risk_governance')
    },

    // 方法用途：停止风险治理 WebSocket 心跳
    clearRiskGovernancePingTimer () {
      if (this.riskGovernancePingTimer) {
        clearInterval(this.riskGovernancePingTimer)
        this.riskGovernancePingTimer = null
      }
    },

    // 方法用途：启动风险治理 WebSocket 心跳，降低代理约 1 分钟空闲断开概率
    startRiskGovernancePing (socket) {
      this.clearRiskGovernancePingTimer()
      this.riskGovernancePingTimer = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          try {
            socket.send('ping')
          } catch (error) {
            console.warn('[risk_governance] 心跳发送失败', error)
          }
        }
      }, 15000)
    },

    // 方法用途：判断是否为心跳报文，避免写入建议正文
    isRiskGovernanceHeartbeatPayload (rawPayload) {
      const text = String(rawPayload == null ? '' : rawPayload)
        .trim()
        .replace(/^"|"$/g, '')
        .toLowerCase()
      return text === 'ping' || text === 'pong'
    },

    // 方法用途：关闭风险治理 WebSocket
    closeRiskGovernanceSocket () {
      this.clearRiskGovernancePingTimer()
      if (!this.riskGovernanceSocket) return
      const socket = this.riskGovernanceSocket
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close()
      }
      this.riskGovernanceSocket = null
    },

    // 方法用途：拆分 AI 返回正文与末尾完整 HTML 报告
    splitAiAdviceReportAndHtml (rawText) {
      const text = String(rawText || '').replace(/\r\n/g, '\n')
      if (!text.trim()) {
        return { textPart: '', htmlPart: '', hasHtmlHint: false }
      }

      const fenceMatch = text.match(/\n*```html\b/i)
      const doctypeMatch = text.match(/<!DOCTYPE\s+html|<html[\s>]/i)
      const fenceIndex = fenceMatch ? fenceMatch.index : -1
      const doctypeIndex = doctypeMatch ? doctypeMatch.index : -1

      let splitIndex = -1
      if (fenceIndex >= 0 && doctypeIndex >= 0) {
        splitIndex = Math.min(fenceIndex, doctypeIndex)
      } else if (fenceIndex >= 0) {
        splitIndex = fenceIndex
      } else if (doctypeIndex >= 0) {
        splitIndex = doctypeIndex
      }

      if (splitIndex < 0) {
        return {
          textPart: this.stripAiAdviceCopyTips(text).trim(),
          htmlPart: '',
          hasHtmlHint: false
        }
      }

      let textPart = text.slice(0, splitIndex).trim()
      textPart = textPart.replace(/\n*```[\w-]*\s*$/i, '').trim()
      textPart = this.stripAiAdviceCopyTips(textPart).trim()

      let htmlSource = text.slice(splitIndex)
      htmlSource = htmlSource.replace(/^\s*```html\b\s*/i, '')
      const htmlPart = this.normalizeAiAdviceEmbeddedHtml(htmlSource)

      return {
        textPart,
        htmlPart,
        hasHtmlHint: true
      }
    },

    // 方法用途：截取完整 HTML 文档
    normalizeAiAdviceEmbeddedHtml (rawHtml) {
      let html = String(rawHtml || '').trim()
      if (!html) return ''

      const endMatch = html.match(/<\/html>/i)
      if (endMatch) {
        html = html.slice(0, endMatch.index + endMatch[0].length)
      } else {
        return ''
      }

      html = html.replace(/```[\w-]*/g, '')
      return html.trim()
    },

    // 方法用途：去掉复制代码 / 使用提示类文案
    stripAiAdviceCopyTips (rawText) {
      return String(rawText || '')
        .replace(/\n*```+\s*$/g, '')
        .replace(/\n*(?:💡\s*)?(?:\*\*)?使用提示(?:\*\*)?[\s\S]*$/i, '')
        .replace(/\n*您可以将以下代码[\s\S]*$/i, '')
        .replace(/\n*复制上方全部代码[\s\S]*$/i, '')
    },

    // 方法用途：打开 HTML 报告预览（先关外层弹窗）
    openAiHtmlPreview () {
      if (!this.canShowAiHtmlActions) {
        ElMessage.warning('完整报告生成中，请稍候')
        return
      }
      this.reopenOuterAfterHtmlPreview = true
      this.$emit('update:outerDialogVisible', false)
      this.$nextTick(() => {
        this.aiHtmlPreviewVisible = true
      })
    },

    // 方法用途：下载 HTML 报告
    downloadAiHtmlReport () {
      if (!this.canShowAiHtmlActions) {
        ElMessage.warning('完整报告生成中，请稍候')
        return
      }
      try {
        const reportBlob = new Blob(['\ufeff', this.embeddedAiHtml], {
          type: 'text/html;charset=utf-8'
        })
        downloadBlob(reportBlob, this.aiHtmlReportFileName)
        ElMessage.success('报告下载成功')
      } catch (error) {
        ElMessage.error('报告下载失败')
      }
    },

    // 方法用途：判断文案是否为暂无可用模型
    isNoAvailableModelMessage (text) {
      return String(text || '').includes('暂无可用模型')
    },

    // 方法用途：跳转到设置-模型管理
    goConfigureModel () {
      this.$emit('update:outerDialogVisible', false)
      this.$router.push({
        path: '/settings',
        query: { menu: 'modelManagement' }
      })
    },

    // 方法用途：通过 WebSocket 请求 AI 治理建议
    sendRiskGovernanceRequest (riskList, requestId) {
      return new Promise((resolve, reject) => {
        const socket = new WebSocket(this.buildRiskGovernanceWsUrl())
        this.riskGovernanceSocket = socket
        let responseText = ''
        let settled = false
        let inboundChain = Promise.resolve()

        const finish = error => {
          if (settled) return
          settled = true
          this.clearRiskGovernancePingTimer()
          this.closeRiskGovernanceSocket()
          if (error) reject(error)
          else resolve(responseText)
        }

        const handleMessage = rawPayload => {
          if (this.isRiskGovernanceHeartbeatPayload(rawPayload)) {
            return
          }
          if (isStreamEndPayload(rawPayload)) {
            finish()
            return
          }
          const chunk = normalizeAiWsChunkToPlainText(rawPayload)
          if (!chunk || /^\{role\s*:/i.test(chunk.trim())) return
          if (this.isRiskGovernanceHeartbeatPayload(chunk)) return
          responseText += chunk
          if (requestId === this.aiAdviceRequestId) {
            this.aiAdviceText = responseText
          }
        }

        socket.onopen = () => {
          // 去掉前端展示用字段，WS 只传业务原样数据
          const payloadData = (Array.isArray(riskList) ? riskList : []).map(
            item => {
              if (!item || typeof item !== 'object') {
                return item
              }
              const cleanedItem = { ...item }
              delete cleanedItem.relatedVulns
              delete cleanedItem.relatedVulnsLoaded
              delete cleanedItem.vulnLoading
              return cleanedItem
            }
          )
          socket.send(
            JSON.stringify({
              type: this.riskType,
              data: payloadData
            })
          )
          // 连接成功后每 15 秒发一次心跳
          this.startRiskGovernancePing(socket)
        }
        socket.onmessage = event => {
          inboundChain = inboundChain
            .then(() => normalizeAiWsPayloadToText(event.data))
            .then(handleMessage)
            .catch(() => finish(new Error('AI 建议解析失败')))
        }
        socket.onerror = () => finish(new Error('治理建议 WebSocket 连接异常'))
        socket.onclose = event => {
          if (settled) return
          this.clearRiskGovernancePingTimer()
          Promise.resolve(inboundChain).then(() => {
            if (responseText.trim()) finish()
            else {
              finish(new Error(event.reason || '治理建议 WebSocket 连接已关闭'))
            }
          })
        }
      })
    },

    // 方法用途：拉取 AI 治理建议与处置建议
    async fetchAiGovernanceAdvice () {
      const requestId = ++this.aiAdviceRequestId
      this.closeRiskGovernanceSocket()
      this.aiAdviceText = ''
      this.aiAdviceError = ''

      const riskList = Array.isArray(this.riskData) ? this.riskData : []
      if (!riskList.length || !this.riskType) {
        this.aiAdviceLoading = false
        return
      }

      this.aiAdviceLoading = true
      try {
        const adviceText = await this.sendRiskGovernanceRequest(
          riskList,
          requestId
        )
        if (requestId !== this.aiAdviceRequestId) return
        // 接口返回暂无可用模型时，走错误区并提供配置入口
        if (this.isNoAvailableModelMessage(adviceText)) {
          this.aiAdviceText = ''
          this.aiAdviceError = String(adviceText).trim() || '暂无可用模型'
          return
        }
        this.aiAdviceText = adviceText || ''
        if (!this.aiAdviceText) {
          this.aiAdviceError = '暂无 AI 建议'
        }
      } catch (error) {
        if (requestId !== this.aiAdviceRequestId) return
        this.aiAdviceText = ''
        this.aiAdviceError = (error && error.message) || '获取 AI 治理建议失败'
        // 暂无可用模型在面板内引导配置，不再额外弹错误 toast
        if (!this.isNoAvailableModelMessage(this.aiAdviceError)) {
          ElMessage.error(this.aiAdviceError)
        }
      } finally {
        if (requestId === this.aiAdviceRequestId) {
          this.aiAdviceLoading = false
        }
      }
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/ai-chat-markdown.scss';

.risk-governance-ai {
  margin-top: 20px;

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

  &__streaming {
    color: var(--c-primary-light);
    font-size: var(--fs-xs);
    font-weight: var(--fw-normal);
  }

  &__dots {
    display: inline-flex;
    align-items: center;
    margin-left: 1px;
    min-width: 1.2em;

    i {
      display: inline-block;
      font-style: normal;
      opacity: 0.2;
      animation: risk-governance-ai-dot-blink 1.2s infinite ease-in-out;
    }

    i:nth-child(1) {
      animation-delay: 0s;
    }

    i:nth-child(2) {
      animation-delay: 0.2s;
    }

    i:nth-child(3) {
      animation-delay: 0.4s;
    }
  }

  &__panel {
    position: relative;
    min-height: 120px;
    max-height: 260px;
    padding: var(--sp-4);
    overflow: auto;
    border: 1px solid var(--rule, #2a3245);
    border-radius: 8px;
    background: var(--bg2, #0f1626);
  }

  &__markdown {
    @include ai-chat-markdown-content;
  }

  &__download {
    margin-top: var(--sp-3);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--rule, #2a3245);
  }

  &__download-title {
    margin-bottom: 8px;
    color: var(--ink2, #303133);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.5;
  }

  &__download-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  &__download-desc {
    color: var(--c-text-secondary, #606266);
    font-size: 13px;
    line-height: 1.6;
  }

  &__download-wait {
    color: var(--c-text-muted, #909399);
    font-size: 12px;
  }

  &__error {
    color: var(--danger, #ef4444);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }

  &__empty-model {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    gap: 8px;
    padding: 12px 0;

    > i {
      color: var(--muted);
      font-size: 48px;
      line-height: 1;
    }
  }

  &__empty-model-text {
    color: var(--c-text-muted);
    font-size: 13px;
    line-height: 1.5;
  }
}

@keyframes risk-governance-ai-dot-blink {
  0%,
  80%,
  100% {
    opacity: 0.2;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-1px);
  }
}
</style>
