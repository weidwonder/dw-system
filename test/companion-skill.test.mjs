// 伴生 skill（agentic-principle 与 skill-principle）的安装与版本检测。
// 两个 skill 的形态刻意不同，覆盖两条真实存在的分支：agentic-principle 的 frontmatter 有
// metadata.version（按版本号比较），skill-principle 没有（按 SKILL.md 内容比较，见 install.mjs
// 的 companionContentSame）。只测一个会让另一条分支整条没有闸。
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

// 两个伴生 skill 的真实形态：name、仓库内子目录、有没有 metadata.version。
// 与 install.mjs 的 COMPANION_SKILLS 保持同构；那边改了这里要跟着改（下方有一条断言盯着）。
const COMPANIONS = {
  agentic: { name: 'agentic-principle', subdir: 'agentic-principle', versioned: true },
  skill: { name: 'skill-principle', subdir: 'skill', versioned: false },
}

// versioned=false 的 skill 用 git tag 管版本，frontmatter 里没有 metadata.version——
// 这不是 fixture 偷懒，是它上游的真实形态，安装器必须能处理。body 用来在无版本号时造出内容差异。
function skillMd(spec, version, body = 'fixture') {
  const meta = spec.versioned ? `metadata:\n  version: '${version}'\n` : ''
  return `---\nname: ${spec.name}\ndescription: Fixture skill for installer tests.\n${meta}---\n\n# ${body}\n`
}

// 造一个"远端"仓库：skill 本体放在该 skill 各自的子目录里，与真实仓库结构一致
//（安装器按 subdir 取本体；两个 skill 的 subdir 并不相同，写死一个就测不出另一个）。
function makeRemote(spec, version, body) {
  const root = mkdtempSync(path.join(tmpdir(), 'companion-remote-'))
  const skillDir = path.join(root, spec.subdir)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(path.join(skillDir, 'SKILL.md'), skillMd(spec, version, body))
  git(root, 'init', '-b', 'main')
  git(root, 'config', 'user.email', 'test@example.com')
  git(root, 'config', 'user.name', 'Companion Test')
  git(root, 'add', '.')
  git(root, 'commit', '-m', 'fixture')
  return root
}

function bumpRemote(remote, spec, version, body) {
  writeFileSync(path.join(remote, spec.subdir, 'SKILL.md'), skillMd(spec, version, body))
  git(remote, 'add', '.')
  git(remote, 'commit', '-m', 'bump')
}

// --no-codegraph：本组只验伴生 skill，不能顺手升级这台机器的全局 codegraph、
// 也不该给临时目标目录建索引。codegraph 那条链另见 codegraph.test.mjs（用假 CLI 跑）。
// --no-ctx-link：同理——不许把临时目录 npm link 成这台机器的全局 ctx 命令。
function runInstaller(target, home, extraArgs = []) {
  return spawnSync(process.execPath, [
    installer, target, `--source-dir=${repoRoot}`, '--yes', '--no-plugins', '--no-codegraph', '--no-ctx-link', ...extraArgs,
  ], { encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } })
}

// 每个用例都 MUST 把**两个** skill 的来源都指向本地假远端：只覆盖其中一个，另一个会去
// 访问真实 GitHub——测试就变成联网的了，且在无网环境下随机失败。
function sandbox(fn) {
  const home = mkdtempSync(path.join(tmpdir(), 'companion-home-'))
  const target = mkdtempSync(path.join(tmpdir(), 'companion-target-'))
  const remote = makeRemote(COMPANIONS.agentic, '0.3.0')
  const spRemote = makeRemote(COMPANIONS.skill, null, 'fixture')
  const args = [
    `--companion-repo=${COMPANIONS.agentic.name}=${remote}`,
    `--companion-repo=${COMPANIONS.skill.name}=${spRemote}`,
  ]
  try {
    fn({ home, target, remote, spRemote, args })
  } finally {
    for (const d of [home, target, remote, spRemote]) rmSync(d, { recursive: true, force: true })
  }
}

const userSkill = (home, tool, name = 'agentic-principle') => path.join(home, tool, 'skills', name)
const claudeSkill = (home, name) => userSkill(home, '.claude', name)
// Codex 的【用户级】入口是 ~/.codex/skills/；~/.agents/skills/ 只是它的项目级形态，
// 用户级不存在，v1.6.0 曾误装到那里（见 legacySkill）。
const codexSkill = (home, name) => userSkill(home, '.codex', name)
const legacySkill = (home, name) => userSkill(home, '.agents', name)

