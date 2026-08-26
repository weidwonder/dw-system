// 2.8.0「需求真相源分层与 TODO 出口」的契约测试。
//
// 为什么要有这份测试：本次改的是**同一条判据分散在三处同源措辞**里的那类东西——归并落点
// 从三个写死项改成一张按口径类型分派的表，判据本体在 `文档治理.md` §6，`00-prd生成流程.md`
// 与 `路径-lean.md` 各有一份投影。三处任意一处漏改，那条路径上的 agent 就会按旧的三个落点
// 收工，而**旧落点恰好覆盖不到最常见的迭代形态**（改已交付功能的行为规则、功能清单一动不
// 动）。这类漏改不会有任何报错：ctx probe 只验可达性，D 文档轴要比对的正文压根不存在。
//
// 同理，`docs/TODO.md` 的章节类型是闭集。闭集散在三处（判据篇 / Lean 自足册 / 模板），
// 任一处多一类少一类，写 todo 的 agent 就会自造章节，清单随即失去"按类型一眼看完"的性质。
//
// 这些断言过过门禁自检（植入必错样本，2026-08-26）：把 §6 的映射表改回三个写死落点、
// 把任一处 TODO 章节类型删一类、把阈值数字复制到引用方 → 全部 RED；
// 契约不变的合法改写（换措辞、调表格列序）→ GREEN。**锁契约不锁措辞**。
//
// spec：docs/spec/2026-08-26-需求真相源分层与TODO出口-eng-spec.md
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = path.join(repoRoot, 'ai-dev-system', 'skills')
const wfRoot = path.join(skillsRoot, 'ai-dev-workflow')
const prdRoot = path.join(skillsRoot, 'ai-prd')
const read = (...seg) => readFileSync(path.join(...seg), 'utf8')

// 切段取子串。锚点找不到当场红——indexOf 返回 -1 时 slice 会静默退化成整个文件，
// 于是段内断言变成整文件级断言，判据写在没人读的那段照样绿。
const section = (text, startAnchor, endAnchor, label) => {
  const start = text.indexOf(startAnchor)
  assert.notEqual(start, -1, `锚点找不到：${label} 的起始锚点 ${startAnchor}`)
  const rest = text.slice(start + startAnchor.length)
  const end = endAnchor ? rest.indexOf(endAnchor) : -1
  return end === -1 ? rest : rest.slice(0, end)
}

const governance = read(wfRoot, 'references', 'core', '文档治理.md')
const lean = read(wfRoot, 'references', 'core', '路径-lean.md')
const prdFlow = read(prdRoot, 'references', '00-prd生成流程.md')

test('需求真相源只写已实现的现状：定位判据在权威篇，且 Lean 自足册有同款要点', () => {
  const sec = section(governance, '### 需求真相源写什么、怎么分层', '## ADR', '文档治理 §需求真相源')
  // 定位：只写现状 + 四类 MUST NOT 内容
  assert.match(sec, /已经实现/, '定位没说"已经实现的现状"')
  assert.match(sec, /MUST NOT 包含/, '缺"MUST NOT 包含"那条')
  for (const banned of ['历史', '对比', '技术选型']) {
    assert.ok(sec.includes(banned), `MUST NOT 包含清单缺一类：${banned}`)
  }
  // 尚未实现的唯一出口
  assert.match(sec, /docs\/TODO\.md/, '没把尚未实现的内容指向 docs/TODO.md')
  assert.match(sec, /MUST NOT 在需求真相源里留.*计划中/, '缺"MUST NOT 留计划中小节"')

  // Lean 不读常驻篇也不读总纲，同一批 MUST 必须在自足册里各有一条
  assert.match(lean, /需求真相源只写现状/, 'Lean 自足册缺"只写现状"要点')
  assert.match(lean, /MUST NOT 在真相源里留"计划中"小节/, 'Lean 自足册缺"计划中"禁令')
})

