<template>
  <el-tag size="small" :type="tagType">{{ displayLabel }}</el-tag>
</template>
<script setup lang="ts">
import { computed } from 'vue'

/** 漏洞等级：0低危 1中危 2高危 3紧急 4关键漏洞 */
const LEVEL_LABEL_MAP: Record<number, string> = {
  0: '低危',
  1: '中危',
  2: '高危',
  3: '紧急',
  4: '关键漏洞',
}

const props = defineProps<{ level?: string | number }>()

const displayLabel = computed(() => {
  if (props.level === undefined || props.level === null || props.level === '') {
    return '-'
  }
  const num = Number(props.level)
  if (Number.isFinite(num) && Object.prototype.hasOwnProperty.call(LEVEL_LABEL_MAP, num)) {
    return LEVEL_LABEL_MAP[num]
  }
  return String(props.level)
})

const tagType = computed(() => {
  const num = Number(props.level)
  if (Number.isFinite(num)) {
    if (num >= 3) return 'danger'
    if (num === 2) return 'warning'
    if (num === 1) return 'warning'
    if (num === 0) return 'info'
  }
  const value = String(props.level || '').toLowerCase()
  if (/关键|紧急|严重|critical|high|高危|p0/.test(value)) return 'danger'
  if (/中危|medium|高|p1/.test(value)) return 'warning'
  return 'info'
})
</script>
