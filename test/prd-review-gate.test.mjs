// 2.2.0「PRD 复核门」的契约测试。
//
// 为什么要有这份测试：本次变更的核心是一个**顺序**约定——复核门必须在落盘确认门
// 之前。顺序写在 markdown 的步骤编号里，而编号散在四个文件中，改一处忘一处不会有
// 任何报错，只会让门在错误的时机跑。这份测试把机器可判的那部分锁住：门的存在、
// 门的先后、五处接线、三个出口、步骤号全仓一致。
//
// spec：docs/spec/2026-08-19-prd复核门-lean-change-spec.md
//
// 2026-08-25 调整：复核门不再"一出稿就自动跑"，前面插了一道**用户过稿门**——
// 用户读稿、提意见、定稿之后才派子代理。三门顺序因此变成
// 用户过稿门 → 复核门 → 落盘确认门，组稿步骤 1–8 顺延为 1–9。下面的顺序断言与
// 步骤号断言都改成**按门名定位、编号动态取**，不再钉死数字（正是本文件顶部那条
// "不要把组稿步骤号写进断言"的自我要求，上一版只做到一半）。
//
// 这些断言自己过过一次门禁自检（植入必错样本，2026-08-19）：SKILL.md 退回"两个出口"、
// SKILL.md 漏掉标签子类、出口列删一个取值、删掉取证足迹整段 → 四个样本全部 RED；
// 合法改写勾验时机措辞、合法改写取证足迹措辞（契约不变）→ 两个样本全部 GREEN。
// 改这些断言时请保持这条性质：**锁契约不锁措辞**——尤其不要把组稿步骤号写进断言，
// 本次变更自己就把 4–7 挪成了 5–8，钉死编号会让"文档改对了、测试反而红"。
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prdRoot = path.join(repoRoot, 'ai-dev-system', 'skills', 'ai-prd')
const read = (...seg) => readFileSync(path.join(...seg), 'utf8')

/** ai-prd 下所有 markdown，供全仓一致性扫描。 */
const prdFiles = (function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (name.endsWith('.md')) acc.push([path.relative(prdRoot, full), readFileSync(full, 'utf8')])
  }
  return acc
})(prdRoot)

test('复核纪律存在，且两轴与三个出口都写明', () => {
  const body = read(prdRoot, 'references', 'prd复核纪律.md')
  for (const must of ['自洽轴', '冲突轴', '三个出口', '事实错了回去补，取舍待定才给用户']) {
    assert.ok(body.includes(must), `prd复核纪律.md 缺「${must}」`)
  }
  // 冲突轴的六类冲突是判据本体，缺一类就等于漏一整类问题
  const rows = [...body.matchAll(/^\| [1-6] \| \*\*/gm)].length
  assert.equal(rows, 6, `冲突轴应有 6 类冲突，实际 ${rows} 类`)
})

/** 组稿节的顶层步骤：[{ num, text }]，text 是该步首行。按门名定位用，不钉死编号。 */
function composeSteps() {
  const flow = read(prdRoot, 'references', '00-prd生成流程.md')
  const section = flow.slice(flow.indexOf('\n## 组稿'), flow.indexOf('\n## PRD 生命周期'))
  return [...section.matchAll(/^([0-9]+)\. (.*)$/gm)].map((m) => ({ num: Number(m[1]), text: m[2] }))
}

/** 按门名取它的步骤号；找不到返回 -1。 */
const gateStep = (name) => {
  const hit = composeSteps().findIndex((s) => s.text.includes(name))
  return hit < 0 ? -1 : composeSteps()[hit].num
}

test('三道门的先后：用户过稿门 → 复核门 → 落盘确认门（本约定的核心）', () => {
  const steps = composeSteps()
  const at = (name) => steps.findIndex((s) => s.text.includes(name))
  const draft = at('用户过稿门')
  const review = at('复核门：派子代理')
  const landing = at('落盘确认门：')
  assert.ok(draft >= 0, '组稿里找不到用户过稿门')
  assert.ok(review >= 0, '组稿里找不到复核门')
  assert.ok(landing >= 0, '组稿里找不到落盘确认门')
  assert.ok(draft < review, '用户过稿门 MUST 排在复核门之前——复核报告只对某一版稿子有效')
  assert.ok(review < landing, '复核门 MUST 排在落盘确认门之前')
})

