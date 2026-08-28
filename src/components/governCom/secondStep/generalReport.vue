<template>
  <!-- 生成报告 -->
  <div class="general-report">
    <div class="general-report__back-row">
      <el-button link class="govern-back-btn" @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
    </div>

    <div class="general-report__header">
      <div class="general-report__title">报告预览</div>
      <el-button
        v-if="reportHtml && !loading"
        type="primary"
        size="default"
        @click="handleDownloadReport"
      >
        <i class="el-icon-download" />
        下载 HTML 报告
      </el-button>
    </div>

    <div class="general-report__body">
      <LedgerLoading
        :visible="loading"
        text="正在生成报告…"
      />

      <iframe
        v-if="reportHtml && !loading"
        ref="reportIframeRef"
        class="general-report__iframe"
        :srcdoc="reportPreviewHtml"
        frameborder="0"
        scrolling="no"
        title="风险报告预览"
        @load="handleReportIframeLoad"
      />

      <div
        v-if="!loading && !reportHtml && loadAttempted"
        class="ledger-table-empty-icon"
        style="min-height: 200px;"
      >
        <i class="iconfont icon-kongzhuangtai"></i>
        <span>报告生成失败，请返回后重试</span>
        <el-button link @click="fetchReportHtml">重新加载</el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus'

import { downloadBlob } from '@/utils/download'
import LedgerLoading from '@/components/ledgerLoading.vue'
import { generateReportAPI } from '@/api/riskOperations'