test('伴生 skill 装到用户级的 Claude 与 Codex 两个入口，不进目标项目', () => {
  sandbox(({ home, target, args }) => {
    const r = runInstaller(target, home, args)
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
  sandbox(({ home, target, args }) => {
    const stale = legacySkill(home)
    mkdirSync(stale, { recursive: true })
    writeFileSync(path.join(stale, 'SKILL.md'), skillMd(COMPANIONS.agentic, '0.1.0'))

    const r = runInstaller(target, home, args)
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
  sandbox(({ home, target, args }) => {
    runInstaller(target, home, args)
    const r = runInstaller(target, home, args)
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /已是最新，跳过/)
    assert.doesNotMatch(r.stdout, /已更新为/)
  })
})

test('远端有新版本时自动更新', () => {
  sandbox(({ home, target, remote, args }) => {
    runInstaller(target, home, args)
    bumpRemote(remote, COMPANIONS.agentic, '0.4.0')
    const r = runInstaller(target, home, args)
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /v0\.3\.0 → 已更新为 v0\.4\.0/)
    assert.match(readFileSync(path.join(claudeSkill(home), 'SKILL.md'), 'utf8'), /version: '0\.4\.0'/)
  })
})

test('目标是 symlink（本地开发态）时只报告版本，绝不覆盖', () => {
  sandbox(({ home, target, args }) => {
    const dev = mkdtempSync(path.join(tmpdir(), 'companion-dev-'))
    try {
      writeFileSync(path.join(dev, 'SKILL.md'), skillMd(COMPANIONS.agentic, '0.1.0'))
      mkdirSync(path.dirname(claudeSkill(home)), { recursive: true })
      symlinkSync(dev, claudeSkill(home))

      const r = runInstaller(target, home, args)
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
  sandbox(({ home, target, args }) => {
    const dir = claudeSkill(home)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'SKILL.md'), skillMd(COMPANIONS.agentic, '0.1.0'))
    git(dir, 'init', '-b', 'main')

    const r = runInstaller(target, home, args)
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /git 工作区.*保持不动/)
    assert.match(readFileSync(path.join(dir, 'SKILL.md'), 'utf8'), /version: '0\.1\.0'/)
  })
})

test('伴生仓库不可达时降级为警告，主安装照常完成', () => {
  sandbox(({ home, target }) => {
    // 两个都指向不存在的路径：只挡住一个，另一个会去访问真实 GitHub，测试就联网了。
    const dead = Object.values(COMPANIONS).map(
      c => `--companion-repo=${c.name}=${path.join(target, 'no-such-repo')}`,
    )
    const r = runInstaller(target, home, dead)
    assert.equal(r.status, 0, r.stderr || r.stdout)
    for (const { name } of Object.values(COMPANIONS)) {
      assert.match(r.stdout, new RegExp(`⚠ 伴生 skill ${name}：无法访问`))
    }
    // 文案按各自的 why 生成，不再是写死的"它是 Agentic 需求的必需依赖"——
    // 那句话对非 agentic 的伴生 skill 是错的。
    assert.match(r.stdout, /本地未安装。它的用途：/)
    assert.ok(!/它是 Agentic 需求的必需依赖/.test(r.stdout), '拉取失败文案仍写死单个 skill 的语义')
    // 主安装的产物必须完好
    assert.ok(existsSync(path.join(target, '.claude', 'skills', 'ai-dev-workflow', 'SKILL.md')))
    assert.match(r.stdout, /完成。下一步：/)
  })
})

test('--no-companions 完全跳过，两个伴生 skill 都不产生用户级写入', () => {
  sandbox(({ home, target, args }) => {
    const r = runInstaller(target, home, [...args, '--no-companions'])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /跳过伴生 skill 检查/)
    // 它是**总闸**：逐个 skill 检查，漏掉哪个都说明总闸退化成了单个 skill 的开关。
    for (const { name } of Object.values(COMPANIONS)) {
      assert.equal(existsSync(claudeSkill(home, name)), false, `${name} 不该被安装`)
      assert.equal(existsSync(codexSkill(home, name)), false, `${name} 不该被安装`)
    }
  })
})

test('--no-agentic 仍是 --no-companions 的同义词（旧调用方不该突然失效）', () => {
  sandbox(({ home, target, args }) => {
    const r = runInstaller(target, home, [...args, '--no-agentic'])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /跳过伴生 skill 检查/)
    assert.equal(existsSync(claudeSkill(home, COMPANIONS.skill.name)), false)
  })
})

