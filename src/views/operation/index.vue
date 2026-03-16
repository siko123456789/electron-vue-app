<template>
  <div class="page">
    <div class="head">
      <div class="title">策略整改</div>
      <div class="sub">此页面后续可接入工单/整改计划/复测等模块。</div>
    </div>

    <el-card class="card">
      <div class="placeholder">
        <div class="k">待接入</div>
        <div class="p">这里先做一级菜单占位，避免顶部导航缺项。</div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.page {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.head .title {
  font-weight: 800;
  font-size: 18px;
  color: var(--app-text);
}

.head .sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--app-muted);
}

.card {
  border-radius: 14px;
  border: 1px solid var(--app-border);
  box-shadow: var(--app-shadow);
}

.placeholder {
  padding: 18px;
  border-radius: 12px;
  background: rgba(34, 197, 94, 0.06);
}

.placeholder .k {
  font-weight: 800;
  color: #16a34a;
}

.placeholder .p {
  margin-top: 6px;
  font-size: 12px;
  color: var(--app-muted);
}
</style>

