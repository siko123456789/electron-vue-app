<template>
  <!-- 邮件通知弹框 -->
  <el-dialog
    v-model="dialogVisible"
    title="发送通知"
    width="640px"
    top="8vh"
    class="dispose-email-notify-dialog dispose-workbench-shell"
    append-to-body
    @close="handleClose"
  >
    <DisposeEmailNotifyPanel
      v-if="notifyContext"
      :notify-context="notifyContext"
      :embedded="false"
      @sent="handlePanelSent"
    />

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">关 闭</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script>
import { computed } from 'vue'
import DisposeEmailNotifyPanel from './DisposeEmailNotifyPanel.vue'

/**
 * 独立邮件通知弹框（复用 DisposeEmailNotifyPanel，适用于未嵌在风险详情内的场景）
 */
export default {
  name: 'DisposeEmailNotifyDialog',
  components: {
    DisposeEmailNotifyPanel
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    notifyContext: {
      type: Object,
      default: null
    }
  },
  emits: ['update:visible', 'close', 'sent'],
  setup(props, { emit }) {
    const dialogVisible = computed({
      get() {
        return props.visible
      },
      set(value) {
        emit('update:visible', value)
      }
    })

    /** 关闭时同步父级 */
    const handleClose = () => {
      emit('close')
    }

    /** 面板发送成功：关闭弹框并上抛事件 */
    const handlePanelSent = (payload) => {
      emit('sent', payload)
      dialogVisible.value = false
    }

    return {
      dialogVisible,
      handleClose,
      handlePanelSent
    }
  }
}
</script>

<style lang="scss">
@import './disposeDialogWorkbench.scss';

.dispose-email-notify-dialog.dispose-workbench-shell {
  .el-dialog__body {
    padding: 14px 20px 10px;
  }
}
</style>