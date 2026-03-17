<template>
  <div class="page">
    <el-card shadow="never">
      <template #header>
        <div class="header">
          <span>{{ title }}</span>
        </div>
      </template>
      <el-empty description="页面开发中" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => (route.meta?.title as string) || (route.name as string) || route.path)
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
