// 索引完整性机器闸。
//
// 为什么要有这份测试：`docs/index.md` 与 `docs/index-archive.md` 是本仓的**现行口径入口**——
// `ctx probe` 的 `requirement-reachable` / `rationale-traceable` 两道题、以及代码评审门 D 文档轴
// 的"断链与孤儿"一项，都以"从索引 ≤2 跳可达"为前提。而**索引是手工同步的**：新写一份 spec、
// 把一份 plan 标成 merged，都要人记得去改两个索引文件，漏改不会报任何错。2026-08-23 那轮评审
// 抓到的就是这一型：`docs/spec/2026-08-23-…-eng-spec.md` 与 `docs/plan/2026-08-23-…-coding-plan.md`
// 都是 `lifecycle: active` 却一个都不在 `index.md`，而「进行中的计划」区还写着"（暂无）"——
// 一篇活着的 spec 对零上下文 agent 而言等于不存在。同一轮还发现一篇 report 三个 frontmatter
// 字段全无。这两类都是机械可判的，判据见 CLAUDE.md §改动时注意「同一类问题被报到第二次，
// 就该有一条机器闸接手」。
//
// ── 判什么（四条，逐条对应 `文档治理.md` §文档生命周期与索引门控）──────────────────
//
//   1. `lifecycle: active`      → **MUST** 被 `docs/index.md` 链接到。
//   2. `merged`/`superseded`/`obsolete` → **MUST** 被 `docs/index-archive.md` 链接到，
//      且 **MUST NOT** 出现在 `docs/index.md`（现行索引只列现行口径，混进归档就是把已被取代的
//      口径重新摆上台面）。
//   3. 两份索引里链接到的仓库内 markdown **MUST** 真实存在（断链检查）。
//   4. **缺 `lifecycle` 字段单独报一条**，措辞写明这是「**字段缺失**」而不是「归类错误」——
//      两者的处置完全不同：缺字段要先按 `文档治理.md` §文档生命周期与索引门控 判一次这篇文档
//      现在算什么，再补 frontmatter；归类错误只要动索引。合并成一条会让人拿错处置方式。
//
// ── 关键口径：按**文件路径**匹配，不按标题文字 ─────────────────────────────────────
//
// 索引里的条目形如 `- **[渐进式披露与需求追溯](./spec/2026-08-23-…-eng-spec.md)** — …`。
// 判"这篇有没有被索引"只看括号里的路径：**标题会改**（改写措辞、加副标题、换称呼都不动文件），
// **路径是稳定标识**。拿标题去匹配会在纯文案改动后误报，而那正是最不该报的一类。
// 链接是相对 `docs/` 的（`./spec/x.md`），因此统一 resolve 成"相对仓库根、正斜杠"的形式再比——
// `path.relative` 在 Windows 给反斜杠，本仓已经因此栽过一次。
//
// ── 刻意不判的一条（已知缺口，不是漏网）───────────────────────────────────────────
//
// **不判「active 的文档 MUST NOT 出现在 index-archive.md」**。归档索引的「口径去了哪」一列
// 天然要指向接手的那份现行文档（`… 已被 [代码事实层强制化](./spec/…-eng-spec.md) 取代`），
// 那是**指路**不是**收录**。机器分不开这两种链接，硬判会把正确写法判红。
//
// 门禁自检：在隔离副本里把某篇 active 文档从 `index.md` 里摘掉 → 判红并点名文件与 lifecycle；
// 删掉某篇的 `lifecycle:` 行 → 报「字段缺失」而不是「归类错误」；把索引里的链接改成不存在的
// 路径 → 报断链。三条都改回去 → 转绿。自检 MUST 用这种方式做，MUST NOT 靠放宽匹配让它绿。
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsRoot = path.join(repoRoot, 'docs')

/** 受管目录：`文档治理.md` §硬规则 固定的三类落点。 */
const MANAGED_DIRS = ['spec', 'plan', 'report']

const INDEX_ACTIVE = 'docs/index.md'
const INDEX_ARCHIVE = 'docs/index-archive.md'

/** `lifecycle` 取值的闭集（`文档治理.md` §文档生命周期与索引门控）。 */
const ACTIVE = 'active'
const ARCHIVED = new Set(['merged', 'superseded', 'obsolete'])

/** 仓库内相对路径统一正斜杠。 */
const relPosix = (abs) => path.relative(repoRoot, abs).split(path.sep).join('/')

