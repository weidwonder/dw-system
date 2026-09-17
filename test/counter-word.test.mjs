// 计数词防腐检查（FR-007 / AC-008 / AC-010，spec §4.3 计数词改写规则）。
//
// 为什么要有这份测试：`四轴` / `五道门` / `四问` / `七条"不裁剪"护栏` 这类**计数词**把一个
// 数字复制到十几个文件里。数字变了（新增一条轴、新增一道门、Triage 多一问）只有权威定义
// 文件会被改，其余复写处不会报任何错，只会让某条路径上的 agent 按旧数字执行——2.3.0 新增
// 文档轴时就是这么漏的。规则因此是：**除权威定义文件外一律改成指名引用**（"按
// `代码评审纪律.md` §四条轴 执行"），把数字收敛到唯一一处。
//
// 匹配方式 MUST 是**字面子串**，MUST NOT 分词、MUST NOT 模糊正则——这是 spec §4.3 豁免 2
// 的实现前提：小节名 `§四条轴` **不含**子串 `四轴`，所以"指名引用小节名"这个改写目标本身
// 不会被这条检查误伤；一旦改成分词/模糊匹配，改写后的正确形态反而会被判红，与规则互斥。
//
// 门禁自检（AC-010）：往任一**非豁免**文件（如 `references/core/文档治理.md`）里写回一个受检
// 计数词（如把某处指名引用改回"按四轴执行"）→ 本检查判红并逐处点名；改回指名引用 → 转绿。
// 自检 MUST 用这种方式做，MUST NOT 靠放宽词表或扩大豁免清单让它绿。
//
// 作用域：只遍历 `dw-workflow/`（下方 wfRoot）。姊妹 skill `dw-prd/` **尚未收敛**——
// `dw-prd/references/prd复核纪律.md` 里仍有 `四轴`×2，另有 `四问`×1。这是
// spec §1「不做什么」划定的范围，不是漏网：`dw-prd` 待后续版本另开一次收敛。MUST NOT 把
// 本闸全绿读成"全仓计数词已收敛"。
//
// spec：docs/spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md §4.3 / §6 Invariant 5
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

// 豁免清单（spec §4.3 的豁免 1 与豁免 3）住在共用模块里：`cards-mandatory.test.mjs` 的护栏
// 取值闸用的是同一份，两边各抄一遍会静默漂移。逐条理由见该文件。
import { EXEMPT_DIRS, EXEMPT_FILES } from './counter-word-exempt.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wfRoot = path.join(repoRoot, 'dw-system', 'skills')

