/**
 * 配置解析与校验：把 frontend/.env 读出的原始键值归一成 AppConfig。
 *
 * 纯函数、无副作用，Node 侧（vite.config.ts）和浏览器侧（运行时）共用，
 * 保证「本地开发」与「构建产出」拿到的是同一份配置、同一套校验。
 */
import {
  AppConfig,
  CONFIG_KEYS,
  ConfigError,
  DEV_REQUIRED_KEYS,
  RawEnv,
  RUNTIME_REQUIRED_KEYS,
} from './types'

export type ConfigScope = 'runtime' | 'dev'

interface ParseOptions {
  /** runtime：浏览器跑应用时所需的键；dev：另需端口与代理目标。 */
  scope: ConfigScope
}

/** 去掉两端空白；不存在或空串都算缺失，而不是静默回退旧默认值。 */
function readValue(raw: RawEnv, key: string): string | undefined {
  const value = raw[key]
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function joinPath(prefix: string, rest: string): string {
  return `${prefix.replace(/\/+$/, '')}/${rest.replace(/^\/+/, '')}`
}

/**
 * 解析配置。任何一项缺失/非法都抛 ConfigError，错误信息直接列出 .env 里的键名，
 * 并给出修复说明；调用方可以补完后重新调用本函数（重试），不会改动旧配置。
 */
export function parseConfig(raw: RawEnv, options: ParseOptions): AppConfig {
  const requiredKeys =
    options.scope === 'dev'
      ? [...RUNTIME_REQUIRED_KEYS, ...DEV_REQUIRED_KEYS]
      : [...RUNTIME_REQUIRED_KEYS]

  const present = new Map<string, string>()
  const missingKeys: string[] = []
  for (const key of requiredKeys) {
    const value = readValue(raw, key)
    if (value === undefined) {
      missingKeys.push(key)
    } else {
      present.set(key, value)
    }
  }
  if (missingKeys.length) {
    throw new ConfigError(
      missingKeys,
      `缺少前端配置项：${missingKeys.join('、')}。` +
        '请在 frontend/.env 中补齐上述配置后重试（不要把旧值写死回代码里）。',
    )
  }

  // —— 下面这些键已经确认存在，继续做格式校验，非法与缺失走同一条报错/重试路径。 ——
  const invalidKeys: string[] = []
  const hints: string[] = []

  const appName = present.get(CONFIG_KEYS.appName) as string

  const apiPrefixRaw = present.get(CONFIG_KEYS.apiPrefix) as string
  if (!/^\/[^\s]*$/.test(apiPrefixRaw)) {
    invalidKeys.push(CONFIG_KEYS.apiPrefix)
    hints.push(`${CONFIG_KEYS.apiPrefix} 必须以 / 开头，例如 /api`)
  }
  const apiPrefix = apiPrefixRaw.replace(/\/+$/, '')

  const baseRaw = present.get(CONFIG_KEYS.base) as string
  if (!/^\/[^\s]*$/.test(baseRaw)) {
    invalidKeys.push(CONFIG_KEYS.base)
    hints.push(`${CONFIG_KEYS.base} 必须以 / 开头（根路径填 /，子路径如 /inspect/）`)
  }
  const base = baseRaw === '/' ? '/' : baseRaw.replace(/\/+$/, '') + '/'

  const portRaw =
    options.scope === 'dev'
      ? (present.get(CONFIG_KEYS.devPort) as string)
      : readValue(raw, CONFIG_KEYS.devPort)
  // 构建态（runtime）不起 dev server：这两个键允许缺省，缺省就是 null，
  // 绝不用写死的端口/地址顶替配置。
  let devPort: number | null = null
  if (portRaw !== undefined) {
    const parsed = Number(portRaw)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      invalidKeys.push(CONFIG_KEYS.devPort)
      hints.push(`${CONFIG_KEYS.devPort} 必须是 1-65535 的整数端口号`)
    } else {
      devPort = parsed
    }
  }

  const targetRaw =
    options.scope === 'dev'
      ? (present.get(CONFIG_KEYS.proxyTarget) as string)
      : readValue(raw, CONFIG_KEYS.proxyTarget)
  let proxyTarget: string | null = null
  if (targetRaw !== undefined) {
    let url: URL | undefined
    try {
      url = new URL(targetRaw)
    } catch {
      url = undefined
    }
    if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
      invalidKeys.push(CONFIG_KEYS.proxyTarget)
      hints.push(`${CONFIG_KEYS.proxyTarget} 必须是 http(s) 地址，例如 http://127.0.0.1:8000`)
    } else {
      proxyTarget = targetRaw.replace(/\/+$/, '')
    }
  }

  if (invalidKeys.length) {
    throw new ConfigError(
      invalidKeys,
      `前端配置项不合法：${invalidKeys.join('、')}。${hints.join('；')}。修正后重试。`,
    )
  }

  return { appName, apiPrefix, base, devPort, proxyTarget }
}

/**
 * 由统一配置生成接口完整路径。
 * 开发态由 dev server 按 apiPrefix 代理到 proxyTarget，生产态交给同前缀的反向代理，
 * 因此运行时只需拼前缀，两种部署产出走同一条路径规则。
 */
export function buildApiUrl(config: Pick<AppConfig, 'apiPrefix'>, path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return joinPath(config.apiPrefix, path)
}
