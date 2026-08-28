import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const HOME_PATH = '/risk-monitor'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: HOME_PATH,
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { requiresAuth: false, title: '登录' },
    },
    {
      path: HOME_PATH,
      name: 'RiskMonitor',
      component: () => import('@/views/riskMonitor/index.vue'),
      meta: { requiresAuth: true, title: '风险监测' },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/setting/index.vue'),
      meta: { requiresAuth: true, title: '设置' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: HOME_PATH,
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const requiresAuth = to.meta.requiresAuth !== false

  if (requiresAuth && !authStore.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.path === '/login' && authStore.isLoggedIn) {
    return HOME_PATH
  }

  return true
})

export default router
export { HOME_PATH }
