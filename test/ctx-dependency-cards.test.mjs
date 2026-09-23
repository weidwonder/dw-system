// 依赖仓事实卡 `dependencies/<上游名>/<域>.md`：读取层、get-card 四级查找、检索来源标记、体检规则。
// 契约：docs/spec/2026-09-22-dw-system-依赖仓事实卡-eng-spec.md §2 ~ §4（FR-001 ~ FR-020）。
//
// 每条新规则各配一个必红样本与一个必绿样本：规则写错成恒绿时，必红样本会先红。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  loadAllCards,
  loadCards,
  loadDependencies,
  loadDependencyCards,
  loadDomainCards,
  dependencyFreshness,
  unreadableCards,
} from '../dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js'
import { discover, getCard } from '../dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js'
import { BUDGET, lintCards } from '../dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js'
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

/** 依赖仓事实卡：四节固定，cite 指向上游仓库里的路径（本项目不存在）。 */
const DEP_CARD = `# 依赖仓事实卡 — agent_fs › 向量库

## 职责
语义检索的存储层。

## 权威实现与对外接口

| 能力 | 权威实现 | 约束 |
|---|---|---|
| 向量写入 | \`packages/search/src/vector-store/store.ts#VectorStore\` | 清理窗口 MUST NOT 为 0 |

## 陷阱项

- \`LegacyVectorIndex\` — 已删除，改用 \`VectorStore\`

## 确认
2026-09-03｜读过 packages/search/src/vector-store/
`

/** 依赖声明：最小五项 + 业务域地图。「上游与当前版本」行故意带形似日期的版本串。 */
const DEP_DECL = `# 依赖声明：agent_fs

- 上游与当前版本：agent_fs @ 1.2.3-2019-01-01
- 确认时间：2026-09-05

## 用到的部分

| 接口名 | 调用点（文件:行） | 注意事项 |
|---|---|---|
| VectorStore | src/index/build.js:12 | 清理窗口不能传 0 |

## 业务域地图

| 业务域 | 一句话 | 事实卡 |
|---|---|---|
| 向量库 | 语义检索的存储层 | \`dependencies/agent_fs/向量库.md\` |
`

/**
 * 建一个临时项目：产品侧一张地图卡 + 一张域卡，依赖侧按参数放声明与事实卡。
 * `deps` 形如 `{ agent_fs: { decl, cards: { 向量库: DEP_CARD } } }`；`decl` 为 null 表示不写声明文件。
 */
