// 多项目变更感知：上游侧「每次合并写 CHANGELOG」+ 下游侧「依赖声明与上游升级顺序」。
//
// 这条契约的价值在两边用同一套接口名：上游条目以接口名开头，下游声明按接口名列"用到的部分"，
// 升级时取交集。判据的家是 dw-code-facts 的 `代码事实纪律.md` §10；评审门忠实轴、完成门准出项
// 各自只管自己那一步的核对动作，注入块只留一句加指针。
//
// 第二个要守的是子代理数：正常路径零子代理，兜底各至多一个。
//
// 只查机械可判的那一半：判据在不在场、五类闭集有没有漂、`ctx init` 有没有真建目录、stub 与模板
// 有没有漂。规则合不合理归评审门；本闸全绿 MUST NOT 被读成契约描述正确。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { readSkillFile, skillFile } from './skill-files.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(path.join(...p), 'utf8')

const FACTS = readSkillFile('代码事实纪律.md')
const REVIEW = readSkillFile('子代理模板.md')
const WORKTREE = readSkillFile('worktree开发纪律.md')
const LEAN = readSkillFile('路径-lean.md')
const SNIPPET = readSkillFile('config-snippets/base.md')
const CARD_TPL = readSkillFile('context-layer/card-map.md')
const DEP_TPL = readSkillFile('context-layer/dependency.md')
const COMMANDS = readSkillFile('ctx/src/commands.js')

/** 按小节切段（同 review-backlog.test.mjs 的理由：判据住在哪一节决定它能不能在那一刻被读到）。 */
const cut = (body, from, to) => {
  const i = body.indexOf(from)
  assert.notEqual(i, -1, `锚点失效（文档已改写，断言需同步）：${from}`)
  const j = body.indexOf(to, i + from.length)
  assert.notEqual(j, -1, `锚点失效（文档已改写，断言需同步）：${to}`)
  return body.slice(i, j)
}

const FACTS_UP = cut(FACTS, '### 10.1 上游侧', '### 10.2 下游侧')
const FACTS_DOWN = cut(FACTS, '### 10.2 下游侧', '## 一句话')
const REVIEW_DUTY = cut(REVIEW, '## 本轴职责', '## 硬要求')
const WORKTREE_MERGE = cut(WORKTREE, '## 完成与自动合并门', '## 失败与阻塞')

/** 五类闭集：顺序与措辞是契约的一部分，任何一处漂了下游就对不上小节名。 */
const FIVE = '`不兼容` / `新增` / `变更` / `修复` / `内部`'

const UPSTREAM_RESTATERS = [['代码事实纪律.md §10.1', FACTS_UP]]
const DOWNSTREAM_RESTATERS = [['代码事实纪律.md §10.2', FACTS_DOWN]]

test('注入块与 Lean 一页只留关键一句加指针，不再展开一份', () => {
  assert.ok(SNIPPET.includes('至少写一条') && SNIPPET.includes('dw-code-facts'), '注入块缺「每次合并写一条」或没指向 dw-code-facts')
  assert.ok(SNIPPET.includes('MUST NOT 替拍板人定版本号'), '注入块缺「AI 不得定版本号」')
  assert.ok(LEAN.includes('写 CHANGELOG 条目'), 'Lean 一页的顺序表没排写 CHANGELOG 这一步')
  for (const [name, body] of [['config-snippets/base.md', SNIPPET], ['路径-lean.md', LEAN]]) {
    assert.ok(!body.includes('MUST NOT 自造第六类') && !body.includes('取交集'), `${name} 又展开了一份变更感知判据`)
  }
})

test('上游侧：五类闭集 + 一律写 + 不兼容三项必填，在三处复述里逐条在场', () => {
  for (const [name, body] of UPSTREAM_RESTATERS) {
    assert.ok(body.includes(FIVE), `${name}：五类闭集的顺序与措辞漂了`)
    assert.ok(body.includes('MUST NOT 自造第六类'), `${name}：闭集禁令缺失`)
    assert.ok(body.includes('至少写一条'), `${name}：「一律写」缺失`)
    assert.ok(/MUST NOT 以.本次无对外变化.为由不写/.test(body), `${name}：不写的借口没被封`)
    assert.ok(/对外接口名\*{0,2}开头/.test(body), `${name}：不兼容条目的接口名开头缺失——下游取交集靠它`)
    for (const item of ['旧调用方式', '新调用方式', '迁移步骤']) {
      assert.ok(body.includes(item), `${name}：不兼容条目必填项「${item}」缺失`)
    }
    assert.ok(/MUST NOT (另)?派子代理(去)?读 diff 生成/.test(body), `${name}：条目来源必须是兼容取舍表，禁止派子代理读 diff`)
    assert.ok(body.includes('MUST NOT 替拍板人定版本号'), `${name}：AI 不得定版本号`)
  }
})

