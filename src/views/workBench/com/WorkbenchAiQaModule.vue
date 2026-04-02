<template>
  <div class="workbench-ai-qa-module">
    <!-- AI 问答：折叠时在管道下方；展开时叠满管道区（父级 .pipeline-ai-stack 需 position:relative） -->
    <div
      v-show="aiQaPanelVisible"
      class="ai-qa-flow-section"
      :class="{
        'ai-qa-flow-section--expanded': aiQaExpanded,
        'ai-qa-flow-section--compact': !aiQaExpanded
      }"
    >
      <div class="ai-qa-flow-head">
        <div class="ai-qa-flow-head-left">
          <span class="ai-qa-flow-head-icon-wrap" aria-hidden="true">
            <el-icon><ChatDotRound /></el-icon>
          </span>
          <div class="ai-qa-flow-head-titles">
            <span class="ai-qa-flow-title">AI 问答</span>
            <span v-if="!aiQaExpanded" class="ai-qa-flow-subhint"
              >管道与任务区已完整展示，对话在下方</span
            >
            <span v-else class="ai-qa-flow-subhint"
              >全屏对话中，折叠后回到下方条带</span
            >
          </div>
          <span
            class="ai-qa-ws-pill"
            :class="'ai-qa-ws-pill--' + aiWsConnectionState"
          >
            {{ aiWsConnectionLabel }}
          </span>
        </div>
        <div class="ai-qa-flow-head-right">
          <button
            v-if="aiQaExpanded"
            type="button"
            class="ai-qa-icon-btn ai-qa-icon-btn--primary"
            title="折叠为底部条带，上方内容全部可见"
            @click="aiQaExpanded = false"
          >
            <el-icon><ArrowDown /></el-icon>
            折叠
          </button>
          <button
            v-else
            type="button"
            class="ai-qa-icon-btn ai-qa-icon-btn--primary"
            title="展开全屏对话"
            @click="aiQaExpanded = true"
          >
            <el-icon><ArrowUp /></el-icon>
            展开
          </button>
          <button
            type="button"
            class="ai-qa-icon-btn ai-qa-icon-btn--danger"
            title="关闭问答区"
            @click="closeAiQaPanel"
          >
            <el-icon><Close /></el-icon>
            关闭
          </button>
          <button
            v-if="
              aiWsConnectionState === 'error' ||
              aiWsConnectionState === 'closed'
            "
            type="button"
            class="ai-qa-reconnect-btn"
            @click="reconnectAiWebSocket"
          >
            重连
          </button>
        </div>
      </div>
      <div
        ref="aiChatScrollRef"
        class="ai-qa-messages"
        :class="{ 'ai-qa-messages--expanded': aiQaExpanded }"
      >
        <div
          v-for="chatItem in aiChatMessages"
          :key="chatItem.id"
          :class="[
            'ai-qa-row',
            chatItem.role === 'user'
              ? 'ai-qa-row--user'
              : chatItem.role === 'system'
              ? 'ai-qa-row--system'
              : 'ai-qa-row--assistant'
          ]"
        >
          <template v-if="chatItem.role === 'system'">
            <div class="ai-qa-row-system-text">
              {{ chatItem.content }}
            </div>
          </template>
          <template v-else-if="chatItem.role === 'assistant'">
            <template v-if="chatItem.toolCalls && chatItem.toolCalls.length > 0">
              <div class="ai-qa-row-label">助手</div>
              <div class="ai-qa-row-body ai-qa-row-body--assistant-toolcalls">
                <div
                  v-for="(toolCall, toolCallIndex) in chatItem.toolCalls"
                  :key="toolCallIndex"
                  class="ai-qa-toolcall-block"
                >
                  <div class="ai-qa-toolcall-title">
                    tool_calls {{ toolCall.toolname || '' }}
                    <el-button
                      link
                      size="small"
                      style="margin-left: 8px;"
                      @click="toggleAiToolCallParamsExpanded(chatItem.id, toolCallIndex)"
                      :icon="isAiToolCallParamsExpanded(chatItem.id, toolCallIndex) ? ArrowDown : ArrowRight"
                    >
                    </el-button>
                  </div>
                  <div
                    v-if="isAiToolCallParamsExpanded(chatItem.id, toolCallIndex)"
                    class="ai-qa-md"
                    v-html="buildAssistantDisplayHtml(toolCall.argumentsTextPretty)"
                  >
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="ai-qa-row-label">AI</div>
              <div class="ai-qa-row-body ai-qa-row-body--assistant-md">
                <div
                  class="ai-qa-md"
                  v-html="renderToolResult(chatItem)"
                ></div>
                <span
                  v-if="
                    chatItem.role === 'assistant' &&
                    (chatItem.typewriterActive ||
                      (chatItem.aiReplyStreaming &&
                        (chatItem.typewriterDisplayLength || 0) <
                          (chatItem.fullSource || '').length))
                  "
                  class="ai-qa-typewriter-cursor"
                  aria-hidden="true"
                ></span>
              </div>
            </template>
          </template>
          <template v-else-if="chatItem.role === 'tool'">
            <div class="ai-qa-row-label">工具</div>
            <div class="ai-qa-row-body ai-qa-row-body--tool-md">
              <div class="ai-qa-tool-output-title">
                {{ chatItem.toolname || 'tool' }}
                <el-button
                  link
                  size="small"
                  style="margin-left: 8px;"
                  @click="toggleAiToolResultExpanded(chatItem.id)"
                  :icon="isAiToolResultExpanded(chatItem.id) ? ArrowDown : ArrowRight"
                >
                </el-button>
              </div>
              <div
                v-if="isAiToolResultExpanded(chatItem.id)"
                class="ai-qa-md"
                v-html="buildAssistantDisplayHtml(chatItem.toolResultText)"
              >
              </div>
            </div>
          </template>
          <template v-else>
            <div class="ai-qa-row-label">您</div>
            <div class="ai-qa-row-body">
              <el-icon
                v-if="isAiChatSending || isAiWsConnecting || aiChatSubmitting"
                class="ai-qa-user-loading is-loading"
              >
                <Loading />
              </el-icon>
              <span class="ai-qa-row-text">{{ chatItem.content }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 底部固定输入：WebSocket 纯文本 -->
    <section class="chat-fixed">
      <div class="chat-form">
        <div class="chat-input-wrap">
          <el-icon class="chat-input-icon"><ChatDotRound /></el-icon>
          <el-input
            v-model="chatInput"
            class="chat-el-input"
            type="text"
            clearable
            placeholder="输入您想获得的信息，或想要执行的安全治理动作..."
            @keyup.enter="handleChatSubmit"
          />
        </div>
        <el-button
          type="primary"
          class="chat-submit-btn"
          :disabled="!chatInput.trim() || isAiChatSending || isAiWsConnecting || aiChatSubmitting"
          @click="handleChatSubmit"
        >
          <el-icon
            v-if="isAiChatSending || isAiWsConnecting || aiChatSubmitting"
            class="is-loading"
          >
            <Loading />
          </el-icon>
          <el-icon v-else><Promotion /></el-icon>
        </el-button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
// @ts-nocheck
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChatDotRound,
  Close,
  Loading,
  Promotion
} from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'

