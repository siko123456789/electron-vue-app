<template>
  <div class="topbar-wrap">
    <header class="topbar">
      <div class="left">
        <div class="brand" @click="router.push('/workbench')">
          <div class="logo">
            <el-icon>
              <Lock />
            </el-icon>
          </div>
          <div class="brand-text">
            <div class="brand-title">风险治理</div>
            <div class="brand-sub">Sentinel</div>
          </div>
        </div>
      </div>

      <div v-if="authStore.isLoggedIn" class="center">
        <div class="menu-scroller">
          <el-menu
            mode="horizontal"
            :default-active="activeMenu"
            :ellipsis="false"
            class="top-nav-menu"
            router
          >
            <el-menu-item index="/workbench">
              <el-icon>
                <House />
              </el-icon>
              <span>工作台</span>
            </el-menu-item>
            <!-- <el-menu-item index="/attack-surface">
              <el-icon>
                <Aim />
              </el-icon>
              <span>攻击面治理</span>
            </el-menu-item>
            <el-menu-item index="/threat-assessment">
              <el-icon>
                <Warning />
              </el-icon>
              <span>威胁评估</span>
            </el-menu-item>-->
            <el-menu-item index="/events">
              <el-icon>
                <Memo />
              </el-icon>
              <span>事件响应</span>
            </el-menu-item>
            <!-- <el-menu-item index="/operation">
              <el-icon>
                <Document />
              </el-icon>
              <span>策略整改</span>
            </el-menu-item>
            <el-menu-item index="/settings">
              <el-icon>
                <Setting />
              </el-icon>
              <span>设置</span>
            </el-menu-item>-->
          </el-menu>
        </div>
      </div>

      <div v-if="authStore.isLoggedIn" class="right">
        <el-button class="icon-btn" text @click="openDrawer">
          <el-badge
            :value="alerts.unreadCount"
            :hidden="alerts.unreadCount === 0"
            class="badge"
            type="danger"
          >
            <el-icon>
              <Bell />
            </el-icon>
          </el-badge>
        </el-button>
        <!-- <div class="divider" />
        <el-button class="help" text>
          帮助文档
          <el-icon class="help-icon">
            <QuestionFilled />
          </el-icon>
        </el-button>-->
        <div class="divider" />
        <el-dropdown @command="handleUserCommand" placement="bottom-end">
          <el-button class="user-menu-btn" text>
            <el-icon style="color:#333;font-size: 16px;">
              <User />
            </el-icon>
          </el-button>
          <template #dropdown>
            <div style="min-width:150px;">
              <el-dropdown-menu>
                <!-- 用户信息区域 -->
                <div class="user-info-dropdown">
                  <div class="user-info-header">
                    <div class="user-avatar">{{ avatarText }}</div>
                    <div class="user-info">
                      <div class="username">{{ username }}</div>
                      <div class="role">{{ roleName }}</div>
                    </div>
                  </div>
                </div>
                <el-dropdown-item command="settings">
                  <el-icon style="margin-right: 6px">
                    <Setting />
                  </el-icon>设置
                </el-dropdown-item>
                <el-dropdown-item command="lock" :disabled="!settingsStore.hasLockPassword">
                  <el-icon style="margin-right: 6px">
                    <Lock />
                  </el-icon>锁定应用
                </el-dropdown-item>
                <el-dropdown-item command="logout">
                  <el-icon style="margin-right: 6px">
                    <SwitchButton />
                  </el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </div>
          </template>
        </el-dropdown>
      </div>
    </header>

    <el-drawer v-if="authStore.isLoggedIn" v-model="drawerOpen" title="消息中心" size="50%">
      <div class="drawer-actions">
        <el-button size="small" @click="alerts.markAllRead()">全部已读</el-button>
        <el-button size="small" type="danger" plain @click="alerts.clearAll()">清空</el-button>
        <el-button size="small" type="primary" plain @click="demoRisk">测试告警</el-button>
        <el-button size="small" type="success" plain @click="startAutoTest">自动测试(1分钟)</el-button>
        <el-button size="small" plain @click="stopAutoTest">停止自动测试</el-button>
      </div>

      <div v-if="alerts.items.length === 0" class="drawer-empty">
        <el-empty description="暂无消息" />
      </div>

      <div v-else class="drawer-list">
        <div
          v-for="item in alerts.items"
          :key="item.id"
          class="drawer-item"
          :class="{ unread: !item.read, [item.variant]: true }"
          @click="alerts.markRead(item.id)"
        >
          <div class="it-head">
            <div class="it-title">{{ item.title }}</div>
            <div class="it-time">{{ formatTime(item.ts) }}</div>
          </div>
          <div class="it-msg">{{ item.message || '请立即关注并处理。' }}</div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
	import { computed, ref } from "vue";
	import { useAlertsStore } from "@/stores/alerts";
	import { useAuthStore } from "@/stores/auth";
	import { useSettingsStore } from "@/stores/settings";
	import type { UserInfo } from "@/stores/auth";
	import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter, useRoute } from "vue-router";