function withProject(fn, { map = MAP, domains = { 订单导出: DOMAIN }, deps = {}, registry = null, extraFiles = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-dep-'))
  try {
    const ctxDir = path.join(root, 'engineering-context')
    fs.mkdirSync(path.join(ctxDir, 'cards', 'order'), { recursive: true })
    if (map !== null) fs.writeFileSync(path.join(ctxDir, 'cards', 'order.md'), map)
    for (const [name, body] of Object.entries(domains)) fs.writeFileSync(path.join(ctxDir, 'cards', 'order', `${name}.md`), body)
    fs.mkdirSync(path.join(ctxDir, 'dependencies'), { recursive: true })
    for (const [upstream, { decl = DEP_DECL, cards = {} }] of Object.entries(deps)) {
      if (decl !== null) fs.writeFileSync(path.join(ctxDir, 'dependencies', `${upstream}.md`), decl)
      if (cards !== null) {
        fs.mkdirSync(path.join(ctxDir, 'dependencies', upstream), { recursive: true })
        for (const [name, body] of Object.entries(cards)) fs.writeFileSync(path.join(ctxDir, 'dependencies', upstream, `${name}.md`), body)
      }
    }
    for (const [rel, body] of Object.entries(extraFiles)) {
      const abs = path.join(ctxDir, ...rel.split('/'))
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, body)
    }
    if (registry !== null) fs.writeFileSync(path.join(ctxDir, 'capability-registry.md'), registry)
    fs.mkdirSync(path.join(root, 'src', 'export'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src', 'export', 'columns.js'), 'export const EXPORT_COLUMNS = []\n')
    return fn({ root, ctxDir })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

const AGENT_FS = { agent_fs: { cards: { 向量库: DEP_CARD } } }
const posix = (p) => p.split(path.sep).join('/')

// ── 读取层 ──────────────────────────────────────────────────────────────────

test('loadDependencyCards 读出 dependencies/<上游名>/<域>.md，三字段与路径一致', () => {
  withProject(({ ctxDir }) => {
    const deps = loadDependencyCards(ctxDir)
    assert.deepEqual(deps.map((d) => [d.service, d.domain, posix(d.path)]), [['agent_fs', '向量库', 'dependencies/agent_fs/向量库.md']])
    assert.ok(deps[0].raw.includes('VectorStore'))
    assert.equal(deps[0].sections['职责'], '语义检索的存储层。')
  }, { deps: AGENT_FS })
})

test('origin 是闭集两值，由三个读取函数各自显式赋值', () => {
  withProject(({ ctxDir }) => {
    assert.deepEqual([...new Set(loadCards(ctxDir).map((c) => c.origin))], ['product'])
    assert.deepEqual([...new Set(loadDomainCards(ctxDir).map((c) => c.origin))], ['product'])
    assert.deepEqual([...new Set(loadDependencyCards(ctxDir).map((c) => c.origin))], ['dependency'])
    for (const card of loadAllCards(ctxDir)) {
      assert.ok(card.origin === 'product' || card.origin === 'dependency', `origin 越出闭集：${card.origin}`)
    }
  }, { deps: AGENT_FS })
})

test('loadAllCards = 产品地图卡 → 产品域卡 → 依赖仓事实卡，长度等于三者之和', () => {
  withProject(({ ctxDir }) => {
    const all = loadAllCards(ctxDir)
    assert.equal(all.length, loadCards(ctxDir).length + loadDomainCards(ctxDir).length + loadDependencyCards(ctxDir).length)
    assert.deepEqual(all.map((c) => `${c.origin}:${c.service}${c.domain ? `/${c.domain}` : ''}`), [
      'product:order',
      'product:order/订单导出',
      'dependency:agent_fs/向量库',
    ])
  }, { deps: AGENT_FS })
})

test('loadDependencies 读声明文件、忽略 README（大小写不敏感），且 MUST NOT 混进 loadAllCards', () => {
  withProject(({ ctxDir }) => {
    assert.deepEqual(loadDependencies(ctxDir).map((d) => [d.upstream, posix(d.path)]), [['agent_fs', 'dependencies/agent_fs.md']])
    assert.ok(!loadAllCards(ctxDir).some((c) => posix(c.path) === 'dependencies/agent_fs.md'), '声明不是卡，混进检索会把"我们调了它什么"错报成外部事实')
  }, { deps: AGENT_FS, extraFiles: { 'dependencies/README.md': '# 依赖声明目录\n\n向量库 清理窗口\n', 'dependencies/readme.md': '# 小写也忽略\n' } })
})

test('dependencies/README.md 不产生卡、也不被 discover 命中', () => {
  withProject(({ ctxDir }) => {
    assert.ok(!loadDependencyCards(ctxDir).some((c) => /readme/i.test(c.service) || /readme/i.test(c.domain)))
    assert.ok(!discover(ctxDir, '目录说明 索引').cards.some((c) => /readme/i.test(c.service)))
    assert.equal(getCard(ctxDir, 'README'), null, 'ctx get-card README MUST 退出 1')
  }, { deps: AGENT_FS, extraFiles: { 'dependencies/README.md': '# 依赖声明目录\n\n目录说明 索引\n' } })
})

test('dependencies/ 不存在时两个读取函数都返回 []，不抛', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-nodep-'))
  try {
    const ctxDir = path.join(root, 'engineering-context')
    fs.mkdirSync(ctxDir, { recursive: true })
    assert.deepEqual(loadDependencyCards(ctxDir), [])
    assert.deepEqual(loadDependencies(ctxDir), [])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('只下探一层：dependencies/<名>/<子目录>/x.md 不是事实卡', () => {
  withProject(({ ctxDir }) => {
    assert.deepEqual(loadDependencyCards(ctxDir).map((d) => d.domain), ['向量库'], '递归会让域名与路径失去唯一解')
  }, { deps: AGENT_FS, extraFiles: { 'dependencies/agent_fs/更深/再一层.md': DEP_CARD } })
})

test('dependencyFreshness 取「确认时间」行，MUST NOT 取「上游与当前版本」里形似日期的版本串', () => {
  assert.equal(dependencyFreshness(DEP_DECL), '2026-09-05')
  const noConfirm = DEP_DECL.replace('- 确认时间：2026-09-05\n', '')
  assert.notEqual(dependencyFreshness(DEP_DECL), '2019-01-01', '版本串里的日期不是确认时间')
  assert.equal(dependencyFreshness(noConfirm), '2019-01-01', '没有「确认时间」行才退回全文第一个日期')
  assert.equal(dependencyFreshness('# 空声明\n'), '未声明新鲜度')
})

// ── get-card 四级查找 ───────────────────────────────────────────────────────

test('get-card <上游名>：无产品卡时返回依赖声明全文，cite 取「确认时间」行', () => {
  withProject(({ ctxDir }) => {
    const r = getCard(ctxDir, 'agent_fs')
    assert.ok(r.content.includes('用到的部分'))
    assert.match(posix(r.cite), /dependencies\/agent_fs\.md#全文 @2026-09-05/)
    assert.ok(!r.missing)
  }, { deps: AGENT_FS })
})

test('get-card <名>：同名产品地图卡优先，并提示另有依赖声明', () => {
  withProject(({ ctxDir }) => {
    const r = getCard(ctxDir, 'order')
    assert.ok(r.content.includes('订单服务。'))
    assert.match(posix(r.cite), /cards\/order\.md#全文/)
    assert.equal(r.alsoDependency, true)
  }, { deps: { order: { decl: DEP_DECL.replace('agent_fs', 'order'), cards: {} } } })
})

test('get-card <名>：只有产品地图卡时不谎报另有依赖声明', () => {
  withProject(({ ctxDir }) => assert.ok(!getCard(ctxDir, 'order').alsoDependency))
})

test('get-card <上游名>：只有事实卡、没有声明文件时不发 cite，available 列出事实卡域名', () => {
  withProject(({ ctxDir }) => {
    const r = getCard(ctxDir, 'agent_fs')
    assert.equal(r.cite, null)
    assert.equal(r.missing, true)
    assert.ok(r.available.includes('向量库[依赖]'), r.available.join(', '))
  }, { deps: { agent_fs: { decl: null, cards: { 向量库: DEP_CARD } } } })
})

test('get-card <上游名> <域>：命中依赖仓事实卡，cite 指向它并取它自己的确认日期', () => {
  withProject(({ ctxDir }) => {
    const r = getCard(ctxDir, 'agent_fs', '向量库')
    assert.ok(r.content.includes('VectorStore'))
    assert.match(posix(r.cite), /dependencies\/agent_fs\/向量库\.md#全文 @2026-09-03/)
  }, { deps: AGENT_FS })
})

test('get-card <名> <域>：产品域卡与依赖仓事实卡同名时取产品域卡（顺序写死，产品仓优先）', () => {
  withProject(({ ctxDir }) => {
    const r = getCard(ctxDir, 'order', '订单导出')
    assert.ok(r.content.includes('EXPORT_COLUMNS'), '本项目自己的事实是第一顺位')
    assert.match(posix(r.cite), /cards\/order\/订单导出\.md#全文/)
  }, { deps: { order: { decl: DEP_DECL.replace('agent_fs', 'order'), cards: { 订单导出: DEP_CARD } } } })
})

test('get-card <上游名> <小节名>：四级顺序的第四级——依赖声明里的同名 ## 小节', () => {
  withProject(({ ctxDir }) => {
    const r = getCard(ctxDir, 'agent_fs', '用到的部分')
    assert.ok(r.content.includes('src/index/build.js:12'))
    assert.match(posix(r.cite), /dependencies\/agent_fs\.md#用到的部分 @2026-09-05/)
  }, { deps: AGENT_FS })
})

test('get-card 四处皆无：不发 cite，available 里依赖侧条目带 [依赖] 标注', () => {
  withProject(({ ctxDir }) => {
    const r = getCard(ctxDir, 'agent_fs', '不存在的域')
    assert.equal(r.cite, null)
    assert.equal(r.missing, true)
    assert.ok(r.available.includes('向量库[依赖]'), `事实卡域名要标来源：${r.available.join(', ')}`)
    assert.ok(r.available.includes('用到的部分[依赖]'), '声明小节名同样标来源')
  }, { deps: AGENT_FS })
})

// ── 检索：discover / search-semantic 区分来源 ────────────────────────────────

test('只写在依赖仓事实卡里的符号能被 discover 命中，结果带 origin', () => {
  withProject(({ ctxDir }) => {
    const r = discover(ctxDir, 'VectorStore 清理窗口')
    const hit = r.cards.find((c) => c.service === 'agent_fs' && c.domain === '向量库')
    assert.ok(hit, '只写在依赖仓事实卡里的符号 MUST 能被 discover 命中')
    assert.equal(hit.origin, 'dependency')
    const p = discover(ctxDir, 'EXPORT_COLUMNS').cards.find((c) => c.domain === '订单导出')
    assert.equal(p.origin, 'product')
  }, { deps: AGENT_FS })
})

test('依赖仓事实卡的〈陷阱项〉逐条进 out-of-scope，指称带 [依赖]；产品域卡不带', () => {
  withProject(({ ctxDir }) => {
    const r = discover(ctxDir, 'VectorStore EXPORT_COLUMNS')
    assert.ok(r.outOfScope.some((l) => l.includes('LegacyVectorIndex') && l.includes('[依赖] agent_fs › 向量库')), r.outOfScope.join('\n'))
    assert.ok(r.outOfScope.some((l) => l.includes('legacyExport') && l.includes('order › 订单导出') && !l.includes('[依赖]')))
  }, { deps: AGENT_FS })
})

test('search-semantic 的候选集含依赖仓事实卡，结果带 origin', () => {
  withProject(({ ctxDir }) => {
    const s = searchSemantic(ctxDir, '向量库 清理窗口', { top: 10 })
    const hit = s.results.find((x) => x.service === 'agent_fs')
    assert.ok(hit, '依赖仓事实卡 MUST 进语义检索候选集')
    assert.equal(hit.origin, 'dependency')
    assert.ok(s.results.filter((x) => x.service === 'order').every((x) => x.origin === 'product'))
  }, { deps: AGENT_FS })
})

test('CLI 人读：discover 与 search-semantic 的依赖仓命中行带 [依赖] 前缀', () => {
  withProject(({ root }) => {
    const d = spawnSync(process.execPath, [cli, 'discover', 'VectorStore EXPORT_COLUMNS'], { cwd: root, encoding: 'utf8' })
    assert.match(d.stdout, /^• \[依赖\] agent_fs › 向量库/m, d.stdout)
    assert.match(d.stdout, /^• order › 订单导出/m, '产品仓无前缀')
    const s = spawnSync(process.execPath, [cli, 'search-semantic', '向量库 清理窗口', '--top', '10'], { cwd: root, encoding: 'utf8' })
    assert.match(s.stdout, /^• \[依赖\] agent_fs\/向量库 › /m, s.stdout)
  }, { deps: AGENT_FS })
})

test('依赖仓事实卡不吃 registry 加权、也不被分数惩罚', () => {
  withProject(({ ctxDir }) => {
    const r = discover(ctxDir, 'VectorStore')
    const hit = r.cards.find((c) => c.service === 'agent_fs')
    assert.equal(hit.why, '文本命中', 'registry 加权只给地图卡；依赖仓事实卡都带 domain，走既有分支')
    assert.equal(hit.score, 1, '标记已足够区分来源，MUST NOT 再做分数折扣')
  }, { deps: AGENT_FS, registry: '| Capability | 权威仓库 | 权威实现 | 陷阱项 |\n|---|---|---|---|\n| 向量检索 | agent_fs | VectorStore | 无 |\n' })
})

// ── lint-cards：依赖仓事实卡的体检规则 ───────────────────────────────────────

const depViolations = (ctxDir) => lintCards(ctxDir).violations.filter((v) => v.includes('dependencies/'))

test('合规的依赖声明 + 依赖仓事实卡：零违规', () => {
  withProject(({ ctxDir }) => assert.deepEqual(lintCards(ctxDir).violations, []), { deps: AGENT_FS })
})

test('sections：依赖仓事实卡缺必备小节、自造小节各判一条；四节齐全不判', () => {
  withProject(({ ctxDir }) => {
    const v = depViolations(ctxDir)
    assert.ok(v.includes('sections|dependencies/agent_fs/向量库.md|缺:陷阱项'), v.join('\n'))
    assert.ok(v.includes('sections|dependencies/agent_fs/向量库.md|多:本次核实'))
  }, { deps: { agent_fs: { cards: { 向量库: DEP_CARD.replace(/## 陷阱项[\s\S]*?(?=## 确认)/, '## 本次核实\n读了一遍。\n\n') } } } })
  withProject(({ ctxDir }) => {
    assert.deepEqual(depViolations(ctxDir), [], '四节齐全 + 可选节不判')
  }, { deps: { agent_fs: { cards: { 向量库: DEP_CARD.replace('## 确认', '## 测试入口\n上游自己的用例。\n\n## 确认') } } } })
})

test('sections MUST NOT 施加于依赖声明文件本身', () => {
  withProject(({ ctxDir }) => {
    assert.ok(!depViolations(ctxDir).some((v) => v.startsWith('sections|dependencies/agent_fs.md')), '声明不是卡，不受四节约束')
  }, { deps: AGENT_FS })
})

test('budget：依赖仓事实卡复用域卡上限；不超不判', () => {
  const pad = (n) => `\n${'填'.repeat(Math.ceil(n / 3))}\n`
  withProject(({ ctxDir }) => {
    assert.ok(depViolations(ctxDir).includes('budget|dependencies/agent_fs/向量库.md|'))
  }, { deps: { agent_fs: { cards: { 向量库: DEP_CARD.replace('语义检索的存储层。', `语义检索的存储层。${pad(BUDGET.domain)}`) } } } })
  withProject(({ ctxDir }) => {
    assert.ok(!depViolations(ctxDir).some((v) => v.startsWith('budget')))
  }, { deps: AGENT_FS })
})

test('dated-heading：依赖仓事实卡带日期的小节名判红，正文里的日期不判', () => {
  withProject(({ ctxDir }) => {
    assert.deepEqual(depViolations(ctxDir).filter((v) => v.startsWith('dated-heading')), ['dated-heading|dependencies/agent_fs/向量库.md|2026-08-20 修复'])
  }, { deps: { agent_fs: { cards: { 向量库: DEP_CARD.replace('## 确认', '### 2026-08-20 修复\n经过略。\n\n## 确认') } } } })
  withProject(({ ctxDir }) => {
    assert.ok(!depViolations(ctxDir).some((v) => v.startsWith('dated-heading')), '〈确认〉正文里的日期不判')
  }, { deps: AGENT_FS })
})

test('trap-noise：依赖仓事实卡陷阱项里的"仍在维护"判红；引用块不判', () => {
  withProject(({ ctxDir }) => {
    const v = depViolations(ctxDir).filter((x) => x.startsWith('trap-noise'))
    assert.equal(v.length, 1)
    assert.ok(v[0].includes('VectorStoreV2'))
  }, { deps: { agent_fs: { cards: { 向量库: DEP_CARD.replace('- `LegacyVectorIndex`', '> "仍在维护"这类话不要写进来\n\n- `VectorStoreV2` 仍在维护，非废弃\n- `LegacyVectorIndex`') } } } })
})

test('domain-dup：同一上游内域名近似重复判红；跨上游同名不判', () => {
  withProject(({ ctxDir }) => {
    assert.deepEqual(depViolations(ctxDir).filter((v) => v.startsWith('domain-dup')), ['domain-dup|dependencies/agent_fs|向量存储~向量存储历史'])
  }, { deps: { agent_fs: { cards: { 向量存储: DEP_CARD, 向量存储历史: DEP_CARD } } } })
  withProject(({ ctxDir }) => {
    assert.ok(!depViolations(ctxDir).some((v) => v.startsWith('domain-dup')), '两个上游各有一张同名卡不是重复')
  }, { deps: { agent_fs: { cards: { 向量库: DEP_CARD } }, other_repo: { decl: DEP_DECL.replace(/agent_fs/g, 'other_repo'), cards: { 向量库: DEP_CARD } } } })
})

test('cite：依赖仓事实卡整卡跳过；同一段 cite 写进产品域卡判红（豁免没把产品侧一起放过）', () => {
  const badCite = '`packages/search/src/vector-store/store.ts#VectorStore`'
  withProject(({ ctxDir }) => {
    assert.ok(!lintCards(ctxDir).violations.some((v) => v.startsWith('cite')), '上游源码不在本项目里，cite 无从校验')
  }, { deps: AGENT_FS })
  withProject(({ ctxDir }) => {
    const v = lintCards(ctxDir).violations.filter((x) => x.startsWith('cite'))
    assert.deepEqual(v, ['cite|cards/order/订单导出.md|packages/search/src/vector-store/store.ts#VectorStore'], '产品域卡里同样的 cite MUST 判违规')
  }, { domains: { 订单导出: DOMAIN.replace('`src/export/columns.js#EXPORT_COLUMNS`', badCite) }, deps: AGENT_FS })
})

// 依赖侧那一行**故意指向一个不存在的文件**：规则一旦被扩到 `dependencies/`，这条立刻判红。
// 指向存在的文件会让本条恒绿——扩面了也照样查得到那个文件，断言永远成立。
// 产品侧那一行指向真实存在的域卡，是绿样本：证明规则本身在跑，且没有误伤产品侧的合法指针。
test('依赖侧不施加 registry-pointer 与 splitSuggestions', () => {
  const registry = '| Capability | 权威实现 | 陷阱项 |\n|---|---|---|\n'
    + '| 向量检索 | 见 `dependencies/agent_fs/检索缓存.md` | 无 |\n'
    + '| 订单导出 | 见 `cards/order/订单导出.md` | 无 |\n'
  withProject(({ ctxDir }) => {
    assert.ok(!fs.existsSync(path.join(ctxDir, 'dependencies', 'agent_fs', '检索缓存.md')), '依赖侧样本必须指向不存在的文件，否则本条恒绿')
    assert.ok(fs.existsSync(path.join(ctxDir, 'cards', 'order', '订单导出.md')), '产品侧绿样本指向的域卡必须真实存在')
    assert.ok(!lintCards(ctxDir).violations.some((v) => v.startsWith('registry-pointer')), 'registry 不该指向依赖仓事实卡，规则也不扩到 dependencies/')
  }, { deps: AGENT_FS, registry })
})

// ── lint-cards：缺依赖声明与依赖侧 unreadable ────────────────────────────────

test('缺依赖声明：有事实卡目录而无同名 .md 判一条；两者都在不判', () => {
  withProject(({ ctxDir }) => {
    assert.ok(depViolations(ctxDir).includes('sections|dependencies/agent_fs|缺依赖声明'))
  }, { deps: { agent_fs: { decl: null, cards: { 向量库: DEP_CARD } } } })
  withProject(({ ctxDir }) => {
    assert.ok(!depViolations(ctxDir).some((v) => v.endsWith('缺依赖声明')))
  }, { deps: AGENT_FS })
})

test('空的 dependencies/<名>/ 目录不判缺依赖声明——空目录是常见 git 残留，判红是噪音', () => {
  withProject(({ ctxDir }) => {
    assert.deepEqual(depViolations(ctxDir), [])
  }, { deps: { agent_fs: { decl: null, cards: {} } } })
})

test('声明缺〈业务域地图〉节而目录下有卡：不判——产品侧也没有"域没登记进地图表"这条规则', () => {
  withProject(({ ctxDir }) => {
    assert.deepEqual(depViolations(ctxDir), [])
  }, { deps: { agent_fs: { decl: DEP_DECL.replace(/## 业务域地图[\s\S]*$/, ''), cards: { 向量库: DEP_CARD } } } })
})

test('unreadable：dependencies/ 下读不出的声明与事实卡各记一条，路径以 dependencies/ 开头',
  { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
    withProject(({ ctxDir }) => {
      const decl = path.join(ctxDir, 'dependencies', 'agent_fs.md')
      const card = path.join(ctxDir, 'dependencies', 'agent_fs', '向量库.md')
      fs.chmodSync(decl, 0o000)
      fs.chmodSync(card, 0o000)
      try {
        const v = lintCards(ctxDir).violations
        assert.ok(v.includes('unreadable|dependencies/agent_fs.md|'), v.join('\n'))
        assert.ok(v.includes('unreadable|dependencies/agent_fs/向量库.md|'))
        assert.ok(unreadableCards(ctxDir).every((p) => p.startsWith('cards/') || p.startsWith('dependencies/')), '路径 MUST 以 engineering-context/ 为根')
      } finally {
        fs.chmodSync(decl, 0o644)
        fs.chmodSync(card, 0o644)
      }
      assert.ok(!lintCards(ctxDir).violations.some((v) => v.startsWith('unreadable')), '读得出时不判')
    }, { deps: AGENT_FS })
  })

// ── CLI 端到端 ──────────────────────────────────────────────────────────────

test('ctx get-card <上游名> 退出 0；--json 的 origin 在 discover 与 search-semantic 里都在', () => {
  withProject(({ root }) => {
    const g = spawnSync(process.execPath, [cli, 'get-card', 'agent_fs'], { cwd: root, encoding: 'utf8' })
    assert.equal(g.status, 0, g.stderr)
    assert.match(posix(g.stdout), /dependencies\/agent_fs\.md#全文 @2026-09-05/)
    const d = JSON.parse(spawnSync(process.execPath, [cli, 'discover', 'VectorStore', '--json'], { cwd: root, encoding: 'utf8' }).stdout)
    assert.ok(d.cards.some((c) => c.origin === 'dependency'))
    const s = JSON.parse(spawnSync(process.execPath, [cli, 'search-semantic', '向量库 清理窗口', '--top', '10', '--json'], { cwd: root, encoding: 'utf8' }).stdout)
    assert.ok(s.results.some((x) => x.origin === 'dependency'))
    const miss = spawnSync(process.execPath, [cli, 'get-card', 'agent_fs', '不存在的域'], { cwd: root, encoding: 'utf8' })
    assert.equal(miss.status, 1)
    assert.match(miss.stdout, /向量库\[依赖\]/)
  }, { deps: AGENT_FS })
})
