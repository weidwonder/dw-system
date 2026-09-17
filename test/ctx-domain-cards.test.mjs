// 域卡读取、卡片体检（lint-cards）与 authority-unique 题型。
// 契约：docs/spec/2026-09-17-dw-system-安装器迁移与ctx体检与机器闸-eng-spec.md §3.2、§3.3、§4.2（FR-011 ~ FR-014）。
//
// 每条体检规则各配一个必红样本与一个必绿样本：规则写错成恒绿时，必红样本会先红。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadAllCards, loadCards, loadDomainCards } from '../dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js'
import { discover, getCard, listServices } from '../dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js'
import { BASELINE_FILE, compareWithBaseline, lintCards } from '../dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js'
import { answerProbe } from '../dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js'
import { searchSemantic } from '../dw-system/skills/dw-code-facts/scripts/ctx/src/semantic.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const cli = path.join(here, '..', 'dw-system', 'skills', 'dw-code-facts', 'scripts', 'ctx', 'src', 'cli.js')

const MAP = `# 地图卡

## 职责
订单服务。

## 业务域地图

| 业务域 | 一句话 | 域卡 |
|---|---|---|
| 订单导出 | 导出 CSV | \`cards/order/订单导出.md\` |

## 确认
2026-09-01｜读过 export/
`

const DOMAIN = `# 域卡

## 职责
把订单导出成 CSV。

## 权威实现与对外接口

| 能力 | 权威实现 | 约束 |
|---|---|---|
| 导出列定义 | \`src/export/columns.js#EXPORT_COLUMNS\` | 新列只许加在末尾 |

## 陷阱项

- \`legacyExport\` — 已删除，改用 \`exportOrders\`

## 确认
2026-09-02｜读过 src/export/
`