import { logout } from "@/api/login";

const alerts = useAlertsStore();
const drawerOpen = ref(false);
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const router = useRouter();
const route = useRoute();

const activeMenu = computed(() => route.path);

// 用户信息计算属性
const pickFirstString = (candidates: any[]) => {
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const username = computed(() => {
  const info = (authStore.userInfo ?? {}) as UserInfo;
  return (
    pickFirstString([
      info.username,
      info.userName,
      info.name,
      info.realName,
      info.user?.username,
      info.user?.name,
      info.profile?.username
    ]) || "用户"
  );
});

const roleName = computed(() => {
  const info = (authStore.userInfo ?? {}) as UserInfo;
  return pickFirstString([
    info.role_name,
    info.roleName,
    info.role?.name,
    info.user?.role_name,
    info.user?.roleName
  ]);
});

const avatarText = computed(() => {
  const text = username.value || "用户";
  return text.length >= 2 ? text.slice(0, 2) : text.slice(0, 1);
});

function openDrawer() {
  drawerOpen.value = true;
}

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function demoRisk() {
  window.ipcRenderer.invoke("app/show-alert", {
    variant: "risk",
    title: "高危告警",
    message: "发现高危漏洞",
    sound: true
  });
}

function startAutoTest() {
  try {
    void window.ipcRenderer.invoke("app/test-alerts/set-enabled", true);
    ElMessage.success("已开启自动测试（每分钟，窗口隐藏时弹出）");
  } catch {
    ElMessage.error("开启自动测试失败");
  }
}

function stopAutoTest() {
  try {
    void window.ipcRenderer.invoke("app/test-alerts/set-enabled", false);
    ElMessage.success("已停止自动测试");
  } catch {
    ElMessage.error("停止自动测试失败");
  }
}

// 处理用户菜单命令
const handleUserCommand = async (command: string) => {
  if (command === "settings") {
    router.push("/settings");
  } else if (command === "lock") {
    if (!settingsStore.hasLockPassword) {
      ElMessage.warning("请先在设置中启用应用锁");
      return;
    }
    drawerOpen.value = false;
    settingsStore.lockApp();
    ElMessage.success("应用已锁定");
  } else if (command === "logout") {
    try {
      // 显示确认对话框
      await ElMessageBox.confirm("确定要退出登录吗？", "退出登录", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      });

      try {
        // 调用退出登录接口（失败也允许本地退出，避免卡死）
        await logout();
      } catch (e) {
        console.warn("退出登录接口失败（已继续本地退出）:", e);
        ElMessage.warning("服务器退出失败，已本地退出");
      } finally {
        authStore.clearAuth();
        router.push("/login");
        ElMessage.success("退出登录成功");
      }
    } catch (error) {
      // 用户取消退出
      if (error !== "cancel") {
        console.error("退出登录失败:", error);
        ElMessage.error("退出登录失败");
      }
    }
  }
};
</script>

<style scoped>
.topbar-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: 64px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.96),
    rgba(255, 255, 255, 0.9)
  );
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(10px);
}

.left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.brand:hover {
  background: color-mix(in srgb, var(--el-color-primary) 5%, #fff);
}

.logo {
  width: 34px;
  height: 34px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, #9810fa, #4f46e5);
  box-shadow: 0 10px 18px rgba(79, 70, 229, 0.18);
}

.brand-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}

