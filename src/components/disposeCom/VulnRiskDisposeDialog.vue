<template>
  <!-- 关键漏洞 -->
  <el-dialog
    v-model="dialogVisible"
    :width="disposeDialogShellWidth"
    :custom-class="'dispose-risk-dialog dispose-risk-dialog--vuln dispose-workbench-shell'"
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
        >
          返回详情
        </el-button>
        <span class="dispose-risk-dialog-heading">
          {{ embeddedSubViewTitle }}
        </span>
      </div>
      <span v-else>关键漏洞 详情</span>
    </template>

    <div v-if="embeddedEmailContext" class="dispose-email-notify-panel-host">
      <DisposeEmailNotifyPanel
        :notify-context="embeddedEmailContext"
        embedded
        @sent="handleEmbeddedNotifySent"
      />
    </div>

    <div
      v-else-if="embeddedConvergenceContext"
      class="dispose-service-convergence-host"
    >
      <ServiceConvergencePanel
        ref="convergencePanelRef"
        embedded
        :asset-summary="embeddedConvergenceContext.assetSummary"
        :convergence-context="embeddedConvergenceContext"
        @agent-installed-change="handleConvergenceAgentInstalledChange"
      />
    </div>

    <div v-else class="dispose-risk-dialog-body">
      <el-empty
        v-if="!displayList.length"
        description="暂无漏洞数据"
        :image-size="72"
      />
      <template v-else>
        <div
          v-for="(vulnItem, vulnIndex) in displayList"
          :key="vulnItem.id"
          class="dispose-vuln-card"
        >
          <div class="dispose-vuln-card-head">
            <div class="dispose-vuln-card-head-main">
              <h4 class="dispose-vuln-title">
                {{
                  (taskRow && vulnIndex === 0 && taskRow.vuln_name) ||
                  vulnItem.title
                }}
              </h4>

              <div
                v-if="
                  taskRow && vulnIndex === 0 && (taskRow.asset_ip || taskRow.port)
                "
                class="dispose-risk-title-sub"
              >
                <span v-if="taskRow.asset_ip" class="dispose-risk-title-sub-item">
                  <span class="dispose-risk-title-sub-k">资产 IP</span>
                  <span class="dispose-risk-title-sub-v">{{ taskRow.asset_ip }}</span>
                </span>

                <span
                  v-if="taskRow.asset_ip && taskRow.port"
                  class="dispose-risk-title-sub-sep"
                >
                  •
                </span>

                <span v-if="taskRow.port" class="dispose-risk-title-sub-item">
                  <span class="dispose-risk-title-sub-k">端口</span>
                  <span class="dispose-risk-title-sub-v">{{ taskRow.port }}</span>
                </span>
              </div>
            </div>

            <el-button
              link
              class="dispose-vuln-toggle"
              @click="toggleExpand(vulnItem)"
            >
              {{ expandedIds.includes(vulnItem.id) ? '收起' : '详情' }}
              <el-icon>
                <ArrowUp v-if="expandedIds.includes(vulnItem.id)" />
                <ArrowRight v-else />
              </el-icon>
            </el-button>
          </div>

          <el-collapse-transition>
            <div
              v-show="expandedIds.includes(vulnItem.id)"
              class="dispose-vuln-expand"
            >
              <div v-if="taskRow && vulnIndex === 0" class="dispose-risk-meta">
                <span
                  v-if="taskRow.task_create_time"
                  class="dispose-risk-meta-item"
                >
                  <span class="dispose-risk-meta-k">创建</span>
                  <span class="dispose-risk-meta-v">{{ taskRow.task_create_time }}</span>
                </span>

                <span
                  v-if="taskRow.task_update_time"
                  class="dispose-risk-meta-item"
                >
                  <span class="dispose-risk-meta-k">更新</span>
                  <span class="dispose-risk-meta-v">{{ taskRow.task_update_time }}</span>
                </span>
              </div>

              <div
                v-if="taskRow && vulnIndex === 0 && taskRow.vuln_number"
                class="dispose-risk-block"
              >
                <div class="dispose-risk-block-k">漏洞编号</div>
                <div class="dispose-risk-block-v dispose-risk-block-v--mono">
                  {{ taskRow.vuln_number }}
                </div>
              </div>

              <p class="dispose-vuln-desc">
                {{ getVulnSuggestionText(vulnItem.id) || vulnItem.description }}
              </p>

              <div class="dispose-vuln-actions">
                <el-button
                  size="small"
                  type="success"
                  plain
                  @click="emitConvergenceForItem(vulnItem)"
                >
                  收敛
                </el-button>

                <el-button
                  size="small"
                  plain
                  :loading="!!verifyLoadingMap[vulnItem.id]"
                  @click="handleVerifyClick(vulnItem)"
                >
                  验证
                </el-button>

                <el-button
                  v-if="enableThreatRuleGeneration"
                  size="small"
                  type="warning"
                  plain
                  @click="openThreatRuleDialog(vulnItem, vulnIndex)"
                >
                  生成威胁检测规则
                </el-button>

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
                      @click="emitNotifyForItem(vulnItem)"
                    >
                      通知
                    </el-button>
                  </span>
                </el-tooltip>

                <el-button
                  size="small"
                  type="primary"
                  @click="emitDownloadReport(vulnItem)"
                >
                  生成报告
                </el-button>
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
        >
          确认优化
        </el-button>
      </span>

      <span v-else class="dialog-footer">
        <el-button type="primary" @click="dialogVisible = false">关 闭</el-button>
      </span>
    </template>

    <el-dialog
      v-model="threatRuleDialogVisible"
      title="生成威胁检测规则"
      width="480px"
      :custom-class="'threat-rule-dialog'"
      append-to-body
      @close="handleThreatRuleDialogClose"
    >
      <div class="dispose-rule-dialog-intro">
        <div class="dispose-rule-dialog-intro__icon">
          <el-icon><Warning /></el-icon>
        </div>
        <div class="dispose-rule-dialog-intro__content">
          <div class="dispose-rule-dialog-intro__title">生成漏洞联动规则</div>
          <div class="dispose-rule-dialog-intro__desc">
            选择响应动作后，系统会基于当前漏洞信息生成一条威胁检测规则。
          </div>
        </div>
      </div>

      <el-form
        ref="threatRuleFormRef"
        :model="ruleForm"
        :rules="ruleFormRules"
        label-width="80px"
        class="dispose-rule-dialog-form"
      >
        <el-form-item label="漏洞名称">
          <div class="dispose-rule-dialog-name">
            {{ currentThreatRuleVulnName || '—' }}
          </div>
        </el-form-item>

        <el-form-item label="动作" prop="action">
          <el-select
            v-model="ruleForm.action"
            placeholder="请选择"
            style="width: 100%"
          >
            <el-option label="告警" value="alert" />
            <el-option label="允许" value="pass" />
            <el-option label="拒绝" value="reject" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button
            class="default-class"
            @click="threatRuleDialogVisible = false"
          >
            取 消
          </el-button>
          <el-button
            type="primary"
            class="primary-class"
            :loading="threatRuleSubmitting"
            @click="submitThreatRule"
          >
            确 定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, ArrowUp, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import DisposeEmailNotifyPanel from './DisposeEmailNotifyPanel.vue'
