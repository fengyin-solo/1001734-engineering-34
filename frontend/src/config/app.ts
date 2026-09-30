/**
 * 唯一配置来源（single source of truth）。
 *
 * 这里同时供三处使用，任何一处都不再各写一份：
 * - Vite/Node 侧（config/node.ts、vite.config.ts）：dev 端口、代理目标、接口前缀、部署子路径
 * - 浏览器侧（src/config/runtime.ts、api/client.ts）：应用名、接口前缀
 * - 左侧导航与运营概览：业务模块清单（MODULES），模块数与导航项都从这一份派生
 *
 * 本文件不直接读 import.meta.env，也不持有可变状态：读取与缓存由浏览器/Node 两侧
 * 各自的入口负责，这里只提供纯函数，保证“同一份配置反复初始化”不会累积副作用。
 */

export type ConfigKey =
  | 'VITE_APP_NAME'
  | 'VITE_API_PREFIX'
  | 'VITE_PROXY_TARGET'
  | 'VITE_DEV_PORT'
  | 'VITE_BASE_PATH'

/** 单个配置项的取值规则：缺哪一项、为什么不合法都由这里决定。 */
export type FieldSpec = {
  key: ConfigKey
  /** 本地开发默认值；新同事克隆下来不改任何东西也能起。 */
  fallback: string
  /** 给人看的说明，报错时原样附上。 */
  describe: string
  /** 返回空串表示通过，否则返回不通过原因（不含字段名）。 */
  validate: (value: string) => string | null
}

const validateNonEmpty = (label: string) => (value: string) =>
  value.trim() ? null : `${label}不能为空`

const validateUrl = (value: string) => {
  if (!value.trim()) return '后端地址不能为空'
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return '后端地址必须是形如 http://127.0.0.1:8000 的完整 URL'
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return '后端地址协议必须是 http 或 https'
  }
  return null
}

const validatePort = (value: string) => {
  if (!/^\d+$/.test(value.trim())) return '端口必须是 0-65535 的整数'
  const port = Number(value.trim())
  if (port < 1 || port > 65535) return '端口必须在 1-65535 之间'
  return null
}

/** 子路径必须以 / 开头、以 / 结尾（根路径就是 "/"）。 */
const validateBasePath = (value: string) => {
  if (!value.startsWith('/')) return '部署子路径必须以 / 开头（根路径填 /）'
  if (value.length > 1 && !value.endsWith('/')) return '部署子路径必须以 / 结尾，例如 /ops/'
  if (value.includes(' ')) return '部署子路径不能包含空格'
  return null
}

