<template>
  <div class="settings-page">
    <header class="page-header">
      <div class="page-header__main">
        <h1 class="page-header__title">设置</h1>
        <p class="page-header__sub">
          桌面端专属配置，不涉及网页端复杂系统参数
        </p>
      </div>
      <el-button link class="settings-back" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回风险监测
      </el-button>
    </header>

    <div class="settings-shell">
      <aside class="settings-nav" aria-label="设置菜单">
        <div class="settings-nav__label">配置项</div>
        <button
          v-for="item in menuItems"
          :key="item.key"
          type="button"
          class="settings-nav__item"
          :class="{ 'is-active': activeMenu === item.key }"
          @click="activeMenu = item.key"
        >
          <span class="settings-nav__icon-wrap">
            <el-icon class="settings-nav__icon">
              <component :is="item.icon" />
            </el-icon>
          </span>
          <span class="settings-nav__text">{{ item.label }}</span>
        </button>
      </aside>

      <section class="settings-content">
        <div
          v-if="!['level', 'notify', 'autoLaunch', 'appLock', 'storage', 'account', 'about'].includes(activeMenu)"
          class="settings-panel__head"
        >
          <div>
            <h2 class="settings-panel__title">{{ activeMenuLabel }}</h2>
            <p class="settings-panel__desc">{{ activeMenuDesc }}</p>
          </div>
          <span class="settings-panel__chip">DESKTOP</span>
        </div>

        <div class="settings-panel__body">
          <LevelConfig v-if="activeMenu === 'level'" />
          <NotifyConfig v-else-if="activeMenu === 'notify'" />
          <AutoLaunchConfig v-else-if="activeMenu === 'autoLaunch'" />
          <AppLockConfig v-else-if="activeMenu === 'appLock'" />
          <StorageConfig v-else-if="activeMenu === 'storage'" />
          <AccountConfig v-else-if="activeMenu === 'account'" />
          <AboutConfig v-else-if="activeMenu === 'about'" />

          <div v-else class="settings-empty">
            <div class="settings-empty__icon">
              <el-icon><component :is="activeMenuIcon" /></el-icon>
            </div>
            <div class="settings-empty__title">{{ activeMenuLabel }}</div>
            <div class="settings-empty__hint">内容待完善，后续在此配置相关选项</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Bell,
  Coin,
  InfoFilled,
  Lock,
  Medal,
  Opportunity,
  User,
} from '@element-plus/icons-vue'
import { HOME_PATH } from '@/router'
import LevelConfig from './com/LevelConfig.vue'
import NotifyConfig from './com/NotifyConfig.vue'
import AutoLaunchConfig from './com/AutoLaunchConfig.vue'
import AppLockConfig from './com/AppLockConfig.vue'
import StorageConfig from './com/StorageConfig.vue'
import AccountConfig from './com/AccountConfig.vue'
import AboutConfig from './com/AboutConfig.vue'

type MenuKey =
  | 'level'
  | 'notify'
  | 'autoLaunch'
  | 'appLock'
  | 'storage'
  | 'account'
  | 'about'

const menuItems: Array<{
  key: MenuKey
  label: string
  desc: string
  icon: unknown
}> = [
  {
    key: 'level',
    label: '等级配置',
    desc: '自定义每种告警事件的响应级别，修改后即刻应用至新触发告警',
    icon: Medal,
  },
  {
    key: 'notify',
    label: '通知配置',
    desc: '自定义 P0 / P1 / P2 告警在桌面的原生声音与弹窗行为',
    icon: Bell,
  },
  {
    key: 'autoLaunch',
    label: '开机自启',
    desc: '配置 Windows 操作系统登录后的哨兵自动化守护服务',
    icon: Opportunity,
  },
  {
    key: 'appLock',
    label: '应用锁',
    desc: '启用锁屏密码保护本地业务数据；自动锁定与开关同步服务端',
    icon: Lock,
  },
  {
    key: 'storage',
    label: '数据与存储',
    desc: '查看本地目录并清理缓存与离线队列',
    icon: Coin,
  },
  {
    key: 'account',
    label: '登录与账号',
    desc: '管理服务器地址与登录凭证',
    icon: User,
  },
  {
    key: 'about',
    label: '关于',
    desc: '查看版本信息与桌面端说明',
    icon: InfoFilled,
  },
]

const router = useRouter()
const route = useRoute()
const activeMenu = ref<MenuKey>('level')

const activeMenuItem = computed(
  () => menuItems.find(item => item.key === activeMenu.value) || menuItems[0],
)
const activeMenuLabel = computed(() => activeMenuItem.value.label)
const activeMenuDesc = computed(() => activeMenuItem.value.desc)
const activeMenuIcon = computed(() => activeMenuItem.value.icon)

/** 兼容外部跳转 query.menu */
function resolveMenuFromQuery(menu?: unknown): MenuKey | null {
  const value = String(menu || '').trim()
  if (!value) return null
  const map: Record<string, MenuKey> = {
    level: 'level',
    levelConfig: 'level',
    notify: 'notify',
    notification: 'notify',
    autoLaunch: 'autoLaunch',
    appLock: 'appLock',
    lock: 'appLock',
    storage: 'storage',
    account: 'account',
    about: 'about',
    modelManagement: 'about',
  }
  return map[value] || null
}

watch(
  () => route.query.menu,
  menu => {
    const next = resolveMenuFromQuery(menu)
    if (next) activeMenu.value = next
  },
  { immediate: true },
)

function goBack() {
  void router.push(HOME_PATH)
}
</script>

<style scoped lang="scss">
.settings-page {
  --section-gap: var(--sp-4);
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--section-gap);
  box-sizing: border-box;
  min-height: 0;
  height: 100%;
  padding: var(--section-gap) var(--sp-5);
  background: var(--c-bg);
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  flex-shrink: 0;
}

