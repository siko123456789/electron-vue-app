<!--
  第二步独立弹窗：关键漏洞验证。
  供治理工单、资产详情等外部页面调用，内部复用 Vue3 验证组件。
-->
<script setup lang="ts">
import { ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import CriticalVulnVerify from '@/components/governCom/secondStep/criticalVulnVerify.vue'

const emit = defineEmits<{
  'verify-result': [payload?: unknown]
  'status-updated': [payload?: unknown]
  'submitting-change': [value: boolean]
}>()

const visible = ref(false)
const context = ref<Record<string, any> | null>(null)
const verifyRef = ref<any>()

function open(value?: Record<string, any>) {
  context.value = { ...(value || {}), verifyKey: Date.now() }
  visible.value = true
}

async function beforeClose(done: () => void) {
  if (!verifyRef.value?.loading) {
    verifyRef.value?.resetState?.()
    done()
    return
  }
  try {
    await ElMessageBox.confirm('验证正在进行中，确认关闭吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    verifyRef.value?.resetState?.()
    done()
  } catch { /* 用户取消关闭 */ }
}

function onClosed() {
  context.value = null
}
function close() { visible.value = false }

defineExpose({ open, close })
</script>

<template>
  <el-dialog
    v-model="visible"
    title="漏洞验证"
    width="920px"
    append-to-body
    :close-on-click-modal="false"
    class="critical-vuln-verify-independent-dialog"
    @before-close="beforeClose"
    @closed="onClosed"
  >
    <CriticalVulnVerify
      v-if="visible"
      ref="verifyRef"
      :verify-context="context"
      @back="close"
      @verify-result="emit('verify-result', $event)"
      @status-updated="emit('status-updated', $event)"
      @submitting-change="emit('submitting-change', $event)"
    />
  </el-dialog>
</template>

<style lang="scss">
.critical-vuln-verify-independent-dialog .el-dialog__body {
  max-height: 500px;
  overflow-y: auto;
  padding: 16px 20px 20px;
}
</style>
