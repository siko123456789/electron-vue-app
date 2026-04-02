<template>
  <!-- 邮件通知表单区（可嵌入风险详情弹框，也可被 DisposeEmailNotifyDialog 包裹单独使用） -->
  <div
    class="dispose-email-notify-inner"
    :class="{ 'dispose-email-notify-inner--embedded': embedded }"
  >
    <!-- 当前风险上下文摘要 -->
    <el-card shadow="never" class="dispose-email-context-card">
      <div class="dispose-email-context-head">
        <div class="dispose-email-context-icon-wrap">
          <el-icon><Message /></el-icon>
        </div>
        <div class="dispose-email-context-head-text">
          <div class="dispose-email-context-label">通知关联</div>
          <div class="dispose-email-context-title">{{ contextTitleText }}</div>
          <p v-if="contextHintText" class="dispose-email-context-hint">
            {{ contextHintText }}
          </p>
        </div>
      </div>
    </el-card>

    <!-- 邮件配置：未配置且未选默认邮箱 -->
    <el-card
      v-if="!isEmailConfigured && !useDefaultEmail"
      shadow="never"
      class="dispose-email-form-card"
    >
      <template #header>
        <div class="dispose-email-card-header">
          <span class="dispose-email-card-header-title">
            <el-icon><Setting /></el-icon>
            发件邮箱配置
          </span>
        </div>
      </template>

      <el-alert
        class="dispose-email-alert"
        title="系统尚未配置发件邮箱，请先填写下方信息保存，或选择使用系统默认邮箱。"
        type="info"
        :closable="false"
        show-icon
      />

      <el-form
        class="dispose-email-form"
        label-position="top"
        size="small"
        @submit.prevent
      >
        <el-form-item label="协议">
          <el-radio-group v-model="emailConfig.protocol">
            <el-radio value="smtp">SMTP</el-radio>
            <el-radio value="smtps">SMTPS</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="邮件服务器地址">
          <el-input
            v-model="emailConfig.smtpserver"
            placeholder="smtp.example.com"
            clearable
          />
        </el-form-item>

        <el-form-item label="服务器端口号">
          <el-input
            v-model="emailConfig.smtpport"
            placeholder="465"
            clearable
          />
        </el-form-item>

        <el-form-item label="发件地址">
          <el-input
            v-model="emailConfig.from"
            type="email"
            placeholder="security@example.com"
            clearable
          />
        </el-form-item>

        <el-form-item label="密码/授权码">
          <el-input
            v-model="emailConfig.password"
            type="password"
            placeholder="••••••••"
            show-password
            clearable
          />
        </el-form-item>
      </el-form>

      <div class="dispose-email-form-actions">
        <el-button
          type="primary"
          :loading="emailConfigSaving"
          @click="handleSaveEmailConfig"
        >
          {{ emailConfigSaving ? '保存中...' : '保存配置并继续' }}
        </el-button>
        <el-button plain @click="useDefaultEmail = true">
          使用系统默认邮箱
        </el-button>
      </div>
    </el-card>

    <!-- 发送区 -->
    <el-card
      v-else
      shadow="never"
      class="dispose-email-form-card dispose-email-send-card"
    >
      <template #header>
        <div class="dispose-email-card-header">
          <span class="dispose-email-card-header-title">
            <el-icon><Promotion /></el-icon>
            发送邮件
          </span>
        </div>
      </template>

      <div class="dispose-email-sender-line">
        <span class="dispose-email-sender-label">当前发件人</span>
        <el-tag
          size="small"
          type="info"
          effect="plain"
          class="dispose-email-sender-tag"
        >
          {{ useDefaultEmail ? '系统默认 (smtp.163.com)' : '自定义 SMTP' }}
        </el-tag>
        <el-button link @click="resetEmailSenderChoice">
          重新配置
        </el-button>
      </div>

      <el-form
        class="dispose-email-form"
        label-position="top"
        size="small"
        @submit.prevent
      >
        <el-form-item label="收件人邮箱">
          <el-select
            v-model="receiverEmail"
            filterable
            allow-create
            default-first-option
            placeholder="name@company.com"
          >
            <el-option
              v-for="item in personListPage"
              :key="item.id"
              :label="item.email_address"
              :value="item.email_address"
            >
              <span>{{ item.email_address }} -- {{ item.name }}</span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>

      <el-tooltip
        :disabled="canSendEmail"
        :content="sendDisabledReason"
        placement="top"
      >
        <span class="dispose-email-send-tooltip-wrap">
          <el-button
            type="primary"
            class="dispose-email-send-btn"
            :loading="sendingEmail"
            :disabled="!canSendEmail"
            @click="handleSendNotify"
          >
            <el-icon v-if="!sendingEmail"><Position /></el-icon>
            {{ sendingEmail ? '发送中...' : '发送通知' }}
          </el-button>
        </span>
      </el-tooltip>
    </el-card>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Message,
  Setting,
  Promotion,
  Position
} from '@element-plus/icons-vue'

