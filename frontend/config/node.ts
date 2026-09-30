/**
 * Node/Vite 侧配置入口：只在 vite.config.ts 里用，不会进浏览器包。
 *
 * 职责：
 * - 读取唯一一份 .env（dev 与 build 都用它，保证本地产物一致）；
 * - 交给 src/config/app.ts 的纯函数校验，缺失/不合法时指出文件与行号；
 * - 幂等地生成 dev 代理规则，反复初始化不重复。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  FIELD_SPECS,
  resolveAppConfig,
  type ConfigIssue,
  type ConfigKey,
  type ResolvedAppConfig,
} from '../src/config/app'

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = resolve(FRONTEND_ROOT, '.env')

/** 把 .env 解析成键值对，并记录每个键所在的行号（用于报错定位）。 */
function parseEnvFile(content: string): {
  values: Record<string, string>
  lines: Record<string, number>
} {
  const values: Record<string, string> = {}
  const lines: Record<string, number> = {}
  content.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) return
    const eq = line.indexOf('=')
    if (eq === -1) return
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // 去掉成对的包裹引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in values)) {
      values[key] = value
      lines[key] = index + 1
    }
  })
  return { values, lines }
}

const KNOWN_KEYS = new Set<ConfigKey>(FIELD_SPECS.map((spec) => spec.key))

/**
 * 读取并解析 .env。
 * 进程环境变量（如 VITE_PROXY_TARGET=... vite）优先于文件，方便临时覆盖；
 * 但行号仍以 .env 文件为准（命令行覆盖没有文件行）。
 */
function readEnv(): {
  env: Partial<Record<ConfigKey, string>>
  lineOf: (key: ConfigKey) => number | null
} {
  let fileValues: Record<string, string> = {}
  let fileLines: Record<string, number> = {}
  try {
    const parsed = parseEnvFile(readFileSync(ENV_FILE, 'utf8'))
    fileValues = parsed.values
    fileLines = parsed.lines
  } catch {
    // 文件不存在时所有键都按“缺失”处理，行号为 null。
  }

  const env: Partial<Record<ConfigKey, string>> = {}
  for (const key of KNOWN_KEYS) {
    const fromProcess = process.env[key]
    env[key] =
      typeof fromProcess === 'string' && fromProcess !== ''
        ? fromProcess
        : fileValues[key]
  }

  const lineOf = (key: ConfigKey): number | null => {
    // 命令行显式覆盖时不指到文件行，避免误导；其余指向 .env 中的行。
    const fromProcess = process.env[key]
    if (typeof fromProcess === 'string' && fromProcess !== '') return null
    return fileLines[key] ?? null
  }

  return { env, lineOf }
}

/** 把单个问题渲染成可读的一行：文件 + 行号 + 原因。 */
export function formatIssue(issue: ConfigIssue): string {
  const where =
    issue.line != null ? `${ENV_FILE}:${issue.line}` : `${ENV_FILE}（或对应环境变量）`
  return `  - [${where}] ${issue.reason}`
}

export class AppConfigError extends Error {
  issues: ConfigIssue[]
  constructor(issues: ConfigIssue[]) {
    super(
      [
        '前端配置校验失败，已停止启动/构建：',
        ...issues.map(formatIssue),
        `请在 ${ENV_FILE} 补齐上述配置后重试。`,
      ].join('\n'),
    )
    this.name = 'AppConfigError'
    this.issues = issues
  }
}

let cached: ResolvedAppConfig | null = null

/**
 * 加载并校验配置。成功后冻结缓存（同一份配置反复初始化只算一次）；
 * 一旦校验失败则不写入缓存，绝不保留/顶替旧值。
 */
export function loadAppConfig(): ResolvedAppConfig {
  if (cached) return cached
  const { env, lineOf } = readEnv()
  const result = resolveAppConfig(env, lineOf)
  if (!result.ok) {
    throw new AppConfigError(result.issues)
  }
  cached = Object.freeze({ ...result })
  return cached
}

type ProxyRule = {
  target: string
  changeOrigin: true
}

let proxyCache: Record<string, ProxyRule> | null = null

/**
 * 生成 dev 代理表。重复调用返回同一份缓存对象，
 * 不会因配置被多次初始化而追加重复的代理规则。
 * 注意：返回对象交给 Vite/http-proxy 持有（其内部会写入属性），不能 Object.freeze。
 */
export function buildProxyRules(config: ResolvedAppConfig): Record<string, ProxyRule> {
  if (proxyCache) return proxyCache
  proxyCache = {
    [config.apiPrefix]: {
      target: config.proxyTarget,
      changeOrigin: true,
    },
  }
  return proxyCache
}
