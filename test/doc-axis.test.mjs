// 2.3.0「文档轴」的契约测试。
//
// 为什么要有这份测试：本次变更的实质是把一件活从"主会话在完成门自己做"挪成"评审门上的
// 一条独立轴"，而这件事的痕迹是**轴数计数词**——它散在 12 个文件里，改一处漏一处不会有
// 任何报错，只会让某条路径上的 agent 按旧的三轴执行、文档轴整条消失。
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

const skillFiles = (function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (name.endsWith('.md')) acc.push([path.relative(skillsRoot, full), readFileSync(full, 'utf8')])
  }
  return acc
})(skillsRoot)

test('轴数计数词全仓一致：skill 侧不得残留"三轴"', () => {
  // 12 个文件都写着轴数，漏改一处就让那条路径退回三轴形态。
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
  assert.ok(/完整流程 5 个 \/ Lean 2 个/.test(rev), 'Agentic 增派后的总数未跟着轴数改')
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
  const item = wt.slice(wt.indexOf('- **文档生命周期已结算**'), wt.indexOf('- 已吸收最新主分支'))
  assert.ok(/只核对结论/.test(item), '完成门那条仍是执行式表述')
  assert.ok(/D 轴报告/.test(item), '完成门那条未指向 D 轴报告')
  // 零命中也要留凭据，这是它能与"没做"区分的唯一依据
  assert.ok(/零命中/.test(item), '完成门那条未要求零命中也有书面结论')
  assert.ok(/四轴/.test(wt), '代码评审门那条的轴数未同改')
})

test('文档治理 §3 的触发点已改挂到评审门，判定与落盘的执行者都写死了', () => {
  const gov = read(wfRoot, 'references', 'core', '文档治理.md')
  assert.ok(/触发点挂在既有的代码评审门上/.test(gov), '§3 触发点未改挂到代码评审门')
  assert.ok(!/触发点挂在既有的完成与自动合并门上/.test(gov), '§3 残留旧触发点')
  assert.ok(/判据仍在本节/.test(gov), '§3 未说明判据仍归本节、D 轴只是执行者')
  // 落盘曾经没有执行者：D 轴只报告不写文件，而"仍准确→更新 last_confirmed"不是 P0/P1，
  // 挂在"P0/P1 修完才过门"下永远轮不到执行，完成门却要核对它已执行。
  assert.ok(/落盘/.test(gov) && /主会话/.test(gov), '§3 未指派落盘的执行者')
  const rev = read(wfRoot, 'references', 'core', '代码评审纪律.md')
  assert.ok(/不受 P0\/P1 口径限制/.test(rev), '§处置 未把文档落盘排除在 P0/P1 口径之外')
})

test('probe 的定位只有一处权威定义，另一处是指针（不重复堆叠）', () => {
  // 曾经在两个文件里各写了一遍完整定位，而 代码评审纪律 自己刚立过
  // "判据不在本文重复定义"的规矩——测试当时还把这份重复锁死了。
  const gov = read(wfRoot, 'references', 'core', '文档治理.md')
  const rev = read(wfRoot, 'references', 'core', '代码评审纪律.md')
  const pos = gov.indexOf('是这三步的辅助')
  assert.ok(pos > 0, '文档治理 §3 缺 probe 的权威定位段')
  assert.ok(/MUST NOT/.test(gov.slice(pos, pos + 500)), 'probe 权威定位段未挡住"绿了就算过"')
  assert.ok(/probe/.test(rev), '代码评审纪律 未提 probe')
  assert.ok(/文档治理\.md` §3/.test(rev.slice(rev.indexOf('D 轴与 `ctx probe` 的分工'), rev.indexOf('D 轴与 `ctx probe` 的分工') + 400)),
    '代码评审纪律 的 probe 段未指向权威定义')
})

test('总纲的完成门也已改成核对形态（曾漏改，且当时测试只锁了 worktree开发纪律）', () => {
  // 总纲是常驻骨架，读到它的主会话会在完成门重做一遍盘点——本次变更的核心目的当场失效。
  const outline = read(wfRoot, 'references', 'core', '00-流程总纲.md')
  const sec = outline.slice(outline.indexOf('## 完成与自动合并门'))
  assert.ok(/只核对/.test(sec), '总纲完成门段仍是执行式表述')
  assert.ok(/MUST NOT 在此重做盘点/.test(sec), '总纲完成门段未挡住"在此重做盘点"')
  assert.ok(!/本门同时结算文档生命周期/.test(outline), '总纲残留旧的执行式表述')
})

test('权威面判据补了"流程与门禁契约"一类（纯 markdown 变更的后门）', () => {
  // 原六类全是代码型面，改一道门的轴集合套不进任何一类，
  // "本次没触碰任何权威面"就成了合法的收工借口。
  const gov = read(wfRoot, 'references', 'core', '文档治理.md')
  assert.ok(/流程与门禁契约/.test(gov), '§3 未补"流程与门禁契约"类权威面')
  // 机械比对之外必须再做一次全文检索，否则正文描述了本次改动、
  // 却没在 authority_refs 里登记它的文档会被整篇漏掉
  assert.ok(/全文检索/.test(gov), '§3 未要求 authority_refs 比对之外再做全文检索')
  // 勾验表按勾选状态判，此前无判据
  assert.ok(/未勾选/.test(gov) && /已勾选/.test(gov), '§3 未定义勾验表怎么判')
})

test('VERSION 不低于 2.3.0（文档轴自此版起）并带一屏内的迁移指南', () => {
  const version = read(repoRoot, 'ai-dev-system', 'VERSION').trim()
  const [maj, min] = version.split('.').map(Number)
  assert.ok(maj > 2 || (maj === 2 && min >= 3), `文档轴自 2.3.0 起，VERSION 不应低于它：${version}`)
  const migration = path.join(repoRoot, 'ai-dev-system', 'migrations', `${version}.md`)
  assert.ok(existsSync(migration), `缺迁移指南：${migration}`)
  assert.ok(readFileSync(migration, 'utf8').split('\n').length <= 45, '迁移指南要保持一屏内（≤45 行）')
})
