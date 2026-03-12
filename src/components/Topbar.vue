<template>
  <header class="topbar">
    <div class="left">
      <div class="title">风险治理平台</div>
      <div class="status">实时监控中</div>
    </div>

    <div class="right">
      <el-button class="icon-btn" text>
        <el-badge :value="1" class="badge" type="danger">
          <el-icon><Bell /></el-icon>
        </el-badge>
      </el-button>
      <div class="divider" />
      <el-button class="help" text>
        帮助文档
        <el-icon class="help-icon"><QuestionFilled /></el-icon>
      </el-button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Bell, QuestionFilled } from '@element-plus/icons-vue'
</script>

<style scoped>
.topbar {
  height: 56px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--app-surface);
  border-bottom: 1px solid var(--app-border);
}

.left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: var(--app-text);
}

.status {
  height: 22px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  font-size: 12px;
  color: var(--app-success);
  background: var(--app-muted-bg);
  gap: 4px;
}
.status::before{
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--app-success);
}

.right {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-muted);
}

.icon-btn :deep(.el-icon) {
  font-size: 18px;
  color: var(--app-muted);
}

.divider {
  width: 1px;
  height: 18px;
  background: var(--app-border);
}

.help {
  color: var(--app-muted);
}

.help-icon {
  margin-left: 6px;
  color: var(--app-muted);
}

.badge :deep(.el-badge__content) {
  transform: translate(6px, -6px);
}
</style>
