<!-- 第二步独立弹窗：服务收敛治理。 -->
<script setup lang="ts">
import { ref } from 'vue'
import ServiceConvergenceGovern from '@/components/governCom/secondStep/serviceConvergenceGovern.vue'

const emit = defineEmits<{ success: [payload?: unknown] }>()
const visible = ref(false)
const context = ref<Record<string, any> | null>(null)
function open(value?: Record<string, any>) {
  context.value = { ...(value || {}), convergenceKey: Date.now() }
  visible.value = true
}
function close() { visible.value = false }
function onClosed() { context.value = null }
defineExpose({ open, close })
</script>

<template>
  <el-dialog
    v-model="visible"
    title="服务收敛"
    width="1100px"
    append-to-body
    :close-on-click-modal="false"
    class="service-convergence-independent-dialog"
    @closed="onClosed"
  >
    <ServiceConvergenceGovern
      v-if="visible"
      :convergence-context="context"
      @back="close"
      @success="emit('success', $event)"
    />
  </el-dialog>
</template>

<style lang="scss">
.service-convergence-independent-dialog .el-dialog__body {
  max-height: 500px;
  overflow-y: auto;
  padding: 8px 20px 20px;
}
</style>
