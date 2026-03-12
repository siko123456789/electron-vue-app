// src/router/index.ts
import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { pinia } from '@/stores'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: {
      requiresAuth: false
    }
  },
  {
    path: '/workbench',
    name: 'Workbench',
    component: () => import('../views/workBench/workbench.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/attack-surface',
    name: 'AttackSurface',
    component: () => import('@/views/attackSurface/index.vue'),
    meta: {
      requiresAuth: true,
      title: '攻击面治理'
    }
  },
     {
    path: '/threat-assessment',
    name: 'ThreatAssessment',
    component: () => import('@/views/threatAssessment/index.vue'),
    meta: {
      requiresAuth: true,
      title: '威胁评估'
    },
  },
  {
    path: '/events',
    name: 'Events',
    component: () => import('@/views/events/index.vue'),
    meta: {
      requiresAuth: true,
      title: '事件响应'
    },
  },
  {
    path: '/operation',
    name: 'Operation',
    component: () => import('@/views/operation/index.vue'),
    meta: {
      requiresAuth: true,
      title: '策略整改'
    },
  },
  // {
  //   path: '/safety-ledger',
  //   name: 'SafetyLedger',
  //   component: () => import('../views/SafetyLedger.vue'),
  //   meta: {
  //     requiresAuth: true
  //   }
  // },
  // {
  //   path: '/attack-surface',
  //   name: 'AttackSurface',
  //   component: () => import('../views/AttackSurface.vue'),
  //   meta: {
  //     requiresAuth: true
  //   },
  //   children: [
  //     {
  //       path: 'high-risk-ports',
  //       name: 'HighRiskPorts',
  //       component: () => import('../views/attack-surface/HighRiskPorts.vue')
  //     },
  //     {
  //       path: 'vulnerabilities',
  //       name: 'Vulnerabilities',
  //       component: () => import('../views/attack-surface/Vulnerabilities.vue')
  //     },
  //     {
  //       path: 'problem-policies',
  //       name: 'ProblemPolicies',
  //       component: () => import('../views/attack-surface/ProblemPolicies.vue')
  //     }
  //   ]
  // },
  // {
  //   path: '/threat-assessment',
  //   name: 'ThreatAssessment',
  //   component: () => import('../views/ThreatAssessment.vue'),
  //   meta: {
  //     requiresAuth: true
  //   },
  //   children: [
  //     {
  //       path: 'new-vulnerabilities',
  //       name: 'NewVulnerabilities',
  //       component: () => import('../views/threat-assessment/NewVulnerabilities.vue')
  //     },
  //     {
  //       path: 'new-attacks',
  //       name: 'NewAttacks',
  //       component: () => import('../views/threat-assessment/NewAttacks.vue')
  //     },
  //     {
  //       path: 'scanning',
  //       name: 'Scanning',
  //       component: () => import('../views/threat-assessment/Scanning.vue')
  //     },
  //     {
  //       path: 'blocking-process',
  //       name: 'BlockingProcess',
  //       component: () => import('../views/threat-assessment/BlockingProcess.vue')
  //     }
  //   ]
  // },
  // {
  //   path: '/events',
  //   name: 'Events',
  //   component: () => import('../views/Events.vue'),
  //   meta: {
  //     requiresAuth: true
  //   },
  //   children: [
  //     {
  //       path: 'new-assets',
  //       name: 'NewAssets',
  //       component: () => import('../views/events/NewAssets.vue')
  //     },
  //     {
  //       path: 'baseline-deviation',
  //       name: 'BaselineDeviation',
  //       component: () => import('../views/events/BaselineDeviation.vue')
  //     }
  //   ]
  // },
  // {
  //   path: '/operation',
  //   name: 'Operation',
  //   component: () => import('../views/Operation.vue'),
  //   meta: {
  //     requiresAuth: true
  //   },
  //   children: [
  //     {
  //       path: 'tickets',
  //       name: 'Tickets',
  //       component: () => import('../views/operation/Tickets.vue')
  //     },
  //     {
  //       path: 'reports',
  //       name: 'Reports',
  //       component: () => import('../views/operation/Reports.vue')
  //     }
  //   ]
  // },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  // 检查是否需要认证
  if (to.meta.requiresAuth !== false) {
    const authStore = useAuthStore(pinia)
    const token = authStore.token
    // 如果没有 token，跳转到登录页面
    if (!token) {
      next('/login')
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router
