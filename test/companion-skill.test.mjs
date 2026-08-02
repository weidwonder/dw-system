// 伴生 skill（agentic-principle）的安装与版本检测。
// 全部用【本地 git 仓库当远端】+【临时 HOME】，不联网、不碰真实用户目录。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const installer = path.join(repoRoot, 'install.mjs')

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr || r.stdout}`)
}

function skillMd(version) {
  return `---\nname: agentic-principle\ndescription: Fixture skill for installer tests.\nmetadata:\n  version: '${version}'\n---\n\n# fixture\n`
}

// 造一个"远端" agentic_principle 仓库：skill 本体在 agentic-principle/ 子目录里，
// 与真实仓库结构一致（安装器按 subdir 取本体）。
function makeRemote(version) {
  const root = mkdtempSync(path.join(tmpdir(), 'companion-remote-'))
  const skillDir = path.join(root, 'agentic-principle')
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(path.join(skillDir, 'SKILL.md'), skillMd(version))
  git(root, 'init', '-b', 'main')
  git(root, 'config', 'user.email', 'test@example.com')
  git(root, 'config', 'user.name', 'Companion Test')
  git(root, 'add', '.')
  git(root, 'commit', '-m', 'fixture')
  return root
}

function bumpRemote(remote, version) {
  writeFileSync(path.join(remote, 'agentic-principle', 'SKILL.md'), skillMd(version))
  git(remote, 'add', '.')
  git(remote, 'commit', '-m', 'bump')
}

function runInstaller(target, home, extraArgs = []) {
  return spawnSync(process.execPath, [
    installer, target, `--source-dir=${repoRoot}`, '--yes', '--no-plugins', ...extraArgs,
  ], { encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } })
}

function sandbox(fn) {
  const home = mkdtempSync(path.join(tmpdir(), 'companion-home-'))
  const target = mkdtempSync(path.join(tmpdir(), 'companion-target-'))
  const remote = makeRemote('0.3.0')
  try {
    fn({ home, target, remote, arg: `--agentic-repo=${remote}` })
  } finally {
    for (const d of [home, target, remote]) rmSync(d, { recursive: true, force: true })
  }
}

const claudeSkill = home => path.join(home, '.claude', 'skills', 'agentic-principle')
// Codex 的【用户级】入口是 ~/.codex/skills/；~/.agents/skills/ 只是它的项目级形态，
// 用户级不存在，v1.6.0 曾误装到那里（见 legacySkill）。
const codexSkill = home => path.join(home, '.codex', 'skills', 'agentic-principle')
const legacySkill = home => path.join(home, '.agents', 'skills', 'agentic-principle')

test('伴生 skill 装到用户级的 Claude 与 Codex 两个入口，不进目标项目', () => {
  sandbox(({ home, target, arg }) => {
    const r = runInstaller(target, home, [arg])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    for (const dir of [claudeSkill(home), codexSkill(home)]) {
      assert.ok(existsSync(path.join(dir, 'SKILL.md')), `${dir} 应已安装`)
      assert.match(readFileSync(path.join(dir, 'SKILL.md'), 'utf8'), /version: '0\.3\.0'/)
    }
    // ~/.agents/ 不是 Codex 的用户级入口，绝不能再往那里写
    assert.equal(existsSync(legacySkill(home)), false)
    // 伴生 skill 是用户级依赖，不该混进目标项目，也不该被写进项目 .gitignore
    assert.equal(existsSync(path.join(target, '.claude', 'skills', 'agentic-principle')), false)
    assert.equal(existsSync(path.join(target, '.agents', 'skills', 'agentic-principle')), false)
    assert.doesNotMatch(readFileSync(path.join(target, '.gitignore'), 'utf8'), /agentic-principle/)
  })
})

test('检出 v1.6.0 误装在 ~/.agents/skills 的陈旧副本时报告，但不自动删', () => {
  sandbox(({ home, target, arg }) => {
    const stale = legacySkill(home)
    mkdirSync(stale, { recursive: true })
    writeFileSync(path.join(stale, 'SKILL.md'), skillMd('0.1.0'))

    const r = runInstaller(target, home, [arg])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /旧版安装器\(≤v1\.6\.0\)误装的副本/)
    assert.match(r.stdout, /rm -rf/)
    // 只报告：既不删除，也不在那里更新版本
    assert.match(readFileSync(path.join(stale, 'SKILL.md'), 'utf8'), /version: '0\.1\.0'/)
    // 正确位置照常安装
    assert.match(readFileSync(path.join(codexSkill(home), 'SKILL.md'), 'utf8'), /version: '0\.3\.0'/)
  })
})

