<template>
  <!-- AI 自动化分析处置报告弹框 -->
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="800px"
    top="5vh"
    custom-class="dispose-report-dialog"
    append-to-body
    @close="handleClose"
  >
    <div v-if="htmlContent" class="dispose-report-iframe-host">
      <iframe
        ref="reportIframe"
        class="dispose-report-iframe"
        :src="previewBlobUrl"
        frameborder="0"
        title="报告预览"
      ></iframe>
    </div>

    <div
      v-else-if="reportPayload"
      ref="reportPrintArea"
      class="dispose-report-inner"
    >
      <div class="dispose-report-header">
        <div class="dispose-report-icon-wrap">
          <i class="el-icon-document"></i>
        </div>
        <h2 class="dispose-report-title">{{ reportPayload.title }}</h2>
        <p class="dispose-report-date">生成时间: {{ reportPayload.date }}</p>
      </div>

      <el-card shadow="never" class="dispose-report-summary-card">
        <el-row :gutter="16">
          <el-col :span="12">
            <div class="dispose-report-field-label">评估资产</div>
            <div class="dispose-report-field-value">
              {{ reportPayload.asset }}
            </div>
          </el-col>
          <el-col :span="12">
            <div class="dispose-report-field-label">综合风险评分</div>
            <div class="dispose-report-field-value dispose-report-risk-score">
              {{ reportPayload.riskScore }}
              <span class="dispose-report-risk-denom">/ 1000</span>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="dispose-report-field-label">风险摘要</div>
            <div class="dispose-report-summary-text">
              {{ reportPayload.summary }}
            </div>
          </el-col>
        </el-row>
      </el-card>

      <h3 class="dispose-report-section-title">
        <i class="el-icon-warning-outline"></i>
        风险详情列表
      </h3>

      <el-empty
        v-if="!reportPayload.items || !reportPayload.items.length"
        description="暂无风险详情条目"
        :image-size="64"
      />
      <el-card
        v-for="(reportItem, itemIndex) in reportPayload.items"
        :key="itemIndex"
        shadow="never"
        class="dispose-report-item-card"
      >
        <div class="dispose-report-item-head">
          <div class="dispose-report-item-title-wrap">
            <span class="dispose-report-item-index">{{ itemIndex + 1 }}</span>
            <span class="dispose-report-item-name">{{ reportItem.name }}</span>
          </div>
          <div class="dispose-report-item-tags">
            <el-tag size="small" type="info" effect="plain">
              <i class="el-icon-location-information"></i>
              {{ reportItem.location }}
            </el-tag>
            <el-tag
              size="small"
              :type="reportItem.level === '极高危' ? 'danger' : 'warning'"
              effect="plain"
              >{{ reportItem.level }}</el-tag
            >
          </div>
        </div>
        <div class="dispose-report-item-body">
          <div class="dispose-report-block">
            <div class="dispose-report-block-label">
              <i class="el-icon-warning"></i>
              风险描述
            </div>
            <p class="dispose-report-block-text">{{ reportItem.desc }}</p>
          </div>
          <div class="dispose-report-block">
            <div
              class="dispose-report-block-label dispose-report-block-label--fix"
            >
              <i class="el-icon-circle-check"></i>
              修复方案
            </div>
            <div class="dispose-report-block-remediation">
              {{ reportItem.remediation }}
            </div>
          </div>
        </div>
      </el-card>

      <div class="dispose-report-footer-note">
        <p>本报告由 AI 安全运营中心自动生成</p>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" plain @click="handleDownloadHtml">
          下载 HTML
        </el-button>
        <el-button type="primary" @click="handlePrint">导出 PDF / 打印</el-button>
        <el-button @click="dialogVisible = false">关 闭</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang="ts">
