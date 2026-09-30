/**
 * 统一请求封装：接口前缀从全站唯一配置取，抛网络错误，给页脚留一句可读的说明。
 *
 * 入参 path 不再带 /api 前缀：前缀只在配置里维护一份（VITE_API_PREFIX），
 * 开发态由 dev server 按此前缀代理，生产态由同前缀反向代理转发。
 */
import { buildApiUrl } from '@/config/parser'
import { useConfig } from '@/config/runtime'

export function apiUrl(path: string): string {
  const { requireConfig } = useConfig()
  return buildApiUrl(requireConfig(), path)
}

export function request(path: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(path)
  return fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  }).catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : '请求未送达'
    throw new Error(`接口请求失败：${detail}`)
  })
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await request(path)
  if (!response.ok) {
    throw new Error(`接口返回 ${response.status}，数据未更新`)
  }
  return (await response.json()) as T
}