import { getEmailInfoAPI } from '@/api/attackSurface'
import { sendEmailAPI } from '@/api/aiGovernance'
import { saveEmailInfo } from '@/api/setting'
import { personList } from '@/api/object'

/**
 * 邮件通知表单区（可嵌入风险详情弹框，也可被 DisposeEmailNotifyDialog 包裹单独使用）
 */
export default {
  name: 'DisposeEmailNotifyPanel',
  components: {
    Message,
    Setting,
    Promotion,
    Position
  },
  props: {
    /**
     * { category: 'vuln'|'weak'|'port'|'workorder'|'attack_surface', item: Object, assetIp: string,
     *   vulnIds?: number[], backendDisabled?: boolean }
     */
    notifyContext: {
      type: Object,
      default: null
    },
    /** 为 true 时表示嵌在父级弹框内，仅用于样式微调 */
    embedded: {
      type: Boolean,
      default: false
    }
  },
  emits: ['sent'],
  setup(props, { emit }) {
    const isEmailConfigured = ref(false)
    const useDefaultEmail = ref(false)
    const emailConfigSaving = ref(false)
    const sendingEmail = ref(false)
    const receiverEmail = ref('')
    const personListPage = ref([])

    const emailConfig = reactive({
      protocol: 'smtp',
      smtpserver: '',
      smtpport: '',
      from: '',
      password: ''
    })

    const contextTitleText = computed(() => {
      const context = props.notifyContext
      if (!context || !context.item) return '—'

      if (context.category === 'workorder') {
        return context.item.title || `工单全部漏洞通知（${context.assetIp || '-'}）`
      }

      if (context.category === 'attack_surface') {
        return context.item.title || `资产漏洞汇总通知（${context.assetIp || '-'}）`
      }

      const row = context.item

      if (context.category === 'vuln') {
        return row.title || row.vuln_name || '漏洞风险'
      }

      if (context.category === 'weak') {
        return row.title || '弱口令风险'
      }

      if (context.category === 'port') {
        return `端口 ${row.port} (${row.service || '服务'})`
      }

      return '—'
    })

    const buildSuggestionText = () => {
      const context = props.notifyContext
      if (!context || !context.item) return ''

      if (context.category === 'workorder') {
        const count = resolvedVulnIdsForApi.value.length
        return `将本工单下共 ${count} 条漏洞记录汇总发送至收件人邮箱。`
      }

      if (context.category === 'attack_surface') {
        const count = resolvedVulnIdsForApi.value.length
        return `将当前资产下共 ${count} 条漏洞记录汇总发送至收件人邮箱。`
      }

      const row = context.item

      if (context.category === 'vuln') {
        return (row.description || row.desc || '').trim()
      }

      if (context.category === 'weak') {
        return (row.description || '').trim()
      }

      if (context.category === 'port') {
        const vulnLines = (row.vulns || [])
          .map(v => v.title || '')
          .filter(Boolean)

        const vulnPart =
          vulnLines.length > 0
            ? `关联漏洞：${vulnLines.join('；')}`
            : '暂无关联漏洞条目'

        return `端口 ${row.port}（${row.service || '服务'}）高危暴露治理提醒。\n${vulnPart}`
      }

      return ''
    }

    const contextHintText = computed(() => {
      const text = (buildSuggestionText() || '').trim()
      if (!text) return ''
      const maxLen = 120
      return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
    })

    const backendDisabled = computed(() => {
      return !!(props.notifyContext && props.notifyContext.backendDisabled)
    })

    const resolvedVulnIdsForApi = computed(() => {
      const context = props.notifyContext || {}
      const ids = Array.isArray(context.vulnIds) ? context.vulnIds : []
      return ids
        .map(item => (item != null && item !== '' ? Number(item) : NaN))
        .filter(num => Number.isFinite(num) && num > 0)
    })

    const canSendEmail = computed(() => {
      const receiver = (receiverEmail.value || '').trim()
      return (
        !sendingEmail.value &&
        !!receiver &&
        resolvedVulnIdsForApi.value.length > 0 &&
        !backendDisabled.value
      )
    })

    const sendDisabledReason = computed(() => {
      if (sendingEmail.value) return '邮件发送中，请稍后…'
      if (backendDisabled.value) return '当前任务缺少漏洞ID，暂时无法进行通知操作'
      if (resolvedVulnIdsForApi.value.length === 0) return '缺少漏洞ID，暂时无法发送通知'
      const receiver = (receiverEmail.value || '').trim()
      if (!receiver) return '请先填写收件人邮箱'
      return ''
    })

    const resolvedVulnIdForApi = computed(() => {
      const context = props.notifyContext
      if (!context || context.category !== 'vuln' || !context.item) return null

      const row = context.item
      const raw =
        row.vuln_id != null
          ? row.vuln_id
          : row.vulnId != null
          ? row.vulnId
          : row.id

      if (raw == null) return null
      const num = Number(raw)
      return Number.isFinite(num) ? num : null
    })

    const resetEmailSenderChoice = () => {
      isEmailConfigured.value = false
      useDefaultEmail.value = false
    }

    const resetLocalState = () => {
      receiverEmail.value = ''
      resetEmailSenderChoice()
      emailConfig.protocol = 'smtp'
      emailConfig.smtpserver = ''
      emailConfig.smtpport = ''
      emailConfig.from = ''
      emailConfig.password = ''
    }

    const loadEmailConfig = async () => {
      try {
        const response = await getEmailInfoAPI()
        if (!response || response.code !== 0) {
          ElMessage.warning((response && response.msg) || '获取邮件配置失败')
          return
        }

        const emailConfigInfo = response.data || {}
        emailConfig.protocol = String(emailConfigInfo.proto || 'SMTP').toLowerCase()
        emailConfig.smtpserver = emailConfigInfo.smtpserver || ''
        emailConfig.smtpport =
          emailConfigInfo.smtpport != null ? String(emailConfigInfo.smtpport) : ''
        emailConfig.from = emailConfigInfo.from || ''
        emailConfig.password = emailConfigInfo.password || ''
        isEmailConfigured.value = true
      } catch (error) {
        console.error(error)
        ElMessage.error('获取邮件配置失败')
      }
    }

    const validateEmailConfigForm = () => {
      const smtpserver = (emailConfig.smtpserver || '').trim()
      const smtpport = String(emailConfig.smtpport || '').trim()
      const fromAddr = (emailConfig.from || '').trim()
      const password = (emailConfig.password || '').trim()

      if (!smtpserver || !smtpport || !fromAddr || !password) {
        ElMessage.warning('请填写服务器地址、端口、发件地址和密码')
        return false
      }
      return true
    }

    const handleSaveEmailConfig = async () => {
      if (emailConfigSaving.value) return
      if (!validateEmailConfigForm()) return

      emailConfigSaving.value = true
      const protoKey = String(emailConfig.protocol || 'smtp').toLowerCase()

      const payload = {
        proto: protoKey === 'smtps' ? 'SMTPS' : 'SMTP',
        smtpserver: (emailConfig.smtpserver || '').trim(),
        smtpport: Number(emailConfig.smtpport),
        from: (emailConfig.from || '').trim(),
        password: (emailConfig.password || '').trim()
      }

      try {
        const response = await saveEmailInfo(payload)
        if (response && response.code === 0) {
          ElMessage.success((response && response.msg) || '保存成功')
          isEmailConfigured.value = true
          useDefaultEmail.value = false
        } else {
          ElMessage.error((response && response.msg) || '保存失败')
        }
      } catch (error) {
        console.error(error)
        ElMessage.error('保存失败')
      } finally {
        emailConfigSaving.value = false
      }
    }

    const handleSendNotify = async () => {
      if (sendingEmail.value) return

      const receiver = (receiverEmail.value || '').trim()
      const vulnIds = resolvedVulnIdsForApi.value

      if (!receiver || vulnIds.length === 0) {
        ElMessage.warning('请补全收件人邮箱与漏洞ID后再发送')
        return
      }

      if (backendDisabled.value) {
        ElMessage.warning('当前任务暂时无法进行通知操作')
        return
      }

      if (!useDefaultEmail.value) {
        if (!isEmailConfigured.value || !validateEmailConfigForm()) {
          return
        }
      }

      sendingEmail.value = true
      try {
        const response = await sendEmailAPI({
          vuln_ids: vulnIds,
          use_default: !!useDefaultEmail.value,
          receiver_email: receiver
        })

        if (response && response.code === 0) {
          ElMessage.success('邮件发送成功')
          emit('sent', { demo: false })
        } else {
          ElMessage.error((response && response.msg) || '发送通知失败')
        }
      } catch (error) {
        console.error(error)
        ElMessage.error('发送通知失败')
      } finally {
        sendingEmail.value = false
      }
    }

    const onContextActive = async () => {
      receiverEmail.value = ''
      await loadEmailConfig()
    }

    const getPersonList = async () => {
      const data = {
        condition: '',
        currentPage: 1,
        pageSize: 1000000
      }

      try {
        const response = await personList(data)
        const responseData = response?.data || {}
        const list = Array.isArray(responseData.personList)
          ? responseData.personList
          : []

        personListPage.value = list.filter(item => item.email_address)
      } catch (error) {
        console.error(error)
      }
    }

    watch(
      () => props.notifyContext,
      async (value) => {
        if (value && value.item) {
          await onContextActive()
        } else {
          resetLocalState()
        }
      },
      {
        immediate: true,
        deep: true
      }
    )

    onMounted(() => {
      getPersonList()
    })

    return {
      isEmailConfigured,
      useDefaultEmail,
      emailConfigSaving,
      sendingEmail,
      receiverEmail,
      emailConfig,
      personListPage,
      contextTitleText,
      contextHintText,
      backendDisabled,
      resolvedVulnIdsForApi,
      canSendEmail,
      sendDisabledReason,
      resolvedVulnIdForApi,
      resetEmailSenderChoice,
      handleSaveEmailConfig,
      handleSendNotify
    }
  }
}
</script>