/** 读 frontmatter 的 `lifecycle`；没有 frontmatter 或没有该字段都返回 null。 */
function readLifecycle(abs) {
  const lines = readFileSync(abs, 'utf8').split('\n')
  if (lines[0].trim() !== '---') return null
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') break
    const m = /^lifecycle\s*:\s*(.+?)\s*$/.exec(lines[i])
    // 取值两种写法都在用（`lifecycle: active` 与 `lifecycle: 'merged'`），去引号后比。
    if (m) return m[1].replace(/^['"]|['"]$/g, '')
  }
  return null
}

/**
 * 受管目录下的全部 markdown（不递归子目录——本仓三类落点都是平铺的）。
 *
 * **只收 git 已跟踪的文件**，判据：受管的是**仓库的文档集**，而未跟踪文件不属于它——
 * 它可能是别人的本地草稿、另一个工具的输出、或还没决定要不要入库的材料。把它们算进来，
 * 等于让任何人在 `docs/` 下放一个临时文件就把**所有人**的闸判红，而那个人往往无权处置它。
 * 实测撞到过：主工作树里有一份别的工具产出的未跟踪报告（无 frontmatter），
 * 合并后验证当场变红，而正确处置是「这份文件归它的作者决定」，不是补字段或删文件。
 *
 * 反过来说：**`git add` 过就受管**（暂存区里的新文件同样被 `ls-files` 列出），
 * 所以"新建文档忘了写 lifecycle"这个真正要拦的场景照样拦得住——入库那一刻就判。
 */
export function collectDocs(rootDir) {
  const out = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (entry.isFile() && entry.name.endsWith('.md')) out.push(abs)
    }
  }
  walk(rootDir)
  return out
}