.page-header__title {
  margin: 0;
  color: var(--c-text);
  font-size: var(--fs-4xl);
  font-weight: var(--fw-bold);
  line-height: 1.2;
}

.page-header__sub {
  margin: var(--sp-2) 0 0;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.settings-back {
  flex-shrink: 0;
  height: 32px;
  padding: 0 4px;
  color: var(--c-text-secondary);
  font-size: var(--fs-sm);
}

.settings-back :deep(.el-icon) {
  margin-right: 4px;
}

.settings-back:hover {
  color: var(--c-primary);
}

.settings-shell {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  border: 1px solid color-mix(in srgb, var(--c-primary) 22%, var(--c-border));
  border-radius: 14px;
  background: color-mix(in srgb, var(--c-bg-card) 88%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 16%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--c-primary) 6%, transparent);
  backdrop-filter: blur(12px) saturate(1.12);
  -webkit-backdrop-filter: blur(12px) saturate(1.12);
  overflow: hidden;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding: 18px 10px;
  border-right: 1px solid color-mix(in srgb, var(--c-primary) 12%, var(--c-border-light));
  background: color-mix(in srgb, var(--c-bg-hover) 45%, transparent);
  overflow: auto;
}

.settings-nav__label {
  margin: 0 6px 4px;
  color: var(--c-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.settings-nav__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 38px;
  padding: 6px 8px;
  color: var(--c-text-secondary);
  font-size: 13px;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 9px;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.settings-nav__icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: var(--c-text-muted);
  background: transparent;
  border: 0;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.settings-nav__icon {
  font-size: 14px;
}

.settings-nav__text {
  line-height: 1.25;
  white-space: nowrap;
}

.settings-nav__item:hover {
  color: var(--c-text);
  background: color-mix(in srgb, var(--c-bg-card) 70%, transparent);
  transform: translateX(1px);
}

.settings-nav__item:hover .settings-nav__icon-wrap {
  color: var(--c-text-secondary);
  background: color-mix(in srgb, var(--c-bg) 55%, transparent);
}

.settings-nav__item.is-active {
  color: var(--c-primary);
  background: var(--c-primary-bg);
  border-color: color-mix(in srgb, var(--c-primary) 26%, transparent);
  font-weight: 600;
}

.settings-nav__item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  bottom: 7px;
  width: 2px;
  border-radius: 2px;
  background: var(--c-primary);
  animation: settings-nav-bar-breathe 1.8s ease-in-out infinite;
}

.settings-nav__item.is-active::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-primary) 40%, transparent);
  animation: settings-nav-glow-breathe 1.8s ease-in-out infinite;
}

.settings-nav__item.is-active .settings-nav__icon-wrap {
  color: var(--c-primary);
  background: color-mix(in srgb, var(--c-bg-card) 72%, transparent);
  animation: settings-nav-icon-breathe 1.8s ease-in-out infinite;
}

@keyframes settings-nav-bar-breathe {
  0%,
  100% {
    opacity: 0.4;
    box-shadow: none;
  }
  50% {
    opacity: 1;
    box-shadow: 0 0 10px color-mix(in srgb, var(--c-primary) 80%, transparent);
  }
}

@keyframes settings-nav-glow-breathe {
  0%,
  100% {
    opacity: 0.15;
  }
  50% {
    opacity: 1;
  }
}

@keyframes settings-nav-icon-breathe {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--c-primary) 18%, transparent);
  }
  50% {
    transform: scale(1.08);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--c-primary) 50%, transparent),
      0 0 14px color-mix(in srgb, var(--c-primary) 40%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-nav__item.is-active::before,
  .settings-nav__item.is-active::after,
  .settings-nav__item.is-active .settings-nav__icon-wrap {
    animation: none;
  }
}

.settings-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: var(--sp-5);
  overflow: auto;
}

.settings-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  margin-bottom: var(--sp-5);
  padding-bottom: var(--sp-4);
  border-bottom: 1px solid color-mix(in srgb, var(--c-primary) 14%, var(--c-border-light));
}

.settings-panel__title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--c-text);
  line-height: 1.3;
}

.settings-panel__desc {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.settings-panel__chip {
  flex-shrink: 0;
  margin-top: 2px;
  padding: 4px 10px;
  color: var(--c-primary);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  border: 1px solid color-mix(in srgb, var(--c-primary) 30%, var(--c-border));
  border-radius: 6px;
  background: var(--c-primary-bg);
}

.settings-panel__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 280px;
}

.settings-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 320px;
  padding: 40px 24px;
  text-align: center;
  border: 1px dashed color-mix(in srgb, var(--c-primary) 20%, var(--c-border));
  border-radius: 12px;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--c-primary-bg) 35%, transparent),
      transparent 48%
    ),
    var(--c-bg);
}

.settings-empty__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 4px;
  color: var(--c-primary);
  border: 1px solid color-mix(in srgb, var(--c-primary) 24%, var(--c-border));
  border-radius: 14px;
  background: var(--c-primary-bg);
  font-size: 24px;
}

.settings-empty__title {
  color: var(--c-text);
  font-size: 15px;
  font-weight: 600;
}

.settings-empty__hint {
  max-width: 320px;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  line-height: 1.6;
}

@media (max-width: 860px) {
  .settings-shell {
    grid-template-columns: 1fr;
  }

  .settings-nav {
    border-right: 0;
    border-bottom: 1px solid var(--c-border-light);
    flex-direction: row;
    flex-wrap: wrap;
  }

  .settings-nav__label {
    width: 100%;
  }

  .settings-nav__item {
    width: auto;
  }
}
</style>
