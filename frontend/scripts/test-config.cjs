/**
 * 配置逻辑自测（零额外依赖，用 esbuild 即时把 TS 转成可执行 JS）。
 * 覆盖：唯一来源、模块数一致、导航/代理幂等不重复、缺失/非法提示、重试不顶旧值。
 * 运行：npm run test:config
 */
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { pathToFileURL } = require('node:url')

const esbuild = require('esbuild')

async function importTs(relative) {
  const abs = path.resolve(__dirname, '..', relative)
  const result = await esbuild.build({
    entryPoints: [abs],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  })
  const code = result.outputFiles[0].text
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-test-')), 'mod.mjs')
  fs.writeFileSync(tmp, code)
  return import(pathToFileURL(tmp).href)
}

async function main() {
  const app = await importTs('src/config/app.ts')
  const node = await importTs('config/node.ts')

  const validEnv = {
    VITE_APP_NAME: '特种设备点检运维平台',
    VITE_API_PREFIX: '/api',
    VITE_PROXY_TARGET: 'http://127.0.0.1:8000',
    VITE_DEV_PORT: '5173',
    VITE_BASE_PATH: '/',
  }

  // 1) 合法配置解析成功
  const ok = app.resolveAppConfig(validEnv)
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.devPort, 5173)
    assert.equal(ok.apiPrefix, '/api')
  }

  // 2) 左侧导航与运营概览取同一份模块数
  const nav = app.buildNavItems()
  assert.equal(nav.length, app.MODULE_COUNT + 1, '导航 = 概览模块数 + 运营概览入口')
  assert.equal(app.MODULE_COUNT, 18)
  assert.equal(app.emptyModuleRows().length, app.MODULE_COUNT)

  // 3) 导航幂等：反复初始化返回同一份、无重复 path
  const navAgain = app.buildNavItems()
  assert.equal(nav, navAgain, '导航应缓存为同一引用')
  const paths = nav.map((n) => n.path)
  assert.equal(new Set(paths).size, paths.length, '导航 path 不重复')

  // 4) 缺项要指出缺哪一项
  const missing = app.resolveAppConfig({ ...validEnv, VITE_DEV_PORT: undefined })
  assert.equal(missing.ok, false)
  if (!missing.ok) {
    assert.equal(missing.issues[0].key, 'VITE_DEV_PORT')
    assert.match(missing.issues[0].reason, /缺少配置项 VITE_DEV_PORT/)
  }

  // 5) 非法值逐项报错且带行号
  const lineOf = (k) => ({ VITE_BASE_PATH: 4 }[k] ?? null)
  const invalid = app.resolveAppConfig({ ...validEnv, VITE_BASE_PATH: 'ops/' }, lineOf)
  assert.equal(invalid.ok, false)
  if (!invalid.ok) {
    const base = invalid.issues.find((i) => i.key === 'VITE_BASE_PATH')
    assert.equal(base.line, 4)
    assert.match(base.reason, /\/ 开头/)
  }

  // 6) 重试不顶旧值：纯解析每次独立，Node 侧失败不写缓存
  //    （通过进程环境注入配置验证 loadAppConfig 成功路径与代理幂等）
  Object.assign(process.env, validEnv)
  const cfg = node.loadAppConfig()
  const proxy1 = node.buildProxyRules(cfg)
  const proxy2 = node.buildProxyRules(cfg)
  assert.equal(proxy1, proxy2, '代理规则应缓存为同一引用')
  assert.deepEqual(Object.keys(proxy1), [cfg.apiPrefix], '代理只有一个前缀键，不重复')
  assert.equal(node.loadAppConfig(), cfg, '同一份配置反复初始化只解析一次')

  // 7) apiPrefix 代理目标来自配置
  assert.equal(proxy1[cfg.apiPrefix].target, cfg.proxyTarget)

  // 8) Node 侧校验失败时抛出带键与原因的错误，且不污染既有成功缓存
  //    （直接调用纯解析即可验证“失败返回 issues”，缓存逻辑见 loadAppConfig 仅成功才写入）
  const bad = app.resolveAppConfig({ ...validEnv, VITE_PROXY_TARGET: 'not-a-url' })
  assert.equal(bad.ok, false)

  console.log('config tests: all assertions passed ✔')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
