<template>
  <!-- 服务收敛治理弹框 -->
  <el-dialog
    v-model="dialogVisible"
    title="服务收敛治理"
    width="1000px"
    top="5vh"
    custom-class="service-convergence-dialog dispose-workbench-shell"
    append-to-body
    @close="handleClose"
  >
    <ServiceConvergencePanel
      ref="convergencePanelRef"
      :embedded="false"
      :access-relations="accessRelations"
      :convergence-context="convergenceContext"
      :asset-summary="assetSummary"
      @bypass-enable-change="$emit('bypass-enable-change', $event)"
    />
    <template #footer>
      <span class="dialog-footer">
      <el-button @click="dialogVisible = false">取 消</el-button>
      <el-button type="primary" @click="handleConfirmOptimize"
        >确认优化</el-button
      >
      </span>
    </template>
  </el-dialog>
</template>

<script lang="ts">
// @ts-nocheck
import ServiceConvergencePanel from './ServiceConvergencePanel.vue'

/**
 * 独立服务收敛治理弹框（复用 ServiceConvergencePanel，样式与处置弹框一致）
 */
export default {
  name: 'ServiceConvergenceDialog',
  components: { ServiceConvergencePanel },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    accessRelations: {
      type: Array,
      default: null
    },
    /** 与处置弹框内嵌一致：含 assetIp、item、riskItems、category 等，供面板拉 Agent/访问关系 */
    convergenceContext: {
      type: Object,
      default: null
    },
    assetSummary: {
      type: String,
      default: ''
    }
  },
  computed: {
    dialogVisible: {
      get () {
        return this.visible
      },
      set (value) {
        this.$emit('update:visible', value)
      }
    }
  },
  methods: {
    /** 关闭时同步父级 */
    handleClose () {
      this.$emit('close')
    },
    /** 确认优化：先调 batchAgentRule，成功后再通知父级（便于父级仅此时写工单活动） */
    handleConfirmOptimize () {
      const panel = this.$refs.convergencePanelRef
      if (!panel || typeof panel.submitHostConfirmOptimize !== 'function') return
      panel
        .submitHostConfirmOptimize()
        .then(result => {
          // 方法用途：兼容“预览->二次确认”交互；预览阶段不关闭弹窗
          if (result && result.preview) return
          this.$emit('confirm-optimize', result)
          this.dialogVisible = false
        })
        .catch(() => {})
    }
  }
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
