/**
 * dev server 侧配置（仅 vite.config.ts 使用，不进浏览器包）。
 *
 * 代理规则由统一配置唯一生成：无论配置被初始化多少次、插件 mergeConfig
 * 执行多少轮，同一个接口前缀只对应一条代理规则，不会重复添加。
 */
import type { ProxyOptions } from 'vite'

import type { AppConfig } from './types'

/** 起 dev server 时的配置：端口与代理目标经 dev 作用域校验，必然非空。 */
export type DevAppConfig = AppConfig & { devPort: number; proxyTarget: string }

interface ProxyRuleMap {
  [prefix: string]: ProxyOptions
}

/**
 * 生成接口前缀的代理规则。前缀来自唯一的 AppConfig，
 * 调用方（vite.config.ts / vite 插件）重复调用时直接复用同一份对象。
 */
export function buildProxyRules(config: DevAppConfig): ProxyRuleMap {
  return {
    [config.apiPrefix]: {
      target: config.proxyTarget,
      changeOrigin: true,
    },
  }
}

/**
 * 幂等合并：已有相同前缀的规则就保留（同一目标才是同一条规则），
 * 防止重复初始化时出现重复代理；前缀或目标不同说明配置已变更，才替换。
 */
export function mergeProxyRules(existing: ProxyRuleMap, next: ProxyRuleMap): ProxyRuleMap {
  const merged: ProxyRuleMap = { ...existing }
  for (const [prefix, rule] of Object.entries(next)) {
    const prev = merged[prefix]
    if (!prev || prev.target !== rule.target) {
      merged[prefix] = rule
    }
  }
  return merged
}
