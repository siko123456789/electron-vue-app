<template>
  <!-- 生成威胁检测规则 -->
  <div class="critical-vuln-threat-rule-govern">
    <div class="critical-vuln-threat-rule-govern__back-row">
      <el-button link class="govern-back-btn" @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
    </div>

    <div class="critical-vuln-threat-rule-govern__alert">
      <div class="critical-vuln-threat-rule-govern__alert-icon">
        <el-icon><Warning /></el-icon>
      </div>
      <div class="critical-vuln-threat-rule-govern__alert-content">
        <div class="critical-vuln-threat-rule-govern__alert-title">
          生成漏洞联动规则
        </div>
        <p class="critical-vuln-threat-rule-govern__alert-desc">
          选择响应动作后，系统会基于当前漏洞信息生成一条威胁检测规则。
        </p>
      </div>
    </div>

    <el-form
      ref="ruleFormRef"
      :model="ruleForm"
      :rules="ruleFormRules"
      label-width="72px"
      size="small"
      class="critical-vuln-threat-rule-govern__form"
      @submit.prevent
    >
      <el-form-item label="漏洞名称">
        <div class="critical-vuln-threat-rule-govern__vuln-name">
          {{ vulnName || '--' }}
        </div>
      </el-form-item>
      <el-form-item label="动作" prop="actionType">
        <el-select
          v-model="ruleForm.actionType"
          placeholder="请选择动作"
          class="critical-vuln-threat-rule-govern__action-select"
        >
          <el-option label="告警" value="alert" />
          <el-option label="拒绝" value="reject" />
        </el-select>
      </el-form-item>
    </el-form>

    <div class="critical-vuln-threat-rule-govern__footer">
      <el-button @click="handleBack">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleConfirm">
        确认
      </el-button>
    </div>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'

import { insertRawRuleAPI } from '@/api/vulnIntelligence'

export default {
  name: 'CriticalVulnThreatRuleGovern',
  components: {
    Warning
  },
  props: {
    // 规则上下文：传入 vulnItem 即可
    ruleContext: {
      type: Object,
      default: () => ({})
    }
  },
  data () {
    return {
      vulnItem: null,
      ruleForm: {
        actionType: 'alert'
      },
      ruleFormRules: {
        actionType: [
          { required: true, message: '请选择动作', trigger: 'change' }
        ]
      },
      submitting: false
    }
  },
  computed: {
    // 漏洞名称展示
    vulnName () {
      if (!this.vulnItem) {
        return ''
      }
      return String(this.vulnItem.vuln_name || '').trim()
    }
  },
  watch: {
    ruleContext: {
      immediate: true,
      deep: true,
      handler (contextValue) {
        this.initFromContext(contextValue)
      }
    }
  },
  methods: {
    // 根据上下文初始化表单
    initFromContext (contextValue) {
      const context =
        contextValue && typeof contextValue === 'object' ? contextValue : {}
      const nextVulnItem =
        context.vulnItem && typeof context.vulnItem === 'object'
          ? context.vulnItem
          : null

      this.vulnItem = nextVulnItem
      this.ruleForm.actionType = 'alert'
      this.submitting = false

      this.$nextTick(() => {
        if (this.$refs.ruleFormRef) {
          this.$refs.ruleFormRef.clearValidate()
        }
      })
    },

    // 从漏洞编号中解析 CVE 编号
    extractCveKeyword (vulnNumber) {
      const vulnNumberText = String(vulnNumber || '').trim()
      if (!vulnNumberText) {
        return ''
      }
      const cveMatch = vulnNumberText.match(/CVE-\d{4}-\d+/i)
      return cveMatch ? cveMatch[0].toUpperCase() : ''
    },

    // 从漏洞编号中解析 LVD 编号
    extractLvdKeyword (vulnNumber) {
      const vulnNumberText = String(vulnNumber || '').trim()
      if (!vulnNumberText) {
        return ''
      }
      const lvdMatch = vulnNumberText.match(/LVD-\d{4}-\d+/i)
      return lvdMatch ? lvdMatch[0].toUpperCase() : ''
    },

    // 构建下发规则请求参数
    buildRulePayload () {
      const assetIp = String(
        (this.vulnItem && this.vulnItem.asset_ip) || ''
      ).trim()
      const portText = String(
        this.vulnItem && this.vulnItem.port != null ? this.vulnItem.port : ''
      ).trim()

      const rawRules = this.flattenDetectRules(
        this.ruleContext && this.ruleContext.rawRules
      )
      return {
        action: this.ruleForm.actionType,
        raw_rules: this.encodeDetectRulesToBase64(rawRules),
        class_type: 'exp',
        rule_msg: this.vulnName || '威胁检测规则',
        src_ip: 'any',
        src_port: 'any',
        dst_ip: assetIp,
        dst_port: portText
      }
    },

    flattenDetectRules (value) {
      if (Array.isArray(value)) {
        return value.flatMap(item => this.flattenDetectRules(item))
      }
      if (value === undefined || value === null) return []
      const text = String(value).trim()
      if (!text) return []
      try {
        const parsed = JSON.parse(text)
        if (parsed !== value) return this.flattenDetectRules(parsed)
      } catch (error) {
        // 普通 Suricata 多行规则按换行拆分
      }
      return text.split(/\r?\n+/).map(item => item.trim()).filter(Boolean)
    },

    encodeDetectRulesToBase64 (rules) {
      return rules.map(rule => {
        const bytes = new TextEncoder().encode(String(rule || '').trim())
        let binary = ''
        bytes.forEach(byte => { binary += String.fromCharCode(byte) })
        return btoa(binary)
      }).filter(Boolean)
    },

    // 确认生成威胁检测规则
    handleConfirm () {
      if (!this.$refs.ruleFormRef) {
        return
      }

      this.$refs.ruleFormRef.validate(async valid => {
        if (!valid) {
          return
        }

        if (!this.vulnItem) {
          ElMessage.warning('缺少漏洞信息，无法生成规则')
          return
        }

        const rawRules = this.flattenDetectRules(
          this.ruleContext && this.ruleContext.rawRules
        )
        if (!rawRules.length) {
          ElMessage.warning('缺少检测规则内容，无法生成规则')
          return
        }

        const rulePayload = this.buildRulePayload()
        if (!rulePayload.dst_ip || !rulePayload.dst_port) {
          ElMessage.warning('缺少资产 IP 或端口，无法生成规则')
          return
        }

        if (!rulePayload.raw_rules.length) {
          ElMessage.warning('检测规则编码失败，无法生成规则')
          return
        }

        this.submitting = true
        try {
          const response = await insertRawRuleAPI([rulePayload])
          const responseMessage =
            (response && (response.message || response.msg)) || ''

          if (response && Number(response.code) === 0) {
            ElMessage.success(responseMessage || '生成规则成功')
            this.$emit('success', response)
            this.handleBack()
            return
          }

          ElMessage.error(responseMessage || '生成规则失败')
        } catch (error) {
          ElMessage.error(
            (error && error.message) || '生成规则失败，请稍后重试'
          )
        } finally {
          this.submitting = false
        }
      })
    },

    // 返回漏洞列表
    handleBack () {
      this.$emit('back')
    }
  }
}
</script>

