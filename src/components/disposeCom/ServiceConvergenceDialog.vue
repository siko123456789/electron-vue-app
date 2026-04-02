<template>
  <!-- 服务收敛治理弹框 -->
  <el-dialog
    v-model="dialogVisible"
    title="服务收敛治理"
    width="1000px"
    top="5vh"
    :custom-class="'service-convergence-dialog dispose-workbench-shell'"
    append-to-body
    @close="handleClose"
  >
    <ServiceConvergencePanel
      ref="convergencePanelRef"
      :embedded="false"
      :access-relations="accessRelations"
      :convergence-context="convergenceContext"
      :asset-summary="assetSummary"
      @bypass-enable-change="handleBypassEnableChange"
    />

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="handleConfirmOptimize">
          确认优化
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import ServiceConvergencePanel from './ServiceConvergencePanel.vue'

/** props */
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  accessRelations: {
    type: Array,
    default: null
  },
  convergenceContext: {
    type: Object,
    default: null
  },
  assetSummary: {
    type: String,
    default: ''
  }
})

/** emits */
const emit = defineEmits([
  'update:visible',
  'close',
  'confirm-optimize',
  'bypass-enable-change'
])

/** ref */
const convergencePanelRef = ref(null)

/** v-model 映射 */
const dialogVisible = computed({
  get() {
    return props.visible
  },
  set(value) {
    emit('update:visible', value)
  }
})

/** 关闭 */
const handleClose = () => {
  emit('close')
}

/** 子组件事件透传 */
const handleBypassEnableChange = (value) => {
  emit('bypass-enable-change', value)
}

/** 确认优化 */
const handleConfirmOptimize = () => {
  const panel = convergencePanelRef.value
  if (!panel || typeof panel.submitHostConfirmOptimize !== 'function') {
    return
  }

  panel
    .submitHostConfirmOptimize()
    .then((result) => {
      if (result && result.preview) return
      emit('confirm-optimize', result)
      dialogVisible.value = false
    })
    .catch(() => {})
}
</script>

<style lang="scss">
@import './disposeDialogWorkbench.scss';

.service-convergence-dialog.dispose-workbench-shell {
  .el-dialog__body {
    padding: 14px 20px 12px;
  }
}
</style>