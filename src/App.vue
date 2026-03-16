<!-- src/App.vue -->
<template>
  <div class="app-layout">
    <div class="app-main">
      <Topbar class="app-topbar" />
      <main class="app-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import Topbar from './components/Topbar.vue'
</script>

<style scoped>
.app-layout {
  height: 100%;
  display: flex;
  background: var(--app-bg);
}

.app-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.app-topbar {
  flex: 0 0 auto;
}

.app-content {
  flex: 1 1 auto;
  min-height: 0;
  padding: 18px 22px 28px;
  overflow: auto;
}
</style>