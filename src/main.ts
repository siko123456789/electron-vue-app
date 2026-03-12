import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pinia } from './stores'

// 样式引入顺序很重要
import 'element-plus/dist/index.css'
import './assets/styles/publicClass.css'

import ElementPlus from 'element-plus'

const app = createApp(App)
app.use(ElementPlus)
app.use(pinia)
app.use(router)
app.mount('#app').$nextTick(() => {
  // Electron ipc
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })
})
