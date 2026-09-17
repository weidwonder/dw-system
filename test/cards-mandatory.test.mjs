// 2.1.0「代码事实层强制化」的契约测试。
//
// 为什么要有这份测试：本体系的行为契约写在 markdown 里，而 markdown 没有编译器——
// 一处改了、别处的交叉引用没跟上，只能等下一轮人工 review 才发现。这份测试把本次
// 变更里**机器可判**的那部分锁住：删除是否彻底、路径改名是否同步、无条件表述有没有
// 退回条件式、骨架是否真的生成 cards/。
//
// spec：docs/spec/2026-08-18-代码事实层强制化-eng-spec.md
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { initScaffold } from '../dw-system/skills/dw-workflow/scripts/ctx/src/commands.js'
// 计数词豁免清单的唯一定义处，两条机器闸共用一份（详见该文件抬头）。
import { EXEMPT_DIRS, EXEMPT_FILES } from './counter-word-exempt.mjs'
import { ENTRY_MAX_BYTES, LOADING_POINT_MIN } from './contract-numbers.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = path.join(repoRoot, 'dw-system', 'skills')
const workflowRoot = path.join(skillsRoot, 'dw-workflow')
const read = (...parts) => readFileSync(path.join(...parts), 'utf8')

/** 递归收集 skills/ 下的所有文本文件（markdown + js），返回 [仓库相对路径（正斜杠）, 内容] 对。 */
function collectSkillFiles() {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === '.git') continue
        walk(full)
        continue
      }
      if (!/\.(md|mjs|js)$/.test(entry)) continue
      // 相对路径统一成正斜杠：Windows 上 path.relative 会给反斜杠，而下面的
      // GUARDRAIL_AUTHORITY / GUARDRAIL_EXEMPT 都是正斜杠写法，直接比对会全部漏判
      // （权威文件与豁免项一个都匹配不上，护栏计数全被塞进 strays，测试必红）。
      out.push([path.relative(repoRoot, full).split(path.sep).join('/'), readFileSync(full, 'utf8')])
    }
  }
  walk(skillsRoot)
  return out
}

const skillFiles = collectSkillFiles()

test('被删除与被改名的引用在 skills/ 下一个不剩', () => {
  // 2.1.0 删掉了「资产补建信号」整套机制，并把两份 capability 分册搬进 core。
  // 本仓库自身纪律：被取代的旧逻辑当场删，不留"该机制已废弃"这类描述性残留——
  // 所以这里是零容忍，不是"允许在说明里提一句"。
  const forbidden = [
    '资产补建信号',
    'capability/curated.md',
    'capability/context-engineering.md',
    'core/资产补建信号.md',
  ]
  const hits = []
  for (const [file, body] of skillFiles) {
    for (const needle of forbidden) {
      if (body.includes(needle)) hits.push(`${file} ← ${needle}`)
    }
  }
  assert.deepEqual(hits, [], '仍有文件引用已删除/已改名的东西：\n' + hits.join('\n'))
})

test('「权威位 / 能力位 / 图谱位」这三个已废弃的开关概念在 skills/ 下一个不剩', () => {
  // 「权威面」「权威实现」「权威口径」是保留词汇，只有带"位"的开关概念要消灭——
  // 所以这里逐词精确匹配，不能写成宽泛的 /权威/。
  const forbidden = ['权威位', '能力位', '图谱位']
  const hits = []
  for (const [file, body] of skillFiles) {
    for (const needle of forbidden) {
      if (body.includes(needle)) hits.push(`${file} ← ${needle}`)
    }
  }
  assert.deepEqual(hits, [], '仍有文件在用已废弃的开关概念：\n' + hits.join('\n'))
})

test('skills/ 下 markdown 里的相对链接都指向真实存在的文件', () => {
  // 路径漂移是本体系历轮 review 反复出现的失败模式，机器能判就别留给人判。
  const broken = []
  for (const [file, body] of skillFiles) {
    if (!file.endsWith('.md')) continue
    const dir = path.dirname(path.join(repoRoot, file))
    for (const m of body.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      const target = m[1]
      if (/^(https?:|mailto:)/.test(target)) continue
      if (target.startsWith('/')) continue
      if (!existsSync(path.resolve(dir, target))) broken.push(`${file} → ${target}`)
    }
  }
  assert.deepEqual(broken, [], '断链：\n' + broken.join('\n'))
})

