import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceVersion = readFileSync(path.join(repoRoot, 'dw-system', 'VERSION'), 'utf8').trim()

// --no-agentic：本组测试只关心版本与迁移，不让安装器联网拉伴生 skill、
// 更不能写进跑测试这台机器的用户级 skills 目录。伴生 skill 另见 companion-skill.test.mjs。
// --no-codegraph：同理——不许升级这台机器的全局 codegraph，也不许对临时目录建索引。
// --no-ctx-link：同理——不许把测试用的临时目录 npm link 成这台机器的全局 ctx 命令。
// codegraph 那条链另见 codegraph.test.mjs（用假 CLI 跑）。
function runInstaller(target, extraArgs = []) {
  return spawnSync(process.execPath, [
    path.join(repoRoot, 'install.mjs'), target, `--source-dir=${repoRoot}`, '--no-agentic', '--no-codegraph', '--no-ctx-link', ...extraArgs,
  ], { encoding: 'utf8' })
}

test('VERSION 与迁移指南文件契约', () => {
  assert.match(sourceVersion, /^\d+\.\d+\.\d+$/, 'dw-system/VERSION 必须是 x.y.z')

  // 成文判据（CLAUDE.md §版本管理）是「**需要用户动作的**升级必须新增迁移指南」——
  // 不是「每个版本都必须有」。此前这里写成无条件断言，是因为历史上每次 bump 恰好都需要
  // 用户动作；2.5.0（渐进式披露）是第一个零手动动作的 bump，把这个隐含假设顶了出来。
  // 无条件要求会逼出比没有更糟的东西：一份「需要的动作：无」的空指南——安装器会把它
  // 高亮全文打印给用户看，等于训练用户忽略这块高亮。
  // 所以这条改成条件式：有指南就必须合规，没有不算违规。
  const guide = path.join(repoRoot, 'dw-system', 'migrations', `${sourceVersion}.md`)
  if (existsSync(guide)) {
    assert.match(readFileSync(guide, 'utf8'), /需要的动作/, '迁移指南必须含"需要的动作"节')
  }

  // 放宽上面那条会丢掉一半防线，这里补回来：目录里的每一份指南都必须是合法版本号命名、
  // 含「需要的动作」节、且在一屏内（安装器升级时会高亮全文打印，超一屏就没人读完）。
  // 这样「写了指南但写坏了」仍然拦得住，只是不再强迫每个版本都写。
  const dir = path.join(repoRoot, 'dw-system', 'migrations')
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    assert.match(name, /^\d+\.\d+\.\d+\.md$/, `迁移指南命名必须是 <版本>.md：${name}`)
    const body = readFileSync(path.join(dir, name), 'utf8')
    assert.match(body, /需要的动作/, `${name} 必须含"需要的动作"节`)
    assert.ok(body.split('\n').length <= 45, `${name} 要保持一屏内（≤45 行）`)
  }

  // VERSION MUST NOT 低于目录里最高的那份指南——指南写了却没 bump 到位，
  // 安装器就永远不会把它打印给任何人看。
  const cmp = (a, b) => {
    const [x, y] = [a, b].map((v) => v.split('.').map(Number))
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  }
  const highest = readdirSync(dir)
    .filter((f) => /^\d+\.\d+\.\d+\.md$/.test(f))
    .map((f) => f.replace(/\.md$/, ''))
    .sort(cmp)
    .pop()
  // migrations/ 为空（或只剩非版本号文件）是**合法状态**——上面那条判据已经放宽成
  // "只有需要用户动作的升级才写指南"，一路都是零手动动作的版本时目录就该是空的。
  // 此刻 highest 为 undefined，`cmp(sourceVersion, undefined)` 会在 split 上抛 TypeError，
  // 把一条本该通过的断言变成崩溃。没有指南就没有"永远不会被打印"的指南，直接短路。
  if (highest === undefined) return
  assert.ok(
    cmp(sourceVersion, highest) >= 0,
    `VERSION（${sourceVersion}）低于已有的最高迁移指南（${highest}）——那份指南永远不会被安装器打印`,
  )
})

test('旧安装（有 skill 无 stamp）升级时高亮打印迁移指南', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-legacy-'))
  try {
    mkdirSync(path.join(target, '.claude', 'skills', 'dw-prd'), { recursive: true })
    const r = runInstaller(target, ['--dry-run'])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /已安装版本：v1\.0\.0/, '无 stamp 旧安装应按 1.0.0 处理')
    assert.match(r.stdout, new RegExp(`版本升级 v1\\.0\\.0 → v${sourceVersion.replace(/\./g, '\\.')}`))
    assert.match(r.stdout, /迁移指南，继续前请阅读/)
    assert.match(r.stdout, /需要的动作/, '迁移指南正文应完整打印')
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('全新安装不出现迁移提示，并在安装后写入版本 stamp', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-fresh-'))
  try {
    const dry = runInstaller(target, ['--dry-run'])
    assert.equal(dry.status, 0, dry.stderr || dry.stdout)
    assert.doesNotMatch(dry.stdout, /迁移指南/)
    assert.doesNotMatch(dry.stdout, /已安装版本/)

    const real = runInstaller(target, ['--yes', '--no-plugins'])
    assert.equal(real.status, 0, real.stderr || real.stdout)
    for (const dir of ['.claude', '.agents']) {
      const stamp = path.join(target, dir, 'skills', 'dw-system.version')
      assert.equal(readFileSync(stamp, 'utf8').trim(), sourceVersion, `${dir} 下应写入版本 stamp`)
    }
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('已 stamp 同版本重装不出现迁移提示；手工做旧 stamp 触发升级路径', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-restamp-'))
  try {
    const first = runInstaller(target, ['--yes', '--no-plugins'])
    assert.equal(first.status, 0, first.stderr || first.stdout)
    const again = runInstaller(target, ['--dry-run'])
    assert.doesNotMatch(again.stdout, /迁移指南/)
    assert.match(again.stdout, new RegExp(`已安装版本：v${sourceVersion.replace(/\./g, '\\.')}`))

    writeFileSync(path.join(target, '.claude', 'skills', 'dw-system.version'), '1.0.0\n')
    writeFileSync(path.join(target, '.agents', 'skills', 'dw-system.version'), '1.0.0\n')
    const upgrade = runInstaller(target, ['--dry-run'])
    assert.match(upgrade.stdout, /版本升级 v1\.0\.0/)
    assert.match(upgrade.stdout, /迁移指南/)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})