export default {
  name: 'GeneralReport',
  components: {
    LedgerLoading
  },
  props: {
    // 报告上下文：vulnItem、vulnIds
    reportContext: {
      type: Object,
      default: () => ({})
    }
  },
  data () {
    return {
      loading: false,
      loadAttempted: false,
      reportHtml: '',
      requestSequence: 0
    }
  },
  computed: {
    // 当前漏洞条目
    currentVulnItem () {
      const context =
        this.reportContext && typeof this.reportContext === 'object'
          ? this.reportContext
          : {}
      return context.vulnItem && typeof context.vulnItem === 'object'
        ? context.vulnItem
        : null
    },
    // 报告接口使用的漏洞 ID
    resolvedVulnIds () {
      const context =
        this.reportContext && typeof this.reportContext === 'object'
          ? this.reportContext
          : {}
      const contextIds = Array.isArray(context.vulnIds) ? context.vulnIds : []
      const vulnItem = this.currentVulnItem
      const itemId =
        vulnItem && vulnItem.id != null
          ? vulnItem.id
          : vulnItem && vulnItem.vuln_id != null
            ? vulnItem.vuln_id
            : null
      return [...new Set(
        [...contextIds, itemId]
          .map(item => Number(item))
          .filter(item => Number.isFinite(item) && item > 0)
      )]
    },
    // 下载文件名
    reportFileName () {
      const vulnName = String(
        (this.currentVulnItem && this.currentVulnItem.vuln_name) || '风险报告'
      ).trim()
      const safeName = vulnName.replace(/[/\\?%*:|"<>]/g, '_') || '风险报告'
      return `${safeName}-报告.html`
    },
    // iframe 预览用的完整 HTML 文档
    reportPreviewHtml () {
      return this.buildPreviewDocumentHtml(this.reportHtml)
    }
  },
  watch: {
    reportHtml () {
      this.$nextTick(() => {
        this.handleReportIframeLoad()
      })
    },
    reportContext: {
      immediate: true,
      deep: true,
      handler (contextValue) {
        const context =
          contextValue && typeof contextValue === 'object' ? contextValue : {}
        if (context.vulnItem) {
          this.fetchReportHtml()
        } else {
          this.resetLocalState()
        }
      }
    }
  },
  methods: {
    // 解析接口返回的 HTML 字符串
    resolveReportHtml (responseData) {
      if (typeof responseData === 'string') {
        return responseData.trim()
      }
      if (
        responseData &&
        typeof responseData === 'object' &&
        typeof responseData.data === 'string'
      ) {
        return responseData.data.trim()
      }
      return ''
    },

    // 构建 iframe 预览文档（保留 head 中的样式与脚本）
    buildPreviewDocumentHtml (htmlContent) {
      const rawHtml = String(htmlContent || '').trim()
      if (!rawHtml) {
        return ''
      }

      const hasDocumentRoot =
        /^<!DOCTYPE/i.test(rawHtml) || /^<html[\s>]/i.test(rawHtml)
      if (hasDocumentRoot) {
        return rawHtml
      }

      return [
        '<!DOCTYPE html>',
        '<html lang="zh-CN">',
        '<head>',
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        '<' + 'script src="https://cdn.tailwindcss.com"><' + '/script>',
        '</head>',
        '<body>',
        rawHtml,
        '</body>',
        '</html>'
      ].join('')
    },

    // 根据 iframe 内容高度自适应预览区域
    handleReportIframeLoad () {
      const iframeElement = this.$refs.reportIframeRef
      if (!iframeElement) {
        return
      }

      const updateIframeHeight = () => {
        try {
          const iframeDocument = iframeElement.contentDocument
          const iframeBody = iframeDocument && iframeDocument.body
          if (!iframeBody) {
            return
          }

          const contentHeight = Math.max(
            iframeBody.scrollHeight,
            iframeBody.offsetHeight,
            360
          )
          iframeElement.style.height = `${contentHeight + 24}px`
        } catch (error) {
          iframeElement.style.height = '360px'
        }
      }

      updateIframeHeight()
      // Tailwind CDN 异步加载后需重新计算高度
      setTimeout(updateIframeHeight, 300)
      setTimeout(updateIframeHeight, 1000)
    },

    // 请求并渲染 HTML 报告
    async fetchReportHtml () {
      const vulnIds = this.resolvedVulnIds
      if (!vulnIds.length) {
        this.loadAttempted = true
        this.reportHtml = ''
        ElMessage.warning('缺少漏洞 ID，无法生成报告')
        return
      }

      const currentSequence = ++this.requestSequence
      this.loading = true
      this.loadAttempted = true
      this.reportHtml = ''

      try {
        const responseData = await generateReportAPI({
          vuln_ids: vulnIds.join(',')
        })
        if (currentSequence !== this.requestSequence) {
          return
        }

        const htmlContent = this.resolveReportHtml(responseData)
        if (!htmlContent) {
          throw new Error('报告内容为空')
        }

        this.reportHtml = htmlContent
      } catch (error) {
        if (currentSequence !== this.requestSequence) {
          return
        }
        this.reportHtml = ''
        ElMessage.error(
          (error && error.msg) ||
            (error && error.message) ||
            '生成报告失败'
        )
      } finally {
        if (currentSequence === this.requestSequence) {
          this.loading = false
        }
      }
    },

    // 下载 HTML 报告
    handleDownloadReport () {
      const htmlContent = String(this.reportHtml || '').trim()
      if (!htmlContent) {
        ElMessage.warning('暂无可下载的报告内容')
        return
      }

      try {
        const reportBlob = new Blob(['\ufeff', htmlContent], {
          type: 'text/html;charset=utf-8'
        })
        downloadBlob(reportBlob, this.reportFileName)
        ElMessage.success('报告下载成功')
      } catch (error) {
        ElMessage.error('报告下载失败')
      }
    },

    // 重置本地状态
    resetLocalState () {
      this.requestSequence += 1
      this.loading = false
      this.loadAttempted = false
      this.reportHtml = ''
    },

    // 返回漏洞列表
    handleBack () {
      this.$emit('back')
    }
  }
}
</script>

<style scoped lang="scss">
.general-report {
  &__back-row {
    margin-bottom: var(--sp-2);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    margin-bottom: var(--sp-3);
  }

  &__title {
    color: var(--c-text);
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
    line-height: 1.4;
  }

  &__body {
    position: relative;
    // min-height: 360px;
    // max-height: 63vh;
    overflow-x: hidden;
    overflow-y: auto;
    border: 1px solid var(--c-border-light);
    border-radius: var(--r-lg);
    background: var(--c-bg-hover);
    scrollbar-width: thin;
    scrollbar-color: var(--c-primary-bg) var(--c-bg-hover);

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--c-primary-bg);
      border-radius: var(--r-md);
    }
  }

  &__iframe {
    display: block;
    width: 100%;
    min-height: 360px;
    border: 0;
    background: #ffffff;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 360px;
    padding: var(--sp-6);
    text-align: center;
  }

  &__empty-icon {
    margin-bottom: var(--sp-3);
    color: var(--c-text-muted);
    font-size: 48px;
  }

  &__empty-text {
    margin: 0 0 var(--sp-2);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }
}
</style>