test('上游侧：条目写在实现阶段、评审门之前；完成门只核对不代写', () => {
  for (const [name, body] of UPSTREAM_RESTATERS) {
    assert.ok(/MUST NOT (推|留)到( §11)? ?完成门才写/.test(body), `${name}：时机漂到完成门`)
  }
  assert.ok(FACTS_UP.includes('积压通路 MUST NOT 豁免本条'), '积压通路不得豁免写条目')
  for (const [name, body] of [['worktree开发纪律.md §完成与自动合并门', WORKTREE_MERGE]]) {
    assert.ok(body.includes('CHANGELOG 条目已在'), `${name}：准出项缺失`)
    assert.ok(body.includes('MUST NOT 在本门内代写'), `${name}：门内代写没被封`)
    assert.ok(body.includes('MUST NOT 派子代理去补写'), `${name}：漏写检查不得派子代理`)
    assert.ok(body.includes('first-parent'), `${name}：漏写检查的范围口径缺失`)
  }
  assert.ok(WORKTREE_MERGE.includes("git describe --tags --abbrev=0 --match 'v*'"), '漏写检查命令要照抄得走')
})

test('评审门忠实轴：spec §8.1 ↔ CHANGELOG 对照与两种偏离记法在场', () => {
  assert.ok(REVIEW_DUTY.includes('CHANGELOG 对照'), '忠实轴职责缺 CHANGELOG 对照')
  assert.ok(/缺一行记\s*一条 `漏做`/.test(REVIEW_DUTY), '缺条目 → 漏做')
  assert.ok(REVIEW_DUTY.includes('记一条 `做反了`'), '无兼容取舍却有不兼容条目 → 做反了')
})

test('下游侧：声明载体、命名、五项、补写义务在三处复述里逐条在场', () => {
  for (const [name, body] of DOWNSTREAM_RESTATERS) {
    assert.ok(body.includes('engineering-context/dependencies/<上游名>.md'), `${name}：声明载体路径漂了`)
    for (const item of ['上游与', '用到的', '调用点', '注意事项', '确认时间']) {
      assert.ok(body.includes(item), `${name}：五项之「${item}」缺失`)
    }
    assert.ok(/MUST NOT 从上游文档(或 PRD )?抄/.test(body), `${name}：真相方向（本项目源码）缺失`)
    assert.ok(body.includes('MUST NOT 顺延'), `${name}：补写义务的顺延禁令缺失`)
  }
  assert.ok(FACTS_DOWN.includes('一个上游一份'), '权威处：一个上游一份')
  assert.ok(FACTS_DOWN.includes('MUST NOT 要求重跑 `ctx init`'), '存量项目缺目录时不要求重跑 init')
})

test('下游侧：升级顺序五步 + 两条兜底 + 子代理上限，三处逐条在场', () => {
  for (const [name, body] of DOWNSTREAM_RESTATERS) {
    assert.ok(body.includes('不兼容` 条目'), `${name}：读的是上游 CHANGELOG 的不兼容条目`)
    assert.ok(body.includes('取交集'), `${name}：交集缺失`)
    assert.ok(/派 \*\*1 个\*\*子代理/.test(body), `${name}：无 CHANGELOG 时的子代理上限（1 个）漂了`)
    assert.ok(/MUST NOT 全量看/.test(body), `${name}：diff 范围限于声明接口的禁令缺失`)
    assert.ok(body.includes('当场补声明'), `${name}：无声明先补声明`)
    assert.ok(body.includes('零子代理'), `${name}：正常路径零子代理的承诺缺失`)
    assert.ok(body.includes('更新声明'), `${name}：升级后更新声明`)
  }
  assert.ok(FACTS_DOWN.includes('MUST NOT 按"无交集"处理'), '拿不准按有交集处理')
  assert.ok(FACTS_DOWN.includes('MUST NOT 在主会话裸 grep'), '无声明时的扫描必须外包')
})

test('文档治理的根目录例外清单认得仓库根 CHANGELOG.md', () => {
  const gov = readSkillFile('文档治理.md')
  assert.ok(gov.includes('`CHANGELOG.md`') && gov.includes('MUST 在仓库根'), '文档治理 §硬规则 缺例外')
})

test('卡片模板的下游行只留指针；声明模板五项齐全', () => {
  assert.ok(CARD_TPL.includes('dependencies/<上游名>.md'), '卡片模板下游行没指向 dependencies/')
  assert.ok(CARD_TPL.includes('MUST NOT 另记一份'), '卡片模板没封"两处各记一份"')
  for (const item of ['上游与当前版本', '确认时间', '接口名', '调用点', '注意事项']) {
    assert.ok(DEP_TPL.includes(item), `声明模板缺「${item}」`)
  }
  assert.ok(DEP_TPL.includes('一字不差'), '声明模板没写接口名要与上游同名')
})