// @ts-nocheck
export default {
  name: 'AiDisposeReportDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    /** 弹框标题 */
    dialogTitle: {
      type: String,
      default: '报告预览'
    },
    /** 接口返回的原始 HTML 字符串（优先用于预览） */
    htmlContent: {
      type: String,
      default: ''
    },
    /** { title, date, asset, riskScore, summary, items: [{ name, location, level, desc, remediation }] } */
    reportData: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      previewBlobUrl: ''
    }
  },
  computed: {
    dialogVisible: {
      get() {
        return this.visible
      },
      set(value) {
        this.$emit('update:visible', value)
      }
    },
    reportPayload() {
      return this.reportData
    },
    previewHtmlContent() {
      return this.normalizeHtmlContent(this.htmlContent)
    }
  },
  watch: {
    previewHtmlContent: {
      immediate: true,
      handler(value) {
        this.updatePreviewBlobUrl(value)
      }
    }
  },
  beforeUnmount() {
    this.revokePreviewBlobUrl()
  },
  methods: {
    handleClose() {
      this.$emit('close')
    },
    getBuiltinReportStyle() {
      return `
        <style>
          html, body {
            margin: 0;
            padding: 0;
            font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          body {
            word-break: break-word;
          }

          img {
            max-width: 100%;
          }

          a {
            word-break: break-all;
          }

          * {
            font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif !important;
          }
        </style>
      `
    },
    normalizeHtmlContent(rawHtml) {
      if (!rawHtml) return ''

      let html = String(rawHtml)
      const builtinStyle = this.getBuiltinReportStyle()

      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(
          /<head([^>]*)>/i,
          `<head$1><meta charset="utf-8" />${builtinStyle}`
        )
      } else if (/<html[^>]*>/i.test(html)) {
        html = html.replace(
          /<html([^>]*)>/i,
          `<html$1><head><meta charset="utf-8" />${builtinStyle}</head>`
        )
      } else {
        html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    ${builtinStyle}
  </head>
  <body>${html}</body>
</html>`
      }

      return html
    },
    revokePreviewBlobUrl() {
      if (this.previewBlobUrl) {
        URL.revokeObjectURL(this.previewBlobUrl)
        this.previewBlobUrl = ''
      }
    },
    updatePreviewBlobUrl(html) {
      this.revokePreviewBlobUrl()
      if (!html) return

      const blob = new Blob([html], {
        type: 'text/html;charset=utf-8'
      })
      this.previewBlobUrl = URL.createObjectURL(blob)
    },
    /** 触发下载 HTML（由父组件生成 Blob 或仅透传） */
    handleDownloadHtml() {
      this.$emit('download-html', this.previewHtmlContent)
    },
    /** 打印当前预览区域 */
    handlePrint() {
      this.$nextTick(() => {
        const printWindow = window.open('', '_blank')
        if (!printWindow) {
          if (this.$message) {
            this.$message.warning('请允许浏览器打开新窗口以打印')
          }
          return
        }
        const html = this.htmlContent
          ? this.previewHtmlContent
          : `<!DOCTYPE html><html><head><meta charset="utf-8">${this.getBuiltinReportStyle()}<title>报告</title></head><body>${
              (this.$refs.reportPrintArea && this.$refs.reportPrintArea.innerHTML) ||
              ''
            }</body></html>`
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
        printWindow.close()
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.dispose-report-iframe-host {
  height: 70vh;
}

.dispose-report-iframe {
  width: 100%;
  height: 70vh;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}

.dispose-report-inner {
  max-height: 70vh;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(124, 58, 237, 0.35) #f3f4f6;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(124, 58, 237, 0.35);
    border-radius: 8px;
  }
}

.dispose-report-header {
  text-align: center;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 2px solid #7c3aed;
}

.dispose-report-icon-wrap {
  display: inline-flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 22px;
  margin-bottom: 8px;
}

.dispose-report-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 800;
  color: #1f2937;
}

.dispose-report-date {
  margin: 0;
  font-size: 13px;
  color: #7c3aed;
  font-weight: 600;
}

.dispose-report-summary-card {
  margin-bottom: 20px;
  border-radius: 10px !important;
  border: 1px solid #e9e8ff !important;
  background: rgba(124, 58, 237, 0.04) !important;
}

.dispose-report-field-label {
  font-size: 11px;
  font-weight: 700;
  color: #7c3aed;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.dispose-report-field-value {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}

.dispose-report-risk-score {
  color: #e11d48;
  font-size: 16px;
  font-weight: 800;
}

.dispose-report-risk-denom {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
}

.dispose-report-summary-text {
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
  padding: 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e9e8ff;
}

.dispose-report-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ede9fe;

  i {
    color: #7c3aed;
  }
}

.dispose-report-item-card {
  margin-bottom: 16px;
  border-radius: 10px !important;
  border: 1px solid #ede9fe !important;
  background: #fff !important;
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 8px 24px rgba(124, 58, 237, 0.08);
  }
}

.dispose-report-item-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

@media (min-width: 640px) {
  .dispose-report-item-head {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
}

.dispose-report-item-title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.dispose-report-item-index {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #ede9fe;
  color: #6d28d9;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.dispose-report-item-name {
  font-size: 14px;
  font-weight: 700;
  color: #1e1b4b;
  line-height: 1.4;
}

.dispose-report-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dispose-report-item-body {
  padding-left: 38px;
}

.dispose-report-block {
  margin-bottom: 12px;
}

.dispose-report-block-label {
  font-size: 11px;
  font-weight: 700;
  color: #7c3aed;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;

  i {
    font-size: 13px;
  }
}

.dispose-report-block-label--fix {
  color: #059669;
}

.dispose-report-block-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #4b5563;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #f3f4f6;
}

.dispose-report-block-remediation {
  font-size: 13px;
  line-height: 1.55;
  color: #374151;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  white-space: pre-line;
}

.dispose-report-footer-note {
  text-align: center;
  padding: 24px 0 8px;
  font-size: 11px;
  color: #a78bfa;

  p {
    margin: 4px 0 0;
  }
}
</style>

<style lang="scss">
@import './disposeReportDialogLight.scss';

/* 报告内标签在浅色背景上的对比度 */
.dispose-report-dialog {
  .dispose-report-item-tags .el-tag--info.el-tag--plain {
    background: #f5f3ff;
    border-color: #ddd6fe;
    color: #6d28d9;
  }

  .dispose-report-item-tags .el-tag--danger.el-tag--plain {
    background: #fff1f2;
    border-color: #fecdd3;
    color: #e11d48;
  }

  .dispose-report-item-tags .el-tag--warning.el-tag--plain {
    background: #fffbeb;
    border-color: #fde68a;
    color: #d97706;
  }
}
</style>
