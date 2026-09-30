import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

import { buildProxyRules, loadAppConfig } from './config/node'

// dev 与 build 共用同一份 .env + 同一套校验，避免“本地产物和构建结果不一致”。
// 校验不过会直接抛出带「文件:行号」的错误，启动/构建随即中止。
const config = loadAppConfig()

/**
 * 构建期再校验一次配置。vite.config.ts 在 build 时本就会执行一次 loadAppConfig，
 * 这个插件负责在错误信息里明确点出构建被配置问题阻断（而不是晦涩的栈）。
 */
function failOnInvalidConfig(): Plugin {
  return {
    name: 'app-config-guard',
    configResolved() {
      // loadAppConfig 已在顶层校验；此处失败会原样冒泡，附带文件与行号。
      loadAppConfig()
    },
  }
}

export default defineConfig({
  // 部署到子路径时，资源与路由基路径都取这一项，左侧导航/页面布局不再错位。
  base: config.basePath,
  plugins: [vue(), failOnInvalidConfig()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: config.devPort,
    // 关掉自动打开页面：起服务时只打印地址，不拉起浏览器
    open: false,
    strictPort: false,
    // 代理键（接口前缀）与目标都来自唯一配置，重复初始化不会生成重复规则。
    proxy: buildProxyRules(config),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
