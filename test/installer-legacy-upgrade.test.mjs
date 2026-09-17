// 旧名字安装（ai-dev-system 1.x / 2.x）升级到 dw-system 的契约测试。
// 契约：docs/spec/2026-09-17-dw-system-安装器迁移与ctx体检与机器闸-eng-spec.md FR-001–FR-009 / AC-002–AC-008。
//
// --no-agentic / --no-codegraph / --no-ctx-link 是硬规定：这三段会动跑测试这台机器的
// 用户级 skills 目录、全局 npm 安装与全局 ctx 命令。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const installer = path.join(repoRoot, 'install.mjs')

const LEGACY_SKILLS = ['ai-dev-workflow', 'ai-prd']
const LEGACY_STAMP = 'ai-dev-system.version'
const LEGACY_TOKENS = ['ai-dev-workflow', 'ai-prd', 'ai-dev-system']

const install = (target, ...args) =>
  spawnSync(
    process.execPath,
    [installer, target, '--source-dir=' + repoRoot, '--no-agentic', '--no-codegraph', '--no-ctx-link', '--yes', ...args],
    { cwd: repoRoot, encoding: 'utf8' },
  )

function withTarget(prefix, fn) {
  const target = fs.mkdtempSync(path.join(tmpdir(), 'dw-legacy-' + prefix + '-'))
  try { return fn(target) } finally { fs.rmSync(target, { recursive: true, force: true }) }
}

const legacyWorkflowBlock = fields =>
  `<!-- ai-dev-workflow:start -->\n> **本项目采用 ai-dev-workflow**\n> (${fields})\n>\n> - 旧正文一行\n<!-- ai-dev-workflow:end -->`

/** 铺一个 2.17.0 形态的旧安装。 */
function seedLegacy217(target, { docsInGit = 'yes' } = {}) {
  for (const dir of ['.claude/skills', '.agents/skills']) {
    for (const name of LEGACY_SKILLS) {
      fs.mkdirSync(path.join(target, dir, name), { recursive: true })
      fs.writeFileSync(path.join(target, dir, name, 'SKILL.md'), '---\nname: ' + name + '\n---\n')
    }
    fs.writeFileSync(path.join(target, dir, LEGACY_STAMP), '2.17.0\n')
    fs.mkdirSync(path.join(target, dir, 'my-own-skill'), { recursive: true })
    fs.writeFileSync(path.join(target, dir, 'my-own-skill', 'SKILL.md'), 'mine\n')
  }
  const block = legacyWorkflowBlock('mode="team" collaboration="team" merge-gate="pr" worktree-dir="../wt/"')
  fs.writeFileSync(path.join(target, 'CLAUDE.md'), `# 项目说明\n\n前文\n\n${block}\n\n后文\n`)
  fs.writeFileSync(
    path.join(target, 'AGENTS.md'),
    `# Agents\n\n${block}\n\n<!-- ai-dev-system:codex-conflicts:start -->\n## ai-dev-system: Codex 冲突技能约束\n旧约束\n<!-- ai-dev-system:codex-conflicts:end -->\n`,
  )
  fs.writeFileSync(
    path.join(target, '.gitignore'),
    'node_modules/\n\n# ai-dev-system:gitignore:start\n/.claude/skills/ai-dev-workflow/\n/.claude/skills/ai-prd/\n'
    + `/.claude/skills/${LEGACY_STAMP}\n/.codegraph/\n# ai-dev-system:project-docs-in-git=${docsInGit}\n# ai-dev-system:gitignore:end\n`,
  )
}

function snapshot(dir) {
  const out = {}
  const walk = (abs, rel) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isSymbolicLink()) out[r] = 'link:' + fs.readlinkSync(path.join(abs, e.name))
      else if (e.isDirectory()) walk(path.join(abs, e.name), r)
      else out[r] = fs.readFileSync(path.join(abs, e.name), 'utf8')
    }
  }
  walk(dir, '')
  return out
}

