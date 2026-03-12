<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="logo">
        <el-icon><Lock /></el-icon>
      </div>
      <div class="name">Sentinel</div>
    </div>

    <div class="section">治理中心</div>

    <el-menu :default-active="activeMenu" class="menu" router>
      <el-menu-item index="/workbench">
        <el-icon><HomeFilled /></el-icon>
        <span>工作台</span>
      </el-menu-item>
      <el-menu-item index="/attack-surface">
        <el-icon><Aim /></el-icon>
        <span>攻击面治理</span>
      </el-menu-item>
      <el-menu-item index="/threat-assessment">
        <el-icon><Warning /></el-icon>
        <span>威胁评估</span>
      </el-menu-item>
      <el-menu-item index="/events">
        <el-icon><Bell /></el-icon>
        <span>事件响应</span>
      </el-menu-item>
      <el-menu-item index="/operation">
        <el-icon><Document /></el-icon>
        <span>策略整改</span>
      </el-menu-item>
    </el-menu>

	    <div class="spacer" />
	
	    <div v-if="authStore.isLoggedIn" class="user-card">
	      <div class="avatar">{{ avatarText }}</div>
	      <div class="user-info">
	        <div class="username">{{ username }}</div>
	        <div v-if="roleName" class="role">{{ roleName }}</div>
	      </div>
	      <el-dropdown @command="handleDropdownCommand">
	        <el-button circle :icon="SwitchButton" />
	        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Aim, Bell, Document, HomeFilled, Lock, More, Warning, SwitchButton } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
	import { useAuthStore } from "@/stores/auth"
	import { logout } from "@/api/login"

const route = useRoute()
const router = useRouter()
	const activeMenu = computed(() => route.path)
	const authStore = useAuthStore()
	
	const pickFirstString = (candidates) => {
	  for (const value of candidates) {
	    if (typeof value === 'string' && value.trim()) return value.trim()
	  }
	  return ''
	}
	
	const username = computed(() => {
	  const info = authStore.userInfo || {}
	  return pickFirstString([
	    info.username,
	    info.userName,
	    info.name,
	    info.realName,
	    info.user?.username,
	    info.user?.name,
	    info.profile?.username,
	  ]) || '用户'
	})
	
	const roleName = computed(() => {
	  const info = authStore.userInfo || {}
	  return pickFirstString([
	    info.role_name,
	    info.roleName,
	    info.role?.name,
	    info.user?.role_name,
	    info.user?.roleName,
	  ])
	})
	
	const avatarText = computed(() => {
	  const text = username.value || '用户'
	  return text.length >= 2 ? text.slice(0, 2) : text.slice(0, 1)
	})

// 处理下拉菜单命令
const handleDropdownCommand = async (command) => {
  if (command === 'logout') {
    try {
      // 显示确认对话框
      await ElMessageBox.confirm(
        '确定要退出登录吗？',
        '退出登录',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      
      try {
        // 调用退出登录接口（失败也允许本地退出，避免卡死）
        await logout()
      } catch (e) {
        console.warn('退出登录接口失败（已继续本地退出）:', e)
        ElMessage.warning('服务器退出失败，已本地退出')
      } finally {
        authStore.clearAuth()
        router.push('/login')
        ElMessage.success('退出登录成功')
      }
    } catch (error) {
      // 用户取消退出
      if (error !== 'cancel') {
        console.error('退出登录失败:', error)
        ElMessage.error('退出登录失败')
      }
    }
  }
}
</script>

<style scoped>
.sidebar {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 14px 14px 16px;
  background: var(--app-surface);
  border-right: 1px solid var(--app-border);
}

.brand {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
}

.logo {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--app-purple);
}

.name {
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text);
}

.section {
  margin-top: 12px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--app-muted);
}

.menu {
  margin-top: 10px;
  border-right: none;
  background: transparent;
}

.menu :deep(.el-menu-item) {
  height: 44px;
  margin: 4px 0;
  border-radius: 12px;
  color: var(--app-muted);
}

.menu :deep(.el-menu-item:hover) {
  background: #f7f8ff;
  color: var(--app-text);
}

.menu :deep(.el-menu-item .el-icon) {
  color: inherit;
}

.menu :deep(.el-menu-item.is-active) {
  color: var(--app-purple);
  background: var(--app-purple-soft) !important;
}

.menu :deep(.el-menu-item.is-active::after) {
  content: '';
  margin-left: auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--app-purple);
}

.spacer {
  flex: 1 1 auto;
}

.user-card {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: #fff;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
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
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role {
  font-size: 12px;
  color: var(--app-muted);
}
</style>
