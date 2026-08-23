// 2.3.0「文档轴」的契约测试。
//
// 为什么要有这份测试：本次变更的实质是把一件活从"主会话在完成门自己做"挪成"评审门上的
// 一条独立轴"，而这件事的痕迹是**轴数计数词**——它散在十几个文件里（实数以 grep 现算为准，
// MUST NOT 写死），改一处漏一处不会有任何报错，只会让某条路径上的 agent 按旧的三轴执行、
// 文档轴整条消失。
//
// 这些断言过过一次门禁自检（植入必错样本，2026-08-19）：把任一处四轴改回三轴、把 E 轴
// 改回 D、把完成门那条改回执行式表述 → 全部 RED；契约不变的合法改写 → GREEN。
// 改断言时保持这条性质：**锁契约不锁措辞**。
//
// spec：docs/spec/2026-08-19-文档轴-lean-change-spec.md
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = path.join(repoRoot, 'ai-dev-system', 'skills')
const wfRoot = path.join(skillsRoot, 'ai-dev-workflow')
const read = (...seg) => readFileSync(path.join(...seg), 'utf8')

// 切段取子串。**锚点找不到必须当场红**：indexOf 返回 -1 时 slice 会静默退化成"整个文件"，
// 于是段内断言变成整文件级断言——判据写在没人读的那段照样绿。A 轴用变异样本实证过这条
// 退化路径，所以全文件的 slice MUST 走这个帮手，MUST NOT 直接 str.slice(str.indexOf(...))。
const cut = (body, from, to) => {
  const i = body.indexOf(from)
  assert.ok(i >= 0, `锚点失效（文档已改写，断言需同步）：${from}`)
  if (to === undefined) return body.slice(i)
  const j = body.indexOf(to, i)
  assert.ok(j > i, `结束锚点失效（文档已改写，断言需同步）：${to}`)
  return body.slice(i, j)
}

const skillFiles = (function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (name.endsWith('.md')) acc.push([path.relative(skillsRoot, full), readFileSync(full, 'utf8')])
  }
  return acc
})(skillsRoot)

test('轴数计数词全仓一致：skill 侧不得残留"三轴"', () => {
  // 十几个文件都写着轴数，漏改一处就让那条路径退回三轴形态（实数以本断言现扫为准）。
  // migrations/ 下的历史指南不在扫描范围——那是历史记载，本就该保留当时的说法。
  const stale = skillFiles.filter(([, b]) => /三轴|三条轴|3 个并行子代理/.test(b))
  assert.deepEqual(stale.map(([f]) => f), [], 'skill 侧残留旧轴数')
})

test('D 是文档轴、E 是 agent 架构轴（编号让位没做一半）', () => {
  const rev = read(wfRoot, 'references', 'core', '代码评审纪律.md')
  assert.ok(/\|\s*\*\*D 文档轴\*\*/.test(rev), '轴表里 D 不是文档轴')
  assert.ok(/\|\s*\*\*E agent 架构轴\*\*/.test(rev), '轴表里 E 不是 agent 架构轴')
  assert.ok(!/\*\*D agent 架构轴\*\*/.test(rev), '残留旧编号 D agent 架构轴')
  // 恒跑四条 + 条件一条：子代理数必须跟着改
  assert.ok(/4 个并行子代理/.test(rev), '门禁未写明完整流程派 4 个')
  assert.ok(/完整流程\s*5\s*个/.test(rev), 'Agentic 增派后完整流程的总数未跟着轴数改')
  assert.ok(/Lean\s*2\s*个/.test(rev), 'Agentic 增派后 Lean 的总数未跟着轴数改')
})

test('D 轴恒跑，没有被设成条件触发', () => {
  const rev = read(wfRoot, 'references', 'core', '代码评审纪律.md')
  const outline = read(wfRoot, 'references', 'core', '00-流程总纲.md')
  // 锁契约：两份文件都要写明"不许主会话先判要不要派"
  for (const [name, body] of [['代码评审纪律', rev], ['00-流程总纲', outline]]) {
    assert.ok(/恒跑/.test(body), `${name} 未写明 D 轴恒跑`)
    assert.ok(/MUST NOT 由主会话先判/.test(body), `${name} 未挡住"主会话先判要不要派"`)
  }
})

test('完成门那条已从"执行整套结算"改成"核对 D 轴报告"', () => {
  const wt = read(wfRoot, 'references', 'core', 'worktree开发纪律.md')
  const item = cut(wt, '- **文档生命周期已结算**', '- 已吸收最新主分支')
  assert.ok(/只核对结论/.test(item), '完成门那条仍是执行式表述')
  assert.ok(/D 轴报告/.test(item), '完成门那条未指向 D 轴报告')
  // 零命中也要留凭据，这是它能与"没做"区分的唯一依据
  assert.ok(/零命中/.test(item), '完成门那条未要求零命中也有书面结论')
  // 计数词已按 spec §4.3 / FR-007 改成指名引用：轴数只留在权威定义文件 `代码评审纪律.md`，
  // 这里再复写一遍数字就是新的漂移源。改为锁同一个契约的两半——**指名引用到位** +
  // **文档轴在场**：任一缺失都说明这条准出项没跟着轴表改。
  const reviewItem = cut(wt, '- **代码评审门已通过**', '- **兼容取舍已有用户结论**')
  assert.ok(/§四条轴/.test(reviewItem), '代码评审门那条未指名引用 `代码评审纪律.md` §四条轴')
  assert.ok(/文档/.test(reviewItem), '代码评审门那条没列出文档轴')
})

