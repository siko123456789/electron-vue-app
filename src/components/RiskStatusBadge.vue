<template>
  <el-tag size="small" :type="tagType">{{ displayLabel }}</el-tag>
</template>
<script setup lang="ts">
import { computed } from 'vue'

/** 漏洞状态：0未修复 1已收敛 2忽略 3已修复 */
const STATUS_LABEL_MAP: Record<number, string> = {
  0: '未修复',
  1: '已收敛',
  2: '忽略',
  3: '已修复',
}

const props = defineProps<{ status?: string | number; label?: string }>()

const displayLabel = computed(() => {
  if (props.label) return props.label
  if (props.status === undefined || props.status === null || props.status === '') {
    return '-'
  }
  const num = Number(props.status)
  if (Number.isFinite(num) && Object.prototype.hasOwnProperty.call(STATUS_LABEL_MAP, num)) {
    return STATUS_LABEL_MAP[num]
  }
  return String(props.status)
})

const tagType = computed(() => {
  const num = Number(props.status)
  if (Number.isFinite(num) && props.status !== '' && props.status !== null && props.status !== undefined) {
    if (num === 3 || num === 1) return 'success'
    if (num === 0) return 'danger'
    if (num === 2) return 'info'
  }
  const value = String(props.label || props.status || '')
  if (/已修复|已收敛|完成|已处理/.test(value)) return 'success'
  if (/未修复|失败/.test(value)) return 'danger'
  if (/忽略/.test(value)) return 'info'
  return 'warning'
})
</script>
