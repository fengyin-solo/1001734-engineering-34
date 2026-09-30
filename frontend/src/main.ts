import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { initConfig } from './config/runtime'
import { createAppRouter } from './router'
import './styles/global.css'

// 配置先行：解析失败也继续挂载，错误信息已写入配置状态，
// App.vue 会指出缺哪一项并提供重试，而不是白屏。
try {
  initConfig()
} catch {
  // 状态里已有缺失项说明；路由用根路径兜底，错误页不依赖任何接口。
}

const app = createApp(App)
app.use(createPinia())
app.use(createAppRouter())
app.mount('#app')