<style lang="scss" scoped>
.dispose-email-notify-inner {
  max-height: 63vh;
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

  &--embedded {
    max-height: 63vh;
    padding-top: 2px;
  }
}

.dispose-email-context-card {
  margin-bottom: 14px;
  border-radius: 14px !important;
  border: 1px solid #e9e8ff !important;
  background: linear-gradient(
    135deg,
    #fafaff 0%,
    #ffffff 52%,
    #f5f3ff 100%
  ) !important;
  box-shadow: 0 4px 18px rgba(124, 58, 237, 0.08) !important;
}

.dispose-email-send-tooltip-wrap {
  display: inline-block;
}

.dispose-email-context-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.el-select{
  width: 100%;
}

.dispose-email-context-icon-wrap {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
  background: linear-gradient(145deg, #7c3aed 0%, #a855f7 100%);
  box-shadow: 0 6px 16px rgba(124, 58, 237, 0.35);
}

.dispose-email-context-head-text {
  flex: 1;
  min-width: 0;
}

.dispose-email-context-label {
  font-size: 11px;
  font-weight: 700;
  color: #7c3aed;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.dispose-email-context-title {
  font-size: 15px;
  font-weight: 800;
  color: #111827;
  line-height: 1.5;
}

.dispose-email-context-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6b7280;
}