import ServiceConvergencePanel from './ServiceConvergencePanel.vue'
import { queryRepairSuggestionByVulnId } from '@/api/attackSurface'
import { pocVerifyAPI } from '@/api/vuln'
import { insertThreatRuleAPI } from '@/api/vulnIntelligence'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
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
  enableThreatRuleGeneration: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:visible',
  'close',
  'download-report',
  'notify',
  'notify-back',
  'notify-sent',
  'convergence-open',
  'convergence-back',
  'convergence-confirm'
])

const convergencePanelRef = ref(null)
const threatRuleFormRef = ref(null)

const expandedIds = ref([])
const convergenceAgentInstalled = ref(false)
const vulnSuggestionMap = ref({})
const vulnSuggestionLoadingMap = ref({})
const verifyLoadingMap = ref({})
const threatRuleDialogVisible = ref(false)
const threatRuleSubmitting = ref(false)
const currentThreatRuleItem = ref(null)
const currentThreatRuleIndex = ref(-1)

const ruleForm = reactive({
  action: 'alert'
})

const ruleFormRules = {
  action: [{ required: true, message: '请选择动作', trigger: 'change' }]
}

const dialogVisible = computed({
  get() {
    return props.visible
  },
  set(value) {
    emit('update:visible', value)
  }
})

const displayList = computed(() => {
  return Array.isArray(props.items) && props.items.length ? props.items : []
})

const embeddedSubViewTitle = computed(() => {
  if (props.embeddedEmailContext) return '发送通知'
  if (props.embeddedConvergenceContext) return '服务收敛治理'
  return ''
})

