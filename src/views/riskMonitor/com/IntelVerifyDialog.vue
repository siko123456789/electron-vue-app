<!-- 漏洞情报验证弹窗：Vue3 + Hawk 直接验证 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, CircleCloseFilled } from '@element-plus/icons-vue'
import { assetList } from '@/api/intelVerify'
import { hawkVulnVerifyAPI } from '@/api/vuln'
import type { RiskMonitorItem } from '@/api/riskMonitor'
import { validateIP, validatePort } from '@/utils/validator'

const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ vulnItem: RiskMonitorItem | null }>()

const verifying = ref(false)
const assetLoading = ref(false)
const assetOptions = ref<Array<{ asset_ip: string }>>([])
const form = ref({ assetIp: '', port: '', protocol: '' })
const hasResult = ref(false)
const verifyExists = ref(false)
const verifyMetadata = ref<Record<string, string>>({})
const resultMessage = ref('')
const resultTarget = ref('')

const detail = computed<Record<string, unknown>>(() => {
  const row = props.vulnItem as (RiskMonitorItem & { detail_json?: unknown }) | null
  const raw = row?.detail_json ?? row?.detail
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch { return {} }
  }
  return {}
})

const pluginId = computed(() => String(detail.value.plugin_id || '').trim())
const pluginName = computed(() => String(detail.value.plugin_name || props.vulnItem?.title || '漏洞情报').trim())
const builtTarget = computed(() => {
  const ip = form.value.assetIp.trim()
  const port = form.value.port.trim()
  if (!ip || !port) return ''
  const hostPort = `${ip}:${port}`
  return form.value.protocol ? `${form.value.protocol}://${hostPort}` : hostPort
})

function buildAssetParams() {
  return {
    page: 1, size: 1000000,
    asset_public_ip: [''], asset_ip: [''], wan_port: [''], lan_port: [''],
    global_ipv6: [''], local_ipv6: [''], domain: [''], asset_domain_name: [''],
    asset_os: [''], subnet_name: [''], service: [''], finger: [''],
    person: [''], depart: [''], asset_app_name: [''], is_expose: [],
    risk_score: [], asset_type: [], is_install_agent: [], status: [],
    asset_level: [], tag: [''], sort_field: '', sort_order: ''
  }
}

async function loadAssets() {
  assetLoading.value = true
  try {
    const response: any = await assetList(buildAssetParams())
    const list = Array.isArray(response?.data?.assetList) ? response.data.assetList : []
    assetOptions.value = list.map((item: any) => ({
      asset_ip: String(item.asset_ip || item.ip || item.asset_public_ip || '')
    })).filter(item => item.asset_ip)
  } catch (error: any) {
    assetOptions.value = []
    ElMessage.warning(error?.message || '资产列表加载失败')
  } finally { assetLoading.value = false }
}

function resetState() {
  form.value = { assetIp: '', port: '', protocol: '' }
  hasResult.value = false
  verifyExists.value = false
  verifyMetadata.value = {}
  resultMessage.value = ''
  resultTarget.value = ''
}

async function handleVerify() {
  if (verifying.value) return
  if (!pluginId.value) return ElMessage.warning('缺少 plugin_id，无法验证')
  const assetIp = form.value.assetIp.trim()
  const port = form.value.port.trim()
  let ipError = ''
  let portError = ''
  if (!assetIp) ipError = '请选择或输入资产 IP'
  else validateIP({}, assetIp, error => { ipError = error ? String(error.message || error) : '' })
  if (!port) portError = '请输入端口'
  else validatePort({}, port, error => { portError = error ? String(error.message || error) : '' })
  if (ipError) return ElMessage.warning(ipError)
  if (portError) return ElMessage.warning(portError)

  verifying.value = true
  hasResult.value = false
  try {
    const response: any = await hawkVulnVerifyAPI({ target: builtTarget.value, plugin_id: pluginId.value })
    if (!response || Number(response.code) !== 0) throw new Error(response?.msg || '漏洞验证失败')
    const payload = response.data || {}
    verifyExists.value = payload.vulnerability_exists === true
    verifyMetadata.value = payload.vulnerability_metadata && typeof payload.vulnerability_metadata === 'object'
      ? payload.vulnerability_metadata
      : {}
    resultMessage.value = response.msg || (verifyExists.value ? '漏洞验证成功' : '未发现漏洞')
    resultTarget.value = builtTarget.value
    hasResult.value = true
    ElMessage.success(resultMessage.value)
  } catch (error: any) {
    hasResult.value = false
    ElMessage.error(error?.message || '漏洞验证失败')
  } finally { verifying.value = false }
}