/** AI 回复区 Markdown（关闭 raw html，换行转 <br>） */
function createAiMarkdownIt () {
  return new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true
  })
}

const DEFAULT_AI_WS_URL = 'ws://10.10.20.201:8888/api/websocket/ai_agent'

export default {
  name: 'WorkbenchAiQaModule',
  components: {
    ArrowDown,
    ArrowRight,
    ArrowUp,
    ChatDotRound,
    Close,
    Loading,
    Promotion
  },
  props: {
    /** WebSocket 地址，便于环境切换 */
    wsUrl: {
      type: String,
      default: DEFAULT_AI_WS_URL
    }
  },
  data () {
    return {
      chatInput: '',
      aiChatMessages: [],
      aiWs: null,
      aiMessageBuffer: '',
      aiWsConnectionState: 'idle',
      aiWsInboundChain: null,
      isAiWsConnecting: false,
      aiWsPendingSend: null,
      isAiChatSending: false,
      aiChatSubmitting: false,
      aiPendingToolCallsCount: 0,
      aiStreamingReplyId: null,
      aiTypewriterTimerId: null,
      aiQaModuleDismissed: false,
      aiQaExpanded: true,
      aiToolCallParamExpanded: {},
      aiToolResultExpanded: {}
    }
  },
  computed: {
    aiWsConnectionLabel () {
      const map = {
        idle: '未连接',
        connecting: '连接中…',
        open: '已连接',
        error: '连接失败',
        closed: '已断开'
      }
      return map[this.aiWsConnectionState] || this.aiWsConnectionState
    },
    aiQaPanelVisible () {
      return (
        this.aiChatMessages.some(item => item.role === 'user') &&
        !this.aiQaModuleDismissed
      )
    }
  },
  watch: {
    aiQaPanelVisible: {
      handler (visible) {
        this.$emit('panel-visible', visible)
      },
      immediate: true
    }
  },
  created () {
    this.markdownRenderer = createAiMarkdownIt()
  },
  beforeUnmount () {
    this.clearAiTypewriterTimer()
    this.isAiWsConnecting = false
    this.closeAiWebSocket()
  },
  methods: {
    renderToolResult (raw) {
      if (!raw) return ''

      let obj = typeof raw === 'string' ? JSON.parse(raw) : raw

      let text = obj.fullSource || ''

      // 🔥 关键：还原 \n
      text = text.replace(/\\n/g, '\n')

      return this.markdownRenderer.render(text)
    },
    /** HTML 转义 */
    escapeHtml (str) {
      if (!str) return ''
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    },
    normalizeAiWsPayloadToText (payload) {
      if (payload instanceof Blob) {
        return payload.text()
      }
      if (typeof payload === 'string') {
        return Promise.resolve(payload)
      }
      if (payload instanceof ArrayBuffer) {
        return Promise.resolve(
          new TextDecoder('utf-8', { fatal: false }).decode(payload)
        )
      }
      console.warn('[AI WS] 未识别的帧类型，已忽略', typeof payload)
      return Promise.resolve(null)
    },
    /** 是否像 Markdown（避免普通对话误走 MarkdownIt） */
    isLikelyMarkdownText (rawText) {
      if (!rawText || typeof rawText !== 'string') return false
      const head = rawText.slice(0, 1200)
      return (
        /```[\s\S]*```/.test(rawText) ||
        /^#{1,6}\s/m.test(head) ||
        /(^|\n)\s*[-*+]\s+\S/m.test(head) ||
        /(^|\n)\s*\d+\.\s+\S/m.test(head) ||
        /(^|\n)\s*>\s/.test(head) ||
        /\*\*[^*\n]+\*\*/.test(head) ||
        /`[^`\n]+`/.test(head) ||
        /\[[^\]]+\]\([^)]+\)/.test(head) ||
        /\|[^|\n]+\|[^|\n]+\|/.test(head)
      )
    },
    /** 纯文本或 Markdown → 展示用 HTML */
    buildAssistantDisplayHtml (rawText) {
      const text = rawText == null ? '' : String(rawText)
      if (!text.trim()) return '<p class="ai-qa-md-empty">（无内容）</p>'
      if (!this.isLikelyMarkdownText(text)) {
        return `<p class="ai-qa-plain-body">${this.escapeHtml(text).replace(
          /\n/g,
          '<br/>'
        )}</p>`
      }
      try {
        return this.markdownRenderer.render(text)
      } catch (renderError) {
        return `<p class="ai-qa-plain-body">${this.escapeHtml(text).replace(
          /\n/g,
          '<br/>'
        )}</p>`
      }
    },
    bindAiWebSocketHandlers () {
      if (!this.aiWs) return
      this.aiWsInboundChain = Promise.resolve()
      this.aiWs.onmessage = event => {
        const payload = event.data
        this.aiWsInboundChain = this.aiWsInboundChain
          .then(() => this.normalizeAiWsPayloadToText(payload))
          .then(text => {
            if (text !== null && text !== undefined) {
              this.handleAiWsTextMessage(text)
            }
          })
          .catch(err => {
            console.error('AI WebSocket 帧解析失败:', err)
          })
      }
      this.aiWs.onerror = () => {
        console.error('WebSocket 错误')
        this.aiWsConnectionState = 'error'
        this.isAiWsConnecting = false
        this.aiChatSubmitting = false // 确保在错误时也释放锁
        this.isAiChatSending = false
        this.aiWsPendingSend = null
        this.pushAiChatMessage('system', '连接出错，可点击重连后再次发送')
      }
      this.aiWs.onclose = () => {
        console.log('WebSocket 连接关闭')
        this.aiWsConnectionState = 'closed'
        this.isAiWsConnecting = false
        this.aiChatSubmitting = false // 确保在关闭时也释放锁
        this.isAiChatSending = false
        this.aiWsPendingSend = null
        this.aiWs = null
        const flushChain =
          this.aiWsInboundChain != null
            ? Promise.resolve(this.aiWsInboundChain)
            : Promise.resolve()
        flushChain
          .then(() => {
            this.finalizeAiReplyFromBufferOnCloseOrTail()
          })
          .catch(() => {})
          .finally(() => {
            this.pushAiChatMessage('system', '连接已关闭，发送消息时将重新连接')
          })
      }
    },
    connectAiWebSocketAndSend (outboundText) {
      this.closeAiWebSocket()
      this.discardUnfinishedAiStreamingBubble()
      this.aiMessageBuffer = ''
      this.aiWsPendingSend = outboundText
      try {
        this.aiWsConnectionState = 'connecting'
        this.aiWs = new WebSocket(this.wsUrl)
        this.bindAiWebSocketHandlers()
        this.aiWs.onopen = () => {
          console.log('WebSocket 连接成功')
          this.aiWsConnectionState = 'open'
          this.isAiWsConnecting = false
          const pendingText = this.aiWsPendingSend
          this.aiWsPendingSend = null
          this.pushAiChatMessage('system', '已连接到 AI 助手')
          if (this.aiWs && pendingText != null && pendingText !== '') {
            this.$nextTick(() => {
              if (this.aiWs && this.aiWs.readyState === WebSocket.OPEN) {
                this.aiWs.send(pendingText)
                this.isAiChatSending = true
              }
              this.aiChatSubmitting = false
            })
          } else {
            this.aiChatSubmitting = false
          }
        }
      } catch (error) {
        console.error('初始化 WebSocket 失败:', error)
        this.isAiWsConnecting = false
        this.aiChatSubmitting = false // 确保在错误时也释放锁
        this.aiWsConnectionState = 'error'
        this.aiWsPendingSend = null
        this.pushAiChatMessage(
          'system',
          '无法连接 AI 服务，请检查网络或后端地址'
        )
      }
    },
    normalizeAiWsChunkToPlainText (rawPayload) {
      if (rawPayload == null) return ''
      const asString = String(rawPayload)
      const trimmed = asString.trim()
      if (trimmed === '') return ''
      try {
        const parsed = JSON.parse(trimmed)
        if (typeof parsed === 'string') return parsed
      } catch (parseError) {
        /* 非 JSON 字符串则按原始分片拼接 */
      }
      return asString
    },
    handleAiWsTextMessage (messageText) {
      const rawText = messageText == null ? '' : String(messageText)
      const trimmed = rawText.trim()
      if (trimmed === '') {
        const fullReplyRaw = this.aiMessageBuffer
        this.aiMessageBuffer = ''
        this.isAiChatSending = false
        const replyText = String(fullReplyRaw || '').trim()
        this.clearAiTypewriterTimer()
        this.finalizeAiStreamingReply(replyText)
        this.scrollAiChatToBottom()
        return
      }
      // 尝试把 } { 作为分隔符切分成多条帧
      const frames = this.splitGoFrames(trimmed)
      if (frames.length > 0) {
        // 先把未完成的流式气泡收尾
        const tail = (this.aiMessageBuffer || '').trim()
        if (this.aiStreamingReplyId) {
          this.clearAiTypewriterTimer()
          this.finalizeAiStreamingReply(tail)
        }
        this.aiMessageBuffer = ''
        this.aiStreamingReplyId = null
        frames.forEach(frame => {
          if (frame) this.processAiRoleFrame(frame)
        })
        return
      }
      // 非结构化帧：作为流式文本继续累积
      const plainChunk = this.normalizeAiWsChunkToPlainText(messageText)
      this.aiMessageBuffer += plainChunk
      this.updateOrCreateAiStreamingBubble()
      this.scheduleAiTypewriterCatchup()
      this.scrollAiChatToBottom()
    },
    /**
     * 把原始文本按 } { 切分成多条 Go 风格帧
     */
    splitGoFrames (text) {
      const frames = []
      if (!text) return frames
      // 使用正则表达式的后行断言和先行断言来安全地分割 JSON 字符串
      const parts = text.split(/(?<=\})\s*(?=\{)/)
      for (const part of parts) {
        const trimmedPart = part.trim()
        if (trimmedPart) {
          const frame = this.parseGoStyleFrame(trimmedPart)
          if (frame && frame.role) {
            frames.push(frame)
          }
        }
      }
      return frames
    },
    /**
     * 解析 Go 打印风格的 {role: xxx, ...} 帧
     */
    parseGoStyleFrame (raw) {
      const text = raw.trim()
      if (!text) return null
      // role
      const roleM = text.match(/\brole\s*:\s*([a-zA-Z_][\w]*)/)
      if (!roleM) return null
      const role = roleM[1]
      // toolname（顶层）
      const toolnameM = text.match(/\btoolname\s*:\s*([a-zA-Z0-9_:-]*)/)
      const toolname = toolnameM ? toolnameM[1] : ''
      // content：如果是数组则取第一个元素
      let contentRaw = this.extractGoFieldValue(text, 'content')
      if (contentRaw && contentRaw[0] === '[') {
        try {
          const arr = JSON.parse(contentRaw)
          if (Array.isArray(arr) && arr.length > 0) contentRaw = JSON.stringify(arr[0])
        } catch {
          console.log('11')
        }
      }
      // tool_calls（仅 assistant）
      let toolCalls = []
      if (role === 'assistant') {
        const tcSeg = this.extractGoFieldValue(text, 'tool_calls')
        if (tcSeg && typeof tcSeg === 'string') {
          toolCalls = this.parseGoStyleToolCalls(tcSeg)
        }
      }
      return { role, content: contentRaw || '', tool_calls: toolCalls, toolname }
    },
    /**
     * 提取 Go 风格字段值（处理 {xxx} 和 [...] 以及普通 token）
     */
    extractGoFieldValue (text, field) {
      const re = new RegExp(`${field}\\s*:\\s*`, 'i')
      const idx = text.search(re)
      if (idx < 0) return null
      const start = idx + text.match(re)[0].length
      const rest = text.slice(start).trim()
      if (!rest) return ''
      const fc = rest[0]
      if (fc === '{' || fc === '[') {
        // 正确处理转义引号来提取完整的 JSON
        let depth = 0, inStr = false, esc = false
        for (let i = 0; i < rest.length; i++) {
          const c = rest[i]
          if (esc) { esc = false; continue }
          if (c === '\\') { esc = true; continue }
          if (c === '"') { inStr = !inStr; continue }
          if (!inStr) {
            if (c === '{' || c === '[') { depth++; continue }
            if (c === '}' || c === ']') { depth--; if (depth === 0) return rest.slice(0, i + 1); }
          }
        }
        return rest // fallback: 返回全部
      }
      // 普通 token：到 , 或 } 为止
      const endM = rest.match(/[,}]/)
      const end = endM ? start + rest.indexOf(endM[0]) : text.length
      return text.slice(start, end).trim()
    },
    /**
     * 提取平衡括号子串，返回 { text, endIdx }
     */
    extractBalanced (text, startIdx, closeChar) {
      const openChar = text[startIdx]
      let depth = 0; let inStr = false; let esc = false
      for (let i = startIdx; i < text.length; i++) {
        const c = text[i]
        if (inStr) { if (esc) { esc = false } else if (c === '\\') { esc = true } else if (c === '"') { inStr = false } continue }
        if (c === '"') { inStr = true; continue }
        if (c === openChar) depth++
        if (c === closeChar) { depth--; if (depth === 0) return { text: text.slice(startIdx, i + 1), endIdx: i } }
      }
      return null
    },
    /**
     * 从 tool_calls 段中提取函数调用
     * 格式示例：[{0xc000f32200 call_92fe0a3e95954b8aba620a8f function {xgre_rag_retriever {"input": "当前有多少资产"}} map[]}]
     * 格式：function { 函数名 { JSON参数 } }
     */
    parseGoStyleToolCalls (seg) {
      const calls = []
      const marker = 'function {'
      let idx = 0
      const s = String(seg)
      while (idx < s.length) {
        const fi = s.indexOf(marker, idx)
        if (fi < 0) break
        // 跳过 'function {'
        let p = fi + marker.length
        // 跳过空格，提取函数名
        while (p < s.length && /\s/.test(s[p])) p++
        const nameM = s.slice(p).match(/^([a-zA-Z0-9_:-]+)/)
        if (!nameM) { idx = fi + 1; continue }
        const toolname = nameM[1]
        p += toolname.length
        // 跳过空格，找参数对象 {
        while (p < s.length && /\s/.test(s[p])) p++
        if (s[p] !== '{') { idx = p; continue }
        // 直接提取 JSON 参数（处理转义引号）
        let depth = 0, inStr = false, esc = false
        const jsonStart = p
        while (p < s.length) {
          const c = s[p]
          if (esc) { esc = false; p++; continue }
          if (c === '\\') { esc = true; p++; continue }
          if (c === '"') { inStr = !inStr; p++; continue }
          if (!inStr) {
            if (c === '{' || c === '[') { depth++; p++; continue }
            if (c === '}' || c === ']') { depth--; if (depth === 0) break; p++; continue }
          }
          p++
        }
        const jsonText = s.slice(jsonStart, p + 1)
        let argsObj = null
        try { argsObj = JSON.parse(jsonText) } catch { argsObj = jsonText }
        calls.push({ toolname, arguments: argsObj })
        idx = p + 1
      }
      return calls
    },
    /**
     * 把 tool_call 项归一化为 { toolname, argumentsTextPretty }
     */
    normalizeAiToolCall (item) {
      if (!item) return null
      let toolname = ''
      let args = null
      if (item.toolname) toolname = item.toolname
      else if (item.name) toolname = item.name
      if (!toolname && item.function && item.function.name) toolname = item.function.name
      if (item.arguments != null) args = item.arguments
      else if (item.function && item.function.arguments != null) args = item.function.arguments
      if (item.argumentsTextPretty != null && item.argumentsTextPretty !== '') {
        const pretty = typeof item.argumentsTextPretty === 'string'
          ? item.argumentsTextPretty
          : JSON.stringify(item.argumentsTextPretty, null, 2)
        return { toolname: toolname || 'tool', argumentsTextPretty: pretty }
      }
      let pretty = ''
      if (typeof args === 'string') {
        try { pretty = JSON.stringify(JSON.parse(args), null, 2) } catch { pretty = args }
      } else if (args != null) {
        pretty = JSON.stringify(args, null, 2)
      }
      return { toolname: toolname || 'tool', argumentsTextPretty: pretty }
    },
    /**
     * 从 tool content 中提取可展示文本
     */
    extractToolResultText (content) {
      if (!content) return ''
      let obj = content
      if (typeof content === 'string') {
        try { obj = JSON.parse(content) } catch { return content }
      }
      if (obj && obj.content && Array.isArray(obj.content)) {
        const parts = []
        obj.content.forEach(part => {
          if (part && part.type === 'text' && part.text) parts.push(part.text)
        })
        return parts.join('\n')
      }
      if (obj && obj.type === 'text' && obj.text) return obj.text
      if (obj && typeof obj === 'object') {
        try { return JSON.stringify(obj, null, 2) } catch {
          console.log('')
        }
      }
      return ''
    },
    /**
     * 处理一条 role 帧，渲染到聊天列表
     */
    processAiRoleFrame (frame) {
      if (!frame || typeof frame !== 'object') return
      const role = frame.role
      if (role === 'user') {
        // 忽略来自服务器的 role: user 消息，因为客户端已经在发送时本地 push 过了，避免重复显示
        console.log('[AI WS] 收到用户角色回显帧，已忽略', frame.content)
        return
      }
      if (role === 'assistant') {
        const tcs = Array.isArray(frame.tool_calls) ? frame.tool_calls : []
        if (tcs.length > 0) {
          // 有工具调用，等待工具结果
          this.aiPendingToolCallsCount += tcs.length
          this.aiChatMessages.push({
            id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: 'assistant',
            toolCalls: tcs.map(item => this.normalizeAiToolCall(item)).filter(Boolean)
          })
          this.scrollAiChatToBottom()
        } else {
          // 最终回复
          if (this.aiPendingToolCallsCount > 0) {
            // 还有待处理的工具调用，等待
            this.pushAiChatMessage('assistant', String(frame.content || ''))
          } else {
            // 没有待处理的工具调用，这轮结束
            this.pushAiChatMessage('assistant', String(frame.content || ''))
            this.isAiChatSending = false
          }
        }
        return
      }
      if (role === 'tool') {
        this.aiPendingToolCallsCount = Math.max(0, this.aiPendingToolCallsCount - 1)
        let resultText = ''
        const c = frame.content
        if (typeof c === 'string') {
          // 尝试解析 JSON 字符串
          try {
            const obj = JSON.parse(c)
            // 提取 content[0].text
            if (obj && obj.content && Array.isArray(obj.content) && obj.content[0] && obj.content[0].text) {
              resultText = obj.content[0].text
            } else if (obj && obj.type === 'text' && obj.text) {
              resultText = obj.text
            } else {
              resultText = JSON.stringify(obj, null, 2)
            }
          } catch { resultText = c }
        } else if (c && c.content && Array.isArray(c.content) && c.content[0] && c.content[0].text) {
          resultText = c.content[0].text
        } else if (c && c.type === 'text' && c.text) {
          resultText = c.text
        }
        this.aiChatMessages.push({
          id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role: 'tool',
          toolname: frame.toolname || 'tool',
          toolResultText: resultText
        })
        this.scrollAiChatToBottom()
        // 如果所有工具结果都收到了，检查是否需要结束
        if (this.aiPendingToolCallsCount === 0) {
          this.isAiChatSending = false
        }
      }
    },
    aiToolCallParamKey (assistantId, idx) {
      return `${assistantId}-tc-${idx}`
    },
    isAiToolCallParamsExpanded (assistantId, idx) {
      return !!this.aiToolCallParamExpanded[this.aiToolCallParamKey(assistantId, idx)]
    },
    toggleAiToolCallParamsExpanded (assistantId, idx) {
      const k = this.aiToolCallParamKey(assistantId, idx)
      this.aiToolCallParamExpanded[k] = !this.aiToolCallParamExpanded[k]
    },
    isAiToolResultExpanded (msgId) {
      return !!this.aiToolResultExpanded[msgId]
    },
    toggleAiToolResultExpanded (msgId) {
      this.aiToolResultExpanded[msgId] = !this.aiToolResultExpanded[msgId]
    },
    discardUnfinishedAiStreamingBubble () {
      if (!this.aiStreamingReplyId) return
      this.clearAiTypewriterTimer()
      const messageIndex = this.aiChatMessages.findIndex(
        item => item.id === this.aiStreamingReplyId
      )
      if (messageIndex >= 0) {
        const chatMessage = this.aiChatMessages[messageIndex]
        if (chatMessage.aiReplyStreaming) {
          this.aiChatMessages.splice(messageIndex, 1)
        }
      }
      this.aiStreamingReplyId = null
    },
    updateOrCreateAiStreamingBubble () {
      const accumulatedText = this.aiMessageBuffer
      if (!this.aiStreamingReplyId) {
        const streamingMessageId = `ai-reply-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}`
        const newAssistantMessage = {
          id: streamingMessageId,
          role: 'assistant',
          fullSource: accumulatedText,
          displayHtml: '',
          typewriterDisplayLength: 0,
          typewriterActive: true,
          aiReplyStreaming: true
        }
        this.aiChatMessages.push(newAssistantMessage)
        this.aiStreamingReplyId = streamingMessageId
      }
      const targetMessage = this.aiChatMessages.find(
        item => item.id === this.aiStreamingReplyId
      )
      if (!targetMessage) return
      targetMessage.fullSource = accumulatedText
    },
    scheduleAiTypewriterCatchup () {
      if (this.aiTypewriterTimerId != null) return
      this.aiTypewriterTimerId = setInterval(() => {
        const streamingId = this.aiStreamingReplyId
        const streamingMessage = streamingId
          ? this.aiChatMessages.find(item => item.id === streamingId)
          : null
        if (!streamingMessage || !streamingMessage.aiReplyStreaming) {
          this.clearAiTypewriterTimer()
          return
        }
        const targetLength = (streamingMessage.fullSource || '').length
        const currentLength =
          streamingMessage.typewriterDisplayLength != null
            ? streamingMessage.typewriterDisplayLength
            : 0
        if (currentLength >= targetLength) {
          streamingMessage.typewriterActive = false
          return
        }
        const charsPerTick = Math.min(4, targetLength - currentLength)
        const nextLength = currentLength + charsPerTick
        streamingMessage.typewriterDisplayLength = nextLength
        streamingMessage.typewriterActive = nextLength < targetLength
        this.scrollAiChatToBottom()
      }, 26)
    },
    finalizeAiStreamingReply (replyTextTrimmed) {
      const replyText = replyTextTrimmed || ''
      if (!this.aiStreamingReplyId) {
        if (replyText !== '') {
          this.appendAssistantReply(replyText)
        }
        return
      }
      const streamingMessage = this.aiChatMessages.find(
        item => item.id === this.aiStreamingReplyId
      )
      this.aiStreamingReplyId = null
      if (!streamingMessage) {
        if (replyText !== '') {
          this.appendAssistantReply(replyText)
        }
        return
      }
      if (replyText === '') {
        const messageIndex = this.aiChatMessages.indexOf(streamingMessage)
        if (messageIndex >= 0) {
          this.aiChatMessages.splice(messageIndex, 1)
        }
        return
      }
      streamingMessage.typewriterDisplayLength = replyText.length
      streamingMessage.aiReplyStreaming = false
      streamingMessage.fullSource = replyText
      streamingMessage.displayHtml = this.buildAssistantDisplayHtml(replyText)
      streamingMessage.typewriterActive = false
    },
    finalizeAiReplyFromBufferOnCloseOrTail () {
      const tailReply = (this.aiMessageBuffer || '').trim()
      this.aiMessageBuffer = ''
      this.clearAiTypewriterTimer()
      if (this.aiStreamingReplyId) {
        this.finalizeAiStreamingReply(tailReply)
        return
      }
      if (tailReply !== '') {
        this.appendAssistantReply(tailReply)
      }
    },
    clearAiTypewriterTimer () {
      if (this.aiTypewriterTimerId != null) {
        clearInterval(this.aiTypewriterTimerId)
        this.aiTypewriterTimerId = null
      }
    },
    appendAssistantReply (fullText) {
      const messageId = `ai-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`
      const useMarkdown = this.isLikelyMarkdownText(fullText)
      const assistantMessage = {
        id: messageId,
        role: 'assistant',
        fullSource: fullText,
        displayHtml: '',
        typewriterActive: !useMarkdown,
        useMarkdown
      }
      this.aiChatMessages.push(assistantMessage)

      if (useMarkdown) {
        assistantMessage.displayHtml = this.buildAssistantDisplayHtml(fullText)
        assistantMessage.typewriterActive = false
        this.scrollAiChatToBottom()
        return
      }

      const plainHtml = `<p class="ai-qa-plain-body">${this.escapeHtml(
        fullText
      ).replace(/\n/g, '<br/>')}</p>`
      assistantMessage.displayHtml = plainHtml
      assistantMessage.typewriterActive = false
      this.scrollAiChatToBottom()
    },
    closeAiWebSocket () {
      if (this.aiWs) {
        this.aiWs.onopen = null
        this.aiWs.onmessage = null
        this.aiWs.onerror = null
        this.aiWs.onclose = null
        try {
          this.aiWs.close()
        } catch (closeError) {
          /* 忽略 */
        }
        this.aiWs = null
      }
      this.aiWsPendingSend = null
    },
    reconnectAiWebSocket () {
      this.isAiWsConnecting = false
      this.closeAiWebSocket()
      this.aiWsConnectionState = 'idle'
      if (this.$message && this.$message.info) {
        this.$message.info('已断开，发送消息时将重新连接')
      }
    },
    pushAiChatMessage (role, content) {
      this.aiChatMessages.push({
        id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role,
        content
      })
      this.scrollAiChatToBottom()
    },
    applyAiQaPanelOnUserSend () {
      const hadUserQuestion = this.aiChatMessages.some(
        item => item.role === 'user'
      )
      if (this.aiQaModuleDismissed) {
        this.aiQaModuleDismissed = false
        this.aiQaExpanded = true
      }
      if (!hadUserQuestion) {
        this.aiQaExpanded = true
      }
    },
    closeAiQaPanel () {
      this.aiQaModuleDismissed = true
    },
    handleChatSubmit () {
      if (this.aiChatSubmitting || this.isAiChatSending || this.isAiWsConnecting) return
      const questionText = (this.chatInput || '').trim()
      if (!questionText) return

      if (this.aiWs && this.aiWs.readyState === WebSocket.OPEN) {
        // 设置提交中锁
        this.aiChatSubmitting = true
        this.pushAiChatMessage('user', questionText)
        this.chatInput = ''
        this.applyAiQaPanelOnUserSend()

        this.aiMessageBuffer = ''
        this.aiStreamingReplyId = null
        this.aiPendingToolCallsCount = 0
        this.aiWs.send(questionText)
        this.isAiChatSending = true
        // 消息发出后即解锁，但 isAiChatSending 为 true 仍会阻塞下一次发送
        this.aiChatSubmitting = false
        return
      }

      // 如果正在连接中，则不再处理（其实上面的 if 已经拦截了，这里双重保险）
      if (this.isAiWsConnecting) return

      // 开始连接流程
      this.aiChatSubmitting = true
      this.pushAiChatMessage('user', questionText)
      const sentText = questionText
      this.chatInput = ''
      this.applyAiQaPanelOnUserSend()

      this.isAiWsConnecting = true
      this.connectAiWebSocketAndSend(sentText)
    },
    scrollAiChatToBottom () {
      this.$nextTick(() => {
        const scrollElement = this.$refs.aiChatScrollRef
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
$purple: #9333ea;
$zinc900: #18181b;
$white: #fff;
$white10: rgba(255, 255, 255, 0.1);
$white20: rgba(255, 255, 255, 0.2);
$white40: rgba(255, 255, 255, 0.4);
$white50: rgba(255, 255, 255, 0.5);
$white60: rgba(255, 255, 255, 0.6);
$white80: rgba(255, 255, 255, 0.8);

.workbench-ai-qa-module {
  /* 子节点直接参与父级 .pipeline-ai-stack 的 flex 列布局；底部栏仍为 position:fixed */
  display: contents;
}

.ai-qa-flow-section {
  padding: 12px 14px 14px;
  background: linear-gradient(
    165deg,
    rgb(18 12 40 / 37%) 0%,
    rgb(12 8 32 / 52%) 100%
  );
  border: 1px solid rgba(167, 139, 250, 0.28);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  pointer-events: auto;
  transition: border-radius 0.3s ease, box-shadow 0.3s ease;

  &.ai-qa-flow-section--compact {
    position: relative;
    flex-shrink: 0;
    width: 100%;
    margin-top: 18px;
    z-index: 1;
    max-height: min(300px, 36vh);
    min-height: 168px;
    backdrop-filter: blur(12px);
    border-top: 1px solid rgba(196, 181, 253, 0.12);
  }

  &.ai-qa-flow-section--expanded {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 12;
    margin-top: 0;
    max-height: none;
    height: 100%;
    min-height: 0;
    border-radius: 18px;
    backdrop-filter: blur(18px);
    background: rgb(8 5 22 / 45%);
    border-color: rgba(196, 181, 253, 0.22);
    box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.08);
    animation: aiQaExpandIn 0.28s ease;
  }
}

@keyframes aiQaExpandIn {
  from {
    opacity: 0.92;
    transform: scale(0.992);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.ai-qa-flow-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
  padding-bottom: 10px;
  margin-bottom: 2px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.12);
}

.ai-qa-flow-head-icon-wrap {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(167, 139, 250, 0.15);
  border: 1px solid rgba(196, 181, 253, 0.22);
  .el-icon {
    font-size: 18px;
    color: #ddd6fe;
  }
}

.ai-qa-flow-head-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.ai-qa-flow-subhint {
  font-size: 10px;
  font-weight: 600;
  color: $white40;
  line-height: 1.35;
  max-width: 220px;
  @media (min-width: 640px) {
    max-width: 320px;
  }
}

.ai-qa-flow-head-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-qa-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  color: #ddd6fe;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(167, 139, 250, 0.22);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.15s,
    box-shadow 0.2s;
  &:hover {
    background: rgba(167, 139, 250, 0.14);
    border-color: rgba(196, 181, 253, 0.38);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  &:active {
    transform: scale(0.97);
  }
  i {
    font-size: 13px;
  }
  &--primary {
    color: #f5f3ff;
    background: rgba(139, 92, 246, 0.22);
    border-color: rgba(167, 139, 250, 0.4);
    &:hover {
      background: rgba(139, 92, 246, 0.32);
      border-color: rgba(196, 181, 253, 0.5);
    }
  }
  &--danger {
    color: #fca5a5;
    border-color: rgba(248, 113, 113, 0.28);
    background: rgba(248, 113, 113, 0.06);
    &:hover {
      background: rgba(248, 113, 113, 0.14);
    }
  }
}

.ai-qa-flow-head-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.ai-qa-flow-title {
  font-size: 13px;
  font-weight: 800;
  color: $white;
}

.ai-qa-ws-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid $white20;
  color: $white60;
}

.ai-qa-ws-pill--open {
  color: #6ee7b7;
  border-color: rgba(16, 185, 129, 0.4);
  background: rgba(16, 185, 129, 0.12);
}

.ai-qa-ws-pill--connecting {
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.35);
}

.ai-qa-ws-pill--error,
.ai-qa-ws-pill--closed {
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.35);
}

.ai-qa-reconnect-btn {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 700;
  color: #e9d5ff;
  background: $white10;
  border: 1px solid $white20;
  border-radius: 8px;
  cursor: pointer;
  &:hover {
    background: $white20;
  }
}

.ai-qa-messages {
  flex: 1;
  min-height: 72px;
  max-height: min(200px, 28vh);
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(167, 139, 250, 0.5) rgba(255, 255, 255, 0.05);
  &::-webkit-scrollbar {
    width: 7px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    margin: 6px 0;
  }
  &::-webkit-scrollbar-thumb {
    background: linear-gradient(
      180deg,
      rgba(196, 181, 253, 0.55),
      rgba(139, 92, 246, 0.42)
    );
    border-radius: 10px;
    border: 2px solid transparent;
    background-clip: padding-box;
    &:hover {
      background: linear-gradient(
        180deg,
        rgba(221, 214, 254, 0.65),
        rgba(167, 139, 250, 0.55)
      );
      background-clip: padding-box;
    }
  }

  &.ai-qa-messages--expanded {
    flex: 1;
    min-height: 0;
    max-height: none;
  }
}

.ai-qa-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 12px;
  line-height: 1.45;
  width: 100%;

  &--user {
    flex-direction: row-reverse;
    align-self: flex-end;
    width: auto;
    max-width: 100%;
    margin-left: auto;
  }
}

.ai-qa-row-label {
  flex-shrink: 0;
  width: 28px;
  font-size: 10px;
  font-weight: 800;
  color: $white40;
  padding-top: 2px;
}

.ai-qa-row-body {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 10px;
  word-break: break-word;
}

.ai-qa-row--user .ai-qa-row-body {
  flex: 0 1 auto;
  width: max-content;
  max-width: min(420px, 88%);
  min-width: 0;
  background: rgba(147, 51, 234, 0.25);
  border: 1px solid rgba(167, 139, 250, 0.25);
  color: #f5f3ff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-qa-user-loading {
  font-size: 14px;
  color: #a78bfa;
}

.ai-qa-row--user .ai-qa-row-label {
  width: auto;
  min-width: 28px;
  text-align: right;
}

.ai-qa-row--user .ai-qa-row-text {
  word-break: break-word;
  display: inline-block;
  max-width: 100%;
}

.ai-qa-row--assistant .ai-qa-row-body {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid $white10;
  color: $white80;
}

.ai-qa-row-body--assistant-md {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid $white10;
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 4px;
}

.ai-qa-row-body--assistant-toolcalls {
  flex: 1;
  min-width: 0;
  padding: 2px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid $white10;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-qa-row-body--tool-md {
  flex: 1;
  min-width: 0;
  padding: 2px 12px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-qa-toolcall-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-qa-toolcall-title {
  font-size: 11px;
  font-weight: 900;
  color: #e9d5ff;
}

.ai-qa-toolcall-params-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-qa-toolcall-params-label {
  font-size: 11px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.75);
}

.ai-qa-toolcall-pre {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
}

.ai-qa-tool-output-title {
  font-size: 11px;
  font-weight: 900;
  color: #ddd6fe;
}

.ai-qa-tool-output-params-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-qa-tool-output-pre {
  margin: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
}

.ai-qa-md {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.88);
  word-break: break-word;

  :deep(.ai-qa-plain-body) {
    margin: 0;
    padding: 0;
    color: rgba(255, 255, 255, 0.92);
    font-size: 13px;
    line-height: 1.65;
    white-space: normal;
  }
  :deep(.ai-qa-plain-stream) {
    color: rgba(255, 255, 255, 0.92);
    font-size: 13px;
    line-height: 1.65;
    white-space: normal;
    word-break: break-word;
  }
  :deep(.ai-qa-plain-stream--placeholder) {
    display: inline-block;
    min-width: 4px;
    min-height: 1.1em;
    vertical-align: bottom;
  }
  :deep(.ai-qa-md-empty) {
    margin: 0;
    color: $white50;
    font-size: 12px;
  }

  :deep(p) {
    margin: 0 0 8px;
    &:last-child {
      margin-bottom: 0;
    }
  }
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: 10px 0 6px;
    font-size: 13px;
    font-weight: 800;
    color: #e9d5fd;
    line-height: 1.35;
    &:first-child {
      margin-top: 0;
    }
  }
  :deep(strong) {
    color: #f5f3ff;
    font-weight: 700;
  }
  :deep(em) {
    color: rgba(255, 255, 255, 0.78);
  }
  :deep(a) {
    color: #c4b5fd;
    text-decoration: underline;
    text-underline-offset: 2px;
    &:hover {
      color: #ddd6fe;
    }
  }
  :deep(ul),
  :deep(ol) {
    margin: 6px 0;
    padding-left: 1.25em;
    color: rgba(255, 255, 255, 0.82);
  }
  :deep(li) {
    margin: 2px 0;
  }
  :deep(blockquote) {
    margin: 8px 0;
    padding: 6px 0 6px 12px;
    border-left: 3px solid #a78bfa;
    color: $white60;
    background: rgba(147, 51, 234, 0.08);
    border-radius: 0 8px 8px 0;
  }
  :deep(code) {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(147, 51, 234, 0.22);
    border: 1px solid rgba(167, 139, 250, 0.25);
    color: #e9d5fd;
    font-family: 'SF Mono', 'Menlo', monospace;
  }
  :deep(pre) {
    margin: 8px 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid $white10;
    overflow-x: auto;
    code {
      padding: 0;
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.9);
      font-size: 11px;
      line-height: 1.45;
    }
  }
  :deep(hr) {
    border: none;
    border-top: 1px solid $white20;
    margin: 12px 0;
  }
  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin: 8px 0;
  }
  :deep(th),
  :deep(td) {
    border: 1px solid $white20;
    padding: 6px 8px;
    text-align: left;
  }
  :deep(th) {
    background: rgba(147, 51, 234, 0.15);
    color: #e9d5fd;
    font-weight: 700;
  }
}

.ai-qa-typewriter-cursor {
  display: inline-block;
  width: 5px;
  height: 14px;
  flex-shrink: 0;
  background: #a78bfa;
  border-radius: 1px;
  margin-bottom: 2px;
  animation: aiQaCursorBlink 0.85s step-end infinite;
}

.ai-qa-row--system {
  justify-content: center;
  .ai-qa-row-system-text {
    font-size: 11px;
    color: $white50;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    text-align: center;
    max-width: 100%;
  }
}

@keyframes aiQaCursorBlink {
  50% {
    opacity: 0;
  }
}

.chat-fixed {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 896px;
  padding: 0 24px;
  z-index: 50;
  @media (max-width: 768px) {
    bottom: 24px;
    padding: 0 16px;
  }
}

.chat-form {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(147, 51, 234, 0.1);
  border-radius: 17px;
  padding: 0 8px;
  box-shadow: 0 20px 50px rgba(147, 51, 234, 0.15);
}

.chat-input-wrap {
  flex: 1;
  position: relative;
}

.chat-input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 20px;
  color: #a78bfa;
  z-index: 2;
  pointer-events: none;
}

.chat-el-input {
  flex: 1;
}

.chat-el-input :deep(.el-input__inner) {
  border: none;
  background: transparent;
  padding-left: 44px;
  padding-right: 12px;
  height: 52px;
  line-height: 52px;
  font-size: 14px;
  color: $zinc900;
  &::placeholder {
    color: #a1a1aa;
  }
}

.chat-submit-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  min-width: 40px;
  padding: 0;
  border-radius: 10px;
  font-size: 18px;
  box-shadow: 0 10px 15px -3px rgba(147, 51, 234, 0.2);
}
</style>

<style lang="scss" scoped>
.ai-qa-flow-title {
  font-size: 16px;
  line-height: 1.25;
}

.ai-qa-flow-subhint,
.ai-qa-row-label,
.ai-qa-icon-btn,
.ai-qa-reconnect-btn,
.ai-qa-row-body,
.ai-qa-row-body--assistant-md,
.ai-qa-row-body--assistant-toolcalls,
.ai-qa-row-body--tool-md,
.ai-qa-row--system .ai-qa-row-system-text,
.ai-qa-md,
.ai-qa-toolcall-title,
.ai-qa-tool-output-title,
.chat-el-input :deep(.el-input__inner) {
  font-size: 12px;
}
</style>

<style lang="scss" scoped>
.ai-qa-flow-section {
  --wbq-fs-caption: clamp(9px, 0.42vw, 10px);
  --wbq-fs-body: clamp(10px, 0.48vw, 11px);
  --wbq-fs-title: clamp(12px, 0.72vw, 14px);
  padding: 10px 12px 12px;
  border-radius: 16px;
}

.ai-qa-flow-section.ai-qa-flow-section--compact {
  max-height: min(236px, 28vh);
  min-height: 132px;
}

.ai-qa-flow-head {
  padding-bottom: 8px;
}

.ai-qa-flow-head-icon-wrap {
  width: 30px;
  height: 30px;
  border-radius: 10px;
}

.ai-qa-flow-title {
  font-size: var(--wbq-fs-title);
}

.ai-qa-flow-subhint,
.ai-qa-row-label {
  font-size: var(--wbq-fs-caption);
}

.ai-qa-icon-btn,
.ai-qa-reconnect-btn {
  min-height: 28px;
  padding: 0 10px;
  font-size: var(--wbq-fs-caption);
}

.ai-qa-messages {
  gap: 8px;
}

.ai-qa-row-body,
.ai-qa-row-body--assistant-md,
.ai-qa-row-body--assistant-toolcalls,
.ai-qa-row-body--tool-md,
.ai-qa-row--system .ai-qa-row-system-text,
.ai-qa-md {
  font-size: var(--wbq-fs-body);
  line-height: 1.55;
}

.chat-fixed {
  bottom: 12px;
  max-width: min(760px, calc(100vw - 36px));
}

.chat-form {
  min-height: 46px;
  padding: 0 6px 0 10px;
  border-radius: 14px;
}

.chat-el-input :deep(.el-input__inner) {
  height: 36px;
  line-height: 36px;
  padding-left: 32px;
  padding-right: 8px;
  font-size: var(--wbq-fs-body);
}

.chat-input-icon {
  font-size: 14px;
}

.chat-submit-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 11px;
}

@media (max-width: 768px) {
  .chat-fixed {
    max-width: calc(100vw - 18px);
  }
}
</style>

<style lang="scss" scoped>
.ai-qa-flow-section {
  --wbq-fs-caption: clamp(10px, 0.5vw, 11px);
  --wbq-fs-body: clamp(11px, 0.58vw, 12px);
  --wbq-fs-title: clamp(14px, 0.82vw, 16px);
  padding: 14px 16px 16px;
  border-radius: 20px;
}

.ai-qa-flow-section.ai-qa-flow-section--compact {
  max-height: min(286px, 34vh);
  min-height: 154px;
}

.ai-qa-flow-head {
  padding-bottom: 10px;
}

.ai-qa-flow-head-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 12px;
}

.ai-qa-flow-title {
  font-size: var(--wbq-fs-title);
}

.ai-qa-flow-subhint,
.ai-qa-row-label {
  font-size: var(--wbq-fs-caption);
}

.ai-qa-icon-btn,
.ai-qa-reconnect-btn {
  min-height: 32px;
  padding: 0 12px;
  font-size: var(--wbq-fs-body);
}

.ai-qa-messages {
  gap: 10px;
}

.ai-qa-row-body,
.ai-qa-row-body--assistant-md,
.ai-qa-row-body--assistant-toolcalls,
.ai-qa-row-body--tool-md,
.ai-qa-row--system .ai-qa-row-system-text,
.ai-qa-md {
  font-size: var(--wbq-fs-body);
  line-height: 1.7;
}

.ai-qa-toolcall-title,
.ai-qa-tool-output-title {
  font-size: var(--wbq-fs-body);
}

.chat-fixed {
  bottom: 18px;
  max-width: min(920px, calc(100vw - 56px));
}

.chat-form {
  min-height: 58px;
  padding: 0 8px 0 12px;
  border-radius: 18px;
}

.chat-el-input :deep(.el-input__inner) {
  height: 44px;
  line-height: 44px;
  padding-left: 38px;
  font-size: clamp(11px, 0.6vw, 12px);
}

.chat-input-icon {
  font-size: 16px;
}

.chat-submit-btn {
  width: 46px;
  height: 46px;
  min-width: 46px;
  border-radius: 14px;
}

@media (max-width: 768px) {
  .ai-qa-flow-section {
    padding: 12px;
    border-radius: 18px;
  }

  .chat-fixed {
    bottom: 14px;
    max-width: calc(100vw - 24px);
  }

  .chat-form {
    min-height: 52px;
    border-radius: 16px;
  }

  .chat-submit-btn {
    width: 40px;
    height: 40px;
    min-width: 40px;
    border-radius: 12px;
  }
}
</style>

<style lang="scss" scoped>
.ai-qa-flow-section {
  padding: 18px 20px 20px;
  background: linear-gradient(180deg, #ffffff 0%, #fdfbff 100%);
  border: 1px solid #efe7fb;
  border-radius: 24px;
  box-shadow: 0 18px 42px rgba(77, 37, 123, 0.08);
}

.ai-qa-flow-section.ai-qa-flow-section--compact {
  margin-top: 0;
  max-height: min(340px, 38vh);
  min-height: 180px;
  backdrop-filter: none;
}

.ai-qa-flow-section.ai-qa-flow-section--expanded {
  background: linear-gradient(180deg, #ffffff 0%, #fdfbff 100%);
  border-color: #efe7fb;
  box-shadow: 0 18px 42px rgba(77, 37, 123, 0.1);
}

.ai-qa-flow-head {
  padding-bottom: 14px;
  border-bottom: 1px solid #f1e9fb;
}

.ai-qa-flow-head-icon-wrap {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: linear-gradient(180deg, #fbf6ff 0%, #f5edff 100%);
  border-color: #eadcff;

  .el-icon {
    color: #9f55ff;
  }
}

.ai-qa-flow-title {
  color: #1f2430;
  font-size: 16px;
}

.ai-qa-flow-subhint {
  color: #8d95a7;
  font-size: 12px;
}

.ai-qa-icon-btn {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  color: #7d8597;
  background: #fff;
  border: 1px solid #e9dff6;

  &--primary,
  &--danger {
    color: #9f55ff;
    background: linear-gradient(180deg, #faf5ff 0%, #f4ebff 100%);
    border-color: #eadcff;
  }
}

.ai-qa-ws-pill {
  background: linear-gradient(180deg, #faf5ff 0%, #f4ebff 100%);
  border-color: #eadcff;
  color: #9f55ff;
}

.ai-qa-reconnect-btn {
  min-height: 36px;
  border-radius: 999px;
  background: #fff;
  color: #9f55ff;
  border-color: #eadcff;
}

.ai-qa-messages {
  scrollbar-color: rgba(159, 85, 255, 0.35) rgba(243, 236, 252, 0.6);
}

.ai-qa-row-label {
  color: #8d95a7;
}

.ai-qa-row--user .ai-qa-row-body {
  background: linear-gradient(180deg, #faf5ff 0%, #f4ebff 100%);
  border-color: #eadcff;
  color: #4d336f;
}

.ai-qa-row--assistant .ai-qa-row-body,
.ai-qa-row-body--assistant-md,
.ai-qa-row-body--assistant-toolcalls,
.ai-qa-row-body--tool-md,
.ai-qa-row--system .ai-qa-row-system-text {
  background: #fcfbfe;
  border-color: #efe7fb;
  color: #32394a;
}

.ai-qa-toolcall-title,
.ai-qa-tool-output-title {
  color: #7a42d8;
}

.ai-qa-md {
  color: #434a5c;

  :deep(.ai-qa-plain-body),
  :deep(.ai-qa-plain-stream),
  :deep(strong),
  :deep(code),
  :deep(th) {
    color: #2f3545;
  }

  :deep(blockquote) {
    background: #faf5ff;
    border-left-color: #b785ff;
    color: #6e7690;
  }

  :deep(code) {
    background: #f7f2ff;
    border-color: #eadcff;
  }

  :deep(pre) {
    background: #fff;
    border-color: #efe7fb;
  }
}

.chat-fixed {
  bottom: 28px;
  max-width: 1080px;
}

.chat-form {
  min-height: 72px;
  padding: 0 10px 0 14px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #efe7fb;
  box-shadow: 0 20px 50px rgba(77, 37, 123, 0.12);
}

.chat-input-icon {
  color: #b785ff;
}

.chat-el-input :deep(.el-input__inner) {
  color: #2f3545;
  font-size: 15px;
}

.chat-submit-btn {
  width: 58px;
  height: 58px;
  min-width: 58px;
  border-radius: 18px;
  background: linear-gradient(180deg, #c684ff 0%, #a95cff 100%) !important;
  border: none !important;
  box-shadow: 0 16px 30px rgba(159, 85, 255, 0.24);
}

@media (max-width: 768px) {
  .ai-qa-flow-section {
    padding: 16px;
    border-radius: 20px;
  }

  .chat-fixed {
    bottom: 18px;
  }

  .chat-form {
    min-height: 62px;
    border-radius: 20px;
  }

  .chat-submit-btn {
    width: 48px;
    height: 48px;
    min-width: 48px;
    border-radius: 15px;
  }
}
</style>