test('复核门被明令禁止在用户定稿前开跑（本次调整要挡的正是这个）', () => {
  const body = read(prdRoot, 'references', 'prd复核纪律.md')
  const gate = body.slice(body.indexOf('## 门禁'), body.indexOf('## 两条轴'))
  assert.ok(/MUST NOT[^。]*派子代理/.test(gate), '§门禁 未禁止用户读稿前就派子代理')
  assert.ok(/定稿/.test(gate), '§门禁 未把开跑条件绑到用户定稿上')
  // 用户不表态时的默认值是"等"，不是"当他没意见"
  assert.ok(/没意见|未表态|尚未表态/.test(gate), '§门禁 未挡住"用户没回复 = 没意见"的读法')
})

test('落盘确认门在复核零发现时退化，不要用户点第二次头', () => {
  const flow = read(prdRoot, 'references', '00-prd生成流程.md')
  const section = flow.slice(flow.indexOf('\n## 组稿'), flow.indexOf('\n## PRD 生命周期'))
  const landing = section.slice(section.indexOf('落盘确认门：'))
  assert.ok(/退化/.test(landing), '落盘确认门缺"复核零发现即退化"的规则')
  assert.ok(/第二次头|再摆一遍|重复确认/.test(landing), '退化规则没说清它要省掉的是什么')
  // 反向：改过稿就不许退化，且要逐条告知用户改了什么
  assert.ok(/实质性改稿/.test(landing), '退化规则缺"实质性改稿"这个反向判据')
  assert.ok(/改了什么|被改了什么/.test(landing), '未要求逐条列出用户定稿后稿子被改了什么')
})

test('接线都在（少一处，门就在那条路径上不存在）', () => {
  const wired = {
    'SKILL.md': ['prd复核纪律', '复核门'],
    'references/prd质量清单.md': ['prd复核纪律', '本清单不是最后一道关'],
    'references/collab/solo.md': ['prd复核纪律'],
    'references/collab/team.md': ['prd复核纪律'],
    'assets/question-bank.md': ['复核门'],
    // 用户过稿门与复核门是同一条链上的两环，接线漏一处，门就在那条路径上不存在
    'references/prd复核纪律.md': ['用户过稿门'],
  }
  const missing = []
  for (const [file, needles] of Object.entries(wired)) {
    const body = read(prdRoot, file)
    for (const n of needles) if (!body.includes(n)) missing.push(`${file} ← 缺「${n}」`)
  }
  assert.deepEqual(missing, [], '复核门接线缺失：\n' + missing.join('\n'))
})

test('组稿步骤号全仓一致：编号连续，且指向各门的引用都落在它自己那一步', () => {
  // 编号漂移不会报错，只会让引用指向另一道门——这正是机器该盯的。
  // 期望值从文档里动态取：插一道门就该整体顺延，钉死数字会让"文档改对了、测试反而红"。
  const nums = composeSteps().map((s) => s.num)
  assert.deepEqual(
    nums,
    nums.map((_, i) => i + 1),
    '组稿步骤编号必须从 1 起连续不重复',
  )

  const landing = gateStep('落盘确认门：')
  const draft = gateStep('用户过稿门')
  const wrong = []
  for (const [file, body] of prdFiles) {
    for (const m of body.matchAll(/第 ([0-9]+) 条的落盘确认门/g)) {
      if (Number(m[1]) !== landing) wrong.push(`${file} ← 「第 ${m[1]} 条的落盘确认门」应为第 ${landing} 条`)
    }
    for (const m of body.matchAll(/§组稿 第 ([0-9]+) 步的用户过稿门/g)) {
      if (Number(m[1]) !== draft) wrong.push(`${file} ← 「第 ${m[1]} 步的用户过稿门」应为第 ${draft} 步`)
    }
  }
  assert.deepEqual(wrong, [], '组稿步骤号漂移：\n' + wrong.join('\n'))
})

test('子代理 prompt 模板守住三条硬约束', () => {
  const body = read(prdRoot, 'references', 'prd复核纪律.md')
  const start = body.indexOf('```text')
  const prompt = body.slice(start, body.indexOf('```', start + 7))
  assert.ok(/MUST NOT 修改或创建任何文件/.test(prompt), 'prompt 未禁止子代理写文件')
  assert.ok(/无出处的冲突指控视为幻觉/.test(prompt), 'prompt 未要求冲突带出处')
  assert.ok(/查不到 MUST NOT 报成冲突/.test(prompt), 'prompt 未挡住"查不到即报冲突"')
  // PRD 尚未落盘，必须内联；否则子代理会去 docs/spec/ 找一个不存在的文件
  assert.ok(/尚未落盘/.test(prompt), 'prompt 未说明 PRD 尚未落盘、需内联')
})