.brand-title {
  font-weight: 900;
  color: var(--app-text);
  letter-spacing: 0.2px;
}

.brand-sub {
  margin-top: 2px;
  font-size: 11px;
  color: var(--app-muted);
}

.center {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
}

.menu-scroller {
  width: 100%;
  max-width: 980px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.menu-scroller::-webkit-scrollbar {
  display: none;
}

.top-nav-menu {
  border-bottom: none;
  background: transparent;
  width: max-content;
  min-width: 100%;
  display: flex;
  align-items: center;
  /* --el-menu-bg-color: transparent;
  --el-menu-hover-bg-color: color-mix(in srgb, var(--el-color-primary) 10%, #fff);
  --el-menu-text-color: var(--app-muted);
  --el-menu-hover-text-color: var(--app-text);
  --el-menu-active-color: #4f46e5;
  --el-menu-border-color: transparent; */
}

.top-nav-menu :deep(.el-menu-item) {
  height: 44px;
  margin: 0 6px;
  border-radius: 14px;
  border-bottom: none !important;
  color: var(--app-muted);
  font-weight: 600;
  transition: all 0.15s ease;
}
:deep(.el-menu) {
  border-bottom: none !important;
}
.top-nav-menu :deep(.el-menu-item:hover) {
  background: color-mix(in srgb, var(--el-color-primary) 5%, #fff) !important;
  color: var(--app-text);
}

.top-nav-menu :deep(.el-menu-item.is-active) {
  color: #4f46e5;
  background: color-mix(in srgb, var(--el-color-primary) 5%, #fff) !important;
}

.top-nav-menu :deep(.el-menu-item.is-active:hover) {
  background: color-mix(in srgb, var(--el-color-primary) 5%, #fff) !important;
  color: #4f46e5;
}

.top-nav-menu :deep(.el-menu-item .el-icon) {
  margin-right: 6px;
  color: inherit;
}

.right {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--app-muted);
}

.icon-btn {
  height: 34px;
  border-radius: 12px;
  padding: 0 12px;
  color: var(--app-muted);
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.15s ease;
}

.icon-btn:hover {
  color: var(--app-text);
  border-color: rgba(79, 70, 229, 0.25);
  background: rgba(79, 70, 229, 0.08);
}

.icon-btn :deep(.el-icon) {
  font-size: 18px;
  color: inherit;
}

.divider {
  width: 1px;
  height: 18px;
  background: var(--app-border);
}

.help {
  height: 34px;
  border-radius: 12px;
  padding: 0 12px;
  color: var(--app-muted);
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.15s ease;
}

.help:hover {
  color: var(--app-text);
  border-color: rgba(79, 70, 229, 0.25);
  background: rgba(79, 70, 229, 0.08);
}

.help-icon {
  margin-left: 6px;
  color: inherit;
}

.badge :deep(.el-badge__content) {
  transform: translate(6px, -6px);
}

.user-menu-btn {
  height: 34px;
  border-radius: 12px;
  padding: 0 12px;
  color: var(--app-muted);
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-menu-btn :deep(.el-icon) {
  color: inherit;
}

.user-menu-btn:hover {
  color: var(--app-text);
  border-color: rgba(79, 70, 229, 0.25);
  background: rgba(79, 70, 229, 0.08);
}

/* 用户信息下拉菜单样式 */
.user-info-dropdown {
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-border);
  margin-bottom: 8px;
}

.user-info-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--app-purple);
  background: var(--app-purple-soft);
}

.user-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.username {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role {
  font-size: 12px;
  color: var(--app-muted);
  margin-top: 2px;
}

.drawer-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--app-border);
  margin-bottom: 10px;
}

.drawer-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.drawer-item {
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 10px 12px;
  background: var(--app-surface);
  cursor: pointer;
}

.drawer-item.unread {
  border-color: rgba(220, 38, 38, 0.4);
}

.drawer-item.todo.unread {
  border-color: rgba(37, 99, 235, 0.4);
}

.it-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.it-title {
  font-weight: 700;
  color: var(--app-text);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.it-time {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--app-muted);
}

.it-msg {
  margin-top: 6px;
  font-size: 12px;
  color: var(--app-muted);
  line-height: 1.4;
}
</style>
