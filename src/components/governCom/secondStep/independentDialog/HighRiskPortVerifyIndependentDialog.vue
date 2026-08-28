<!-- 第二步独立弹窗：高危端口复测。 -->
<script setup lang="ts">
import { ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import HighRiskPortVerify from '@/components/governCom/secondStep/highRiskPortVerify.vue'

const emit = defineEmits<{ 'verify-result': [payload?: unknown] }>()
const visible = ref(false)
const context = ref<Record<string, any> | null>(null)
const verifyRef = ref<any>()

function open(value?: Record<string, any>) {
  context.value = { ...(value || {}), verifyKey: Date.now() }
  visible.value = true
}
async function beforeClose(done: () => void) {
  if (!verifyRef.value?.running) {
    verifyRef.value?.resetVerifyState?.()
    done()
    return
  }
  try {
    await ElMessageBox.confirm('端口复测尚未完成，确认关闭吗？', '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    })
    verifyRef.value?.closeVerifyWebSocket?.()
    done()
  } catch { /* 用户取消关闭 */ }
}
function close() { visible.value = false }
function onClosed() { context.value = null }
defineExpose({ open, close })
</script>

<template>
  <el-dialog
    v-model="visible"
    title="端口验证"
    width="880px"
    append-to-body
    :close-on-click-modal="false"
    class="high-risk-port-verify-independent-dialog"
    @before-close="beforeClose"
    @closed="onClosed"
  >
    <HighRiskPortVerify
      v-if="visible"
      ref="verifyRef"
      :verify-context="context"
      @back="close"
      @verify-result="emit('verify-result', $event)"
    />
  </el-dialog>
</template>

<style lang="scss">
.high-risk-port-verify-independent-dialog .el-dialog__body {
  max-height: 500px;
  overflow-y: auto;
  padding: 16px 20px 20px;
}
</style>
