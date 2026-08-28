<!-- 第二步独立弹窗：邮件通知。内部复用邮件通知表单。 -->
<script setup lang="ts">
import { ref } from 'vue'
import EmailNotif from '@/components/governCom/secondStep/emailNotif.vue'

const emit = defineEmits<{ sent: [payload?: unknown] }>()
const visible = ref(false)
const context = ref<Record<string, any> | null>(null)

function open(value?: Record<string, any>) {
  context.value = { ...(value || {}), notifyKey: Date.now() }
  visible.value = true
}
function close() { visible.value = false }
function onClosed() { context.value = null }
function onSent(payload?: unknown) {
  emit('sent', payload)
  close()
}

defineExpose({ open, close })
</script>

<template>
  <el-dialog
    v-model="visible"
    title="邮件通知"
    width="760px"
    append-to-body
    :close-on-click-modal="false"
    class="email-notify-independent-dialog"
    @closed="onClosed"
  >
    <EmailNotif v-if="visible" :notify-context="context" @sent="onSent" @back="close" />
  </el-dialog>
</template>

<style lang="scss">
.email-notify-independent-dialog .el-dialog__body {
  max-height: 500px;
  overflow-y: auto;
  padding: 16px 20px 20px;
}
</style>