/** 建一个带地图卡 + 一张域卡 + 被 cite 的源码文件的项目；fn 拿到 { root, ctxDir }。 */
function withProject(fn, { map = MAP, domains = { 订单导出: DOMAIN }, registry = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-domain-'))
  try {
    const ctxDir = path.join(root, 'engineering-context')
    fs.mkdirSync(path.join(ctxDir, 'cards', 'order'), { recursive: true })
    if (map !== null) fs.writeFileSync(path.join(ctxDir, 'cards', 'order.md'), map)
    for (const [name, body] of Object.entries(domains)) fs.writeFileSync(path.join(ctxDir, 'cards', 'order', `${name}.md`), body)
    if (registry !== null) fs.writeFileSync(path.join(ctxDir, 'capability-registry.md'), registry)
    fs.mkdirSync(path.join(root, 'src', 'export'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src', 'export', 'columns.js'), 'export const EXPORT_COLUMNS = []\n')
    return fn({ root, ctxDir })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

// ── 域卡读取 ────────────────────────────────────────────────────────────────

test('loadCards 只给地图卡并带域名；loadDomainCards 给域卡；loadAllCards 是两者之和', () => {
  withProject(({ ctxDir }) => {
    const maps = loadCards(ctxDir)
    assert.deepEqual(maps.map((c) => c.service), ['order'])
    assert.deepEqual(maps[0].domains, ['订单导出'])
    const domains = loadDomainCards(ctxDir)
    assert.deepEqual(domains.map((d) => [d.service, d.domain, d.path.split(path.sep).join('/')]), [['order', '订单导出', 'cards/order/订单导出.md']])
    assert.equal(loadAllCards(ctxDir).length, 2)
  })
})

test('get-card <仓库> <域>：有域卡文件读域卡，cite 指向域卡并取域卡自己的确认日期', () => {
  withProject(({ ctxDir }) => {
    const r = getCard(ctxDir, 'order', '订单导出')
    assert.ok(r.content.includes('EXPORT_COLUMNS'))
    assert.match(r.cite, /cards[\\/]order[\\/]订单导出\.md#全文 @2026-09-02/)
  })
})

test('get-card <仓库> <域>：没有域卡文件时照旧读地图卡里的同名小节', () => {
  withProject(({ ctxDir }) => {
    const r = getCard(ctxDir, 'order', '职责')
    assert.equal(r.content, '订单服务。')
    assert.match(r.cite, /order\.md#职责 @2026-09-01/)
  })
})

test('get-card 两处都没有：不发 cite，可用清单同时列出域卡与地图卡小节', () => {
  withProject(({ ctxDir }) => {
    const r = getCard(ctxDir, 'order', '不存在的域')
    assert.equal(r.cite, null)
    assert.equal(r.missing, true)
    assert.ok(r.available.includes('订单导出') && r.available.includes('职责'))
  })
})

test('discover 与 search-semantic 的检索范围包含域卡，陷阱项进 out-of-scope', () => {
  withProject(({ ctxDir }) => {
    const r = discover(ctxDir, 'EXPORT_COLUMNS')
    const hit = r.cards.find((c) => c.domain === '订单导出')
    assert.ok(hit, '只写在域卡里的符号 MUST 能被 discover 命中')
    assert.ok(r.outOfScope.some((l) => l.includes('legacyExport') && l.includes('order › 订单导出')), '域卡〈陷阱项〉MUST 变成 out-of-scope 警告')
    const s = searchSemantic(ctxDir, '导出列定义')
    assert.ok(s.results.some((x) => x.domain === '订单导出'))
  })
})

test('list-services 只列地图卡，域卡挂在它的仓库下', () => {
  withProject(({ ctxDir }) => {
    const r = listServices(ctxDir)
    assert.deepEqual(r.map((s) => s.service), ['order'])
    assert.deepEqual(r[0].domains, ['订单导出'])
  })
})

// ── lint-cards 规则 ─────────────────────────────────────────────────────────

test('合规的地图卡 + 域卡：零违规', () => {
  withProject(({ ctxDir }) => assert.deepEqual(lintCards(ctxDir).violations, []))
})

test('sections：缺必备小节、自造小节、缺地图卡各判一条', () => {
  withProject(({ ctxDir }) => {
    const v = lintCards(ctxDir).violations
    assert.ok(v.includes('sections|cards/order/订单导出.md|缺:陷阱项'))
    assert.ok(v.includes('sections|cards/order/订单导出.md|多:本次核实'))
    assert.ok(v.includes('sections|cards/order|缺地图卡'))
  }, { map: null, domains: { 订单导出: DOMAIN.replace(/## 陷阱项[\s\S]*?(?=## 确认)/, '## 本次核实\n读了一遍。\n\n') } })
})

test('budget：域卡超 16,000 字节、地图卡超 8,000 字节、registry 单格超 300 字节', () => {
  const pad = (n) => `\n${'填'.repeat(Math.ceil(n / 3))}\n`
  withProject(({ ctxDir }) => {
    const v = lintCards(ctxDir).violations
    assert.ok(v.includes('budget|cards/order.md|'))
    assert.ok(v.includes('budget|cards/order/订单导出.md|'))
    assert.ok(v.some((x) => x.startsWith('budget|capability-registry.md|订单导出#')))
  }, {
    map: MAP.replace('订单服务。', `订单服务。${pad(8000)}`),
    domains: { 订单导出: DOMAIN.replace('把订单导出成 CSV。', `把订单导出成 CSV。${pad(16000)}`) },
    registry: `| Capability | 权威实现 | 陷阱项 |\n|---|---|---|\n| 订单导出 | ${'长'.repeat(120)} | 无 |\n`,
  })
})

test('dated-heading：带日期的小节名判红，正文里的日期不判', () => {
  withProject(({ ctxDir }) => {
    const v = lintCards(ctxDir).violations.filter((x) => x.startsWith('dated-heading'))
    assert.deepEqual(v, ['dated-heading|cards/order/订单导出.md|2026-08-16 工具链收口'])
  }, { domains: { 订单导出: DOMAIN.replace('## 确认', '### 2026-08-16 工具链收口\n经过略。\n\n## 确认') } })
})

test('cite：路径不存在、符号检索不到、行号越界各判红；围栏内与占位行不判', () => {
  const body = DOMAIN.replace('| 导出列定义 |', [
    '| 不存在的文件 | `src/nope.js#X` | — |',
    '| 符号已改名 | `src/export/columns.js#OLD_NAME` | — |',
    '| 行号越界 | `src/export/columns.js:99` | — |',
    '| 行号在界内 | `src/export/columns.js:1` | — |',
    '| 【占位】 | 【`src/还没填.js#Y`】 | — |',
    '| 导出列定义 |',
  ].join('\n')).replace('## 确认', '```\n`src/fenced.js#Z`\n```\n\n## 确认')
  withProject(({ ctxDir }) => {
    const v = lintCards(ctxDir).violations.filter((x) => x.startsWith('cite'))
    assert.deepEqual(v, [
      'cite|cards/order/订单导出.md|src/export/columns.js#OLD_NAME',
      'cite|cards/order/订单导出.md|src/export/columns.js:99',
      'cite|cards/order/订单导出.md|src/nope.js#X',
    ])
  }, { domains: { 订单导出: body } })
})

test('cite：地图卡声明的根目录参与解析；声明为「外部」的仓库整体跳过', () => {
  const domain = DOMAIN.replace('src/export/columns.js#EXPORT_COLUMNS', 'export/columns.js#EXPORT_COLUMNS')
  withProject(({ ctxDir }) => {
    assert.deepEqual(lintCards(ctxDir).violations, [], '`> 根目录：src` 下 export/columns.js MUST 解析得到')
  }, { map: MAP.replace('订单服务。', '订单服务。\n\n> 根目录：src'), domains: { 订单导出: domain } })
  withProject(({ ctxDir }) => {
    assert.deepEqual(lintCards(ctxDir).violations, [], '外部仓库的源码不在本项目里，cite 无从校验')
  }, { map: MAP.replace('订单服务。', '订单服务。\n\n> 根目录：外部'), domains: { 订单导出: DOMAIN.replace('src/export/columns.js', 'lib/elsewhere.js') } })
})

test('domain-dup：归一化后相等、或 ≥4 字的前缀关系判红；短前缀不判', () => {
  withProject(({ ctxDir }) => {
    const v = lintCards(ctxDir).violations.filter((x) => x.startsWith('domain-dup'))
    assert.deepEqual(v, [
      'domain-dup|cards/order|订单-导出~订单导出',
      'domain-dup|cards/order|订单-导出~订单导出历史',
      'domain-dup|cards/order|订单导出~订单导出历史',
    ])
  }, { domains: { 订单导出: DOMAIN, '订单-导出': DOMAIN, 订单导出历史: DOMAIN, 订单: DOMAIN } })
})

test('registry-pointer：指向不存在的卡判红，指向存在的卡不判', () => {
  withProject(({ ctxDir }) => {
    const v = lintCards(ctxDir).violations
    assert.deepEqual(v, ['registry-pointer|capability-registry.md|cards/order/退款.md'])
  }, { registry: '| Capability | 权威实现 | 陷阱项 |\n|---|---|---|\n| 导出 | 见 `cards/order/订单导出.md` | 无 |\n| 退款 | 见 `cards/order/退款.md` | 无 |\n' })
})

test('trap-noise：陷阱项里的"仍在维护"判红；写在引用块里的引导语不判', () => {
  withProject(({ ctxDir }) => {
    const v = lintCards(ctxDir).violations.filter((x) => x.startsWith('trap-noise'))
    assert.equal(v.length, 1)
    assert.ok(v[0].includes('exportOrders'))
  }, { domains: { 订单导出: DOMAIN.replace('- `legacyExport`', '> "仍在维护"这类话不要写进来\n\n- `exportOrders` 仍在维护，非废弃\n- `legacyExport`') } })
})

// ── 基线 ───────────────────────────────────────────────────────────────────

const runCli = (root, ...args) => spawnSync(process.execPath, [cli, 'lint-cards', ...args], { cwd: root, encoding: 'utf8' })
const DIRTY = { domains: { 订单导出: DOMAIN.replace('## 确认', '## 本次核实\n略。\n\n## 确认') } }

test('无基线时存量违规判红；--init-baseline 之后转绿，且拒绝第二次初始化', () => {
  withProject(({ root, ctxDir }) => {
    assert.equal(runCli(root).status, 1)
    const init = runCli(root, '--init-baseline')
    assert.equal(init.status, 0)
    const saved = JSON.parse(fs.readFileSync(path.join(ctxDir, BASELINE_FILE), 'utf8'))
    assert.deepEqual(saved, { version: 1, violations: ['sections|cards/order/订单导出.md|多:本次核实'] })
    assert.equal(runCli(root).status, 0, '基线内的存量违规不判红')
    assert.equal(runCli(root, '--init-baseline').status, 2, '已有基线 MUST 拒绝覆盖——覆盖等于把新违规一笔勾销')
  }, DIRTY)
})

test('有基线时新增违规判红，且基线不会被顺手改写', () => {
  withProject(({ root, ctxDir }) => {
    runCli(root, '--init-baseline')
    const before = fs.readFileSync(path.join(ctxDir, BASELINE_FILE), 'utf8')
    fs.appendFileSync(path.join(ctxDir, 'cards', 'order', '订单导出.md'), '\n## 又一个自造小节\n略。\n')
    const r = runCli(root, '--json')
    assert.equal(r.status, 1)
    assert.deepEqual(JSON.parse(r.stdout).fresh, ['sections|cards/order/订单导出.md|多:又一个自造小节'])
    assert.equal(fs.readFileSync(path.join(ctxDir, BASELINE_FILE), 'utf8'), before)
  }, DIRTY)
})

test('--prune-baseline 只移除已修掉的条目，MUST NOT 把新违规加进基线', () => {
  withProject(({ root, ctxDir }) => {
    runCli(root, '--init-baseline')
    const file = path.join(ctxDir, 'cards', 'order', '订单导出.md')
    fs.writeFileSync(file, `${DOMAIN}\n## 新冒出来的小节\n略。\n`) // 旧违规修掉了，同时引入一条新的
    assert.deepEqual(compareWithBaseline(ctxDir).fixed, ['sections|cards/order/订单导出.md|多:本次核实'])
    assert.equal(runCli(root, '--prune-baseline').status, 0)
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ctxDir, BASELINE_FILE), 'utf8')).violations, [])
    assert.equal(runCli(root).status, 1, '新违规仍判红')
  }, DIRTY)
})

test('没有 cards/ 目录：打印"没有卡片可检"，退出 0', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-nocards-'))
  try {
    fs.mkdirSync(path.join(root, 'engineering-context'))
    const r = runCli(root)
    assert.equal(r.status, 0)
    assert.match(r.stdout, /没有卡片可检/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

// ── authority-unique ───────────────────────────────────────────────────────

function withDocs(docs, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-authority-'))
  try {
    fs.mkdirSync(path.join(root, 'docs', 'spec'), { recursive: true })
    const links = []
    for (const [name, { lifecycle = 'active', refs, archived = false }] of Object.entries(docs)) {
      const fm = `---\nlifecycle: ${lifecycle}\nauthority_refs:\n${refs.map((r) => `  - '${r}'`).join('\n')}\n---\n\n# ${name}\n`
      fs.writeFileSync(path.join(root, 'docs', 'spec', `${name}.md`), fm)
      links.push({ name, archived })
    }
    const line = (l) => `- [${l.name}](./spec/${l.name}.md)`
    fs.writeFileSync(path.join(root, 'docs', 'index.md'),
      `# 索引\n\n## 现行\n${links.filter((l) => !l.archived).map(line).join('\n')}\n\n## 归档\n${links.filter((l) => l.archived).map(line).join('\n')}\n`)
    return fn(root)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

const ask = (root, type = 'authority-unique') => answerProbe([], [], { n: '1', type, input: 'docs/index.md', expected: '' }, { root })

test('authority-unique：两份现行文档声明同一权威面即失败，并成对列出文件；中文别名同效', () => {
  withDocs({ a: { refs: ['`orders` 表的状态枚举'] }, b: { refs: ['orders  表的状态枚举', '导出列'] } }, (root) => {
    const r = ask(root)
    assert.equal(r.pass, false)
    assert.match(r.actual, /docs\/spec\/a\.md \+ docs\/spec\/b\.md/)
    assert.equal(ask(root, '权威面唯一').pass, false)
  })
})

test('authority-unique：`无`、非 active、归档区里的文档都不参与比对', () => {
  withDocs({
    a: { refs: ['无', '导出列'] },
    b: { refs: ['无'] },
    c: { lifecycle: 'merged', refs: ['导出列'] },
    d: { archived: true, refs: ['导出列'] },
  }, (root) => assert.equal(ask(root).pass, true))
})

test('authority-unique：现行区一篇文档都没链到时判失败——零条目不算通过', () => {
  withDocs({ d: { archived: true, refs: ['导出列'] } }, (root) => {
    const r = ask(root)
    assert.equal(r.pass, false)
    assert.match(r.actual, /NO-DOC-LINK/)
  })
})

// ── 评审门补的边界：读不出的卡、损坏的基线、存量单文件卡 ─────────────────────────

const LEGACY_SINGLE = `# 单文件卡

## 职责
订单服务。

## 引用原件预览
- \`src/export/columns.js#EXPORT_COLUMNS\`

## 引用原件预览与定位
- \`src/export/columns.js#EXPORT_COLUMNS\`
`

test('unreadable：读不出的域卡记一条违规，不从体检里无声消失', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
  withProject(({ ctxDir }) => {
    const file = path.join(ctxDir, 'cards', 'order', '订单导出.md')
    fs.chmodSync(file, 0o000)
    try {
      assert.ok(lintCards(ctxDir).violations.includes('unreadable|cards/order/订单导出.md|'))
    } finally {
      fs.chmodSync(file, 0o644)
    }
    assert.ok(!lintCards(ctxDir).violations.some((v) => v.startsWith('unreadable')), '读得出时不判')
  })
})

test('基线 JSON 损坏或缺 violations：退出码 2 并点名文件，MUST NOT 当成空基线继续', () => {
  for (const body of ['{ 不是 JSON', '{"version":1}']) {
    withProject(({ root, ctxDir }) => {
      fs.writeFileSync(path.join(ctxDir, BASELINE_FILE), body)
      const r = runCli(root)
      assert.equal(r.status, 2, body)
      assert.match(r.stderr, new RegExp(BASELINE_FILE.replace(/\./g, '\\.')), body)
      assert.equal(fs.readFileSync(path.join(ctxDir, BASELINE_FILE), 'utf8'), body, '损坏的基线不得被顺手重写')
    })
  }
})

test('存量单文件卡：固定小节之外的 `## ` 小节当业务域查近似重复；--init-baseline 列出按域拆分的建议', () => {
  withProject(({ root, ctxDir }) => {
    const v = lintCards(ctxDir).violations
    assert.ok(v.includes('domain-dup|cards/order.md|引用原件预览~引用原件预览与定位'), v.join('\n'))
    const init = runCli(root, '--init-baseline')
    assert.equal(init.status, 0)
    assert.match(init.stdout, /按业务域拆分的建议/)
    assert.match(init.stdout, /cards\/order\.md：引用原件预览、引用原件预览与定位/)
  }, { map: LEGACY_SINGLE, domains: {} })
})

test('已经拆成域卡的仓库：--init-baseline 不给拆分建议', () => {
  withProject(({ root }) => {
    assert.doesNotMatch(runCli(root, '--init-baseline').stdout, /按业务域拆分的建议/)
  })
})
