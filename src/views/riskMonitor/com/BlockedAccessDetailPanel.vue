<!--
  被拦截访问行为专属详情弹窗：展示源 IP、目标端点、规则和命中次数，
  并处理加入白名单操作。该事件字段结构与扫描/漏洞处置日志不同，因此单独维护。
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { batchAddRuleById, type RiskMonitorItem } from '@/api/riskMonitor'

const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ row: RiskMonitorItem | null }>()

const submitting = ref(false)

function normalizeAgentId(value: unknown) {
  const text = String(value ?? '').trim()
  return /^\d+$/.test(text) ? text.padStart(3, '0') : text
}

const blockedDetail = computed(() => {
  const rawValue = props.row?.detail
  const raw = Array.isArray(rawValue) ? rawValue[0] : rawValue
  const detail = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  return {
    timestamp: String(detail.timestamp || props.row?.occurred_at || '-'),
    srcIp: String(detail.src_ip || '-'),
    dstIp: String(detail.dst_ip || detail.dest_ip || '-'),
    dstPort: String(detail.dst_port ?? detail.dest_port ?? '-'),
    ruleId: String(detail.rule_id ?? '-'),
    agentId: normalizeAgentId(detail.agent_id),
    count: String(detail.count ?? 0),
  }
})

async function addToWhitelist() {
  const target = blockedDetail.value
  const port = Number(target.dstPort)
  if (!target.agentId || !target.srcIp || target.srcIp === '-' || !Number.isInteger(port) || submitting.value) {
    if (!target.agentId) ElMessage.warning('缺少有效的 agent ID，无法加入白名单')
    else if (!target.srcIp || target.srcIp === '-') ElMessage.warning('缺少有效的访问源 IP，无法加入白名单')
    else ElMessage.warning('缺少有效的目标端口，无法加入白名单')
    return
  }

  submitting.value = true
  try {
    const res = await batchAddRuleById({
      batchAddRuleRequest: {
        agentId: target.agentId,
        rules: [{
          ip: target.srcIp,
          port,
          protocol: 'tcp',
          rule_type: 'Whitelist',
          direction: 'incomming',
        }],
      },
    })
    if (res?.code === 1001) throw new Error(res.msg || '没有规则被添加')
    if (res?.code !== 0) throw new Error(res?.msg || '加入白名单失败')
    ElMessage.success('已加入白名单')
    visible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加入白名单失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    class="ledger-form-dialog dialog-width-default blocked-access-dialog"
    append-to-body
    :close-on-click-modal="false"
    destroy-on-close
  >
    <template #header>
      <div class="dialog-head">
        <div class="dialog-head__title">被拦截的访问行为</div>
        <div class="dialog-head__sub">
          <span>ID: {{ row?.id ?? '-' }}</span>
          <span>来源：{{ row?.source || '-' }}</span>
        </div>
      </div>
    </template>

    <div class="blocked-access-body">
      <div class="blocked-access-summary">
        <div class="blocked-access-summary__icon">!</div>
        <div>
          <div class="blocked-access-summary__title">访问行为已被拦截</div>
          <div class="blocked-access-summary__desc">系统已根据规则阻断该访问请求</div>
          <div class="blocked-access-summary__time">{{ blockedDetail.timestamp }}</div>
        </div>
      </div>

      <div class="blocked-access-grid">
        <div class="blocked-access-field">
          <span class="el-dialog__label">访问源 IP</span>
          <code>{{ blockedDetail.srcIp }}</code>
        </div>
        <div class="blocked-access-field">
          <span class="el-dialog__label">目标 IP &amp; 端口</span>
          <code>{{ blockedDetail.dstIp }}:{{ blockedDetail.dstPort }}</code>
        </div>
        <div class="blocked-access-field">
          <span class="el-dialog__label">规则 ID</span>
          <code>{{ blockedDetail.ruleId }}</code>
        </div>
        <div class="blocked-access-field">
          <span class="el-dialog__label">探针 ID</span>
          <code>{{ blockedDetail.agentId || '-' }}</code>
        </div>
        <div class="blocked-access-field blocked-access-field--full">
          <span class="el-dialog__label">命中次数</span>
          <strong>{{ blockedDetail.count }}</strong>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button type="primary" :loading="submitting" @click="addToWhitelist">加入白名单</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.blocked-access-body {
  padding: 4px 0 0;
}

.blocked-access-summary {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  background: color-mix(in srgb, var(--c-danger-bg) 52%, var(--c-bg-card));
  border: 1px solid color-mix(in srgb, var(--c-danger) 22%, var(--c-border));
  border-radius: 12px;
}

.blocked-access-summary__icon {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  place-items: center;
  color: var(--c-danger);
  font-size: 22px;
  font-weight: 800;
  background: var(--c-danger-bg);
  border-radius: 10px;
}

.blocked-access-summary__title {
  color: var(--c-text);
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
}

.blocked-access-summary__desc,
.blocked-access-summary__time {
  margin-top: 4px;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}

.blocked-access-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.blocked-access-field {
  display: flex;
  min-height: 62px;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 10px 14px;
  background: var(--c-bg-hover);
  border: 1px solid var(--c-border);
  border-radius: 10px;
}

.blocked-access-field--full {
  grid-column: 1 / -1;
}

.blocked-access-field code,
.blocked-access-field strong {
  overflow: hidden;
  color: var(--c-text);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .blocked-access-grid {
    grid-template-columns: 1fr;
  }

  .blocked-access-field--full {
    grid-column: auto;
  }
}
</style>