.dispose-email-form-card {
  border-radius: 14px !important;
  border: 1px solid #e5e7eb !important;
  background: #ffffff !important;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06) !important;

  &.dispose-email-send-card {
    margin-top: 0;
  }
}

.dispose-email-card-header {
  display: flex;
  align-items: center;
}

.dispose-email-card-header-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 800;
  color: #111827;

  i {
    font-size: 16px;
    color: #7c3aed;
  }
}

.dispose-email-alert {
  margin-bottom: 16px;
}

.dispose-email-form {
  margin-top: 4px;

  :deep(.el-form-item__label){
    color: #4b5563;
    font-weight: 600;
    padding-bottom: 4px;
    line-height: 1.4;
  }

  :deep(.el-input__inner){
    border-radius: 8px;
  }

  :deep(.el-input-group__prepend ){
    background: #f9fafb;
    color: #7c3aed;
    border-color: #e5e7eb;
  }
}

.dispose-email-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
  padding-top: 4px;

   :deep(.el-button--primary ){
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    border-color: #7c3aed;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
    &:hover,
    &:focus {
      background: linear-gradient(135deg, #6d28d9 0%, #9333ea 100%);
      border-color: #6d28d9;
    }
  }

  :deep(.el-button--primary.is-plain){
    color: #5b21b6;
    border-color: #c4b5fd;
    background: #f5f3ff;
    box-shadow: none;
    &:hover {
      background: #ede9fe;
    }
  }
}

.dispose-email-sender-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f9fafb;
  border: 1px solid #f3f4f6;
}

.dispose-email-sender-label {
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
}

.dispose-email-sender-tag {
  font-weight: 700;
}

.dispose-email-send-btn {
  width: 100%;
  margin-top: 12px;
  border-radius: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 12px 20px;

  :deep(.el-icon){
    margin-right: 6px;
  }
}
</style>

<style lang="scss">
.dispose-email-notify-panel-host {
  .dispose-email-context-card .el-card__body {
    padding: 16px 18px;
  }

  .dispose-email-form-card .el-card__header {
    padding: 12px 18px;
    border-bottom: 1px solid #f3f4f6;
    background: linear-gradient(180deg, #fafafa 0%, #ffffff 100%);
  }

  .dispose-email-form-card .el-card__body {
    padding: 16px 18px 18px;
  }
}

.dispose-email-notify-dialog.dispose-workbench-shell {
  .dispose-email-form-card .el-card__header {
    padding: 12px 18px;
    border-bottom: 1px solid #f3f4f6;
    background: linear-gradient(180deg, #fafafa 0%, #ffffff 100%);
  }

  .dispose-email-form-card .el-card__body {
    padding: 16px 18px 18px;
  }

  .dispose-email-context-card .el-card__body {
    padding: 16px 18px;
  }
}
</style>