test('两层承载是上限：主文档 + 一级子模块，三处都禁二级目录', () => {
  for (const [label, text] of [['文档治理', governance], ['Lean 自足册', lean]]) {
    assert.match(text, /docs\/requirements\//, `${label} 没提子模块目录`)
    assert.match(text, /MUST NOT 出现.*二级目录|MUST NOT 出现二级目录/, `${label} 缺二级目录禁令`)
  }
  // 模板侧同款
  const moduleTpl = read(prdRoot, 'assets', 'templates', 'requirements-module.md')
  assert.match(moduleTpl, /MUST NOT 再往下分层/, '子模块模板缺"不再往下分层"')
})

test('拆分阈值只在权威定义处出现，引用方一律指名引用', () => {
  const AUTHORITY = path.join(wfRoot, 'references', 'core', '文档治理.md')
  const sec = section(governance, '### 需求真相源写什么、怎么分层', '## ADR', '文档治理 §需求真相源')
  assert.match(sec, /500/, '权威处没写 500')
  assert.match(sec, /800/, '权威处没写 800')

  // 引用方 MUST NOT 另记一个数字——同一个量写在两处，改一处就会漂
  const referrers = [
    [path.join(prdRoot, 'references', '00-prd生成流程.md'), prdFlow],
    [path.join(wfRoot, 'references', 'core', '路径-lean.md'), lean],
  ]
  for (const [file, text] of referrers) {
    assert.notEqual(file, AUTHORITY)
    assert.doesNotMatch(text, /500 行|800 行/, `${path.basename(file)} 复制了拆分阈值数字，MUST 改指名引用`)
  }
})

test('归并落点是一张按口径类型分派的表，三处同源且都带"清单没变化不等于无需归并"', () => {
  const g6 = section(governance, '### 6. 准出时归并需求真相源', '## TODO 出口', '文档治理 §6')
  // 表里最易漏的那一行必须在
  assert.match(g6, /已交付功能的行为规则变了/, '§6 映射表缺"已交付功能的行为规则变了"这一类')
  assert.match(g6, /就地改写/, '§6 缺"就地改写"')
  assert.match(g6, /MUST NOT 留前后对比|MUST NOT 留.*对比/, '§6 缺"不留前后对比"')

  // 三处都要有这条反读警告，缺任一处那条路径就会照旧收工
  const WARN = /「功能清单没变化」MUST NOT 被读成「无需归并」/
  assert.match(g6, WARN, '文档治理 §6 缺反读警告')
  assert.match(prdFlow, WARN, 'ai-prd §PRD 生命周期 缺反读警告')
  assert.match(lean, WARN, 'Lean 自足册 §10.6 缺反读警告')

  // 两处投影 MUST 指名引用权威处，MUST NOT 各写一份判据
  assert.match(prdFlow, /文档治理\.md` §6/, 'ai-prd 没指名引用 文档治理 §6')
})

test('归并时机统一：真相源在准出门才更新，"最后才是 spec"那条已删干净', () => {
  for (const [label, text] of [['文档治理', governance], ['Lean 自足册', lean]]) {
    assert.doesNotMatch(text, /最后才是 spec/, `${label} 还留着与准出归并互斥的旧表述`)
    assert.match(text, /MUST NOT 在实现验收之前把本次口径写进需求真相源|MUST NOT 在实现验收之前/, `${label} 缺"验收前不得写进真相源"`)
  }
})

test('存量收敛：触碰的定义 + 两档动作，拆分档 MUST 由用户拍板', () => {
  const g6 = section(governance, '### 6. 准出时归并需求真相源', '## TODO 出口', '文档治理 §6')
  assert.match(g6, /触碰/, '§6 没定义触碰')
  assert.match(g6, /只读|MUST NOT 算触碰/, '§6 没排除"只读也算触碰"')
  assert.match(g6, /MUST NOT 未经确认就自行拆分|MUST NOT 自行拆分/, '§6 缺"拆分要用户拍板"')
  assert.match(lean, /MUST NOT 自行拆分|MUST NOT 未经确认就自行拆分/, 'Lean 自足册缺同款')
})

test('TODO 章节类型是闭集，三处逐字一致', () => {
  const TYPES = ['想做的功能', '待澄清的问题', '已知风险', '技术欠账']
  const todoTpl = read(prdRoot, 'assets', 'templates', 'todo.md')
  const targets = [
    ['文档治理 §7', section(governance, '## TODO 出口', '## 默认命名', '文档治理 §TODO 出口')],
    ['Lean 自足册 §10.7', section(lean, '### 10.7 TODO 出口', '## 11.', 'Lean §10.7')],
    ['todo 模板', todoTpl],
  ]
  for (const [label, text] of targets) {
    for (const t of TYPES) {
      assert.ok(text.includes(t), `${label} 缺章节类型：${t}`)
    }
    assert.match(text, /MUST NOT 自造第五类|MUST NOT 自造/, `${label} 缺"不许自造第五类"`)
  }
  // 模板里四类 MUST 真是 markdown 章节，不能只在说明文字里出现
  for (const t of TYPES) {
    assert.match(todoTpl, new RegExp(`^## ${t}$`, 'm'), `todo 模板里「${t}」不是真章节`)
  }
})

test('TODO 有准入门槛与日期要求，且 AI 不得自行删条目', () => {
  const g7 = section(governance, '## TODO 出口', '## 默认命名', '文档治理 §TODO 出口')
  for (const [label, text] of [['文档治理 §7', g7], ['Lean 自足册', lean]]) {
    assert.match(text, /MUST 带提出日期|每条 MUST 带提出日期/, `${label} 缺日期要求`)
    assert.match(text, /MUST NOT 自行删除/, `${label} 缺"AI 不得自行删除"`)
  }
  // 门槛的正反例都要在——只写"收什么"不写"不收什么"，随手记照样塞得进来
  assert.match(g7, /改个变量名|清掉一行死代码|补一个测试/, '§7 缺"不收什么"的反例')
  assert.match(g7, /3 个月/, '§7 缺默认陈旧阈值')
  // 阈值同样只在权威处
  assert.doesNotMatch(prdFlow, /3 个月/, 'ai-prd 复制了陈旧阈值数字')
})

test('docs/ 根例外清单三处一致：真相源两份 + TODO.md', () => {
  const outline = read(wfRoot, 'references', 'core', '00-流程总纲.md')
  for (const [label, text] of [['文档治理 §硬规则', governance], ['总纲结论行', outline], ['Lean 自足册', lean]]) {
    assert.match(text, /docs\/TODO\.md|`docs\/TODO\.md`/, `${label} 的 docs/ 根例外清单漏了 TODO.md`)
    assert.match(text, /docs\/requirements\//, `${label} 没提子模块目录`)
  }
})

test('两份新模板存在，且入口清单与 ai-prd 分流都指向它们', () => {
  for (const f of ['requirements-module.md', 'todo.md']) {
    assert.ok(existsSync(path.join(prdRoot, 'assets', 'templates', f)), `模板缺失：${f}`)
  }
  const prdSkill = read(prdRoot, 'SKILL.md')
  assert.match(prdSkill, /requirements-module/, 'ai-prd SKILL.md 没指向子模块模板')
  assert.match(prdSkill, /todo/, 'ai-prd SKILL.md 没指向 todo 模板')
  // 没有加载点的分册永远不会被读到，只是死文件
  const wfSkill = read(wfRoot, 'SKILL.md')
  assert.match(wfSkill, /TODO/, 'ai-dev-workflow 加载点清单里没有 TODO 的触发行')
})

test('整品 PRD 模板已按新定位收敛：规划类章节全部移出', () => {
  const tpl = read(prdRoot, 'assets', 'templates', 'product-prd.md')
  for (const gone of ['## Product Scope', 'Growth', 'Vision', 'Risk Mitigation', '## 开放问题']) {
    assert.ok(!tpl.includes(gone), `product-prd 模板还留着规划类内容：${gone}`)
  }
  assert.match(tpl, /MUST NOT.*计划中|MUST NOT 在本文留/, '模板头注没禁止"计划中"小节')
  assert.match(tpl, /docs\/TODO\.md/, '模板没告诉使用者规划类内容去哪')
  assert.match(tpl, /^## 子模块划分/m, '模板缺〈子模块划分〉节')
})

test('「以后想做」与「明确不做」分家：产 PRD 的三个落点都接上了 TODO 出口', () => {
  // 本次改动给"尚未实现的东西"修了出口，但产 PRD 这一侧才是它们最先冒出来的地方。
  // 上游不接，agent 会照旧把"以后想做"写进非目标 —— 然后它随变更 PRD 一起归档消失，
  // 与本次要堵的漏洞完全同构。三处缺任一处，那条路径上就会漏。
  const changeTpl = read(prdRoot, 'assets', 'templates', 'change-prd.md')
  const prdSkill = read(prdRoot, 'SKILL.md')
  for (const [label, text] of [['change-prd 模板', changeTpl], ['ai-prd SKILL.md', prdSkill], ['00-prd生成流程.md', prdFlow]]) {
    assert.match(text, /docs\/TODO\.md/, `${label} 没提 docs/TODO.md`)
    assert.match(text, /以后想做/, `${label} 缺"以后想做"与"明确不做"的分流判据`)
  }
  // 非目标那一侧要说清它写的是"当前边界"，否则两类还是会混
  assert.match(changeTpl, /当前边界/, 'change-prd 非目标节没说清它写的是当前边界')
  assert.match(prdSkill, /MUST NOT 塞进非目标|MUST NOT 写进这里/, 'ai-prd SKILL.md 缺"不许塞进非目标"的禁令')
})

test('本仓库自身不再是特例：真相源与 TODO 都在', () => {
  assert.ok(existsSync(path.join(repoRoot, 'docs', 'REQUIREMENTS.md')), '本仓库缺 docs/REQUIREMENTS.md')
  assert.ok(existsSync(path.join(repoRoot, 'docs', 'TODO.md')), '本仓库缺 docs/TODO.md')
  const index = read(repoRoot, 'docs', 'index.md')
  assert.doesNotMatch(index, /没有 `REQUIREMENTS\.md`/, 'docs/index.md 还写着本仓库没有真相源')
})