// 常驻集合自 2.4.x 的渐进式披露改造起由九篇缩到六份（spec §4.1 判定结果 / FR-002）：
// 入口 + core 四篇 + collab 一份。`文档治理.md` / `spec写作纪律.md` / `worktree开发纪律.md`
// 三篇移出常驻，文件仍在，改由 SKILL.md 的〈加载点清单〉在触发时才取。
// 断言分两半：常驻集合本身（下方第一个 test）与加载点清单的行数下限（第二个 test，spec §6 Invariant 3；下限值见 test/contract-numbers.mjs）。
const RESIDENT_CORE = ['00-流程总纲.md', '代码事实纪律.md', '用户沟通纪律.md', '上下文卫生.md']
const MOVED_OUT_OF_RESIDENT = ['文档治理.md', 'spec写作纪律.md', 'worktree开发纪律.md']

test('SKILL.md 声明的常驻集合是六份，移出的三篇不再算常驻', () => {
  const skill = read(workflowRoot, 'SKILL.md')
  assert.match(skill, /常驻只有六份/, 'SKILL.md 必须声明常驻只有六份（入口 + core 四篇 + collab 一份）')
  assert.doesNotMatch(
    skill,
    /常驻 core 七篇|常驻七篇|常驻九篇/,
    '旧的"常驻 core 七篇"表述 MUST 已删除（spec §8.2 替换清单）',
  )
  for (const name of RESIDENT_CORE) {
    assert.ok(skill.includes(name), `常驻分册未在入口点名：${name}`)
    assert.ok(
      existsSync(path.join(workflowRoot, 'references', 'core', name)),
      `常驻分册缺失：${name}`,
    )
  }
  // 第六份是 collab/ 二选一，入口必须指出这件事
  assert.match(skill, /collab\/[^\n]*二选一/, '入口必须写明 collab/ 必加载一份')
  for (const f of ['solo.md', 'team.md']) {
    assert.ok(existsSync(path.join(workflowRoot, 'references', 'collab', f)), `collab 分册缺失：${f}`)
  }
  // 移出常驻的三篇：文件仍在（按加载点取），但 MUST NOT 再被算进常驻集合
  for (const name of MOVED_OUT_OF_RESIDENT) {
    assert.ok(
      existsSync(path.join(workflowRoot, 'references', 'core', name)),
      `移出常驻 ≠ 删除文件，缺失：${name}`,
    )
    assert.ok(skill.includes(name), `移出常驻的分册必须出现在加载点清单里：${name}`)
  }
  // engineering-context设计.md 是条件加载，但必须存在（代码事实纪律引用它）
  assert.ok(existsSync(path.join(workflowRoot, 'references', 'core', 'engineering-context设计.md')))
  // capability/ 只剩代码图谱一篇
  const capability = readdirSync(path.join(workflowRoot, 'references', 'capability'))
  assert.deepEqual(capability.sort(), ['graph.md'], 'capability/ 应只剩 graph.md')
})

