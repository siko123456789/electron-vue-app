<template>
  <!-- 邮件通知 -->
  <div class="email-notif">
    <!-- 当前风险上下文摘要 -->
    <el-card shadow="never" class="email-notif__context-card">
      <div class="email-notif__context-head">
        <div class="email-notif__context-icon-wrap">
          <i class="el-icon-message" />
        </div>
        <div class="email-notif__context-head-text">
          <div class="email-notif__context-label">通知关联</div>
          <div class="email-notif__context-title">{{ contextTitleText }}</div>
          <p v-if="contextHintText" class="email-notif__context-hint">
            {{ contextHintText }}
          </p>
        </div>
      </div>
    </el-card>

    <!-- 发件邮箱配置 -->
    <el-card
      v-if="!isEmailConfigured && !useDefaultEmail"
      shadow="never"
      class="email-notif__form-card"
    >
      <div slot="header" class="email-notif__card-header">
        <span class="email-notif__card-header-title">
          <i class="el-icon-setting" />
          发件邮箱配置
        </span>
      </div>

      <div class="email-notif__info-tip">
        <i class="el-icon-info email-notif__info-tip-icon" />
        <p class="email-notif__info-tip-text">
          系统尚未配置发件邮箱，请先填写下方信息保存，或选择使用系统默认邮箱。
        </p>
      </div>

      <el-form
        class="email-notif__form"
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
            placeholder="security@example.com"
            clearable
          />
        </el-form-item>
        <el-form-item label="密码/授权码">
          <el-input
            v-model="emailConfig.password"
            type="password"
            placeholder="请输入密码或授权码"
            show-password
            clearable
          />
        </el-form-item>
      </el-form>

      <div class="email-notif__form-actions">
        <el-button
          type="primary"
          size="default"
          :loading="emailConfigSaving"
          @click="handleSaveEmailConfig"
        >
          {{ emailConfigSaving ? '保存中...' : '保存配置并继续' }}
        </el-button>
        <el-button size="default" @click="handleUseDefaultEmail">
          使用系统默认邮箱
        </el-button>
      </div>
    </el-card>

    <!-- 发送邮件 -->
    <el-card
      v-else
      shadow="never"
      class="email-notif__form-card email-notif__send-card"
    >
      <div slot="header" class="email-notif__card-header">
        <span class="email-notif__card-header-title">
          <i class="iconfont icon-send" />
          发送邮件
        </span>
      </div>

      <div class="email-notif__sender-line">
        <span class="email-notif__sender-label">当前发件人</span>
        <el-tag
          size="small"
          effect="plain"
          class="email-notif__sender-tag"
          :class="{ 'email-notif__sender-tag--system': useDefaultEmail }"
        >
          {{
            useDefaultEmail ? `系统默认 (${defaultSmtpServer})` : '自定义 SMTP'
          }}
        </el-tag>
        <el-button link @click="resetEmailSenderChoice">
          重新配置
        </el-button>
      </div>

      <el-form
        class="email-notif__form"
        label-position="top"
        size="small"
        @submit.prevent
      >
        <el-form-item label="收件人邮箱">
          <el-autocomplete
            ref="receiverEmailAutocompleteRef"
            v-model="receiverEmail"
            class="email-notif__receiver-autocomplete"
            popper-class="email-notif-autocomplete-dropdown"
            :fetch-suggestions="fetchReceiverEmailSuggestions"
            placeholder="name@company.com"
            clearable
            :trigger-on-focus="true"
            @select="handleReceiverEmailSelect"
          >
            <template #default="{ item }">
              <span>{{ item.email_address }} -- {{ item.name }}</span>
            </template>
          </el-autocomplete>
        </el-form-item>
      </el-form>

      <div class="email-notif__send-footer">
        <el-tooltip
          :disabled="canSendEmail"
          :content="sendDisabledReason"
          placement="top"
        >
          <span class="email-notif__send-tooltip-wrap">
            <el-button
              type="primary"
              size="large"
              class="email-notif__send-btn"
              :loading="sendingEmail"
              :disabled="!canSendEmail"
              @click="handleSendNotify"
            >
              <i v-if="!sendingEmail" class="el-icon-position" />
              {{ sendingEmail ? '发送中...' : '发送通知' }}
            </el-button>
          </span>
        </el-tooltip>
      </div>
    </el-card>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus'

import { personList } from '@/api/assets'
import { emailInfo, saveEmailInfo, sendEmailAPI } from '@/api/setting'

