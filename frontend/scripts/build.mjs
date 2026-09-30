#!/usr/bin/env node
/**
 * 构建入口：先做类型检查再打包，任一步失败都给出可读提示。
 *
 * 类型错误会逐条列出「文件 + 行:列 + 原因」，例如：
 *   构建失败（类型检查）：src/views/boiler/index.vue:99:12 —— 找不到名称 xxx
 * 打包阶段的错误（语法/导入解析）由 vite.config.ts 里的插件负责定位文件行列。
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const isWindows = process.platform === 'win32'
const npx = isWindows ? 'npx.cmd' : 'npx'

function run(command, args, options) {
  return spawnSync(command, args, { encoding: 'utf8', ...options })
}

/** vue-tsc 报错形如 `path(line,col): error TSxxxx: message` 或 `path:line:col - message`。 */
function formatTypeErrors(output) {
  const lines = []
  const pattern = /^(.+?)(?:\((\d+),(\d+)\)|:(\d+):(\d+))(?::\s*error[^:]*:|\s+-)\s*(.+)$/
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const match = line.match(pattern)
    if (match) {
      const [, file, l1, c1, l2, c2, message] = match
      const row = l1 ?? l2
      const col = c1 ?? c2
      lines.push(`构建失败（类型检查）：${file}:${row}:${col} —— ${message}`)
    } else if (/error TS\d+/.test(line)) {
      lines.push(`构建失败（类型检查）：${line}`)
    }
  }
  return lines
}

// 1) 类型检查
const tsc = run(npx, ['vue-tsc', '--noEmit'])
if (tsc.status !== 0) {
  const output = `${tsc.stdout ?? ''}\n${tsc.stderr ?? ''}`
  const formatted = formatTypeErrors(output)
  if (formatted.length) {
    console.error(formatted.join('\n'))
  } else {
    console.error('构建失败（类型检查），原始输出：')
    console.error(output.trim())
  }
  console.error('\n请按上面的文件与行列号修正后重新运行 npm run build。')
  process.exit(1)
}

// 2) 打包（vite 自身的错误由 vite.config.ts 的 readable-build-errors 插件定位）
const build = run(npx, ['vite', 'build'], { stdio: 'inherit' })
if (build.status !== 0) {
  console.error('\n构建失败（打包阶段）：请查看上方标注的文件、行列号与原因。')
  process.exit(build.status ?? 1)
}