test('本地已是最新则跳过，不重新下载', () => {
  sandbox(({ home, target, arg }) => {
    runInstaller(target, home, [arg])
    const r = runInstaller(target, home, [arg])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /已是最新，跳过/)
    assert.doesNotMatch(r.stdout, /已更新为/)
  })
})

test('远端有新版本时自动更新', () => {
  sandbox(({ home, target, remote, arg }) => {
    runInstaller(target, home, [arg])
    bumpRemote(remote, '0.4.0')
    const r = runInstaller(target, home, [arg])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /v0\.3\.0 → 已更新为 v0\.4\.0/)
    assert.match(readFileSync(path.join(claudeSkill(home), 'SKILL.md'), 'utf8'), /version: '0\.4\.0'/)
  })
})

test('目标是 symlink（本地开发态）时只报告版本，绝不覆盖', () => {
  sandbox(({ home, target, arg }) => {
    const dev = mkdtempSync(path.join(tmpdir(), 'companion-dev-'))
    try {
      writeFileSync(path.join(dev, 'SKILL.md'), skillMd('0.1.0'))
      mkdirSync(path.dirname(claudeSkill(home)), { recursive: true })
      symlinkSync(dev, claudeSkill(home))

      const r = runInstaller(target, home, [arg])
      assert.equal(r.status, 0, r.stderr || r.stdout)
      assert.match(r.stdout, /symlink.*保持不动/)
      assert.match(r.stdout, /有更新可用，但不自动覆盖/)
      // 开发目录的内容必须原样保留
      assert.match(readFileSync(path.join(dev, 'SKILL.md'), 'utf8'), /version: '0\.1\.0'/)
    } finally {
      rmSync(dev, { recursive: true, force: true })
    }
  })
})

test('目标是 git 工作区时同样不覆盖', () => {
  sandbox(({ home, target, arg }) => {
    const dir = claudeSkill(home)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'SKILL.md'), skillMd('0.1.0'))
    git(dir, 'init', '-b', 'main')

    const r = runInstaller(target, home, [arg])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /git 工作区.*保持不动/)
    assert.match(readFileSync(path.join(dir, 'SKILL.md'), 'utf8'), /version: '0\.1\.0'/)
  })
})

test('伴生仓库不可达时降级为警告，主安装照常完成', () => {
  sandbox(({ home, target }) => {
    const r = runInstaller(target, home, [`--agentic-repo=${path.join(target, 'no-such-repo')}`])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /⚠ 伴生 skill agentic-principle：无法访问/)
    assert.match(r.stdout, /本地未安装。它是 Agentic 需求的必需依赖/)
    // 主安装的产物必须完好
    assert.ok(existsSync(path.join(target, '.claude', 'skills', 'ai-dev-workflow', 'SKILL.md')))
    assert.match(r.stdout, /完成。下一步：/)
  })
})

test('--no-agentic 完全跳过，不产生任何用户级写入', () => {
  sandbox(({ home, target, arg }) => {
    const r = runInstaller(target, home, [arg, '--no-agentic'])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /跳过伴生 skill 检查/)
    assert.equal(existsSync(claudeSkill(home)), false)
    assert.equal(existsSync(codexSkill(home)), false)
  })
})

test('--dry-run 只预告伴生 skill 的动作，不落盘', () => {
  sandbox(({ home, target, arg }) => {
    const r = runInstaller(target, home, [arg, '--dry-run'])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /\[--dry-run\] 将安装\/更新为 v0\.3\.0/)
    assert.equal(existsSync(claudeSkill(home)), false)
  })
})

test('COMPANION_SKILLS 指向真实的 agentic_principle 仓库与子目录', () => {
  const raw = readFileSync(installer, 'utf8')
  assert.match(raw, /repo: 'https:\/\/github\.com\/weidwonder\/agentic_principle\.git'/)
  assert.match(raw, /subdir: 'agentic-principle'/)
  // 帮助里必须说明它是用户级、可跳过
  const help = spawnSync(process.execPath, [installer, '--help'], { encoding: 'utf8' })
  assert.match(help.stdout, /伴生 skill（用户级/)
  assert.match(help.stdout, /--no-agentic/)
})