test('ctx init 真生成 dependencies/README.md；--minimal 不生成', async () => {
  const { initScaffold } = await import(pathToFileURL(skillFile('ctx/src/commands.js')).href)
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'ctx-dep-'))
  try {
    const { files } = initScaffold(tmp)
    const readme = path.join(tmp, 'engineering-context', 'dependencies', 'README.md')
    assert.ok(existsSync(readme), 'dependencies/README.md 未生成')
    assert.ok(files.includes('dependencies/README.md'), '返回的文件清单没列它')
    const body = readFileSync(readme, 'utf8')
    for (const item of ['上游与当前版本', '用到的部分', '调用点', '注意事项', '确认时间']) {
      assert.ok(body.includes(item), `生成的 README 缺「${item}」`)
    }
    assert.ok(body.includes('代码事实纪律.md §10.2'), '生成的 README 没指回权威判据')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  const tmp2 = mkdtempSync(path.join(os.tmpdir(), 'ctx-dep-min-'))
  try {
    initScaffold(tmp2, { minimal: true })
    assert.ok(!existsSync(path.join(tmp2, 'engineering-context', 'dependencies')), '--minimal 不该建 dependencies/')
  } finally {
    rmSync(tmp2, { recursive: true, force: true })
  }
})

test('commands.js 的 DEPENDENCIES_README_STUB 与 assets/context-layer/dependency.md 讲同一套五项与同一条示例', () => {
  const stub = cut(COMMANDS, 'const DEPENDENCIES_README_STUB = `', '\n`;')
  // 精简副本不逐字相等（模板带【】占位与说明），但五项、示例行与权威指针 MUST 一致——
  // 这三样是 agent 照着写声明时真正会抄的部分，漂了就会长出两种写法。
  for (const item of ['上游与当前版本', '用到的部分', '调用点', '注意事项', '确认时间']) {
    assert.ok(stub.includes(item) && DEP_TPL.includes(item), `五项之「${item}」在 stub 与模板里不同时在场`)
  }
  assert.ok(stub.includes('createOrder') && DEP_TPL.includes('createOrder'), '示例接口名两处不一致')
  assert.ok(stub.includes('src/order/service.ts:41') && DEP_TPL.includes('src/order/service.ts:41'), '示例调用点两处不一致')
  assert.ok(stub.includes('代码事实纪律.md §10.2') && DEP_TPL.includes('代码事实纪律.md') && DEP_TPL.includes('§10.2'), '权威指针两处不一致')
})

test('本仓库自身的 CHANGELOG.md 在仓库根、有未发布节与五个小节', () => {
  const p = path.join(repoRoot, 'CHANGELOG.md')
  assert.ok(existsSync(p), '仓库根缺 CHANGELOG.md')
  const body = readFileSync(p, 'utf8')
  assert.ok(body.includes('## 未发布'), '缺 ## 未发布')
  for (const h of ['### 不兼容', '### 新增', '### 变更', '### 修复', '### 内部']) {
    assert.ok(body.includes(h), `缺小节 ${h}`)
  }
  // `## 未发布` MUST 排在所有版本节之前（发版是把它改名、再在上面新开一个空的）。
  const start = body.indexOf('## 未发布')
  const firstVersion = body.search(/\n## \d+\.\d+\.\d+/)
  assert.ok(firstVersion === -1 || start < firstVersion, '`## 未发布` 必须在版本节之前')
  // 「每次合并至少写一条」：`## 未发布` 只在发版刚改完名、之后还没有新提交时合法为空。
  //   当前 VERSION 的 tag 还没打（发版提交还在分支上）→ 该版本节 MUST 有条目；
  //   tag 已打且其后有提交 → `## 未发布` MUST 有条目；tag 已打且其后无提交 → 合法为空。
  const entriesOf = (heading) => {
    const from = body.indexOf(`\n${heading}`)
    if (from === -1) return []
    const next = body.indexOf('\n## ', from + 1)
    return body.slice(from, next === -1 ? undefined : next).split('\n').filter((l) => l.startsWith('- '))
  }
  const version = readFileSync(path.join(repoRoot, 'dw-system', 'VERSION'), 'utf8').trim()
  const git = (args) => spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
  const tagged = git(['rev-parse', '--verify', '--quiet', `refs/tags/v${version}`]).status === 0
  if (!tagged) {
    assert.ok(entriesOf(`## ${version}`).length >= 1 || entriesOf('## 未发布').length >= 1,
      `v${version} 还没打 tag，而 \`## ${version}\` 与 \`## 未发布\` 下都没有条目——每次合并 MUST 至少写一条`)
  } else if (Number(git(['rev-list', '--count', `v${version}..HEAD`]).stdout.trim()) > 0) {
    assert.ok(entriesOf('## 未发布').length >= 1, `v${version} 之后已有提交，\`## 未发布\` 下却一条都没有——每次合并 MUST 至少写一条`)
  }
})
