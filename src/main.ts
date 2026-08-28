import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pinia } from './stores'
import { applyColorTheme, getStoredColorTheme } from './utils/theme'
import '@/assets/iconfont/iconfont.css'
applyColorTheme(getStoredColorTheme())

import '@/assets/fonts/fonts.css'
import 'element-plus/dist/index.css'
import './assets/styles/index.scss'
import './assets/styles/publicClass.css'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const app = createApp(App)
app.use(ElementPlus, { locale: zhCn })

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
app.mount('#app')
