<!-- 治理第一步通用任务列表：关键漏洞、高风险端口、弱口令共用。第二步动作暂留占位。 -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { taskListNewAPI, queryRepairSuggestionByVulnId } from '@/api/riskOperations'
import { portStatusAPI } from '@/api/assets'

const props = defineProps<{
  visible: boolean
  title: string
  category: string
  kind: 'critical' | 'port' | 'weak'
  externalTaskList?: Array<Record<string, any>> | null
}>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; refresh: [] }>()

const loading = ref(false)
const list = ref<Array<Record<string, any>>>([])
const expanded = ref<Record<string, boolean>>({})
const suggestionLoading = ref<Record<string, boolean>>({})
const suggestions = ref<Record<string, string>>({})
const portUpdating = ref<string | number>('')

const dialogVisible = computed({ get: () => props.visible, set: value => emit('update:visible', value) })
const emptyText = computed(() => props.kind === 'critical' ? '暂无关键漏洞数据' : props.kind === 'port' ? '暂无高风险端口数据' : '暂无弱口令数据')

function taskId(item: Record<string, any>, index = 0) { return item.id ?? item.task_id ?? item.vuln_id ?? index }
function statusText(value: unknown) { return Number(value) === 1 ? '已处理' : '待处理' }
function statusClass(value: unknown) { return Number(value) === 1 ? 'is-done' : 'is-pending' }
function displayName(item: Record<string, any>) { return item.vuln_name || item.title || item.name || (props.kind === 'port' ? `${item.asset_ip || '--'}:${item.port || '--'}` : '--') }
function normalizeList(result: any) {
  const data = result?.data ?? result
  return Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : []
}

async function fetchList() {
  if (Array.isArray(props.externalTaskList)) { list.value = props.externalTaskList; return }
  loading.value = true
  try {
    const result: any = await taskListNewAPI({ category: props.category, task_type: '风险处置', status: 0 })
    if (Number(result?.code) !== 0) throw new Error(result?.msg || '获取治理任务失败')
    list.value = normalizeList(result)
  } catch (error) {
    list.value = []
    ElMessage.error(error instanceof Error ? error.message : '获取治理任务失败')
  } finally { loading.value = false }
}

function toggle(item: Record<string, any>, index: number) {
  const id = String(taskId(item, index))
  expanded.value[id] = !expanded.value[id]
  if (expanded.value[id] && props.kind === 'critical') loadSuggestion(item)
}

async function loadSuggestion(item: Record<string, any>) {
  const id = item.id ?? item.vuln_id
  if (!id || suggestions.value[String(id)] || suggestionLoading.value[String(id)]) return
  suggestionLoading.value[String(id)] = true
  try {
    const result: any = await queryRepairSuggestionByVulnId({ id })
    suggestions.value[String(id)] = Number(result?.code) === 0 ? String(result?.data?.suggestion || '--') : '--'
  } catch { suggestions.value[String(id)] = '--' } finally { suggestionLoading.value[String(id)] = false }
}

async function updatePortStatus(item: Record<string, any>, status: number) {
  const id = taskId(item)
  portUpdating.value = id
  try {
    const result: any = await portStatusAPI({ ...item, status })
    if (Number(result?.code) !== 0) throw new Error(result?.msg || '端口状态更新失败')
    ElMessage.success('端口状态已更新')
    await fetchList()
    emit('refresh')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '端口状态更新失败') } finally { portUpdating.value = '' }
}

function placeholder(action: string) { ElMessage.info(`${action}功能将在第二步接入`) }
watch(() => props.visible, value => { if (value) void fetchList() })
</script>