function collectManagedDocs() {
  const tracked = new Set(
    // `ls-files --cached` 列出的是索引里的文件——已提交的与 `git add` 过的新文件都在其中，
    // 未跟踪的不在。这正是"受管 = 属于仓库的文档集"要的那条线。
    execFileSync('git', ['ls-files', '--cached', '--', 'docs/'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean),
  )
  const out = []
  for (const dir of MANAGED_DIRS) {
    const absDir = path.join(docsRoot, dir)
    if (!existsSync(absDir)) continue
    for (const abs of collectDocs(absDir).sort()) {
      const entry = path.basename(abs)
      const rel = relPosix(abs)
      if (!tracked.has(rel)) continue
      out.push({ rel, abs, lifecycle: readLifecycle(abs) })
    }
  }
  return out
}

/**
 * 抽索引里的 markdown 链接目标，resolve 成"相对仓库根、正斜杠"。
 * 只收仓库内链接：http(s)、mailto、纯锚点都跳过。
 */
function collectLinks(indexRel) {
  const abs = path.join(repoRoot, ...indexRel.split('/'))
  const body = readFileSync(abs, 'utf8')
  const links = []
  for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const raw = m[1]
    if (/^(https?:|mailto:|#)/.test(raw)) continue
    const target = raw.split('#')[0]
    if (!target) continue
    const resolved = relPosix(path.resolve(path.dirname(abs), target))
    links.push({ raw, resolved })
  }
  return links
}

const DOCS = collectManagedDocs()
const ACTIVE_LINKS = collectLinks(INDEX_ACTIVE)
const ARCHIVE_LINKS = collectLinks(INDEX_ARCHIVE)
const activeSet = new Set(ACTIVE_LINKS.map((l) => l.resolved))
const archiveSet = new Set(ARCHIVE_LINKS.map((l) => l.resolved))

test('两个索引文件都在，且都抽得出链接（抽不到会让本闸凭空全绿）', () => {
  // 这道护栏钉的是"索引被改名/被清空/链接写法整体换掉"这类失效：链接集合为空时下面的
  // active 断言会全数判红（还好），但 archive 断言与断链检查会静默通过，数字错了没有信号。
  for (const rel of [INDEX_ACTIVE, INDEX_ARCHIVE]) {
    assert.ok(existsSync(path.join(repoRoot, ...rel.split('/'))), `索引文件缺失：${rel}`)
  }
  assert.ok(
    ACTIVE_LINKS.length > 0 && ARCHIVE_LINKS.length > 0,
    `索引里抽到的仓库内链接数为 现行 ${ACTIVE_LINKS.length} / 归档 ${ARCHIVE_LINKS.length}：`
      + '链接写法很可能已被改写（本闸只认 markdown 行内链接 `[文字](路径)`），此刻是空跑。',
  )
  assert.ok(
    DOCS.length > 0,
    `docs/{${MANAGED_DIRS.join(',')}}/ 下一篇 markdown 都没扫到——目录约定很可能已改，`
      + 'MUST 同步 MANAGED_DIRS 与 `文档治理.md` §硬规则。',
  )
})

test('每篇受管文档都带 lifecycle 字段（缺字段是字段缺失，不是归类错误）', () => {
  const missing = DOCS.filter((d) => d.lifecycle === null).map((d) => d.rel)
  assert.equal(
    missing.length,
    0,
    `以下 ${missing.length} 篇文档的 frontmatter 里读不到 \`lifecycle\` 字段——这是**字段缺失**，`
      + '不是归类错误：\n'
      + missing.map((r) => `    - ${r}`).join('\n')
      + '\n  处置：先按 `references/core/文档治理.md` §文档生命周期与索引门控 判一次这篇现在算什么，'
      + '再补 `lifecycle` / `last_confirmed` / `authority_refs` 三个字段，最后才动索引。'
      + 'MUST NOT 直接往索引里塞一行了事——没有字段就没有判据，下一次归档轮到它时还是判不了。',
  )
})

test('lifecycle 取值都在闭集内（自造取值会让分类检查静默漏掉这一篇）', () => {
  const known = new Set([ACTIVE, ...ARCHIVED])
  const weird = DOCS.filter((d) => d.lifecycle !== null && !known.has(d.lifecycle))
  assert.equal(
    weird.length,
    0,
    `以下文档的 \`lifecycle\` 取值不在闭集 {${[...known].join(' / ')}} 内：\n`
      + weird.map((d) => `    - ${d.rel}：lifecycle: ${d.lifecycle}`).join('\n')
      + '\n  取值闭集的权威定义在 `references/core/文档治理.md` §文档生命周期与索引门控。'
      + '取值漂了，下面两条分类检查会把这一篇整个跳过——看着全绿，实则判据已丢。'
      + '（易错点：字段名是 `lifecycle` 不是 `status`，后者的语义已被 lean-change-spec 的'
      + '`写作进度` 与 product-prd 的 `status` 占用。）',
  )
})

test('active 的文档都在现行索引里，归档的都在归档索引里且不在现行索引里', () => {
  const problems = []
  for (const d of DOCS) {
    if (d.lifecycle === null) continue // 已由「字段缺失」那条单独报，不重复计数
    if (d.lifecycle === ACTIVE) {
      if (!activeSet.has(d.rel)) {
        problems.push(
          `${d.rel}\n      lifecycle: active，但 ${INDEX_ACTIVE} 里没有任何链接指向它`
            + '\n      → 对零上下文 agent 而言这篇等于不存在（从入口文档跳不到）。'
            + `MUST 在 ${INDEX_ACTIVE} 对应分区补一行；分区还写着"（暂无）"时 MUST 一并删掉那行占位。`,
        )
      }
      continue
    }
    if (!ARCHIVED.has(d.lifecycle)) continue
    if (!archiveSet.has(d.rel)) {
      problems.push(
        `${d.rel}\n      lifecycle: ${d.lifecycle}，但 ${INDEX_ARCHIVE} 里没有任何链接指向它`
          + '\n      → 归档只降权、不移动、不删除，落不进归档索引就成了没人找得到的孤儿。'
          + `MUST 在 ${INDEX_ARCHIVE} 的年份表补一行，并写清"口径去了哪"。`,
      )
    }
    if (activeSet.has(d.rel)) {
      problems.push(
        `${d.rel}\n      lifecycle: ${d.lifecycle}，却仍被 ${INDEX_ACTIVE} 链接着`
          + '\n      → 现行索引只列现行口径，已被取代的挂在这里等于把旧口径重新摆上台面。'
          + `MUST 从 ${INDEX_ACTIVE} 移除该条目（文件留在原路径不动）。`,
      )
    }
  }

  console.log(
    `\n── 索引完整性实测 ──\n  受管文档 ${DOCS.length} 篇`
      + `（active ${DOCS.filter((d) => d.lifecycle === ACTIVE).length} /`
      + ` 归档 ${DOCS.filter((d) => d.lifecycle !== null && ARCHIVED.has(d.lifecycle)).length} /`
      + ` 无字段 ${DOCS.filter((d) => d.lifecycle === null).length}）；`
      + `现行索引链接 ${ACTIVE_LINKS.length} 条、归档索引链接 ${ARCHIVE_LINKS.length} 条。\n`,
  )

  assert.equal(
    problems.length,
    0,
    `索引与 lifecycle 不一致 ${problems.length} 处：\n`
      + problems.map((p, i) => `    [${i + 1}] ${p}`).join('\n\n'),
  )
})

test('两个索引里的链接都指向真实存在的文件（断链检查）', () => {
  const problems = []
  for (const [indexRel, links] of [[INDEX_ACTIVE, ACTIVE_LINKS], [INDEX_ARCHIVE, ARCHIVE_LINKS]]) {
    for (const l of links) {
      if (existsSync(path.join(repoRoot, ...l.resolved.split('/')))) continue
      problems.push(`${indexRel} → \`${l.raw}\`（resolve 成 ${l.resolved}）：目标文件不存在`)
    }
  }
  assert.equal(
    problems.length,
    0,
    `索引里有 ${problems.length} 条断链——顺着索引跳过去会扑空：\n`
      + problems.map((p, i) => `    [${i + 1}] ${p}`).join('\n')
      + '\n  处置：文档改名或移动后 MUST 同步两个索引；归档只降权不移动，出现断链一般说明文件被真删了。',
  )
})

test('索引检查递归到子目录', () => {
  const dir = path.join(repoRoot, '.tmp-doc-index-test')
  mkdirSync(path.join(dir, 'spec', '2026-08-27-某次大产出'), { recursive: true })
  writeFileSync(path.join(dir, 'spec', '2026-08-27-某次大产出', 'part-a.md'), '# 无 frontmatter\n')
  try {
    const found = collectDocs(path.join(dir, 'spec'))
    assert.ok(found.some((p) => p.endsWith('part-a.md')), '递归没生效，子目录里的文档整体逃出了检查')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
