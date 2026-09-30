/**
 * 统一请求封装：统一拼接口前缀、抛网络错误、给页脚留一句可读的说明。
 * 接口前缀只来自唯一配置（src/config），各页面不再自己写 /api。
 */
import { apiPrefix } from '@/config/runtime'

/** 给业务路径补统一前缀；已经是绝对地址（http/https 或 //）或已带前缀的原样返回。 */
export function apiUrl(path: string): string {
  if (/^(https?:)?\/\//.test(path)) return path
  const prefix = apiPrefix()
  if (path === prefix || path.startsWith(`${prefix}/`)) return path
  return `${prefix}${path.startsWith('/') ? '' : '/'}${path}`
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
