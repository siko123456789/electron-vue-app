<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const isMaximized = ref(false)
const isPinned = ref(false)
let removeMaximizeListener: (() => void) | null = null

async function refreshState() {
  try {
    isMaximized.value = Boolean(
      await window.ipcRenderer.invoke('window/is-maximized'),
    )
    isPinned.value = Boolean(
      await window.ipcRenderer.invoke('window/is-always-on-top'),
    )
  } catch {
    isMaximized.value = false
    isPinned.value = false
  }
}

onMounted(async () => {
  await refreshState()
  const onMaximizeChanged = (_event: unknown, maximized: boolean) => {
    isMaximized.value = Boolean(maximized)
  }
  window.ipcRenderer?.on('window/maximize-changed', onMaximizeChanged)
  removeMaximizeListener = () =>
    window.ipcRenderer?.off('window/maximize-changed', onMaximizeChanged)
})

onUnmounted(() => removeMaximizeListener?.())

function invoke(channel: string) {
  void window.ipcRenderer?.invoke(channel)
}

function togglePin() {
  void window.ipcRenderer
    ?.invoke('window/always-on-top-toggle')
    .then((value: unknown) => {
      isPinned.value = Boolean(value)
    })
    .catch(() => refreshState())
}

function toggleMaximize() {
  void window.ipcRenderer
    ?.invoke('window/maximize-toggle')
    .then((value: unknown) => {
      isMaximized.value = Boolean(value)
    })
}
</script>

<template>
  <div class="window-controls" aria-label="窗口控制">
    <button
      class="window-controls__btn"
      :class="{ 'is-active': isPinned }"
      type="button"
      title="窗口置顶"
      @click="togglePin"
    >
      <span class="window-controls__pin" />
    </button>
    <button
      class="window-controls__btn"
      type="button"
      title="最小化"
      @click="invoke('window/minimize')"
    >
      <span class="window-controls__minimize" />
    </button>
    <button
      class="window-controls__btn"
      type="button"
      :title="isMaximized ? '还原' : '最大化'"
      @click="toggleMaximize"
    >
      <span v-if="!isMaximized" class="window-controls__maximize" />
      <span v-else class="window-controls__restore" />
    </button>
    <button
      class="window-controls__btn window-controls__close"
      type="button"
      title="关闭"
      @click="invoke('window/close')"
    >
      <span class="window-controls__close-icon" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.window-controls {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.window-controls__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 32px;
  padding: 0;
  color: var(--c-text-muted);
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.window-controls__btn:hover {
  color: var(--c-text);
  background: var(--c-bg-hover);
}

.window-controls__btn.is-active {
  color: var(--c-primary);
  background: var(--c-primary-bg);
}

.window-controls__close:hover {
  color: #fff;
  background: #e81123;
}

.window-controls__pin {
  width: 9px;
  height: 9px;
  border: 1.5px solid currentColor;
  border-radius: 50% 50% 0 50%;
  transform: rotate(-45deg);
}

.window-controls__minimize {
  width: 10px;
  height: 1.5px;
  border-radius: 1px;
  background: currentColor;
}

.window-controls__maximize,
.window-controls__restore {
  width: 10px;
  height: 10px;
  border: 1.5px solid currentColor;
  border-radius: 1px;
}

.window-controls__restore {
  position: relative;
  width: 8px;
  height: 8px;
  margin: 1px 0 0 1px;
  box-shadow: 2px -2px 0 -1.5px transparent, 2px -2px 0 0 currentColor;
}

.window-controls__close-icon {
  position: relative;
  width: 12px;
  height: 12px;
}

.window-controls__close-icon::before,
.window-controls__close-icon::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 1.5px;
  border-radius: 1px;
  background: currentColor;
}

.window-controls__close-icon::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.window-controls__close-icon::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}
</style>
