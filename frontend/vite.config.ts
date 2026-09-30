import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

import { buildProxyRules, type DevAppConfig } from './src/config/dev-server'
import { parseConfig } from './src/config/parser'
import type { AppConfig } from './src/config/types'

const envDir = fileURLToPath(new URL('.', import.meta.url))

/**
 * 构建失败时给出可读提示：明确指出哪个文件、哪一行、哪一列、为什么失败，
 * 而不是只丢一段插件栈。vue-tsc 类型检查阶段的失败由 scripts/build.mjs 负责格式化。
 */
function readableBuildErrors(): Plugin {
  function describe(error: { id?: string; loc?: { file?: string; line?: number; column?: number }; message?: string }): string {
    const location = error.id ?? error.loc?.file
    const parts = [
      location ? `文件 ${location}` : '',
      error.loc?.line ? `第 ${error.loc.line} 行` : '',
      error.loc?.column ? `第 ${error.loc.column} 列` : '',
    ].filter(Boolean)
    const reason = (error.message ?? String(error)).split('\n')[0]
    return `构建失败：${parts.length ? parts.join(' ') + '，' : ''}${reason}`
  }
  return {
    name: 'readable-build-errors',
    buildEnd(error) {
      if (error) {
        this.error({ message: describe(error) })
      }
    },
  }
}

function loadAppConfig(command: 'build' | 'serve', mode: string): AppConfig {
  // prefix 传空串：frontend/.env 里的键全部读入（含 dev server 端口、代理目标）。
  // loadEnv 同时会合并进程中已存在的 VITE_ 变量，容器里用环境变量覆盖仍然有效。
  const raw = loadEnv(mode, envDir, '')
  try {
    return parseConfig(raw, { scope: command === 'build' ? 'runtime' : 'dev' })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${detail}\n配置文件位置：${fileURLToPath(new URL('.env', import.meta.url))}，` +
        '按提示的键名补齐后重试即可。',
    )
  }
}

export default defineConfig(({ command, mode }) => {
  // 开发与构建读的是同一份 frontend/.env、走同一个 parseConfig，结果一致。
  const appConfig = loadAppConfig(command, mode)

  return {
    plugins: [vue(), readableBuildErrors()],
    // 部署到子路径时，静态资源与路由 base 同取配置，导航与布局不再错位。
    base: appConfig.base,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server:
      command === 'serve'
        ? {
            host: '127.0.0.1',
            // dev 作用域下端口与代理目标已校验为非空；构建态不起 server。
            port: (appConfig as DevAppConfig).devPort,
            // 关掉自动打开页面：起服务时只打印地址，不拉起浏览器。
            open: false,
            // 端口以配置为准：被占用时直接报错，不静默换端口。
            strictPort: true,
            proxy: buildProxyRules(appConfig as DevAppConfig),
          }
        : undefined,
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