const disposeDialogShellWidth = computed(() => {
  return props.embeddedConvergenceContext ? '960px' : '720px'
})

const notifyEligibleDisabled = computed(() => {
  const row = props.taskRow || {}
  const idNum = row.id != null && row.id !== '' ? Number(row.id) : NaN
  if (Number.isFinite(idNum) && idNum > 0) return false

  const list = Array.isArray(displayList.value) ? displayList.value : []
  const hasItemId = list.some((entry) => {
    const vid =
      entry && entry.id != null && entry.id !== '' ? Number(entry.id) : NaN
    return Number.isFinite(vid) && vid > 0
  })
  return !hasItemId
})

const notifyEligibleReason = computed(() => {
  if (!notifyEligibleDisabled.value) return ''
  return '暂时无法进行通知操作'
})

const currentThreatRuleVulnName = computed(() => {
  const detail = getThreatRuleDetailSource(
    currentThreatRuleItem.value,
    currentThreatRuleIndex.value
  )
  return detail.vulnName
})

watch(
  () => props.visible,
  (value) => {
    if (!value) {
      expandedIds.value = []
      convergenceAgentInstalled.value = false
      vulnSuggestionMap.value = {}
      vulnSuggestionLoadingMap.value = {}
      verifyLoadingMap.value = {}
      handleThreatRuleDialogClose()
    } else {
      const safeList = Array.isArray(displayList.value) ? displayList.value : []
      const firstRow = safeList.length > 0 ? safeList[0] : null
      const firstId = firstRow && firstRow.id != null ? firstRow.id : null
      expandedIds.value = firstId != null && firstId !== '' ? [firstId] : []
    }
  }
)

watch(
  () => props.items,
  (list) => {
    if (!props.visible) return
    const safeList = Array.isArray(list) ? list : []
    safeList.forEach((row) => {
      if (row && row.id != null) fetchRepairSuggestionByVulnId(row.id)
    })
  },
  { immediate: true }
)

const toggleExpand = (vulnItem) => {
  const itemId = vulnItem && vulnItem.id
  if (!itemId) return
  const index = expandedIds.value.indexOf(itemId)
  if (index >= 0) {
    expandedIds.value.splice(index, 1)
  } else {
    expandedIds.value.push(itemId)
    fetchRepairSuggestionByVulnId(itemId)
  }
}

const fetchRepairSuggestionByVulnId = (vulnId) => {
  const normalizedVulnId = Number(vulnId)
  if (!Number.isFinite(normalizedVulnId) || normalizedVulnId <= 0) return
  if (vulnSuggestionMap.value[normalizedVulnId]) return
  if (vulnSuggestionLoadingMap.value[normalizedVulnId]) return

  vulnSuggestionLoadingMap.value[normalizedVulnId] = true
  queryRepairSuggestionByVulnId({ id: normalizedVulnId })
    .then((responseData) => {
      const suggestionText =
        responseData &&
        responseData.data &&
        typeof responseData.data.suggestion === 'string'
          ? responseData.data.suggestion.trim()
          : ''
      vulnSuggestionMap.value[normalizedVulnId] = suggestionText
    })
    .catch(() => {
      vulnSuggestionMap.value[normalizedVulnId] = ''
    })
    .finally(() => {
      vulnSuggestionLoadingMap.value[normalizedVulnId] = false
    })
}

const getVulnSuggestionText = (vulnId) => {
  const normalizedVulnId = Number(vulnId)
  if (!Number.isFinite(normalizedVulnId) || normalizedVulnId <= 0) return ''
  return vulnSuggestionMap.value[normalizedVulnId] || ''
}

