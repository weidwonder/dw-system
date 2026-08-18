// ai-dev-workflow 标记块的字段模型与迁移改写。
// 契约来源：docs/spec/2026-08-16-项目真相源与context-tier重构-eng-spec.md §5 / §6.1 / §8.3 / §9。
//
// --no-agentic / --no-codegraph / --no-ctx-link 是硬规定：这三段会动跑测试这台机器的
// 用户级 skills 目录、全局 npm 安装与全局 ctx 命令。本组测试一律带上。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const installer = path.join(repoRoot, 'install.mjs')

const START = '<!-- ai-dev-workflow:start -->'
const END = '<!-- ai-dev-workflow:end -->'

const install = (target, ...args) =>
  spawnSync(
    process.execPath,
    [installer, target, '--source-dir=' + repoRoot, '--no-agentic', '--no-codegraph', '--no-ctx-link', '--yes', ...args],
    { cwd: repoRoot, encoding: 'utf8' },
  )

const read = (...parts) => readFileSync(path.join(...parts), 'utf8')
const write = (file, body) => writeFileSync(file, body)

const legacyBlock = mode => `# Fixture\n\n${START}\n> **本项目采用 ai-dev-workflow** (mode="${mode}")\n${END}\n`
const newBlock = (collaboration, mergeGate, worktreeDir = './.worktrees/') =>
  `# Fixture\n\n${START}\n> **本项目采用 ai-dev-workflow**\n`
  + `> (mode="team" collaboration="${collaboration}" merge-gate="${mergeGate}" worktree-dir="${worktreeDir}")\n${END}\n`

function blockOf(text) {
  const start = text.indexOf(START)
  const end = text.indexOf(END, start + START.length)
  assert.notEqual(start, -1, '标记块必须存在')
  assert.notEqual(end, -1, '标记块必须闭合')
  return text.slice(start, end + END.length)
}