test('VERSION 不低于 2.2.0（复核门自此版起）并带一屏内的迁移指南', () => {
  // 与 cards-mandatory 同一修法：写死当前版本会让此后每次无关的 bump 都在这里假红
  const version = read(repoRoot, 'ai-dev-system', 'VERSION').trim()
  const [maj, min] = version.split('.').map(Number)
  assert.ok(maj > 2 || (maj === 2 && min >= 2), `复核门自 2.2.0 起，VERSION 不应低于它：${version}`)
  // 盯的是**本特性落地的那个版本**的指南（2.2.0），不是当前 VERSION。
  // 写 `${version}.md` 会隐含要求「每个版本都有迁移指南」——那从来不是成文判据，
  // 只是历史上恰好每次 bump 都需要用户动作。2.5.0 是第一个零手动动作的 bump，
  // 它把这个隐含假设顶了出来。指向 2.2.0 则永不过期：PRD 复核门的指南永远是 2.2.0 那一份。
  const migration = path.join(repoRoot, 'ai-dev-system', 'migrations', '2.2.0.md')
  assert.ok(existsSync(migration), `缺迁移指南：${migration}`)
  assert.ok(readFileSync(migration, 'utf8').split('\n').length <= 45, '迁移指南要保持一屏内（≤45 行）')
})

test('[组稿·复核后] 标签枚举三处同步（本次已重演两次的失败模式，锁成机器闸）', () => {
  // 标签枚举散在三处：question-bank 的说明 / 00-prd生成流程 的标签清单 / SKILL.md 路由。
  // 改一处漏一处不会报错，只会让新标签在漏掉那处被当成普通 [组稿] 在第 3 步勾验。
  const spots = [
    ['assets/question-bank.md', '定义勾验时机'],
    ['references/00-prd生成流程.md', '§4 批提问的标签清单'],
    ['SKILL.md', '路由第 4 步的枚举'],
  ]
  const missing = spots.filter(([f]) => !read(prdRoot, f).includes('[组稿·复核后]'))
  assert.deepEqual(missing.map(([f, why]) => `${f}（${why}）`), [], '标签枚举漏同步')

  // 勾验时机是这个子类存在的全部理由，丢了它就退化成一个多余的标签。
  // 只锁契约不锁措辞：MUST NOT 组稿早期勾验 + 时机绑在复核门上。
  // 刻意不断言步骤号——本次变更自己就把 4–7 挪成了 5–8，编号是会变的东西，
  // 钉死它会让"文档改对了、测试反而红"。
  const qb = read(prdRoot, 'assets', 'question-bank.md')
  const def = qb.slice(qb.indexOf('`[组稿·复核后]` 是'), qb.indexOf('\n\n', qb.indexOf('`[组稿·复核后]` 是')))
  assert.ok(/MUST NOT 勾验/.test(def), '子类定义未写明早期 MUST NOT 勾验')
  assert.ok(/复核门/.test(def), '子类定义未把勾验时机绑到复核门上')
})

test('出口计数在入口层与流程层都没退回两个（round-1 的 P0 原样重放会被挡下）', () => {
  // 这条锁的是**已经发生过**的那次 P0：改判时权威定义改了、SKILL.md 的摘要没跟上。
  // 上一版闸只锁 prd复核纪律.md 内部的取值列表，把 SKILL.md 改回"两个出口"照样全绿。
  const stale = prdFiles.filter(([, body]) => /两个出口|两出口/.test(body))
  assert.deepEqual(stale.map(([f]) => f), [], 'skill 侧残留"两个出口"的旧表述')
  for (const f of ['SKILL.md', 'references/00-prd生成流程.md']) {
    assert.ok(/三个出口/.test(read(prdRoot, f)), `${f} 未写明三个出口`)
  }
})

test('子代理报告的「出口」列取值能表达全部三个出口', () => {
  // 三出口改判时这一列漏改过一次：两个可填值装不下三个出口，
  // "现状失实"只能被标成【需用户拍板】——正是判据明令禁止的路径
  const body = read(prdRoot, 'references', 'prd复核纪律.md')
  for (const v of ['【当场改稿】', '【回流到批 B】', '【回流到批 D】', '【需用户拍板】']) {
    assert.ok(body.includes(v), `返回格式的出口列缺取值 ${v}`)
  }
  // 冲突轴的取证足迹是"补交接面"那条无条件 MUST 的唯一输入，缺了它该条就是空转
  assert.ok(/取证足迹/.test(body), '返回格式缺「取证足迹」段')
  // 锁"它是无条件必交的"这个契约，不锁具体那句话怎么写
  const trace = body.slice(body.indexOf('「取证足迹」'), body.indexOf('- 「未能取证」'))
  assert.ok(/MUST\s*写|必写/.test(trace), '取证足迹未写成强制项')
  assert.ok(/无论|与本轴有没有发现|不管/.test(trace), '取证足迹未写明与本轴有无发现无关')
})