export default {
  name: 'EmailNotif',
  props: {
    // 通知上下文：vulnItem、vulnIds、assetIp
    notifyContext: {
      type: Object,
      default: () => ({})
    }
  },
  data () {
    return {
      isEmailConfigured: false,
      useDefaultEmail: false,
      emailConfigSaving: false,
      sendingEmail: false,
      receiverEmail: '',
      defaultSmtpServer: 'smtp.163.com',
      emailConfig: {
        protocol: 'smtp',
        smtpserver: '',
        smtpport: '',
        from: '',
        password: ''
      },
      personListPage: []
    }
  },
  computed: {
    // 通知标题
    contextTitleText () {
      const vulnItem = this.currentVulnItem
      if (!vulnItem) {
        return '—'
      }
      return vulnItem.vuln_name || '漏洞风险'
    },
    // 通知描述摘要
    contextHintText () {
      const describeText = String(
        (this.currentVulnItem && this.currentVulnItem.describe) || ''
      ).trim()
      if (!describeText) {
        return ''
      }
      const maxLength = 120
      return describeText.length > maxLength
        ? `${describeText.slice(0, maxLength)}…`
        : describeText
    },
    // 当前漏洞卡片
    currentVulnItem () {
      const context =
        this.notifyContext && typeof this.notifyContext === 'object'
          ? this.notifyContext
          : {}
      return context.vulnItem && typeof context.vulnItem === 'object'
        ? context.vulnItem
        : null
    },
    // 发送接口使用的漏洞 ID 列表
    resolvedVulnIdsForApi () {
      const context =
        this.notifyContext && typeof this.notifyContext === 'object'
          ? this.notifyContext
          : {}
      const contextIds = Array.isArray(context.vulnIds) ? context.vulnIds : []
      const vulnItem = this.currentVulnItem
      const itemId =
        vulnItem && vulnItem.id != null
          ? vulnItem.id
          : vulnItem && vulnItem.vuln_id != null
          ? vulnItem.vuln_id
          : null
      const mergedIds = [...contextIds, itemId]
      return [
        ...new Set(
          mergedIds
            .map(item => Number(item))
            .filter(item => Number.isFinite(item) && item > 0)
        )
      ]
    },
    // 是否可发送邮件
    canSendEmail () {
      const receiverEmail = String(this.receiverEmail || '').trim()
      return (
        !this.sendingEmail &&
        Boolean(receiverEmail) &&
        this.resolvedVulnIdsForApi.length > 0
      )
    },
    // 发送按钮禁用原因
    sendDisabledReason () {
      if (this.sendingEmail) {
        return '邮件发送中，请稍后…'
      }
      if (this.resolvedVulnIdsForApi.length === 0) {
        return '缺少漏洞 ID，暂时无法发送通知'
      }
      if (!String(this.receiverEmail || '').trim()) {
        return '请先填写收件人邮箱'
      }
      return ''
    }
  },
  watch: {
    notifyContext: {
      immediate: true,
      deep: true,
      handler (contextValue) {
        const context =
          contextValue && typeof contextValue === 'object' ? contextValue : {}
        if (context.vulnItem) {
          this.onContextActive()
        } else {
          this.resetLocalState()
        }
      }
    }
  },
  mounted () {
    this.fetchPersonList()
  },
  methods: {
    // 当前漏洞进入通知视图时初始化
    async onContextActive () {
      this.receiverEmail = ''
      this.useDefaultEmail = false
      await this.loadEmailConfig()
    },

    // 获取负责人列表
    async fetchPersonList () {
      try {
        const response = await personList({
          condition: '',
          currentPage: 1,
          pageSize: 1000000
        })
        const responseData = (response && response.data) || {}
        const personItems = Array.isArray(responseData.personList)
          ? responseData.personList
          : []
        this.personListPage = personItems.filter(
          personItem => personItem && personItem.email_address
        )
      } catch (error) {
        this.personListPage = []
      }
    },

    // 收件人邮箱联想
    fetchReceiverEmailSuggestions (queryString, callback) {
      const keyword = String(queryString || '')
        .trim()
        .toLowerCase()
      const matchedList = (this.personListPage || [])
        .filter(personItem => {
          const emailText = String(personItem.email_address || '').trim()
          if (!emailText) {
            return false
          }
          if (!keyword) {
            return true
          }
          const nameText = String(personItem.name || '')
            .trim()
            .toLowerCase()
          return (
            emailText.toLowerCase().includes(keyword) ||
            nameText.includes(keyword)
          )
        })
        .map(personItem => ({
          value: String(personItem.email_address).trim(),
          email_address: String(personItem.email_address).trim(),
          name: String(personItem.name || '').trim()
        }))
      callback(matchedList)
    },

    // 选中联想收件人
    handleReceiverEmailSelect (selectedItem) {
      const emailText =
        (selectedItem && selectedItem.value) ||
        (selectedItem && selectedItem.email_address) ||
        ''
      this.receiverEmail = String(emailText).trim()
    },

    // 解析发送用的收件人邮箱
    resolveReceiverEmailForSend () {
      const autocompleteRef = this.$refs.receiverEmailAutocompleteRef
      const inputComponent =
        autocompleteRef && autocompleteRef.$refs
          ? autocompleteRef.$refs.input
          : null
      const inputDom =
        inputComponent && inputComponent.$refs
          ? inputComponent.$refs.input
          : null
      const inputValue =
        inputDom && inputDom.value != null ? String(inputDom.value).trim() : ''
      const modelValue = String(this.receiverEmail || '').trim()
      if (inputValue && inputValue.includes('@')) {
        return inputValue
      }
      return modelValue
    },

    // 判断邮件配置是否完整
    hasCompleteEmailConfig (emailConfigInfo) {
      const configInfo =
        emailConfigInfo && typeof emailConfigInfo === 'object'
          ? emailConfigInfo
          : {}
      return Boolean(
        String(configInfo.smtpserver || '').trim() &&
          String(configInfo.from || '').trim() &&
          configInfo.smtpport != null &&
          String(configInfo.smtpport).trim() &&
          String(configInfo.password || '').trim()
      )
    },

    // 填充邮件配置表单
    fillEmailConfigForm (emailConfigInfo) {
      const configInfo =
        emailConfigInfo && typeof emailConfigInfo === 'object'
          ? emailConfigInfo
          : {}
      this.emailConfig.protocol = String(
        configInfo.proto || 'smtp'
      ).toLowerCase()
      this.emailConfig.smtpserver = configInfo.smtpserver || ''
      this.emailConfig.smtpport =
        configInfo.smtpport != null ? String(configInfo.smtpport) : ''
      this.emailConfig.from = configInfo.from || ''
      this.emailConfig.password = configInfo.password || ''
      if (configInfo.smtpserver) {
        this.defaultSmtpServer = String(configInfo.smtpserver).trim()
      }
    },

    // 加载邮件服务器配置
    async loadEmailConfig () {
      try {
        const response = await emailInfo()
        if (!response || Number(response.code) !== 0) {
          this.isEmailConfigured = false
          ElMessage.warning(
            (response && (response.msg || response.message)) ||
              '获取邮件配置失败'
          )
          return
        }

        const emailConfigInfo = response.data || {}
        this.fillEmailConfigForm(emailConfigInfo)
        this.isEmailConfigured = this.hasCompleteEmailConfig(emailConfigInfo)
      } catch (error) {
        this.isEmailConfigured = false
        ElMessage.error('获取邮件配置失败')
      }
    },

    // 校验邮箱配置表单
    validateEmailConfigForm () {
      const smtpServer = String(this.emailConfig.smtpserver || '').trim()
      const smtpPort = String(this.emailConfig.smtpport || '').trim()
      const fromAddress = String(this.emailConfig.from || '').trim()
      const password = String(this.emailConfig.password || '').trim()
      if (!smtpServer || !smtpPort || !fromAddress || !password) {
        ElMessage.warning('请填写服务器地址、端口、发件地址和密码')
        return false
      }
      return true
    },

    // 保存邮件配置并继续
    async handleSaveEmailConfig () {
      if (this.emailConfigSaving) {
        return
      }
      if (!this.validateEmailConfigForm()) {
        return
      }

      this.emailConfigSaving = true
      const protocolKey = String(
        this.emailConfig.protocol || 'smtp'
      ).toLowerCase()
      const payload = {
        proto: protocolKey === 'smtps' ? 'SMTPS' : 'SMTP',
        smtpserver: String(this.emailConfig.smtpserver || '').trim(),
        smtpport: Number(this.emailConfig.smtpport),
        from: String(this.emailConfig.from || '').trim(),
        password: String(this.emailConfig.password || '').trim()
      }

      try {
        const response = await saveEmailInfo(payload)
        if (response && Number(response.code) === 0) {
          ElMessage.success(
            (response && (response.msg || response.message)) || '保存成功'
          )
          this.isEmailConfigured = true
          this.useDefaultEmail = false
          this.defaultSmtpServer = payload.smtpserver
          return
        }
        ElMessage.error(
          (response && (response.msg || response.message)) || '保存失败'
        )
      } catch (error) {
        ElMessage.error('保存失败')
      } finally {
        this.emailConfigSaving = false
      }
    },

    // 使用系统默认邮箱
    handleUseDefaultEmail () {
      this.useDefaultEmail = true
    },

    // 重新配置发件邮箱
    resetEmailSenderChoice () {
      this.isEmailConfigured = false
      this.useDefaultEmail = false
    },

    // 发送邮件通知
    async handleSendNotify () {
      if (this.sendingEmail) {
        return
      }

      const receiverEmail = this.resolveReceiverEmailForSend()
      this.receiverEmail = receiverEmail
      const vulnIds = this.resolvedVulnIdsForApi

      if (!receiverEmail || !vulnIds.length) {
        ElMessage.warning('请补全收件人邮箱与漏洞 ID 后再发送')
        return
      }

      if (!this.useDefaultEmail) {
        if (!this.isEmailConfigured || !this.validateEmailConfigForm()) {
          return
        }
      }

      this.sendingEmail = true
      try {
        const response = await sendEmailAPI({
          vuln_ids: vulnIds,
          use_default: Boolean(this.useDefaultEmail),
          receiver_email: receiverEmail
        })
        if (response && Number(response.code) === 0) {
          ElMessage.success('邮件发送成功')
          this.$emit('sent')
          return
        }
        ElMessage.error(
          (response && (response.msg || response.message)) || '发送通知失败'
        )
      } catch (error) {
        ElMessage.error('发送通知失败')
      } finally {
        this.sendingEmail = false
      }
    },

    // 重置本地状态
    resetLocalState () {
      this.receiverEmail = ''
      this.resetEmailSenderChoice()
      this.emailConfig = {
        protocol: 'smtp',
        smtpserver: '',
        smtpport: '',
        from: '',
        password: ''
      }
    },

    // 返回漏洞列表
    handleBack () {
      this.$emit('back')
    }
  }
}
</script>