// 标记块里出现的所有 key="value" 属性名，用于断言"没有多出任何字段"。
const fieldNames = block => [...block.matchAll(/([a-z][a-z-]*)="[^"]*"/g)].map(m => m[1]).sort()

function withTarget(prefix, fn) {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-' + prefix + '-'))
  try {
    return fn(target)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
}

test('新格式标记块被原样识别，且重复安装幂等', () => {
  withTarget('block-new', target => {
    write(path.join(target, 'CLAUDE.md'), newBlock('team', 'pr'))

    const first = install(target)
    assert.equal(first.status, 0, first.stderr || first.stdout)
    const afterFirst = read(target, 'CLAUDE.md')
    const block = blockOf(afterFirst)
    assert.match(block, /collaboration="team"/)
    assert.match(block, /merge-gate="pr"/)
    assert.match(block, /worktree-dir="\.\/\.worktrees\/"/)
    // 新格式无需迁移，不打印前后对照
    assert.doesNotMatch(first.stdout, /改写前后对照/)

    const second = install(target)
    assert.equal(second.status, 0, second.stderr || second.stdout)
    assert.equal(read(target, 'CLAUDE.md'), afterFirst, '重复安装必须字节级幂等')
    assert.equal((read(target, 'CLAUDE.md').match(/ai-dev-workflow:start/g) || []).length, 1)
    assert.doesNotMatch(second.stdout, /改写前后对照/)
  })
})

test('旧 mode="personal" 迁移为 collaboration="solo" / merge-gate="direct"', () => {
  withTarget('block-legacy-personal', target => {
    write(path.join(target, 'CLAUDE.md'), legacyBlock('personal'))

    const result = install(target)
    assert.equal(result.status, 0, result.stderr || result.stdout)

    for (const entry of ['CLAUDE.md', 'AGENTS.md']) {
      const block = blockOf(read(target, entry))
      assert.match(block, /collaboration="solo"/, entry)
      assert.match(block, /merge-gate="direct"/, entry)
      assert.match(block, /worktree-dir="\.\/\.worktrees\/"/, entry)
      // 墓碑字段：旧 skill 读到不硬失败；新 skill 完全忽略（spec §8.3）
      assert.match(block, /mode="team"/, entry)
      assert.doesNotMatch(block, /mode="personal"/, entry)
      // §8.1 第 1 条拍板"不兼容"：标记块正文里不得再出现旧概念
      assert.doesNotMatch(block, /个人版|团队版/, entry)
    }

    // §8.3 边界 2：改写前打印前后对照
    assert.match(result.stdout, /改写前后对照/)
    assert.match(result.stdout, /旧：.*mode="personal"/)
    assert.match(result.stdout, /新：.*collaboration="solo".*merge-gate="direct"/)
  })
})

test('旧 mode="team" 只映射协作维度，MUST NOT 推出任何能力位', () => {
  withTarget('block-legacy-team', target => {
    write(path.join(target, 'CLAUDE.md'), legacyBlock('team'))

    const result = install(target)
    assert.equal(result.status, 0, result.stderr || result.stdout)

    const block = blockOf(read(target, 'CLAUDE.md'))
    assert.match(block, /collaboration="team"/)
    assert.match(block, /merge-gate="pr"/)

    // spec §8.1 第 2、3 条拍板"不兼容" + §8.3 边界 1：旧 team 声明对能力档位零效力。
    // 字段面：除四个已定义字段外不得多出任何字段。
    assert.deepEqual(fieldNames(block), ['collaboration', 'merge-gate', 'mode', 'worktree-dir'])
    // 内容面：不得**声明**项目启用了哪个能力位。
    // 注意判据是"声明式"而非关键词黑名单：base.md 里有一条**条件式** ctx 指引
    //（"本项目若存在已填写的 registry，则查权威实现时先用 ctx"），它对所有项目无条件注入，
    // 描述的是"如果有就怎么用"，不声明本项目属于哪一档，因此不构成能力位映射。
    // 用黑名单会连它一起误杀——那条是 ctx 跨文件契约的落点，删掉就等于让 agent 退回 grep。
    assert.doesNotMatch(block, /(启用了?|已有|具备)\s*(权威位|图谱位)/)
    // ctx 指令必须是条件式：同一行里要么带条件前缀（"若存在…"），要么不该出现强制用 ctx。
    for (const line of block.split('\n')) {
      if (!/MUST\s+(先)?用\s*`?ctx/.test(line)) continue
      assert.match(line, /若存在|若已|探测到|存在已填写/,
        `无条件的 ctx 强制指令即为能力位映射，只允许条件式：${line}`)
    }
    // 副作用面：不得替目标项目建出任何权威资产。
    assert.equal(existsSync(path.join(target, 'engineering-context')), false)
    assert.equal(existsSync(path.join(target, '.codegraph')), false)
    // 告知文案面：不得声称启用了什么能力。
    const notice = result.stdout.slice(result.stdout.indexOf('改写前后对照'))
    assert.doesNotMatch(notice, /engineering-context|权威|registry|图谱/)
    assert.match(notice, /探测/, '必须说明供给方式由探测得出，而不是由旧声明得出')
  })
})

test('新旧标记块的字段集合完全相同，只有协作维度的值不同', () => {
  const fieldsFor = mode => withTarget('block-fields-' + mode, target => {
    write(path.join(target, 'CLAUDE.md'), legacyBlock(mode))
    const result = install(target)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    return fieldNames(blockOf(read(target, 'CLAUDE.md')))
  })
  assert.deepEqual(fieldsFor('personal'), fieldsFor('team'))
})

test('两条迁移路径的正文差异只在协作语义，不在能力位（§8.3 边界 1 的精确守卫）', () => {
  const bodyFor = mode => withTarget('block-body-' + mode, target => {
    write(path.join(target, 'CLAUDE.md'), legacyBlock(mode))
    const result = install(target)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    return blockOf(read(target, 'CLAUDE.md'))
      .split('\n')
      .filter(l => l.trim() && !/^>\s*\(/.test(l)) // 去掉字段行，它本就该不同
  })
  const solo = bodyFor('personal')
  const team = bodyFor('team')

  // 差异行 = 两侧各自独有的行（即 collab-solo.md 与 collab-team.md 的内容）。
  // 这条断言不依赖关键词黑名单：无论 base.md 将来怎么改，只要旧 mode 值影响到了
  // 协作以外的任何一条正文，差异行里就会冒出能力位词，测试立刻红。
  const diff = [...solo.filter(l => !team.includes(l)), ...team.filter(l => !solo.includes(l))]
  assert.ok(diff.length > 0, '两个协作面理应有差异，一条都没有说明 collab 分册没被注入')
  for (const line of diff) {
    assert.doesNotMatch(line, /engineering-context|capability-registry|codegraph|权威位|图谱位/,
      `旧 mode 值只允许影响协作语义，这一行却带了能力位内容：${line}`)
  }
  // 公共部分（base.md）必须真的存在且非空——否则上面的差集判定是空转。
  assert.ok(solo.filter(l => team.includes(l)).length >= 5, 'base.md 的公共正文缺失')
})

test('混合状态：CLAUDE 新块 + AGENTS 旧块 → 以 CLAUDE 为准同步', () => {
  withTarget('block-mixed-new-old', target => {
    write(path.join(target, 'CLAUDE.md'), newBlock('solo', 'pr'))
    write(path.join(target, 'AGENTS.md'), legacyBlock('team'))

    const result = install(target)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    for (const entry of ['CLAUDE.md', 'AGENTS.md']) {
      const block = blockOf(read(target, entry))
      assert.match(block, /collaboration="solo"/, entry)
      assert.match(block, /merge-gate="pr"/, entry)
    }
  })
})

test('混合状态：CLAUDE 旧块 + AGENTS 新块 → 仍以 CLAUDE 为准，并立即迁移改写', () => {
  withTarget('block-mixed-old-new', target => {
    write(path.join(target, 'CLAUDE.md'), legacyBlock('personal'))
    write(path.join(target, 'AGENTS.md'), newBlock('team', 'pr'))

    const result = install(target)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /改写前后对照/)
    for (const entry of ['CLAUDE.md', 'AGENTS.md']) {
      const block = blockOf(read(target, entry))
      assert.match(block, /collaboration="solo"/, entry)
      assert.match(block, /merge-gate="direct"/, entry)
      assert.doesNotMatch(block, /mode="personal"/, entry)
    }
  })
})

test('混合状态：两侧都是旧块 → 同时迁移，且再次安装不再改写', () => {
  withTarget('block-mixed-old-old', target => {
    write(path.join(target, 'CLAUDE.md'), legacyBlock('team'))
    write(path.join(target, 'AGENTS.md'), legacyBlock('team'))

    const first = install(target)
    assert.equal(first.status, 0, first.stderr || first.stdout)
    assert.match(first.stdout, /改写前后对照/)
    const migrated = { claude: read(target, 'CLAUDE.md'), agents: read(target, 'AGENTS.md') }
    assert.match(migrated.claude, /collaboration="team"/)
    assert.match(migrated.agents, /collaboration="team"/)

    const second = install(target)
    assert.equal(second.status, 0, second.stderr || second.stdout)
    assert.doesNotMatch(second.stdout, /改写前后对照/, '迁移改写必须幂等，第二次不再改写')
    assert.equal(read(target, 'CLAUDE.md'), migrated.claude)
    assert.equal(read(target, 'AGENTS.md'), migrated.agents)
  })
})

test('collaboration 值非法 → 报错中止并列出合法值域，目标项目零改动', () => {
  withTarget('block-bad-collaboration', target => {
    write(path.join(target, 'CLAUDE.md'), newBlock('duo', 'pr'))

    const result = install(target)
    assert.notEqual(result.status, 0)
    const out = result.stdout + result.stderr
    assert.match(out, /collaboration/)
    assert.match(out, /solo/)
    assert.match(out, /team/)
    assert.equal(existsSync(path.join(target, '.claude', 'skills')), false)
    assert.equal(read(target, 'CLAUDE.md'), newBlock('duo', 'pr'))
  })
})

test('merge-gate 值非法 → 报错中止，MUST NOT 猜测', () => {
  withTarget('block-bad-merge-gate', target => {
    write(path.join(target, 'CLAUDE.md'), newBlock('team', 'rebase'))

    const result = install(target)
    assert.notEqual(result.status, 0)
    const out = result.stdout + result.stderr
    assert.match(out, /merge-gate/)
    assert.match(out, /direct/)
    assert.match(out, /pr/)
    assert.equal(existsSync(path.join(target, '.claude', 'skills')), false)
  })
})

test('标记块存在但读不出任何已知字段 → 报错中止', () => {
  withTarget('block-unknown-fields', target => {
    write(path.join(target, 'CLAUDE.md'), `${START}\nnothing="useful"\n${END}\n`)

    const result = install(target)
    assert.notEqual(result.status, 0)
    assert.match(result.stdout + result.stderr, /ai-dev-workflow/)
    assert.equal(existsSync(path.join(target, '.claude', 'skills')), false)
  })
})

test('标记块只有墓碑字段也算已知字段，不报错', () => {
  withTarget('block-tombstone-only', target => {
    write(path.join(target, 'CLAUDE.md'), `${START}\nmode="team"\n${END}\n`)

    const result = install(target)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(blockOf(read(target, 'CLAUDE.md')), /collaboration="team"/)
  })
})

test('已装 skill stamp 早于 2.0.0 而标记块已是新格式 → 显式报告，不静默继续', () => {
  withTarget('block-stale-stamp', target => {
    write(path.join(target, 'CLAUDE.md'), newBlock('solo', 'direct'))
    for (const dir of [path.join(target, '.claude', 'skills'), path.join(target, '.agents', 'skills')]) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(path.join(dir, 'ai-dev-system.version'), '1.0.0\n')
    }

    const result = install(target)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /skill 版本落后于配置/)
    assert.match(result.stdout, /重跑安装器/)
  })
})

test('安装器面向用户的输出不再出现"个人版 / 团队版"', () => {
  withTarget('block-no-old-terms', target => {
    write(path.join(target, 'CLAUDE.md'), legacyBlock('team'))
    const result = install(target)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    // 迁移指南（migrations/*.md）会被高亮全文打印，是唯一允许保留旧说法的地方，按行剔除后再断言。
    const lines = result.stdout.split('\n').filter(line => !line.includes('│'))
    assert.doesNotMatch(lines.join('\n'), /个人版|团队版/)
  })
})
