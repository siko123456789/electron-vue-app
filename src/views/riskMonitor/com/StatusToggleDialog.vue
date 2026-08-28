<!--
  列表处理状态切换确认弹窗：只负责待处理/已处理状态切换，
  不参与扫描、漏洞或被拦截访问行为的处置联动。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { updateNotifyStatus, type RiskMonitorItem } from '@/api/riskMonitor'

const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ row: RiskMonitorItem | null }>()
const emit = defineEmits<{ updated: [] }>()

const currentStatus = computed(() => Number(props.row?.status) === 1 ? 1 : 0)
const nextStatus = computed(() => currentStatus.value === 1 ? 0 : 1)
const currentLabel = computed(() => currentStatus.value === 1 ? '已处理' : '待处理')
const nextLabel = computed(() => nextStatus.value === 1 ? '已处理' : '待处理')

async function handleConfirm() {
  const row = props.row
  if (!row) return

  try {
    const res = await updateNotifyStatus({ ids: [Number(row.id)], status: nextStatus.value })
    if (res?.code !== 0) throw new Error(res?.msg || '状态切换失败')
    ElMessage.success(`已切换为“${nextLabel.value}”`)
    visible.value = false
    emit('updated')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '状态切换失败')
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    class="status-toggle-dialog"
    title="确认切换状态"
    width="420px"
    header-class="status-toggle-dialog__header"
    body-class="status-toggle-dialog__body"
    footer-class="status-toggle-dialog__footer"
    destroy-on-close
  >
    <div class="status-toggle-dialog__content">
      当前状态为“{{ currentLabel }}”，确认切换为“{{ nextLabel }}”吗？
    </div>
    <template #footer>
      <el-button size="small" @click="visible = false">取消</el-button>
      <el-button size="small" type="primary" @click="handleConfirm">确认切换</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
:global(.el-dialog.status-toggle-dialog) {
  top: 15vh;
  margin-top: 0 !important;
  overflow: hidden;
  border-radius: 14px;
}

:global(.status-toggle-dialog__header) {
  margin-right: 0;
  padding: 10px 16px 8px !important;
  border-bottom: 1px solid var(--c-border);
}

:global(.status-toggle-dialog__header .el-dialog__headerbtn) {
  top: 8px;
  right: 10px;
}

:global(.status-toggle-dialog__body) {
  padding: 14px 16px 16px !important;
}

:global(.status-toggle-dialog__footer) {
  padding: 8px 16px 10px !important;
  border-top: 1px solid var(--c-border);
}

:global(.status-toggle-dialog__footer .el-button) {
  min-width: 0;
  margin-left: 8px;
}

.status-toggle-dialog__content {
  color: var(--c-text-secondary);
  font-size: 15px;
  line-height: 1.5;
}
</style>
