import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceVersion = readFileSync(path.join(repoRoot, 'ai-dev-system', 'VERSION'), 'utf8').trim()

function runInstaller(target, extraArgs = []) {
  return spawnSync(process.execPath, [
    path.join(repoRoot, 'install.mjs'), target, `--source-dir=${repoRoot}`, ...extraArgs,
  ], { encoding: 'utf8' })
}

test('VERSION 与迁移指南文件契约', () => {
  assert.match(sourceVersion, /^\d+\.\d+\.\d+$/, 'ai-dev-system/VERSION 必须是 x.y.z')
  const guide = path.join(repoRoot, 'ai-dev-system', 'migrations', `${sourceVersion}.md`)
  assert.ok(existsSync(guide), `当前版本 ${sourceVersion} 存在迁移指南则命名必须为 migrations/${sourceVersion}.md（本版本有迁移，故必须存在）`)
  assert.match(readFileSync(guide, 'utf8'), /需要的动作/, '迁移指南必须含"需要的动作"节')
})

test('旧安装（有 skill 无 stamp）升级时高亮打印迁移指南', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-legacy-'))
  try {
    mkdirSync(path.join(target, '.claude', 'skills', 'ai-prd'), { recursive: true })
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
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-fresh-'))
  try {
    const dry = runInstaller(target, ['--dry-run'])
    assert.equal(dry.status, 0, dry.stderr || dry.stdout)
    assert.doesNotMatch(dry.stdout, /迁移指南/)
    assert.doesNotMatch(dry.stdout, /已安装版本/)

    const real = runInstaller(target, ['--yes', '--no-plugins'])
    assert.equal(real.status, 0, real.stderr || real.stdout)
    for (const dir of ['.claude', '.agents']) {
      const stamp = path.join(target, dir, 'skills', 'ai-dev-system.version')
      assert.equal(readFileSync(stamp, 'utf8').trim(), sourceVersion, `${dir} 下应写入版本 stamp`)
    }
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('已 stamp 同版本重装不出现迁移提示；手工做旧 stamp 触发升级路径', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-restamp-'))
  try {
    const first = runInstaller(target, ['--yes', '--no-plugins'])
    assert.equal(first.status, 0, first.stderr || first.stdout)
    const again = runInstaller(target, ['--dry-run'])
    assert.doesNotMatch(again.stdout, /迁移指南/)
    assert.match(again.stdout, new RegExp(`已安装版本：v${sourceVersion.replace(/\./g, '\\.')}`))

    writeFileSync(path.join(target, '.claude', 'skills', 'ai-dev-system.version'), '1.0.0\n')
    writeFileSync(path.join(target, '.agents', 'skills', 'ai-dev-system.version'), '1.0.0\n')
    const upgrade = runInstaller(target, ['--dry-run'])
    assert.match(upgrade.stdout, /版本升级 v1\.0\.0/)
    assert.match(upgrade.stdout, /迁移指南/)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})