<style scoped lang="scss">
.email-notif {
  &__context-card {
    margin-bottom: var(--sp-4);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    background: linear-gradient(
      135deg,
      var(--c-primary-bg) 0%,
      var(--c-bg-card) 52%,
      var(--c-primary-bg) 100%
    );
    box-shadow: var(--shadow-sm);

    ::v-deep .el-card__body {
      padding: var(--sp-4);
    }
  }

  &__context-head {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
  }

  &__context-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    color: var(--c-text-on-primary);
    font-size: var(--fs-xl);
    border-radius: var(--r-md);
    background: linear-gradient(
      145deg,
      var(--c-primary) 0%,
      var(--c-primary-light) 100%
    );
    box-shadow: 0 6px 16px var(--c-primary-bg);
  }

  &__context-head-text {
    flex: 1;
    min-width: 0;
  }

  &__context-label {
    margin-bottom: var(--sp-2);
    color: var(--c-primary);
    font-size: var(--fs-xs);
    font-weight: var(--fw-bold);
    letter-spacing: 0.06em;
  }

  &__context-title {
    color: var(--c-text);
    font-size: var(--fs-md);
    font-weight: var(--fw-medium);
    line-height: 1.5;
  }

  &__context-hint {
    margin: var(--sp-2) 0 0;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 1.6;
  }

  &__form-card {
    overflow: hidden;
    border: 1px solid var(--c-border-light);
    border-radius: var(--r-lg);
    background: var(--c-bg-card);
    box-shadow: var(--shadow-sm);

    ::v-deep .el-card__header {
      padding: var(--sp-3) var(--sp-4);
      border-bottom: 1px solid var(--c-border-light);
      background: var(--c-bg-hover);
    }

    ::v-deep .el-card__body {
      padding: var(--sp-4);
    }
  }

  &__card-header-title {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    color: var(--c-text);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);

    i {
      color: var(--c-primary);
      font-size: var(--fs-md);
    }
  }

  &__info-tip {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--c-border-light);
    border-radius: var(--r-md);
    background: var(--c-bg-hover);
  }

  &__info-tip-icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--c-primary-light);
    font-size: var(--fs-md);
  }

  &__info-tip-text {
    margin: 0;
    color: var(--c-text-secondary);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }

  &__form {
    ::v-deep .el-form-item__label {
      padding-bottom: var(--sp-1);
      color: var(--c-text-secondary);
      font-size: var(--fs-sm);
      font-weight: var(--fw-semibold);
      line-height: 1.4;
    }
  }

  &__form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-top: var(--sp-2);

    ::v-deep .el-button + .el-button {
      margin-left: 0;
    }
  }

  &__sender-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--c-border-light);
    border-radius: var(--r-md);
    background: var(--c-bg-hover);
  }

  &__sender-label {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: var(--fw-bold);
  }

  &__sender-tag {
    color: var(--c-text-secondary);
    font-weight: var(--fw-semibold);
    border-color: var(--c-border-strong);
    background: var(--c-bg-card);

    &--system {
      color: var(--c-system-default-tag-color);
      border-color: var(--c-system-default-tag-border);
      background: var(--c-system-default-tag-bg);
    }
  }

  &__receiver-autocomplete {
    width: 100%;
  }

  &__send-footer {
    margin-top: var(--sp-4);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--c-border-light);
  }

  &__send-tooltip-wrap {
    display: inline-block;
    width: 100%;
  }

  &__send-btn {
    height: 36px;
    width: 100%;
  }
}
</style>
