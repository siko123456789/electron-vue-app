<script setup lang="ts">
const props = withDefaults(defineProps<{
  visible?: boolean
  htmlContent?: string
  fileName?: string
  title?: string
}>(), { visible: false, htmlContent: '', fileName: '治理报告.html', title: '报告预览' })
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()
function close() { emit('update:visible', false) }
</script>

<template>
  <el-dialog :model-value="props.visible" :title="props.title" width="90%" append-to-body @close="close">
    <iframe class="depth-analysis-report__frame" :srcdoc="props.htmlContent" :title="props.fileName" />
  </el-dialog>
</template>

<style scoped lang="scss">
.depth-analysis-report__frame { display: block; width: 100%; height: 65vh; border: 0; }
</style>
