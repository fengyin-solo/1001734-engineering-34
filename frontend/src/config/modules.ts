/**
 * 业务模块登记表：左侧导航与运营概览共用的同一份模块清单。
 *
 * - key 与后端 store/overview 返回的模块名一致，也与 router 里的路由 name 一致；
 * - 要新增/下线业务模块，只在这里改一处，导航项与运营概览模块行同时生效；
 * - 导航「运营概览」是固定首页，不计入业务模块数（概览数字按业务模块统计）。
 */
export interface ModuleDef {
  key: string
  label: string
  path: string
}

/** 顺序即导航与概览表格的展示顺序。 */
export const MODULES: readonly ModuleDef[] = [
  { key: 'boiler', label: '锅炉设备', path: '/boiler' },
  { key: 'vessel', label: '压力容器', path: '/vessel' },
  { key: 'pressurepipe', label: '压力管道', path: '/pressurepipe' },
  { key: 'crane', label: '起重机械', path: '/crane' },
  { key: 'elevator', label: '电梯设备', path: '/elevator' },
  { key: 'forklift', label: '场内机动车辆', path: '/forklift' },
  { key: 'plan', label: '点检计划', path: '/plan' },
  { key: 'spotcheck', label: '点检记录', path: '/spotcheck' },
  { key: 'lubricate', label: '润滑保养', path: '/lubricate' },
  { key: 'inspect', label: '定期检验', path: '/inspect' },
  { key: 'report', label: '检验报告', path: '/report' },
  { key: 'hazard', label: '隐患登记', path: '/hazard' },
  { key: 'rectify', label: '整改闭环', path: '/rectify' },
  { key: 'register', label: '使用登记', path: '/register' },
  { key: 'operator', label: '作业人员', path: '/operator' },
  { key: 'spare', label: '备件器材', path: '/spare' },
  { key: 'contract', label: '维保合同', path: '/contract' },
  { key: 'settle', label: '费用结算', path: '/settle' },
] as const

export interface NavItem {
  label: string
  path: string
}

const DASHBOARD_NAV: NavItem = { label: '运营概览', path: '/' }

/**
 * 左侧导航项：固定首页 + 模块登记表。
 * 结果冻结缓存：同一份配置/登记表无论被初始化多少次，都复用同一数组，
 * 不会出现重复的导航项。
 */
let cachedNavItems: readonly NavItem[] | undefined
export function getNavItems(): readonly NavItem[] {
  if (!cachedNavItems) {
    cachedNavItems = Object.freeze([
      DASHBOARD_NAV,
      ...MODULES.map((module) => ({ label: module.label, path: module.path })),
    ])
  }
  return cachedNavItems
}

/** 业务模块数量：导航（除固定首页）与运营概览取同一个数。 */
export function getModuleCount(): number {
  return MODULES.length
}

/** 按后端模块 key 查展示名，概览接口返回什么都不会改变模块行数。 */
export function findModule(key: string): ModuleDef | undefined {
  return MODULES.find((module) => module.key === key)
}
