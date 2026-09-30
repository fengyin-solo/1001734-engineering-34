import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { initAppConfig } from './config/runtime'
import './styles/global.css'

// 先解析唯一配置再挂载；失败时 App 展示缺失项与“重试”，且不顶旧值。
initAppConfig()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