// 受检词表（闭集，spec §4.3）。`variants` 覆盖同一个词的引号写法差异：仓库现用直引号，
// 但弯引号 / 直角引号是中文写作里等价的常见变体，漏掉等于留了一条绕过通道。
// `authority` 是**唯一允许出现该数字的文件**（相对 wfRoot）：判定标准是"该数字的定义在此处、
// 别处只是引用"。`rewrite` 是失败信息里给出的目标形态。
const CHECKED_WORDS = [
  {
    word: '四轴',
    variants: ['四轴'],
    // 2.15.0 起轴集合不再固定为四条——它按本次改动触碰的对象面推导（P → 规范/忠实/残留/文档，
    // K → skill 原则轴，G → agent 架构轴，取并集）。「四轴」因此降为**纯过时值**，与 `四道门`
    // 之于 `五道门` 同性质：不再有任何文件有资格写它，**包括原先的权威文件**。
    // authority 为 null 即表示"全仓禁用、无权威定义处"，下方反向护栏对这类词改判"全仓零出现"。
    authority: null,
    rewrite: '轴集合按对象面推导，改成指名引用 `评审轴.md` §评审轴 或 `评审门禁.md` §门禁（MUST NOT 保留数字）',
  },
  {
    word: '五道门',
    variants: ['五道门', '四道门'],
    // 五道门的清单与各门判据定义在总纲的 §五道门 一节。
    // `四道门` 留在 variants 里不是笔误：2.11.0 新增 spec 过稿门后它是**过时值**，
    // 别处残留一处就是一条按旧数字执行的路径，因此与新值同受本闸管辖。
    authority: 'dw-workflow/references/00-流程总纲.md',
    // 注意：这一条与 `四轴` 的情形不同。`四轴` 的权威小节名叫 §四条轴，天然不含子串
    // `四轴`，所以"指名引用小节名"直接成立；而 `五道门` 的权威小节名**字面就是**
    // `## 五道门（…）`，引用写成 `§五道门` 仍含受检子串、照样判红。因此改写目标是
    // **指名引用具体那一道门的小节**（§兼容取舍确认门 / §代码评审门 / §完成与自动合并门），
    // 而不是引用那张总表。这不是绕过：引用方要的本来就是某一道门的判据，不是"一共几道"。
    rewrite: '指名引用具体那道门的小节（如 `00-流程总纲.md` §兼容取舍确认门），MUST NOT 用含数字的 §五道门',
  },
  {
    word: '四问',
    variants: ['四问'],
    // Triage 的判定问题清单定义在总纲的 §Step 0 一节，默认倾向也在总纲。
    // 下面 rewrite 里的 `§Step 0 Triage 的判定问题` 是**描述性指路**，不是字面小节名
    // （真实标题为 `## Step 0：需求体量与风险分流（Triage）`）——照抄会得到一个查不到
    // 的锚点。`§默认倾向` 则是字面小节名的截短形态（全名 `§默认倾向（四问全否之后）`
    // 含数字，但它住在权威文件里，允许保留；引用方截短到 `§默认倾向` 即可）。
    authority: 'dw-workflow/references/00-流程总纲.md',
    rewrite: '按 `00-流程总纲.md` §Step 0 Triage 的判定问题 / §默认倾向 指名引用（MUST NOT 保留数字）',
  },
  {
    word: '七条"不裁剪"护栏',
    variants: ['七条"不裁剪"护栏', '七条“不裁剪”护栏', '七条「不裁剪」护栏'],
    // 护栏条目本身逐条列在总纲的 §七条"不裁剪"护栏 一节。
    authority: 'dw-workflow/references/00-流程总纲.md',
    rewrite: '按 `00-流程总纲.md` §"不裁剪"护栏 指名引用（MUST NOT 保留条数）',
  },
]

const isExempt = (rel) =>
  EXEMPT_FILES.includes(rel) || EXEMPT_DIRS.some((dir) => rel.startsWith(dir))

/** 递归收集 dw-system/skills/ 下的文本文件，返回 [相对 wfRoot 的路径（正斜杠）, 内容]。 */
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
      // authority 为 null 的词是过时值：没有任何文件有资格保留它，豁免仍生效（那些文件按设计复述数字）。
      if ((authority !== null && rel === authority) || isExempt(rel)) continue
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
        authority === null
          ? '    本词已无权威定义处（过时值）：全仓禁用，MUST NOT 在任何非豁免文件里保留'
          : `    权威定义文件（唯一允许保留数字的位置）：${authority}`,
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
  //
  // `authority: null` 是**显式声明**的第二类：该词已是过时值（如 2.15.0 起的 `四轴`），
  // 全仓包括原权威文件都不许再出现。这类词不适用上面那条护栏——它本来就该"全仓禁用"，
  // 于是改判反向的一条：原权威文件里也确实不能再有它。两类各有一条闸，MUST NOT 只留一类。
  for (const { word, variants, authority } of CHECKED_WORDS) {
    if (authority === null) {
      for (const [rel, body] of FILES) {
        if (isExempt(rel)) continue
        const hits = findHits(body, variants)
        assert.equal(
          hits.length,
          0,
          `受检词「${word}」已声明为过时值（authority: null），但 ${rel}:${hits[0]?.line} 仍在使用它。` +
            '过时值 MUST 全仓清除；若它重新有了权威定义处，MUST 把 authority 改回具体文件而不是留 null。',
        )
      }
      continue
    }
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