test('文档治理 §3 的触发点已改挂到评审门，判定与落盘的执行者都写死了', () => {
  const gov = read(wfRoot, 'references', 'core', '文档治理.md')
  assert.ok(/触发点挂在既有的代码评审门上/.test(gov), '§3 触发点未改挂到代码评审门')
  assert.ok(!/触发点挂在既有的完成与自动合并门上/.test(gov), '§3 残留旧触发点')
  assert.ok(/判据仍在本节/.test(gov), '§3 未说明判据仍归本节、D 轴只是执行者')
  // 落盘曾经没有执行者：D 轴只报告不写文件，而"仍准确→更新 last_confirmed"不是 P0/P1，
  // 挂在"P0/P1 修完才过门"下永远轮不到执行，完成门却要核对它已执行。
  // 断言 MUST 切到 §3 的引导段内——整文件级正则挡不住"把角色切分整段删掉"（A 轴实证）。
  const lead = cut(gov, '**触发点挂在既有的代码评审门上', '1. **盘点本次触碰的权威面**')
  assert.ok(/落盘/.test(lead) && /主会话/.test(lead), '§3 引导段未指派落盘的执行者')
  assert.ok(/判定/.test(lead), '§3 引导段未切分判定与落盘两个角色')
  // 上面两条仍不够：引导段横跨三小段，删掉"判定与落盘分属两个角色"那段后，
  // "主会话""落盘"还能在相邻段命中。锁这条关键禁止句——它只出现在角色切分段里。
  assert.ok(/MUST NOT 把落盘挂在/.test(lead), '§3 未挡住"把落盘挂在 P0/P1 口径下"（那样它永远轮不到执行）')
  const rev = read(wfRoot, 'references', 'core', '代码评审纪律.md')
  assert.ok(/不受 P0\/P1 口径限制/.test(rev), '§处置 未把文档落盘排除在 P0/P1 口径之外')
})

