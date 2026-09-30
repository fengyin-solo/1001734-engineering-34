/**
 * 运行时配置入口（浏览器侧）。
 *
 * - 全站唯一的配置单例：initConfig 反复执行不会重建，只在第一次或显式重试时解析；
 * - 取不到配置时保留上一份可用配置（不顶旧值），错误信息指出缺哪一项并允许重试；
 * - 配置来源是 Vite 构建时注入的 import.meta.env，解析规则与 vite.config.ts 同源。
 */
import { readonly, reactive } from 'vue'

import { parseConfig } from './parser'
import { AppConfig, ConfigError, RawEnv } from './types'

interface ConfigState {
  config: AppConfig | null
  error: ConfigError | null
  /** 是否已完成过至少一次解析（无论成功失败）。 */
  initialized: boolean
}

// currentConfig 保存「当前可用配置」的原始对象，供 initConfig 做引用级幂等判断；
// reactive 里的 config 只是它的响应式视图（代理），两者指向同一份配置内容。
let currentConfig: AppConfig | null = null

const state = reactive<ConfigState>({
  config: null,
  error: null,
  initialized: false,
})

function readEnv(): RawEnv {
  return import.meta.env as unknown as RawEnv
}

function sameConfig(a: AppConfig, b: AppConfig): boolean {
  return (
    a.appName === b.appName &&
    a.apiPrefix === b.apiPrefix &&
    a.base === b.base &&
    a.devPort === b.devPort &&
    a.proxyTarget === b.proxyTarget
  )
}

/**
 * 解析并装载配置。
 *
 * 已经有可用配置时再次调用属于重复初始化：内容没变就原样返回同一对象，
 * 不触发任何下游重建（导航、代理规则同理都跟着配置走同一份）。
 * 解析失败时：
 * - 若此前已有一份可用配置，继续用旧配置（不顶旧值），只更新错误提示；
 * - 若此前没有可用配置，config 保持为 null，由界面提示缺失项并引导重试。
 */
export function initConfig(
  raw: RawEnv = readEnv(),
  scope: 'runtime' | 'dev' = 'runtime',
): AppConfig {
  try {
    const next = parseConfig(raw, { scope })
    if (currentConfig && sameConfig(currentConfig, next)) {
      // 幂等：重复初始化复用旧实例。
      state.error = null
      state.initialized = true
      return currentConfig
    }
    currentConfig = next
    state.config = next
    state.error = null
    state.initialized = true
    return next
  } catch (error) {
    const configError =
      error instanceof ConfigError ? error : new ConfigError([], String(error))
    // 不覆盖 currentConfig/state.config：旧配置还在就继续用旧值。
    state.error = configError
    state.initialized = true
    throw configError
  }
}

/** 补完配置后由界面调用：重新解析。仍失败则保留旧值，成功则刷新。 */
export function retryConfig(raw?: RawEnv): AppConfig {
  return initConfig(raw ?? readEnv())
}

export function useConfig() {
  return {
    state: readonly(state),
    /** 已确认可用的配置；没有可用配置时抛错并指明缺哪一项。 */
    requireConfig(): AppConfig {
      if (currentConfig) return currentConfig
      throw state.error ?? new ConfigError([], '前端配置尚未初始化')
    },
  }
}