function handleBackToDetail() { visible.value = false }

watch(visible, value => {
  if (value) { resetState(); void loadAssets() }
})
onBeforeUnmount(() => { verifying.value = false })
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="`验证 · ${pluginName}`"
    class="ledger-form-dialog dialog-width-default hawk-plugin-verify-dialog"
    append-to-body
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="ledger-form-dialog__body">
      <div class="intel-verify-dialog__body">
        <el-form label-position="top" class="ledger-form-grid">
          <el-form-item label="漏洞名称" class="ledger-form-grid__full">
            <div class="intel-verify-dialog__vuln-name">{{ pluginName }}</div>
          </el-form-item>
          <el-form-item label="选择资产" class="ledger-form-grid__full">
            <el-select v-model="form.assetIp" class="field-control" filterable allow-create default-first-option clearable :loading="assetLoading" :disabled="verifying" placeholder="请选择或输入资产 IP">
              <el-option v-for="item in assetOptions" :key="item.asset_ip" :label="item.asset_ip" :value="item.asset_ip" />
            </el-select>
          </el-form-item>
          <el-form-item label="端口" class="ledger-form-grid__full">
            <el-input v-model.trim="form.port" clearable :disabled="verifying" placeholder="请输入端口，如 8080" />
          </el-form-item>
          <el-form-item label="协议" class="ledger-form-grid__full">
            <el-select v-model="form.protocol" class="field-control" clearable :disabled="verifying" placeholder="可不选">
              <el-option label="http" value="http" /><el-option label="https" value="https" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <div v-if="hasResult" class="intel-verify-result">
        <div :class="['intel-verify-result__status', verifyExists ? 'is-danger' : 'is-success']">
          <el-icon>
            <CircleCloseFilled v-if="verifyExists" />
            <CircleCheck v-else />
          </el-icon>
          <span>{{ verifyExists ? '存在漏洞' : '未发现漏洞' }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="handleBackToDetail">返回漏洞情报详情</el-button>
      <el-button v-if="!hasResult" type="primary" :loading="verifying" @click="handleVerify">开始验证</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.field-control { width: 100%; }
.intel-verify-dialog__vuln-name { width: 100%; box-sizing: border-box; min-height: 38px; padding: 8px 12px; color: var(--c-text); background: var(--c-bg-hover); border: 1px solid var(--c-border-light); border-radius: var(--r-sm); font-size: var(--fs-sm); line-height: 1.6; word-break: break-word; overflow-wrap: anywhere; }
.intel-verify-result { margin-top: 4px; padding-top: 12px; border-top: 1px solid var(--c-border-light); }
.intel-verify-result__status { display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 14px; border: 1px solid; border-radius: var(--r-md); font-size: var(--fs-sm); font-weight: var(--fw-medium); }
.intel-verify-result__status :deep(.el-icon) { font-size: 18px; }
.intel-verify-result__status.is-success { color: var(--c-success); background: var(--c-success-bg); border-color: color-mix(in srgb, var(--c-success) 30%, var(--c-border-light)); }
.intel-verify-result__status.is-danger { color: var(--c-danger); background: var(--c-danger-bg); border-color: color-mix(in srgb, var(--c-danger) 30%, var(--c-border-light)); }
</style>

<style lang="scss">
.hawk-plugin-verify-dialog.ledger-form-dialog .el-dialog__title {
  display: block;
  max-width: calc(100% - 56px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hawk-plugin-verify-dialog.ledger-form-dialog .ledger-form-dialog__body { max-height: none; padding-right: 0; overflow: visible; }
</style>
