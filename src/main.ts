// import './assets/main.css'
import ElementPlus from 'element-plus'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

import App from './App.vue'
import router from './router'

import './styles/main.less'

// token 不存在时清除持久化的 user_info，防止 stale state 触发 401
if (!localStorage.getItem('jueblog_token')) {
  try {
    const raw = localStorage.getItem('user_state')
    if (raw) {
      const stored = JSON.parse(raw)
      if (stored?.user_info) {
        stored.user_info = null
        localStorage.setItem('user_state', JSON.stringify(stored))
      }
    }
  } catch {
    /* ignore */
  }
}

const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(ElementPlus)

app.mount('#app')