<template>
  <el-dialog v-model="dialogVisible" :title="title" class="ledger-form-dialog dialog-width-wide" append-to-body :close-on-click-modal="false" destroy-on-close>
    <div v-loading="loading" class="govern-task-list">
      <div v-if="!loading && !list.length" class="govern-task-list__empty">{{ emptyText }}</div>
      <article v-for="(item, index) in list" :key="taskId(item, index)" class="govern-task-card" :class="{ 'is-expanded': expanded[String(taskId(item, index))] }">
        <header class="govern-task-card__header" @click="toggle(item, index)">
          <div class="govern-task-card__main">
            <strong>{{ displayName(item) }}</strong>
            <span>资产 IP：{{ item.asset_ip || '--' }} · 端口：{{ item.port || '--' }}</span>
          </div>
          <div class="govern-task-card__right"><span class="govern-status" :class="statusClass(item.status)">{{ statusText(item.status) }}</span><span>{{ expanded[String(taskId(item, index))] ? '收起' : '展开' }}</span></div>
        </header>
        <div v-if="expanded[String(taskId(item, index))]" class="govern-task-card__body">
          <div class="govern-task-card__detail"><span>漏洞编号</span><code>{{ item.vuln_number || item.cve || '--' }}</code></div>
          <div v-if="kind === 'critical'" class="govern-task-card__detail"><span>修复建议</span><em>{{ suggestionLoading[String(item.id ?? item.vuln_id)] ? '加载中...' : suggestions[String(item.id ?? item.vuln_id)] || '--' }}</em></div>
          <div v-if="kind === 'weak'" class="govern-task-card__detail"><span>账号 / 密码</span><em>{{ item.describe || '--' }}</em></div>
          <div v-if="kind === 'port'" class="govern-task-card__detail"><span>端口状态</span><em>{{ item.port_status || item.status_text || '--' }}</em></div>
          <div class="govern-task-card__actions">
            <template v-if="kind === 'port'"><el-button size="small" :loading="portUpdating === taskId(item, index)" @click.stop="updatePortStatus(item, 1)">标记已处理</el-button></template>
            <el-button size="small" @click.stop="placeholder('收敛')">收敛</el-button>
            <el-button size="small" @click.stop="placeholder('验证')">验证</el-button>
            <el-button size="small" @click.stop="placeholder('通知')">通知</el-button>
            <el-button size="small" @click.stop="placeholder('生成报告')">生成报告</el-button>
          </div>
        </div>
      </article>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.govern-task-list { min-height: 180px; max-height: 500px; overflow-y: auto; }
.govern-task-list__empty { display: grid; min-height: 180px; place-items: center; color: var(--c-text-muted); }
.govern-task-card { margin-bottom: 8px; overflow: hidden; background: var(--c-bg-card); border: 1px solid var(--c-border); border-radius: 9px; }
.govern-task-card.is-expanded { border-color: var(--c-primary-light); }
.govern-task-card__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; cursor: pointer; }
.govern-task-card__main { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.govern-task-card__main strong { overflow: hidden; color: var(--c-text); text-overflow: ellipsis; white-space: nowrap; }
.govern-task-card__main span, .govern-task-card__right { color: var(--c-text-muted); font-size: var(--fs-xs); }
.govern-task-card__right { display: flex; align-items: center; flex-shrink: 0; gap: 10px; }
.govern-status { padding: 3px 8px; border-radius: 999px; font-weight: var(--fw-semibold); }
.govern-status.is-pending { color: var(--c-warn); background: var(--c-warn-bg); }
.govern-status.is-done { color: var(--c-success); background: var(--c-success-bg); }
.govern-task-card__body { padding: 0 14px 12px; border-top: 1px solid var(--c-border-light); }
.govern-task-card__detail { display: flex; gap: 18px; padding: 8px 0; border-bottom: 1px dashed var(--c-border-light); color: var(--c-text-secondary); font-size: var(--fs-sm); }
.govern-task-card__detail > span { width: 72px; flex-shrink: 0; color: var(--c-text-muted); }
.govern-task-card__detail em { color: var(--c-text); font-style: normal; word-break: break-all; }
.govern-task-card__actions { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 10px; }
.govern-task-card__actions :deep(.el-button) { margin: 0; }
</style>