/** 接口前缀必须以 / 开头、不能以 / 结尾，且不允许写成完整 URL。 */
const validateApiPrefix = (value: string) => {
  if (!value.startsWith('/')) return '接口前缀必须以 / 开头，例如 /api'
  if (value.endsWith('/')) return '接口前缀不能以 / 结尾，例如 /api 而不是 /api/'
  if (/^https?:\/\//.test(value)) return '接口前缀只需写路径，不要写后端域名'
  return null
}

export const FIELD_SPECS: FieldSpec[] = [
  {
    key: 'VITE_APP_NAME',
    fallback: '特种设备点检运维平台',
    describe: '左侧导航与浏览器标题使用的应用名称',
    validate: validateNonEmpty('应用名称'),
  },
  {
    key: 'VITE_API_PREFIX',
    fallback: '/api',
    describe: '所有后端接口的统一前缀，dev 代理与浏览器请求都用它',
    validate: validateApiPrefix,
  },
  {
    key: 'VITE_PROXY_TARGET',
    fallback: 'http://127.0.0.1:8000',
    describe: 'dev server 把接口前缀代理到的后端地址',
    validate: validateUrl,
  },
  {
    key: 'VITE_DEV_PORT',
    fallback: '5173',
    describe: '本地 dev server 监听端口',
    validate: validatePort,
  },
  {
    key: 'VITE_BASE_PATH',
    fallback: '/',
    describe: '部署子路径；部署在域名根目录填 /，部署到 /ops/ 这类子路径填对应值',
    validate: validateBasePath,
  },
]

export type ResolvedAppConfig = {
  appName: string
  apiPrefix: string
  proxyTarget: string
  devPort: number
  basePath: string
}

export type ConfigIssue = {
  key: ConfigKey
  reason: string
  describe: string
  /** 该键在 .env 文件中的行号（从 1 开始）；取不到文件或行时为 null。 */
  line: number | null
}

export type ResolveResult =
  | ({ ok: true } & ResolvedAppConfig)
  | { ok: false; issues: ConfigIssue[] }

/**
 * 纯函数：根据一份“读取到的环境变量”解析并校验全部配置。
 *
 * 每次调用都从传入的 env 重新计算，绝不复用上次结果，因此重试时不会顶旧值。
 * `lineOf` 由 Node 侧注入（浏览器侧没有文件概念，传 undefined 即可）。
 */
export function resolveAppConfig(
  env: Partial<Record<ConfigKey, string>>,
  lineOf?: (key: ConfigKey) => number | null,
): ResolveResult {
  const issues: ConfigIssue[] = []

  const read = (spec: FieldSpec): string => {
    // 三种情况要区分：键不存在=缺这一项；显式空串/纯空白=值为空；有内容但格式不对=不合法。
    // 无论哪种都不会用旧值顶替，只会在失败提示里说清楚原因。
    const raw = env[spec.key]
    if (typeof raw !== 'string') {
      issues.push({
        key: spec.key,
        reason: `缺少配置项 ${spec.key}（${spec.describe}）`,
        describe: spec.describe,
        line: lineOf?.(spec.key) ?? null,
      })
      return spec.fallback
    }
    const value = raw.trim()
    if (value === '') {
      issues.push({
        key: spec.key,
        reason: `配置项 ${spec.key} 的值不能为空白（${spec.describe}）`,
        describe: spec.describe,
        line: lineOf?.(spec.key) ?? null,
      })
      return spec.fallback
    }
    const invalid = spec.validate(value)
    if (invalid) {
      issues.push({
        key: spec.key,
        reason: `配置项 ${spec.key} 不合法：${invalid}`,
        describe: spec.describe,
        line: lineOf?.(spec.key) ?? null,
      })
      return spec.fallback
    }
    return value
  }

  const values: Record<ConfigKey, string> = {} as Record<ConfigKey, string>
  for (const spec of FIELD_SPECS) {
    values[spec.key] = read(spec)
  }

  if (issues.length > 0) {
    return { ok: false, issues }
  }

  return {
    ok: true,
    appName: values.VITE_APP_NAME,
    apiPrefix: values.VITE_API_PREFIX,
    proxyTarget: values.VITE_PROXY_TARGET,
    devPort: Number(values.VITE_DEV_PORT),
    basePath: values.VITE_BASE_PATH,
  }
}

/** 业务模块定义：左侧导航、运营概览的模块数都取这一份。 */
export type ModuleDef = {
  /** 与后端 store/seed 的表名、路由 path、接口路径一致。 */
  key: string
  /** 导航与运营概览里展示的中文名，与后端 overview 返回的 name 对齐。 */
  label: string
}

/**
 * 顺序与后端 backend/app/seed.py 的模块、router 注册顺序保持一致，
 * 运营概览拿到服务端数据时即可按下标/名称对齐。
 */
export const MODULES: readonly ModuleDef[] = [
  { key: 'boiler', label: '锅炉设备' },
  { key: 'vessel', label: '压力容器' },
  { key: 'pressurepipe', label: '压力管道' },
  { key: 'crane', label: '起重机械' },
  { key: 'elevator', label: '电梯设备' },
  { key: 'forklift', label: '场内机动车辆' },
  { key: 'plan', label: '点检计划' },
  { key: 'spotcheck', label: '点检记录' },
  { key: 'lubricate', label: '润滑保养' },
  { key: 'inspect', label: '定期检验' },
  { key: 'report', label: '检验报告' },
  { key: 'hazard', label: '隐患登记' },
  { key: 'rectify', label: '整改闭环' },
  { key: 'register', label: '使用登记' },
  { key: 'operator', label: '作业人员' },
  { key: 'spare', label: '备件器材' },
  { key: 'contract', label: '维保合同' },
  { key: 'settle', label: '费用结算' },
]

export type NavItem = { label: string; path: string }

let navCache: readonly NavItem[] | null = null

/**
 * 派生左侧导航。反复调用返回同一份冻结结果，不会因为“配置反复初始化”
 * 而产生重复的导航项；按 path 去重再兜底一次。
 */
export function buildNavItems(): readonly NavItem[] {
  if (navCache) return navCache
  const seen = new Set<string>()
  const items: NavItem[] = [{ label: '运营概览', path: '/' }]
  seen.add('/')
  for (const mod of MODULES) {
    const path = `/${mod.key}`
    if (seen.has(path)) continue
    seen.add(path)
    items.push({ label: mod.label, path })
  }
  navCache = Object.freeze(items.map((item) => Object.freeze({ ...item })))
  return navCache
}

/** 运营概览的业务模块数与左侧导航的业务模块数取同一份。 */
export const MODULE_COUNT = MODULES.length

/** 运营概览接口失败时的兜底行：同样来自 MODULES，数量始终与导航一致。 */
export function emptyModuleRows() {
  return MODULES.map((mod) => ({
    name: mod.label,
    created: 0,
    pending: 0,
    abnormal: 0,
  }))
}
