<template>
  <div v-if="visible" class="ledger-loading"><span class="ledger-loading__spinner" />{{ text }}</div>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ visible?: boolean; text?: string }>(), { visible: false, text: '加载中...' })
</script>
<style scoped lang="scss">
.ledger-loading { display:flex; align-items:center; justify-content:center; gap:8px; min-height:44px; color:var(--c-text-muted); }
.ledger-loading__spinner { width:16px; height:16px; border:2px solid var(--c-border); border-top-color:var(--c-primary); border-radius:50%; animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
</style>