test('入口自带工作区隔离门要点：建不建、目录取哪个字段、过不了怎么办（AC-004）', () => {
  // 这道门在 Triage 之前，那一刻 worktree开发纪律.md 还没加载，要点只能驻留入口。
  const skill = read(workflowRoot, 'SKILL.md')
  assert.match(skill, /全程使用独立 worktree/, '入口必须给出"必须建 worktree"')
  assert.match(skill, /worktree-dir/, '入口必须点名目录取自哪个字段')
  assert.match(skill, /\.\/\.worktrees\//, '入口必须给出 worktree-dir 缺省值')
  assert.match(skill, /MUST NOT 替用户 stash/, '入口必须写明主工作树不干净时中止而不是替用户 stash/reset')
  // 上限取自 `contract-numbers.mjs` 的单点定义，MUST NOT 在这里再写一个字面量——
  // 此前这两行写死了一个与那份「唯一定义处」并存的字面量，却没人盯着两者是否一致，
  // 正是 `contract-numbers.mjs` 要消除的形态。
  assert.ok(
    Buffer.byteLength(skill, 'utf8') <= ENTRY_MAX_BYTES,
    `入口 MUST ≤ ${ENTRY_MAX_BYTES} 字节（AC-004），当前 ${Buffer.byteLength(skill, 'utf8')}`,
  )
})

test('加载点清单不少于 spec §7 的十八个加载点（Invariant 3）', () => {
  const skill = read(workflowRoot, 'SKILL.md')
  const table = skill.slice(skill.indexOf('## 加载点清单'))
  assert.ok(table.length > 0, '找不到〈加载点清单〉节')
  const rows = table
    .split('\n')
    .filter(l => l.startsWith('| ') && !/^\|\s*-+/.test(l) && !l.startsWith('| 触发条件'))
  // 门槛跟 Invariant 3 走，值在 `contract-numbers.mjs` 单点定义（此前这里与 spec/CLAUDE.md 各写一份，
  // 实测漂成 18/14/14 三处不一致）。它是**下限不是上限**
  // （每新判出一个触发式小节 MUST 增行）。此前这里写死 14，比不变量松了 4 行——删掉实现阶段
  // 新增的那四行照样绿，等于那四个加载点没有任何机器防线。下限值 MUST 与 spec §7 的行数一致，
  // spec 增行时同步上调；**MUST NOT 为了让删行通过而下调它**。
  assert.ok(
    rows.length >= LOADING_POINT_MIN,
    `加载点清单只有 ${rows.length} 行，MUST NOT 少于 ${LOADING_POINT_MIN} 行（spec §7：设计阶段十四个 + 实现阶段新增四个）`,
  )
  // 每行四个 REQUIRED 字段齐（触发条件 / 加载对象 / 为什么此刻需要 / 适用路径）
  for (const row of rows) {
    const cells = row.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
    assert.equal(cells.length, 4, `加载点行的字段数不是 4：${row}`)
    for (const c of cells) assert.ok(c.length > 0, `加载点行有空字段：${row}`)
    assert.match(cells[3], /^(Lean|完整|两条)$/, `适用路径取值非法（Lean/完整/两条）：${row}`)
  }
  // 十四个触发条件的锚点词（spec §7，稳定标识是触发条件文本本身）
  for (const anchor of [
    '每次唤起',
    'merge-gate` 缺省',
    '要建 worktree',
    'Triage 四问全否',
    'Triage 任一为是',
    '红回路门命中',
    '动笔写 spec',
    '登记替换清单',
    '过代码评审门',
    '进入测试阶段',
    '覆盖度台账',
    '索引分层',
    '过完成与自动合并门',
    '过载信号',
  ]) {
    assert.ok(table.includes(anchor), `加载点清单缺少触发条件：${anchor}`)
  }
})

test('路由不再探测 engineering-context——它是必备资产，不参与分档', () => {
  const skill = read(workflowRoot, 'SKILL.md')
  const routing = skill.slice(skill.indexOf('## 路由逻辑'), skill.indexOf('## 关键纪律'))
  assert.ok(routing.length > 0, '找不到 §路由逻辑 段')
  assert.match(
    routing,
    /MUST NOT 探测 engineering-context/,
    '路由第 1 步必须显式禁止把 engineering-context 当探测开关',
  )
  // 探测段里 capability-registry 不该作为判据出现
  const detect = routing.slice(0, routing.indexOf('2. 【读标记块】'))
  assert.doesNotMatch(
    detect.replace(/MUST NOT 探测 engineering-context[\s\S]*/, ''),
    /capability-registry\.md 存在/,
    '探测步骤 MUST NOT 再把 registry 是否有数据行当判据',
  )
})

test('注入片段里的 ctx 条目是无条件的，没有退回条件式', () => {
  const base = read(workflowRoot, 'assets', 'config-snippets', 'base.md')
  assert.match(base, /engineering-context/, 'base.md 必须声明本项目维护代码事实层')
  assert.match(base, /ctx find-scenes/, 'base.md 必须给出取事实的固定顺序')
  assert.match(base, /MUST NOT 退回 grep/, 'base.md 必须保留"不退回 grep"这条底线')
  assert.match(
    base,
    /查不到卡片[\s\S]{0,200}?补上/,
    'base.md 必须写明"查不到卡片就读源码并当场补卡"',
  )
  // 2.0.0 的条件式措辞：本项目若存在 …… 且其中至少有一行不含【】的真实数据行
  assert.doesNotMatch(
    base,
    /本项目若存在|至少有一行不含/,
    'base.md 的 ctx 条目 MUST NOT 再是条件式——卡片层是必备的',
  )
  // 标记块本身不许被动过
  assert.ok(base.startsWith('<!-- dw-workflow:start -->'))
  assert.ok(base.trimEnd().endsWith('<!-- dw-workflow:end -->'))
  assert.match(base, /collaboration="solo\|team" merge-gate="direct\|pr" worktree-dir=/)
})

test('初始化会建完整骨架，且明令禁止用 --minimal', () => {
  const init = read(workflowRoot, 'references', 'init-初始化.md')
  assert.match(init, /5b\./, '初始化必须有建骨架那一步')
  assert.match(init, /ctx init/, '建骨架用 ctx init')
  assert.match(init, /MUST NOT 跑 `--minimal`/, '必须显式禁止 --minimal——cards/ 目录要从第一天就在')
  assert.match(
    init,
    /MUST NOT 在这一步通读项目代码/,
    '必须显式禁止一次性铺满卡片（用户选的是渐进补齐）',
  )
})

test('分流默认倾向是无条件的，不再由任何东西分档', () => {
  const outline = read(workflowRoot, 'references', 'core', '00-流程总纲.md')
  const section = outline.slice(
    outline.indexOf('### 默认倾向'),
    outline.indexOf('## 完整流程步骤索引'),
  )
  assert.ok(section.length > 0, '找不到 §默认倾向 段')
  assert.match(section, /无条件适用于所有项目/, '默认倾向必须声明无条件')
  // 只禁**肯定式**的分档说法（"某类项目默认假设走 Lean"），不能连
  // "MUST NOT 从'只有我一个人'推出'默认走最短流程'……默认走 Lean 是危险的"
  // 这种否定式警告一起禁掉——那句正是本次要保留的护栏。
  assert.doesNotMatch(
    section,
    /默认假设走 Lean|默认所有需求先假设|→ 默认走 Lean/,
    'MUST NOT 再保留"某类项目默认走 Lean"的分档说法',
  )
  // 判据 3 恒为真是旧架构删掉这四条的原因，新架构必须显式挡住这个读法
  assert.match(
    section,
    /MUST NOT 被读成"卡片里查不到就算说不清"/,
    '必须显式挡住"查不到卡片就判说不清"——否则每个新项目都被无差别升级',
  )
})

test('总纲的不裁剪护栏含"补卡不裁剪"这一条', () => {
  const outline = read(workflowRoot, 'references', 'core', '00-流程总纲.md')
  assert.match(outline, /七条"不裁剪"护栏/, '护栏从六条增至七条')
  assert.match(outline, /7\. \*\*补卡不裁剪。\*\*/, '第 7 条必须是补卡不裁剪')
  // 导航行也要同步，否则读者按目录跳不过去
  assert.doesNotMatch(outline, /六条"不裁剪"护栏/, '导航行/正文里不该还留着"六条"')
})

test('代码事实纪律给出了补一张卡片的最小形态，且四项齐全', () => {
  const disc = read(workflowRoot, 'references', 'core', '代码事实纪律.md')
  assert.match(disc, /### 4\.1 补一张卡片的最小形态/)
  for (const field of ['职责', '对外接口', '陷阱项', '确认时间']) {
    assert.match(disc, new RegExp(`\\| ${field} \\|`), `最小形态缺字段：${field}`)
  }
  assert.match(disc, /MUST NOT 顺延/, '必须写明补卡不许顺延')
  assert.match(disc, /只增不减/, '必须写明卡片库只增不减')
})

test('ctx init 生成的完整骨架含 cards/ 目录（初始化依赖这一点）', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cards-mandatory-'))
  try {
    const { base, files } = initScaffold(dir)
    assert.ok(files.includes('cards/'), 'ctx init 必须生成 cards/ 目录')
    assert.ok(existsSync(path.join(base, 'cards')), 'cards/ 目录必须真的落盘')
    assert.ok(existsSync(path.join(base, 'capability-registry.md')))
    assert.ok(existsSync(path.join(base, '.gitignore')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ctx CLI 的对外契约没有被这次变更碰到', () => {
  // spec §8 明确：命令、参数、输出格式完全兼容，不改。安装器还靠 HELP 首行做签名校验。
  const cli = read(workflowRoot, 'scripts', 'ctx', 'src', 'cli.js')
  assert.match(cli, /ctx — Engineering Context CLI/, 'HELP 首行签名串 MUST NOT 变（install.mjs 靠它判定）')
  const pkg = JSON.parse(read(workflowRoot, 'scripts', 'ctx', 'package.json'))
  assert.equal(pkg.name, 'ctx')
  assert.ok(pkg.bin && pkg.bin.ctx, 'bin.ctx MUST NOT 变（npm link 依赖它）')
  // --minimal 仍然可用，只是不再是初始化的推荐路径
  const { files } = (() => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cards-minimal-'))
    try {
      return initScaffold(dir, { minimal: true })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })()
  assert.deepEqual(files, ['capability-registry.md', '.gitignore'], '--minimal 的行为 MUST NOT 变')
})

test('VERSION 不低于 2.1.0（卡片必备自此版起）并带配套迁移指南', () => {
  // 不写死当前版本：这条锁的是"卡片必备的起始版本 + VERSION 与 migrations 必须配套"，
  // 写死会让此后每一次无关的 bump 都在这里假红。
  const version = read(repoRoot, 'dw-system', 'VERSION').trim()
  const [maj, min] = version.split('.').map(Number)
  assert.ok(maj > 2 || (maj === 2 && min >= 1), `卡片必备自 2.1.0 起，VERSION 不应低于它：${version}`)
  // 盯的是**本特性落地的那个版本**的指南（2.1.0），不是当前 VERSION。
  // 写 `${version}.md` 会隐含要求「每个版本都有迁移指南」——那从来不是成文判据，
  // 只是历史上恰好每次 bump 都需要用户动作。2.5.0 是第一个零手动动作的 bump，
  // 它把这个隐含假设顶了出来。指向 2.1.0 则永不过期：卡片必备的指南永远是 2.1.0 那一份。
  const migration = path.join(repoRoot, 'dw-system', 'migrations', '2.1.0.md')
  assert.ok(existsSync(migration), `缺迁移指南：${migration}`)
  const body = readFileSync(migration, 'utf8')
  // 安装器会高亮全文打印，指南必须保持一屏内
  assert.ok(body.split('\n').length <= 45, '迁移指南要保持一屏内（≤45 行）')
})

// ── 计数词一致性 ────────────────────────────────────────────────────────────
// 这一组不是本次变更特有的契约，而是本次 review 里**同一类 bug 咬了两次**之后加的机械闸：
// 总纲的护栏从六条加到七条，`collab/solo.md` 的跳转表还写着"六条"并漏掉新增那条；
// `文档治理.md` 的固定文件名例外从三个收敛到两个，另外四处引用仍写"三个"。
// 两次都是"权威定义改了、别处的计数词没跟改"，人工 review 才发现——这正是机器该做的事。

const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }

// 护栏计数词的新策略（spec §4.3 / FR-007）：**数字只允许出现在权威定义文件**（总纲），
// 别处一律改成指名引用（"按 `00-流程总纲.md` §\"不裁剪\"护栏 执行"）。
// 分工：`test/counter-word.test.mjs` 管"别处还有没有残留数字"（受检词表是闭集，含豁免清单）；
// 这里只管 `counter-word` 管不到的那一半——**权威文件里写的那个数字与实际条目数是否一致**。
// 两条缺一不可：只查取值，数字会被复制到别处；只查出现位置，权威处写错数字照样全绿。
const GUARDRAIL_AUTHORITY = 'references/core/00-流程总纲.md'
// 豁免清单**从 counter-word-exempt.mjs 取**，不在这里另抄一份：入口与 Lean 自足册按设计必须
// 复述，config-snippets/ 被注入目标项目、读它的 AI 没有本 skill 的文件可跳转。此前两份各写
// 一遍、只靠注释"保持一致"手工同步，两边写法还不同，漂了不会报任何错——同一份判据 MUST 只有
// 一处定义。
// 共用清单的基准是 `dw-workflow/`，这里的 skillFiles 相对 repoRoot 且**含姊妹 skill
// `dw-prd/`**，所以 MUST 补回 `dw-workflow/` 前缀再匹配：直接拿裸的 `SKILL.md` 去
// `includes`，会把 `dw-prd/SKILL.md` 一起豁免掉，静默放宽检查面。
const GUARDRAIL_EXEMPT = [...EXEMPT_FILES, ...EXEMPT_DIRS].map((x) => `dw-workflow/${x}`)

test('"不裁剪护栏"的条数只在总纲里出现，且与实际条目数一致', () => {
  const outline = read(workflowRoot, 'references', 'core', '00-流程总纲.md')
  const start = outline.indexOf('"不裁剪"护栏\n')
  assert.ok(start > 0, '找不到护栏小节')
  const section = outline.slice(start, outline.indexOf('\n## ', start))
  // 护栏条目形如 `1. **目录不裁剪。**`，逐条数出权威值
  const actual = [...section.matchAll(/^(\d+)\. \*\*/gm)].length
  assert.ok(actual >= 5, `护栏条目数解析异常（数出 ${actual} 条），断言本身可能已失效`)

  const wrong = []
  const strays = []
  for (const [file, body] of skillFiles) {
    const hits = [...body.matchAll(/([一二两三四五六七八九十])条["“「]?不裁剪/g)]
    if (hits.length === 0) continue
    const isAuthority = file.endsWith(GUARDRAIL_AUTHORITY)
    const isExempt = GUARDRAIL_EXEMPT.some(x => file.includes(x))
    for (const m of hits) {
      if (isAuthority || isExempt) {
        if (CN_NUM[m[1]] !== actual) wrong.push(`${file} ← 写着"${m[1]}条"，实际 ${actual} 条`)
      } else {
        strays.push(`${file} ← 写着"${m[1]}条不裁剪"，MUST 改成指名引用（不带数字）`)
      }
    }
  }
  assert.deepEqual(wrong, [], '护栏条数与总纲实际条目数不一致：\n' + wrong.join('\n'))
  assert.deepEqual(
    strays,
    [],
    '护栏条数出现在权威定义文件与豁免范围之外（判据 spec §4.3）：\n' + strays.join('\n'),
  )
})

test('"N 个固定文件名例外"的计数词与文档治理里实际登记的个数一致', () => {
  const gov = read(workflowRoot, 'references', 'core', '文档治理.md')
  // 权威值 = 文档治理里被点名的固定文件名账本，逐个数出来
  const named = new Set(
    [...gov.matchAll(/`(bug修复历史\.md|测试场景覆盖度\.md|资产补建信号\.md)`/g)].map(m => m[1]),
  )
  const actual = named.size
  assert.ok(actual >= 1, '固定文件名账本解析异常，断言本身可能已失效')

  const wrong = []
  for (const [file, body] of skillFiles) {
    for (const m of body.matchAll(/([一二两三四五六七八九十])个固定文件名/g)) {
      if (CN_NUM[m[1]] !== actual) wrong.push(`${file} ← 写着"${m[1]}个"，实际 ${actual} 个`)
    }
  }
  assert.deepEqual(wrong, [], '固定文件名例外计数词不一致：\n' + wrong.join('\n'))
})

test('删段没有把 --- 挤成 setext 标题', () => {
  // 删掉一整段时最容易连它前后的空行一起带走。紧跟正文行的 `---` 在 markdown 里是
  // **setext H2**，不是分隔线：那行正文会被渲染成一级大标题，章节分隔也一并消失。
  // 本次 review 在 00-流程总纲.md 抓到过一次，肉眼几乎看不出来。
  const bad = []
  for (const [file, body] of skillFiles) {
    if (!file.endsWith('.md')) continue
    const lines = body.split('\n')
    // frontmatter 的收尾 `---` 天然紧跟正文（最后一个 YAML 字段），不是缺陷——跳过它
    let start = 1
    if (lines[0] === '---') {
      const close = lines.indexOf('---', 1)
      if (close > 0) start = close + 1
    }
    let inFence = false
    for (let i = start; i < lines.length; i++) {
      if (/^\s*```/.test(lines[i])) inFence = !inFence
      if (inFence) continue
      if (!/^-{3,}\s*$/.test(lines[i])) continue
      const prev = lines[i - 1]
      // 表格分隔行（|---|---|）不长这样；紧邻的上一行非空即为 setext
      if (prev.trim() !== '') bad.push(`${file}:${i + 1} 上一行是「${prev.trim().slice(0, 40)}」`)
    }
  }
  assert.deepEqual(bad, [], '`---` 紧跟正文，会被渲染成 setext 标题：\n' + bad.join('\n'))
})