<style scoped lang="scss">
.critical-vuln-threat-rule-govern {
  &__back-row {
    margin-bottom: var(--sp-2);
  }

  &__alert {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid rgba(251, 191, 36, 0.28);
    border-radius: var(--r-md);
    background: rgba(251, 191, 36, 0.08);
  }

  &__alert-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    color: var(--c-warn);
    font-size: 18px;
    border-radius: var(--r-sm);
    background: rgba(251, 191, 36, 0.15);
  }

  &__alert-content {
    flex: 1;
    min-width: 0;
  }

  &__alert-title {
    margin-bottom: 4px;
    color: var(--c-warn);
    font-size: var(--fs-md);
    font-weight: var(--fw-medium);
    line-height: 1.4;
  }

  &__alert-desc {
    margin: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }

  // &__form {
  //   ::v-deep .el-form-item__label {
  //     color: var(--c-text-secondary);
  //     font-size: var(--fs-xs);
  //     font-weight: var(--fw-semibold);
  //   }

  //   ::v-deep .el-form-item__label::before {
  //     color: var(--c-danger);
  //   }
  // }

  &__vuln-name {
    width: 100%;
    box-sizing: border-box;
    min-height: 32px;
    padding: 8px 12px;
    color: var(--c-text);
    font-size: var(--fs-sm);
    line-height: 1.6;
    word-break: break-all;
    border: 1px solid var(--c-border-light);
    border-radius: var(--r-sm);
    background: var(--c-bg-hover);
  }

  &__action-select {
    width: 100%;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-2);
    margin-top: var(--sp-4);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--c-border-light);
  }
}
</style>

<style lang="scss">
:root[data-theme='light'] {
  .critical-vuln-threat-rule-govern__alert {
    background: rgba(251, 191, 36, 0.1);
    border-color: rgba(251, 191, 36, 0.35);
  }

  .critical-vuln-threat-rule-govern__vuln-name {
    background: #f8f9fb;
    border-color: #ebeef5;
  }

  .critical-vuln-threat-rule-govern__footer {
    border-top-color: #ebeef5;
  }
}
</style>