const managedText = target =>
  ['CLAUDE.md', 'AGENTS.md', '.gitignore'].map(f => fs.readFileSync(path.join(target, f), 'utf8')).join('\n')

test('全新安装：两个 skills 目录、两个入口、.gitignore 里没有任何旧名字（AC-002）', () => {
  withTarget('fresh', target => {
    fs.writeFileSync(path.join(target, 'CLAUDE.md'),
      '<!-- dw-workflow:start -->\n> (collaboration="solo" merge-gate="direct" worktree-dir="./.worktrees/")\n<!-- dw-workflow:end -->\n')
    const r = install(target)
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.doesNotMatch(r.stdout, /旧版残留清理/)
    for (const dir of ['.claude/skills', '.agents/skills']) {
      const names = fs.readdirSync(path.join(target, dir))
      assert.ok(names.includes('dw-system.version'))
      for (const n of names) assert.ok(!LEGACY_TOKENS.some(t => n.includes(t)), `${dir}/${n}`)
    }
    for (const t of LEGACY_TOKENS) assert.ok(!managedText(target).includes(t), `入口或 .gitignore 里出现旧名字 ${t}`)
    assert.doesNotMatch(managedText(target), /mode="/)
  })
})

test('2.17.0 旧安装一次升级：旧目录与旧戳消失，字段与入库决定逐字保留，新块不含 mode（AC-003）', () => {
  withTarget('v217', target => {
    seedLegacy217(target)
    const r = install(target)
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /旧版残留清理/)
    assert.match(r.stdout, /旧：.*mode="team".*collaboration="team"/)
    assert.match(r.stdout, /新：collaboration="team" merge-gate="pr" worktree-dir="\.\.\/wt\/"/)
    assert.match(r.stdout, /已安装版本：v2\.17\.0/)
    for (const dir of ['.claude/skills', '.agents/skills']) {
      for (const name of LEGACY_SKILLS) assert.ok(!fs.existsSync(path.join(target, dir, name)), `${dir}/${name} 应被删除`)
      assert.ok(!fs.existsSync(path.join(target, dir, LEGACY_STAMP)))
      assert.ok(fs.existsSync(path.join(target, dir, 'dw-workflow', 'SKILL.md')))
      assert.equal(fs.readFileSync(path.join(target, dir, 'my-own-skill', 'SKILL.md'), 'utf8'), 'mine\n', '旧名字之外的条目不得触碰')
    }
    const claude = fs.readFileSync(path.join(target, 'CLAUDE.md'), 'utf8')
    assert.match(claude, /<!-- dw-workflow:start -->[\s\S]*collaboration="team"[\s\S]*merge-gate="pr"[\s\S]*worktree-dir="\.\.\/wt\/"[\s\S]*<!-- dw-workflow:end -->/)
    assert.ok(claude.indexOf('前文') < claude.indexOf('dw-workflow:start') && claude.indexOf('dw-workflow:end') < claude.indexOf('后文'), '新块 MUST 落在旧块原来的位置')
    const gitignore = fs.readFileSync(path.join(target, '.gitignore'), 'utf8')
    assert.match(gitignore, /# dw-system:project-docs-in-git=yes/)
    assert.doesNotMatch(gitignore, /^\/docs\/$/m, '决定是 yes 时不得忽略 docs/')
    assert.match(gitignore, /node_modules\//)
    for (const t of LEGACY_TOKENS) assert.ok(!managedText(target).includes(t), `残留旧名字 ${t}`)
    assert.doesNotMatch(managedText(target), /mode="/)
  })
})

test('同一项目第二次运行：无残留段、无文件改写（AC-005）', () => {
  withTarget('idem', target => {
    seedLegacy217(target, { docsInGit: 'no' })
    assert.equal(install(target).status, 0)
    const before = snapshot(target)
    const second = install(target)
    assert.equal(second.status, 0, second.stderr || second.stdout)
    assert.doesNotMatch(second.stdout, /旧版残留清理/)
    assert.deepEqual(snapshot(target), before)
  })
})

test('--dry-run 打印残留清单且目标目录逐字节不变（AC-006）', () => {
  withTarget('dry', target => {
    seedLegacy217(target)
    const before = snapshot(target)
    const r = install(target, '--dry-run')
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /旧版残留清理/)
    assert.match(r.stdout, /删除 \.claude\/skills\/ai-dev-workflow\//)
    assert.match(r.stdout, /\.gitignore/)
    assert.deepEqual(snapshot(target), before)
  })
})

test('只有 mode 的 1.x 旧块：按既有推断规则带出协作面与合并方式（AC-004）', () => {
  for (const [mode, collaboration, mergeGate] of [['team', 'team', 'pr'], ['personal', 'solo', 'direct']]) {
    withTarget('v1-' + mode, target => {
      fs.mkdirSync(path.join(target, '.claude', 'skills', 'ai-dev-workflow'), { recursive: true })
      fs.writeFileSync(path.join(target, 'CLAUDE.md'),
        `<!-- ai-dev-workflow:start -->\n> **本项目采用 ai-dev-workflow** (mode="${mode}")\n<!-- ai-dev-workflow:end -->\n`)
      const r = install(target)
      assert.equal(r.status, 0, r.stderr || r.stdout)
      assert.match(r.stdout, /已安装版本：v1\.0\.0/)
      const claude = fs.readFileSync(path.join(target, 'CLAUDE.md'), 'utf8')
      assert.match(claude, new RegExp(`collaboration="${collaboration}" merge-gate="${mergeGate}"`))
      assert.doesNotMatch(claude, /mode="|ai-dev-workflow/)
      assert.equal(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8').includes('dw-workflow:start'), true)
    })
  }
})

test('新旧标记块并存：以新块为准，旧块删除', () => {
  withTarget('both', target => {
    fs.writeFileSync(path.join(target, 'CLAUDE.md'),
      legacyWorkflowBlock('mode="team" collaboration="team" merge-gate="pr" worktree-dir="./old/"')
      + '\n\n<!-- dw-workflow:start -->\n> (collaboration="solo" merge-gate="direct" worktree-dir="./new/")\n<!-- dw-workflow:end -->\n')
    const r = install(target)
    assert.equal(r.status, 0, r.stderr || r.stdout)
    const claude = fs.readFileSync(path.join(target, 'CLAUDE.md'), 'utf8')
    assert.match(claude, /collaboration="solo" merge-gate="direct" worktree-dir="\.\/new\/"/)
    assert.doesNotMatch(claude, /ai-dev-workflow|\.\/old\//)
  })
})

test('旧 skill 目录是符号链接时只删链接，不进入链接目标（AC-007）', () => {
  withTarget('symlink', target => {
    const outside = fs.mkdtempSync(path.join(tmpdir(), 'dw-legacy-outside-'))
    try {
      fs.writeFileSync(path.join(outside, 'keep.txt'), 'keep\n')
      fs.mkdirSync(path.join(target, '.claude', 'skills'), { recursive: true })
      fs.symlinkSync(outside, path.join(target, '.claude', 'skills', 'ai-dev-workflow'), 'dir')
      const r = install(target)
      assert.equal(r.status, 0, r.stderr || r.stdout)
      assert.ok(!fs.existsSync(path.join(target, '.claude', 'skills', 'ai-dev-workflow')))
      assert.equal(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'keep\n')
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })
})

test('CLAUDE.md 是独立文件却带着旧 Codex 约束块：一次清掉，第二次运行不再列残留（FR-006 / FR-009）', () => {
  withTarget('guard-in-claude', target => {
    seedLegacy217(target)
    const guard = '<!-- ai-dev-system:codex-conflicts:start -->\n旧约束\n<!-- ai-dev-system:codex-conflicts:end -->\n'
    fs.appendFileSync(path.join(target, 'CLAUDE.md'), '\n' + guard)
    const first = install(target, '--no-plugins')
    assert.equal(first.status, 0, first.stderr || first.stdout)
    for (const t of LEGACY_TOKENS) assert.ok(!managedText(target).includes(t), `残留旧名字 ${t}`)
    assert.doesNotMatch(install(target, '--no-plugins').stdout, /旧版残留清理/)
  })
})

test('块类残留每项一行"已改写"，删除项每项一行"已删除"（spec §7）', () => {
  withTarget('observability', target => {
    seedLegacy217(target)
    const r = install(target, '--no-plugins')
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.equal((r.stdout.match(/^✓ 已删除 /gm) || []).length, 6, '两个目录 × （两个旧 skill + 一个旧戳）')
    // CLAUDE.md 的流程块、AGENTS.md 的流程块与约束块、.gitignore 的忽略块
    assert.equal((r.stdout.match(/^✓ 已改写 /gm) || []).length, 4)
  })
})

test('旧名字的块字段齐全且不含 mode：块名照样改写，前后对照照样打印（FR-005）', () => {
  withTarget('legacy-no-mode', target => {
    const block = legacyWorkflowBlock('collaboration="solo" merge-gate="direct" worktree-dir="./wt/"')
    fs.writeFileSync(path.join(target, 'CLAUDE.md'), block + '\n')
    fs.writeFileSync(path.join(target, 'AGENTS.md'), block + '\n')
    const r = install(target)
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /旧：.*collaboration="solo"/)
    assert.match(r.stdout, /新：collaboration="solo" merge-gate="direct" worktree-dir="\.\/wt\/"/)
  })
})

test('新旧 .gitignore 块并存且新块没有决定行：沿用旧块里的决定，不发问（FR-007）', () => {
  withTarget('docs-decision', target => {
    seedLegacy217(target, { docsInGit: 'no' })
    fs.appendFileSync(path.join(target, '.gitignore'), '\n# dw-system:gitignore:start\n/.codegraph/\n# dw-system:gitignore:end\n')
    const r = install(target)
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(fs.readFileSync(path.join(target, '.gitignore'), 'utf8'), /# dw-system:project-docs-in-git=no/)
  })
})

test('安装器里旧名字只出现在 LEGACY 表内（FR-002）', () => {
  const src = fs.readFileSync(installer, 'utf8')
  const start = src.indexOf('const LEGACY = Object.freeze({')
  assert.notEqual(start, -1, '找不到 LEGACY 表')
  const end = src.indexOf('});', start) + 3
  const outside = src.slice(0, start) + src.slice(end)
  for (const t of LEGACY_TOKENS) assert.ok(!outside.includes(t), `LEGACY 表之外出现旧名字 ${t}`)
})

test('全局 ctx 的归属判定同时认新旧两个 skill 路径段（AC-008）', () => {
  const src = fs.readFileSync(installer, 'utf8')
  assert.match(src, /ctxSkills:\s*\[[^\]]*'ai-dev-workflow'/)
  assert.match(src, /\[CTX\.skill,\s*\.\.\.LEGACY\.ctxSkills\]/)
})

test('skills 树里旧名字只出现一处：dw-workflow 入口路由表识别 3.0 之前安装的那一行', () => {
  // 这项兼容要能一刀移除：识别旧块的文字散到第二个文件，移除时就得全树找。
  const skillsRoot = path.join(repoRoot, 'dw-system', 'skills')
  const hits = []
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) { walk(abs); continue }
      if (!/\.(md|mjs|js|json|html|css)$/.test(e.name)) continue
      fs.readFileSync(abs, 'utf8').split('\n').forEach((line, i) => {
        if (LEGACY_TOKENS.some(t => line.includes(t))) hits.push(`${path.relative(skillsRoot, abs).split(path.sep).join('/')}:${i + 1}`)
      })
    }
  }
  walk(skillsRoot)
  assert.equal(hits.length, 1, `旧名字出现在：\n  ${hits.join('\n  ')}`)
  assert.match(hits[0], /^dw-workflow\/SKILL\.md:\d+$/)
})