const handleVerifyClick = (vulnItem) => {
  const task =
    props.taskRow && typeof props.taskRow === 'object' ? props.taskRow : null
  const loadingKey =
    vulnItem && vulnItem.id != null ? vulnItem.id : 'verify-default'

  let vulnId = NaN
  let vulnName = ''
  let vulnNumber = ''
  let assetIp = ''
  let assetPort = ''

  if (task) {
    vulnId = Number(task.id)
    vulnName =
      task.vuln_name != null && String(task.vuln_name).trim()
        ? String(task.vuln_name)
        : vulnItem && vulnItem.title
        ? String(vulnItem.title)
        : ''
    vulnNumber = task.vuln_number != null ? String(task.vuln_number) : ''
    assetIp = task.asset_ip != null ? String(task.asset_ip).trim() : ''
    assetPort = task.port != null && task.port !== '' ? String(task.port) : ''
  } else {
    const sourceVulnData = (vulnItem && vulnItem.rawData) || vulnItem || {}
    vulnId = Number(sourceVulnData.id || (vulnItem && vulnItem.id))
    vulnName =
      sourceVulnData.vuln_name != null
        ? String(sourceVulnData.vuln_name)
        : vulnItem && vulnItem.title
        ? String(vulnItem.title)
        : ''
    vulnNumber =
      sourceVulnData.vuln_number != null
        ? String(sourceVulnData.vuln_number)
        : ''
    assetIp =
      sourceVulnData.asset_ip != null
        ? String(sourceVulnData.asset_ip).trim()
        : ''
    assetPort = String(sourceVulnData.port || sourceVulnData.affect_port || '')
  }

  if (!Number.isFinite(vulnId) || vulnId <= 0) {
    ElMessage.warning('当前漏洞缺少ID，无法执行验证')
    return
  }

  const requestPayload = [
    {
      id: vulnId,
      vuln_name: vulnName,
      vuln_number: vulnNumber,
      affect_asset_ip: assetIp,
      affect_asset_port: assetPort
    }
  ]

  verifyLoadingMap.value[loadingKey] = true
  pocVerifyAPI(requestPayload)
    .then((responseData) => {
      if (responseData && responseData.code === 0) {
        ElMessage.success(responseData.msg || '验证请求已提交')
      } else {
        ElMessage.error((responseData && responseData.msg) || '验证失败')
      }
    })
    .catch(() => {
      ElMessage.error('验证失败')
    })
    .finally(() => {
      verifyLoadingMap.value[loadingKey] = false
    })
}

const openThreatRuleDialog = (vulnItem, vulnIndex) => {
  if (!props.enableThreatRuleGeneration) return
  const detail = getThreatRuleDetailSource(vulnItem, vulnIndex)
  if (!detail.vulnName) {
    ElMessage.warning('当前漏洞缺少名称，暂时无法生成规则')
    return
  }
  currentThreatRuleItem.value = vulnItem || null
  currentThreatRuleIndex.value =
    typeof vulnIndex === 'number' ? vulnIndex : -1
  ruleForm.action = 'alert'
  threatRuleDialogVisible.value = true
  nextTick(() => {
    if (threatRuleFormRef.value) {
      threatRuleFormRef.value.clearValidate()
    }
  })
}

const handleThreatRuleDialogClose = () => {
  threatRuleDialogVisible.value = false
  threatRuleSubmitting.value = false
  currentThreatRuleItem.value = null
  currentThreatRuleIndex.value = -1
  ruleForm.action = 'alert'
  nextTick(() => {
    if (threatRuleFormRef.value) {
      threatRuleFormRef.value.clearValidate()
    }
  })
}

const getThreatRuleDetailSource = (vulnItem, vulnIndex) => {
  const isFirstRow = vulnIndex === 0
  const task =
    isFirstRow && props.taskRow && typeof props.taskRow === 'object'
      ? props.taskRow
      : null
  const rawData =
    vulnItem &&
    vulnItem.rawData &&
    typeof vulnItem.rawData === 'object'
      ? vulnItem.rawData
      : null
  const raw = rawData ? rawData : vulnItem || {}

  const vulnNumber =
    task && task.vuln_number != null
      ? String(task.vuln_number).trim()
      : raw.vuln_number != null
      ? String(raw.vuln_number).trim()
      : ''

  const vulnName =
    task && task.vuln_name != null && String(task.vuln_name).trim()
      ? String(task.vuln_name).trim()
      : raw.vuln_name != null && String(raw.vuln_name).trim()
      ? String(raw.vuln_name).trim()
      : vulnItem && vulnItem.title != null && String(vulnItem.title).trim()
      ? String(vulnItem.title).trim()
      : ''

  const cveId =
    (raw.cve_id != null && String(raw.cve_id).trim()) ||
    (raw.cve != null && String(raw.cve).trim()) ||
    (task && task.cve_id != null && String(task.cve_id).trim()) ||
    (task && task.cve != null && String(task.cve).trim()) ||
    extractCveIdFromText(vulnName) ||
    ''

  const lvdId =
    (raw.lvd_id != null && String(raw.lvd_id).trim()) ||
    (raw.lhvd != null && String(raw.lhvd).trim()) ||
    (task && task.lvd_id != null && String(task.lvd_id).trim()) ||
    (task && task.lhvd != null && String(task.lhvd).trim()) ||
    ''

  return {
    vulnName,
    vulnNumber,
    cveId: cveId || '',
    lvdId: lvdId || ''
  }
}

