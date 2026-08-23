// 计数词防腐检查（FR-007 / AC-008 / AC-010，spec §4.3 计数词改写规则）。
//
// 为什么要有这份测试：`四轴` / `四道门` / `四问` / `七条"不裁剪"护栏` 这类**计数词**把一个
// 数字复制到十几个文件里。数字变了（新增一条轴、新增一道门、Triage 多一问）只有权威定义
// 文件会被改，其余复写处不会报任何错，只会让某条路径上的 agent 按旧数字执行——2.3.0 新增
// 文档轴时就是这么漏的。规则因此是：**除权威定义文件外一律改成指名引用**（"按
// `代码评审纪律.md` §四条轴 执行"），把数字收敛到唯一一处。
//
// 匹配方式 MUST 是**字面子串**，MUST NOT 分词、MUST NOT 模糊正则——这是 spec §4.3 豁免 2
// 的实现前提：小节名 `§四条轴` **不含**子串 `四轴`，所以"指名引用小节名"这个改写目标本身
// 不会被这条检查误伤；一旦改成分词/模糊匹配，改写后的正确形态反而会被判红，与规则互斥。
//
// 这条检查此刻**预期为红**（内容尚未改写），由 coding-plan Task 5 转绿；转绿后按 AC-010
// 做一次门禁自检：往任一非豁免文件写回计数词 → RED，改回 → GREEN。
//
// spec：docs/spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md §4.3 / §6 Invariant 5
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wfRoot = path.join(repoRoot, 'ai-dev-system', 'skills', 'ai-dev-workflow')

// 受检词表（闭集，spec §4.3）。`variants` 覆盖同一个词的引号写法差异：仓库现用直引号，
// 但弯引号 / 直角引号是中文写作里等价的常见变体，漏掉等于留了一条绕过通道。
// `authority` 是**唯一允许出现该数字的文件**（相对 wfRoot）：判定标准是"该数字的定义在此处、
// 别处只是引用"。`rewrite` 是失败信息里给出的目标形态。
const CHECKED_WORDS = [
  {
    word: '四轴',
    variants: ['四轴'],
    // 四条轴（规范/忠实/残留/文档）的定义与派发规则只在这一篇里定义，别处全是引用。
    authority: 'references/core/代码评审纪律.md',
    rewrite: '按 `代码评审纪律.md` §四条轴 执行（指名引用小节，MUST NOT 保留数字）',
  },
  {
    word: '四道门',
    variants: ['四道门'],
    // 四道门的清单与各门判据定义在总纲的 §四道门 一节。
    authority: 'references/core/00-流程总纲.md',
    rewrite: '按 `00-流程总纲.md` §四道门 执行（指名引用小节，MUST NOT 保留数字）',
  },
  {
    word: '四问',
    variants: ['四问'],
    // Triage 的判定问题清单定义在总纲的 §Step 0 一节，默认倾向也在总纲。
    authority: 'references/core/00-流程总纲.md',
    rewrite: '按 `00-流程总纲.md` §Step 0 Triage 的判定问题 / §默认倾向 指名引用（MUST NOT 保留数字）',
  },
  {
    word: '七条"不裁剪"护栏',
    variants: ['七条"不裁剪"护栏', '七条“不裁剪”护栏', '七条「不裁剪」护栏'],
    // 护栏条目本身逐条列在总纲的 §七条"不裁剪"护栏 一节。
    authority: 'references/core/00-流程总纲.md',
    rewrite: '按 `00-流程总纲.md` §"不裁剪"护栏 指名引用（MUST NOT 保留条数）',
  },
]

// 豁免清单（spec §4.3 的豁免 1 与豁免 3）：
//   1. `SKILL.md` 与 Lean 自足册 `路径-lean.md` —— 它们按设计必须复述这些内容（入口在没有
//      别的文件在手时就要判门；Lean 路径不读常驻篇），且按从属规则不可能是权威定义文件。
//   3. `assets/config-snippets/**` 整目录 —— 内容被注入**目标项目**的 CLAUDE.md/AGENTS.md，
//      读它的 AI 手边没有本 skill 的文件可跳转，"按某文件某小节执行"对它无法兑现；
//      2026-08-23 兼容取舍门已拍板保留原表述（spec §8.1）。
const EXEMPT_FILES = ['SKILL.md', 'references/core/路径-lean.md']
const EXEMPT_DIRS = ['assets/config-snippets/']