test('probe 的定位只有一处权威定义，另一处是指针（不重复堆叠）', () => {
  // 曾经在两个文件里各写了一遍完整定位，而 代码评审纪律 自己刚立过
  // "判据不在本文重复定义"的规矩——测试当时还把这份重复锁死了。
  const gov = read(wfRoot, 'references', 'core', '文档治理.md')
  const rev = read(wfRoot, 'references', 'core', '代码评审纪律.md')
  const authoritative = cut(gov, '是这三步的辅助')
  assert.ok(/MUST NOT/.test(authoritative.slice(0, 500)), 'probe 权威定位段未挡住"绿了就算过"')
  assert.ok(/probe/.test(rev), '代码评审纪律 未提 probe')
  assert.ok(/文档治理\.md` §3/.test(cut(rev, 'D 轴与 `ctx probe` 的分工').slice(0, 400)),
    '代码评审纪律 的 probe 段未指向权威定义')
})

test('总纲的完成门也已改成核对形态（曾漏改，且当时测试只锁了 worktree开发纪律）', () => {
  // 总纲是常驻骨架，读到它的主会话会在完成门重做一遍盘点——本次变更的核心目的当场失效。
  const outline = read(wfRoot, 'references', 'core', '00-流程总纲.md')
  const sec = cut(outline, '## 完成与自动合并门')
  assert.ok(/只核对/.test(sec), '总纲完成门段仍是执行式表述')
  assert.ok(/MUST NOT 在此重做盘点/.test(sec), '总纲完成门段未挡住"在此重做盘点"')
  assert.ok(!/本门同时结算文档生命周期/.test(outline), '总纲残留旧的执行式表述')
})

test('新判据落在 D 轴真正会读的那一段里（不是只出现在文件某处）', () => {
  // 上一版这三条是**整文件级**正则：判据写在类目表、而 D 轴执行的 §3 第 1 步里没有，
  // 断言照样绿——C1 那个 P0 就是这么溜过去的。现在切到使用该判据的段内再断言。
  const gov = read(wfRoot, 'references', 'core', '文档治理.md')
  const step1 = cut(gov, '1. **盘点本次触碰的权威面**', '2. **比对')
  const step2 = cut(gov, '2. **比对', '3. **逐篇判定')
  const step3 = cut(gov, '3. **逐篇判定')

  assert.ok(/流程与门禁契约/.test(step1), '第 1 步的盘点清单里没有「流程与门禁契约」')
  assert.ok(/全文检索/.test(step2), '第 2 步没有全文检索兜底')
  assert.ok(/未勾选/.test(step3) && /已勾选/.test(step3), '第 3 步没有勾验表判据')
  // 勾选位是一条事实主张，不是口径的一部分——口径对齐时翻它，等于追认一次没发生的执行。
  // 这条判据是三个轴独立命中"上一轮我自己违规翻转了一处"之后补的，必须有闸看着。
  assert.ok(/MUST NOT 翻转勾选位/.test(step3), '第 3 步未挡住"口径对齐时翻转勾选位"')

  // 刷卡面比文档权威面窄——说成"同一个面"会把文档层专有的那几类挤掉。
  // 锁契约而不是那句措辞：第 1 步的表 MUST 有"也触发刷卡？"这一列且两种取值都出现，
  // 二值性一旦坍缩成单值，"同源但更宽"就名存实亡。（上一版写成一条正则去匹配历史原句，
  // 而原句中间隔着两个文件引用，正则永远匹配不到——把原句整句退回去照样全绿，A 轴实证。）
  assert.ok(/也触发刷卡/.test(step1), '第 1 步的权威面表缺「也触发刷卡？」列')
  assert.ok(/✅/.test(step1) && /❌/.test(step1), '刷卡列坍缩成单值：文档权威面被等同于刷卡面')
  assert.ok(/文档层专有/.test(step1), '第 1 步未标出哪些是文档层专有的权威面')
  assert.ok(!/刷卡片?用的是\s*\*{0,2}同一个面/.test(gov), '§3 仍把文档权威面说成与刷卡面同一个面')
})

test('权威面清单只有一份，且引用它的地方数量词对得上', () => {
  // 曾经两份枚举并存且内容不一致（一份有"对外契约"、另一份有"废弃标记/兼容窗口"），
  // 于是加第七类时只加进了没人读的那一份，还引出"七类/前六类/实际6条"三个数字打架。
  const gov = read(wfRoot, 'references', 'core', '文档治理.md')
  const step1 = cut(gov, '1. **盘点本次触碰的权威面**', '2. **比对')
  const rows = [...step1.matchAll(/^\s*\| \d+ \| /gm)].length
  assert.ok(rows >= 6, `第 1 步的权威面表只解析出 ${rows} 行，断言本身可能已失效`)

  // 引用方写的数量词必须等于这张表的实际行数
  const CN = { 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  const wrong = []
  for (const [f, body] of skillFiles) {
    for (const m of body.matchAll(/([五六七八九])类(?:面|权威面)/g)) {
      if (CN[m[1]] !== rows) wrong.push(`${f} ← 写着"${m[1]}类"，实际 ${rows} 类`)
    }
  }
  assert.deepEqual(wrong, [], '权威面数量词与 §3 第 1 步的实际条目数不符：\n' + wrong.join('\n'))

  // 类目表那处必须是指针，不能再复制一份清单
  const decl = cut(gov, '`authority_refs` 写本文所描述的权威实体', '**触发点挂在既有的代码评审门上')
  assert.ok(/§3 第 1 步/.test(decl), 'authority_refs 声明处未指向唯一权威清单')
  assert.ok(!/DB schema 与唯一键/.test(decl), 'authority_refs 声明处又复制了一份清单')
})

test('「待归并」例外与它修饰的判据同处（读表的人和读 prompt 的人不能得到两个结论）', () => {
  const rev = read(wfRoot, 'references', 'core', '代码评审纪律.md')
  const row = cut(rev, '| **D 文档轴**', '| **E agent 架构轴**')
  assert.ok(/待归并/.test(row), 'D 轴定义表里缺「待归并」例外——只写在 prompt 会让读表的人误报')
  const prompt = cut(rev, '- 文档轴：', '- agent 架构轴（仅 Agentic 项目')
  assert.ok(/待归并/.test(prompt), 'prompt 模板里缺「待归并」例外')
})

test('VERSION 不低于 2.3.0（文档轴自此版起）并带一屏内的迁移指南', () => {
  const version = read(repoRoot, 'ai-dev-system', 'VERSION').trim()
  const [maj, min] = version.split('.').map(Number)
  assert.ok(maj > 2 || (maj === 2 && min >= 3), `文档轴自 2.3.0 起，VERSION 不应低于它：${version}`)
  // 盯的是**本特性落地的那个版本**的指南（2.3.0），不是当前 VERSION。
  // 写 `${version}.md` 会隐含要求「每个版本都有迁移指南」——那从来不是成文判据，
  // 只是历史上恰好每次 bump 都需要用户动作。2.5.0 是第一个零手动动作的 bump，
  // 它把这个隐含假设顶了出来。指向 2.3.0 则永不过期：文档轴的指南永远是 2.3.0 那一份。
  const migration = path.join(repoRoot, 'ai-dev-system', 'migrations', '2.3.0.md')
  assert.ok(existsSync(migration), `缺迁移指南：${migration}`)
  assert.ok(readFileSync(migration, 'utf8').split('\n').length <= 45, '迁移指南要保持一屏内（≤45 行）')
})