const buildThreatRulePayload = () => {
  const detail = getThreatRuleDetailSource(
    currentThreatRuleItem.value,
    currentThreatRuleIndex.value
  )
  return {
    action: ruleForm.action,
    rule_msg: detail.vulnName || detail.vulnNumber || '漏洞检测规则',
    rule_type: 'exp',
    src_ip: 'any',
    src_port: 'any',
    dst_ip: 'any',
    dst_port: 'any',
    enable: true,
    cve_id: detail.cveId,
    lvd_id: detail.lvdId,
    vuln_name: detail.vulnName
  }
}

const extractCveIdFromText = (text) => {
  const source = text != null ? String(text) : ''
  const match = source.match(/CVE-\d{4}-\d+/i)
  return match && match[0] ? match[0].toUpperCase() : ''
}

const submitThreatRule = () => {
  if (!threatRuleFormRef.value) return
  threatRuleFormRef.value.validate(async (valid) => {
    if (!valid) return

    const payload = buildThreatRulePayload()
    if (!payload.vuln_name) {
      ElMessage.warning('当前漏洞缺少名称，暂时无法生成规则')
      return
    }

    threatRuleSubmitting.value = true
    try {
      const responseData = await insertThreatRuleAPI(payload)
      if (responseData && responseData.code === 0) {
        ElMessage.success(responseData.msg || '威胁检测规则生成成功')
        return
      }
      ElMessage.error(
        (responseData && responseData.msg) || '威胁检测规则生成失败'
      )
    } catch (error) {
      ElMessage.error('威胁检测规则生成失败')
    } finally {
      threatRuleSubmitting.value = false
      handleThreatRuleDialogClose()
    }
  })
}

const handleClose = () => {
  emit('close')
}

const emitDownloadReport = (vulnItem) => {
  const row = vulnItem || {}
  const titleText =
    row.title != null && String(row.title).trim()
      ? String(row.title).trim()
      : '关键漏洞'

  const raw =
    (row.rawData && typeof row.rawData === 'object' && row.rawData) || row

  const idRaw =
    raw.id != null ? raw.id : row.id != null ? row.id : null
  const idNum = idRaw != null && idRaw !== '' ? Number(idRaw) : NaN
  const vulnIds = Number.isFinite(idNum) && idNum > 0 ? [idNum] : []

  emit('download-report', { title: titleText, vulnIds })
}

const emitNotifyForItem = (vulnRow) => {
  emit('notify', vulnRow)
}

const emitEmbeddedSubViewBack = () => {
  if (props.embeddedEmailContext) {
    emit('notify-back')
  } else if (props.embeddedConvergenceContext) {
    convergenceAgentInstalled.value = false
    emit('convergence-back')
  }
}

const emitConvergenceForItem = (vulnRow) => {
  emit('convergence-open', vulnRow)
}

const handleConvergenceConfirmClick = () => {
  const panel = convergencePanelRef.value
  if (!panel) return
  panel
    .submitHostConfirmOptimize()
    .then((result) => {
      if (result && result.preview) return
      emit('convergence-confirm', result)
    })
    .catch(() => {})
}

const handleConvergenceAgentInstalledChange = (installed) => {
  convergenceAgentInstalled.value = !!installed
}

const handleEmbeddedNotifySent = (payload) => {
  emit('notify-sent', payload)
}
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

.dispose-vuln-card {
  margin-bottom: 14px;
  border: 1px solid #fecdd3;
  border-radius: 10px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06),
    0 4px 14px rgba(244, 63, 94, 0.08);
  border-left: 4px solid #f43f5e;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  &:last-child {
    margin-bottom: 0;
  }
  &:hover {
    border-color: #fda4af;
    box-shadow: 0 4px 20px rgba(244, 63, 94, 0.12);
  }
}

.dispose-vuln-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
}

.dispose-vuln-card-head-main {
  flex: 1;
  min-width: 0;
}

.dispose-vuln-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 800;
  color: #111827;
  line-height: 1.45;
}

/* 仅展示真实数据：去掉 severity / CVSS 等演示标签 */
.dispose-vuln-tags {
  display: none;
}

