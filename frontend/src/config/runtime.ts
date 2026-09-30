/**
 * 浏览器侧运行时配置入口。
 *
 * - 应用启动时调用 initAppConfig() 读取并校验 import.meta.env；
 * - 取不到/不合法时返回缺失项说明，由界面提示并允许“重试”；
 * - 每次重试都重新读取，绝不用上一次的值顶替；只有解析成功才更新 config。
 */
import { reactive, readonly } from 'vue'

import {
  resolveAppConfig,
  type ConfigIssue,
  type ResolvedAppConfig,
} from '@/config/app'

function readBrowserEnv(): Partial<Record<string, string>> {
  const env = import.meta.env
  return {
    VITE_APP_NAME: env.VITE_APP_NAME,
    VITE_API_PREFIX: env.VITE_API_PREFIX,
    VITE_PROXY_TARGET: env.VITE_PROXY_TARGET,
    VITE_DEV_PORT: env.VITE_DEV_PORT,
    VITE_BASE_PATH: env.VITE_BASE_PATH,
  }
}

type RuntimeState = {
  config: ResolvedAppConfig | null
  issues: ConfigIssue[]
}

const state = reactive<RuntimeState>({ config: null, issues: [] })

/**
 * 重新读取并校验配置。
 * 关键点：解析结果先落在局部变量里。
 * - 成功才整体替换 state.config；
 * - 失败立即清空 state.config 并写回缺失项，界面因此进入“报错 + 可重试”状态，
 *   绝不用上一次（旧）的值继续顶着跑。
 */
export function initAppConfig(): void {
  const result = resolveAppConfig(readBrowserEnv())
  if (result.ok) {
    const { ok: _ok, ...cfg } = result
    state.config = Object.freeze({ ...cfg })
    state.issues = []
    return
  }
  state.config = null
  state.issues = result.issues
}

export function useAppConfig() {
  return {
    state: readonly(state),
    /** 允许界面在修正环境后重新拉取；失败不顶旧值。 */
    retry: initAppConfig,
  }
}

/** 当前生效的接口前缀；配置尚未就绪时回退到规范默认，保证请求函数可安全调用。 */
export function apiPrefix(): string {
  return state.config?.apiPrefix ?? '/api'
}

/** 部署基路径；路由在配置就绪前先用 Vite 注入的 BASE_URL。 */
export function basePath(): string {
  return state.config?.basePath ?? import.meta.env.BASE_URL ?? '/'
}