const isExempt = (rel) =>
  EXEMPT_FILES.includes(rel) || EXEMPT_DIRS.some((dir) => rel.startsWith(dir))

/** 递归收集 ai-dev-workflow/ 下的文本文件，返回 [相对 wfRoot 的路径（正斜杠）, 内容]。 */
function collectFiles() {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === '.git') continue
        walk(full)
        continue
      }
      if (!/\.(md|mjs|js|json)$/.test(entry)) continue
      // 相对路径统一成正斜杠，Windows 上 path.relative 会给反斜杠，直接比对会全部漏判。
      out.push([path.relative(wfRoot, full).split(path.sep).join('/'), readFileSync(full, 'utf8')])
    }
  }
  walk(wfRoot)
  return out
}

const FILES = collectFiles()

/** 在一份文件内找出某个词全部变体的字面出现位置，返回 [{ line, text, variant }]。 */
function findHits(body, variants) {
  const hits = []
  const lines = body.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    for (const variant of variants) {
      // 字面 includes —— 不用正则，避免任何模糊/分词语义混进来。
      if (lines[i].includes(variant)) {
        hits.push({ line: i + 1, text: lines[i].trim(), variant })
        break
      }
    }
  }
  return hits
}

test('受检计数词只出现在权威定义文件与豁免范围内', () => {
  const problems = []

  for (const { word, variants, authority, rewrite } of CHECKED_WORDS) {
    const offenders = []
    for (const [rel, body] of FILES) {
      if (rel === authority || isExempt(rel)) continue
      for (const hit of findHits(body, variants)) {
        offenders.push({ rel, ...hit })
      }
    }
    if (offenders.length === 0) continue

    const detail = offenders
      .map(({ rel, line, text, variant }) => {
        const snippet = text.length > 100 ? `${text.slice(0, 100)}…` : text
        return `    ${rel}:${line}  出现「${variant}」 | ${snippet}`
      })
      .join('\n')
    problems.push(
      [
        `计数词「${word}」在权威定义文件与豁免范围之外出现 ${offenders.length} 处（MUST 改成指名引用，判据 spec §4.3 / FR-007）：`,
        `    权威定义文件（唯一允许保留数字的位置）：${authority}`,
        `    豁免范围：${[...EXEMPT_FILES, ...EXEMPT_DIRS.map((d) => `${d}**`)].join('、')}`,
        `    应改成：${rewrite}`,
        '    逐处：',
        detail,
      ].join('\n'),
    )
  }

  assert.equal(
    problems.length,
    0,
    `\n${problems.join('\n\n')}\n\n（指名引用不含数字，因此改写后的形态不会被本检查命中：` +
      '小节名 `§四条轴` 不含子串 `四轴`。）\n',
  )
})

test('权威定义文件映射有效：每个受检词在它的权威文件里确有定义', () => {
  // 防映射漂移：权威文件被改名或数字被搬走时，上一条检查会静默变成"到处都不许出现"，
  // 看起来更严，实际是判据丢了。这里要求权威文件必须存在且确实含该词。
  for (const { word, variants, authority } of CHECKED_WORDS) {
    const full = path.join(wfRoot, ...authority.split('/'))
    assert.ok(existsSync(full), `受检词「${word}」的权威定义文件不存在：${authority}（映射需同步更新）`)
    const body = readFileSync(full, 'utf8')
    assert.ok(
      variants.some((v) => body.includes(v)),
      `受检词「${word}」在权威定义文件 ${authority} 中已不存在——定义搬走了就要同步改本测试的映射，` +
        'MUST NOT 让检查退化成"全仓禁用"。',
    )
  }
})

test('豁免清单里的路径确实存在：改名不得静默扩大检查面', () => {
  for (const rel of EXEMPT_FILES) {
    assert.ok(existsSync(path.join(wfRoot, ...rel.split('/'))), `豁免文件不存在（已改名？请同步本测试）：${rel}`)
  }
  for (const dir of EXEMPT_DIRS) {
    const full = path.join(wfRoot, ...dir.replace(/\/$/, '').split('/'))
    assert.ok(existsSync(full), `豁免目录不存在（已改名？请同步本测试）：${dir}`)
  }
})