.dispose-vuln-toggle {
  flex-shrink: 0;
  padding: 4px 0;
  color: #7c3aed !important;
  font-weight: 700;
  font-size: 12px;
  &:hover {
    color: #5b21b6 !important;
  }
}

.dispose-vuln-expand {
  padding: 0 18px 16px;
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

.dispose-risk-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding-top: 12px;
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

.dispose-risk-block {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.dispose-risk-block-k {
  font-size: 12px;
  color: rgba(17, 24, 39, 0.55);
  margin-bottom: 6px;
}

.dispose-risk-block-v {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(17, 24, 39, 0.92);
  word-break: break-word;
}

.dispose-risk-block-v--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
}

.dispose-vuln-desc {
  margin: 14px 0;
  font-size: 13px;
  line-height: 1.75;
  color: #374151;
}

.dispose-vuln-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 6px;
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

.dispose-rule-dialog-name {
  min-height: 32px;
  padding: 12px 14px;
  line-height: 1.7;
  color: #1f2937;
  word-break: break-all;
  border-radius: 12px;
  background: linear-gradient(180deg, #fff7ed 0%, #fff 100%);
  border: 1px solid rgba(251, 146, 60, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.dispose-rule-dialog-intro {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 18px;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%);
  border: 1px solid rgba(251, 146, 60, 0.18);
}

.dispose-rule-dialog-intro__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f97316 0%, #fb7185 100%);
  color: #fff;
  font-size: 18px;
  box-shadow: 0 10px 24px rgba(249, 115, 22, 0.22);
}

.dispose-rule-dialog-intro__content {
  flex: 1;
  min-width: 0;
}

.dispose-rule-dialog-intro__title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
}

.dispose-rule-dialog-intro__desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: #6b7280;
}

.dispose-rule-dialog-form {
  padding: 4px 2px 0;
}
</style>

<style lang="scss">
@import './disposeDialogWorkbench.scss';

.dispose-risk-dialog--vuln.dispose-workbench-shell {
  .el-dialog__body {
    padding: 14px 20px 10px;
  }

  /* 标签在浅色卡片上的对比与层次 */
  .dispose-vuln-tags .el-tag--danger.el-tag--plain {
    background: #fff1f2;
    border-color: #fecdd3;
    color: #be123c;
    font-weight: 700;
  }

  .dispose-vuln-tags .el-tag--info.el-tag--plain {
    background: #f8fafc;
    border-color: #e2e8f0;
    color: #475569;
    font-weight: 600;
  }

  .dispose-vuln-actions .el-button--primary:not(.is-plain) {
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    border-color: #7c3aed;
    color: #fff;
  }
  .el-button{
    border-radius: 10px;
  }
}

.threat-rule-dialog {
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.24);

  .el-dialog__header {
    padding: 20px 24px 12px;
    background: linear-gradient(135deg, #fff7ed 0%, #ffffff 68%);
    border-bottom: 1px solid rgba(251, 146, 60, 0.12);
  }

  .el-dialog__title {
    font-size: 17px;
    font-weight: 800;
    color: #111827;
    letter-spacing: 0.01em;
  }

  .el-dialog__headerbtn {
    top: 18px;
    right: 18px;
  }

  .el-dialog__headerbtn .el-dialog__close {
    color: #9ca3af;
    font-size: 18px;
    transition: color 0.2s ease, transform 0.2s ease;
  }

  .el-dialog__headerbtn:hover .el-dialog__close {
    color: #f97316;
    transform: rotate(90deg);
  }

  .el-dialog__body {
    padding: 18px 24px 10px;
    background:
      radial-gradient(circle at top right, rgba(251, 146, 60, 0.08), transparent 28%),
      linear-gradient(180deg, #fffdfb 0%, #ffffff 100%);
  }

  .el-dialog__footer {
    padding: 12px 24px 22px;
    background: #fff;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .dialog-footer .el-button {
    min-width: 96px;
  }

  .dispose-rule-dialog-form .el-form-item {
    margin-bottom: 18px;
  }

  .dispose-rule-dialog-form .el-form-item__label {
    font-weight: 700;
    color: #374151;
  }

  .dispose-rule-dialog-form .el-input__inner,
  .dispose-rule-dialog-form .el-select .el-input__inner {
    height: 40px;
    border-radius: 12px;
    border-color: #fde68a;
    background: #fff;
    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .dispose-rule-dialog-form .el-input__inner:focus,
  .dispose-rule-dialog-form .el-select .el-input__inner:focus {
    border-color: #f97316;
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12);
  }
}
</style>