test('两个伴生 skill 都装上，各自取自己的子目录', () => {
  sandbox(({ home, target, args }) => {
    const r = runInstaller(target, home, args)
    assert.equal(r.status, 0, r.stderr || r.stdout)
    for (const spec of Object.values(COMPANIONS)) {
      for (const dir of [claudeSkill(home, spec.name), codexSkill(home, spec.name)]) {
        assert.ok(existsSync(path.join(dir, 'SKILL.md')), `${dir} 应已安装`)
        assert.match(readFileSync(path.join(dir, 'SKILL.md'), 'utf8'), new RegExp(`name: ${spec.name}`))
      }
    }
  })
})

// AC-023：无 metadata.version 的 skill 必须按内容判更新，否则每次安装都会重写它。
test('无版本号的伴生 skill：内容没变则跳过，内容变了才更新', () => {
  sandbox(({ home, target, args, spRemote }) => {
    const spec = COMPANIONS.skill
    runInstaller(target, home, args)
    assert.ok(existsSync(path.join(claudeSkill(home, spec.name), 'SKILL.md')))

    const second = runInstaller(target, home, args)
    assert.equal(second.status, 0, second.stderr || second.stdout)
    const spBlock = second.stdout.slice(second.stdout.indexOf(`伴生 skill ${spec.name}`))
    assert.match(spBlock, /已是最新，跳过/, '无版本号的 skill 内容没变时仍被重写')
    assert.ok(!/已更新为/.test(spBlock), '内容没变却报了"已更新"')

    bumpRemote(spRemote, spec, null, 'changed-body')
    const third = runInstaller(target, home, args)
    const spBlock3 = third.stdout.slice(third.stdout.indexOf(`伴生 skill ${spec.name}`))
    assert.match(spBlock3, /已更新为/, '内容变了却没更新')
    assert.match(readFileSync(path.join(claudeSkill(home, spec.name), 'SKILL.md'), 'utf8'), /changed-body/)
  })
})

test('--companion-repo 的 name 不认识时报错中止，不静默忽略', () => {
  sandbox(({ home, target, args }) => {
    const r = runInstaller(target, home, [...args, '--companion-repo=no-such-skill=/tmp/x'])
    assert.notEqual(r.status, 0, '未知 name 应当以非零退出码中止')
    const out = r.stderr + r.stdout
    assert.match(out, /agentic-principle/, '报错未列出合法值域')
    assert.match(out, /skill-principle/, '报错未列出合法值域')
  })
})

test('--dry-run 只预告伴生 skill 的动作，不落盘', () => {
  sandbox(({ home, target, args }) => {
    const r = runInstaller(target, home, [...args, '--dry-run'])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /\[--dry-run\] 将安装\/更新为 v0\.3\.0/)
    assert.equal(existsSync(claudeSkill(home)), false)
  })
})

test('COMPANION_SKILLS 指向两个伴生 skill 各自真实的仓库与子目录', () => {
  const raw = readFileSync(installer, 'utf8')
  assert.match(raw, /repo: 'https:\/\/github\.com\/weidwonder\/agentic-principle\.git'/)
  assert.match(raw, /subdir: 'agentic-principle'/)
  // skill-principle 的本体在仓库的 skill/ 子目录（仓库根是开发工程，含 dist/ docs/）——
  // 这一条实拉验证过，写错 subdir 会让安装器每次都报"仓库里找不到 SKILL.md"。
  assert.match(raw, /repo: 'https:\/\/github\.com\/weidwonder\/skill-principle\.git'/)
  assert.match(raw, /subdir: 'skill'/)
  // 每个条目都要有 why：拉取失败时的文案是按它生成的，缺了就会打印 undefined。
  for (const name of ['agentic-principle', 'skill-principle']) {
    const entry = raw.slice(raw.indexOf(`name: '${name}'`))
    assert.match(entry.slice(0, 600), /why: '[^']+'/, `${name} 条目缺 why`)
  }
  // 单数化硬编码不得回潮：下标引用会让第二个 skill 在帮助文本里消失。
  assert.ok(!/COMPANION_SKILLS\[0\]/.test(raw), 'install.mjs 里又出现了 COMPANION_SKILLS[0] 下标')
  // 帮助里必须说明它是用户级、可跳过
  const help = spawnSync(process.execPath, [installer, '--help'], { encoding: 'utf8' })
  assert.match(help.stdout, /伴生 skill（用户级/)
  assert.match(help.stdout, /--no-agentic/)
})
