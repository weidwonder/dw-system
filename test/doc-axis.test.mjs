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

test('文档治理 §3 的触发点已改挂到评审门，且 probe 是 SHOULD 辅助', () => {
  const gov = read(wfRoot, 'references', 'core', '文档治理.md')
  assert.ok(/触发点挂在既有的代码评审门上/.test(gov), '§3 触发点未改挂到代码评审门')
  assert.ok(!/触发点挂在既有的完成与自动合并门上/.test(gov), '§3 残留旧触发点')
  // 判据仍归 §3，D 轴只是执行者——两处都要说清，否则会变成两套判据
  assert.ok(/判据仍在本节/.test(gov), '§3 未说明判据仍归本节、D 轴只是执行者')
  // probe 的定位：辅助不是门禁，绿了不等于准
  for (const [name, body] of [['文档治理', gov], ['代码评审纪律', read(wfRoot, 'references', 'core', '代码评审纪律.md')]]) {
    assert.ok(/probe/.test(body), `${name} 未提 ctx probe`)
    assert.ok(/MUST NOT/.test(body.slice(body.indexOf('probe') - 400, body.indexOf('probe') + 600)),
      `${name} 未挡住"probe 绿了就算过"`)
  }
})

test('VERSION 不低于 2.3.0（文档轴自此版起）并带一屏内的迁移指南', () => {
  const version = read(repoRoot, 'ai-dev-system', 'VERSION').trim()
  const [maj, min] = version.split('.').map(Number)
  assert.ok(maj > 2 || (maj === 2 && min >= 3), `文档轴自 2.3.0 起，VERSION 不应低于它：${version}`)
  const migration = path.join(repoRoot, 'ai-dev-system', 'migrations', `${version}.md`)
  assert.ok(existsSync(migration), `缺迁移指南：${migration}`)
  assert.ok(readFileSync(migration, 'utf8').split('\n').length <= 45, '迁移指南要保持一屏内（≤45 行）')
})
