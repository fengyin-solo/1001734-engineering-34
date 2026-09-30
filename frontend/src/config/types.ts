/**
 * 全站唯一生效的一份配置的类型定义与键名约定。
 *
 * 换端口、换后端地址、换部署子路径，都只改 frontend/.env 这一份文件，
 * vite.config.ts（开发代理）、src/api/client.ts（接口前缀）、
 * router（部署 base）都从这里取值，不再各写各的。
 */

/** frontend/.env 中允许出现的全部键，新增配置项时先在这里登记。 */
export const CONFIG_KEYS = {
  appName: 'VITE_APP_NAME',
  /** 接口统一前缀，开发态由 dev server 按此前缀代理，生产态按此前缀拼接。 */
  apiPrefix: 'VITE_API_PREFIX',
  /** 部署子路径，例如 /inspect/；本地根路径部署时填 /。 */
  base: 'VITE_BASE',
  /** dev server 监听端口。 */
  devPort: 'VITE_DEV_PORT',
  /** dev server 代理目标，即后端地址。 */
  proxyTarget: 'VITE_PROXY_TARGET',
} as const

/** 浏览器里跑应用必需的键；代理目标只在起 dev server 时需要。 */
export const RUNTIME_REQUIRED_KEYS = [
  CONFIG_KEYS.appName,
  CONFIG_KEYS.apiPrefix,
  CONFIG_KEYS.base,
] as const

/** 起 dev server（vite / vite preview）时必需的键。 */
export const DEV_REQUIRED_KEYS = [
  CONFIG_KEYS.devPort,
  CONFIG_KEYS.proxyTarget,
] as const

/** 校验、归一化之后的配置，应用内只认这一份结构。 */
export interface AppConfig {
  appName: string
  apiPrefix: string
  base: string
  /** dev server 端口；构建态不起 server，允许为 null。 */
  devPort: number | null
  /** dev server 代理目标；构建态允许为 null。 */
  proxyTarget: string | null
}

export type RawEnv = Record<string, string | undefined>

/** 配置校验失败：明确指出缺的是哪一项（.env 里的键名），方便补完重试。 */
export class ConfigError extends Error {
  /** 缺失或非法的 .env 键名，调用方据此高亮并允许重试。 */
  readonly missingKeys: string[]

  constructor(missingKeys: string[], message: string) {
    super(message)
    this.name = 'ConfigError'
    this.missingKeys = missingKeys
  }
}
