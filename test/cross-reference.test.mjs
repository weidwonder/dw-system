// 交叉引用有效性机器闸。
//
// 为什么要有这份测试：skill 的判据是**跨文件互指**的（"按 `代码评审纪律.md` §四条轴 执行"），
// 而指路本身没有任何编译期约束——被指的小节改了名、整块被删，引用方一个字都不会变，也不会
// 报错，只会让下一个零上下文 agent 顺着指针跳过去扑空，然后**回退到自己猜**。这正是本体系
// 最初要消灭的失败模式。2026-08-23 那轮四轴评审门一次就抓到两条同型 P1：
//   ①`代码评审纪律.md` 指向 `SKILL.md` 的「触发提示」引用块——那个块早被删了；
//   ②`00-流程总纲.md` 写「`路径-lean.md` §Lean 特有的提醒」——真实标题是 `## 15. Lean 特有的四个提醒`。
// 两条都是**机械可判**的：目标文件在不在、目标标题有没有，一条 linter 就能查全量，而子代理
// 只看它这次读到的那部分。判据见 CLAUDE.md §改动时注意「同一类问题被报到第二次，就该有一条
// 机器闸接手」。
//
// ── 一、收哪些引用形态（宁可少收，MUST NOT 模糊匹配）────────────────────────────────
//
// 只收**主形态**：反引号包住的 `<路径>.md` + 零或多个空格 + `§` + 小节名。
// 实测全仓 357 处 `<file>.md` … `§` 组合里，这个形态占 344 处。**刻意不收**的三类，是已知缺口
// 而不是漏网（收了就得靠猜边界，猜错就是假阳性，那会让整条闸失去可信度）：
//   ①`` `core/00-流程总纲.md` §代码评审门 (L§9) `` 里的 `(L§9)`——它指的是 **Lean 自足册**的
//     小节，不是紧邻它的那个文件名，按主形态解析会张冠李戴；
//   ②表格里的 `` `assets/templates/lean-change-spec.md` | §4 | ``——`|` 是列分隔，两列之间是
//     不是同一条引用取决于表头语义，机器判不了；
//   ③夹了散文的 `` `x.md`，它遵循 §y ``——中间任意长的连接词无法与"引用"区分。
//   ④同文件内的裸 `§x`（不带文件名）——没有目标文件可解析。
// `《》`/`「」` 变体实测**零出现**，因此不实现（真出现了会落进"未被收取"的缺口，不会误报）。
//
// ── 二、小节名的右边界怎么定（中文没有空格，这是本闸最难的一处）────────────────────
//
// 引用后面常常直接跟散文：`§完成与自动合并门收尾。`、`§组稿 第 2 步生成`、`§3 的固定顺序跑`。
// 中文不分词，机器**不可能**知道"收尾"是不是标题的一部分。所以这里的口径是：
//   1. 先按**强标点**截断（见 STOP_CHARS）取一个"候选名"，允许它含空格、允许它多带一截散文；
//   2. 再用**双向子串**判定：候选名 ⊂ 某标题，或某标题 ⊂ 候选名，任一成立即算指得中。
//
// 为什么是**双向子串**而不是题面建议的"引用名是标题的前缀"——三条实测得来的理由：
//   - **右侧粘连**：`§完成与自动合并门收尾。` 截出 `完成与自动合并门收尾`，比真标题
//     `## 完成与自动合并门` **长**。单向前缀会把它判红，可它指得完全正确。"标题 ⊂ 候选"这个
//     方向专治这一类。
//   - **左截短是另一条机器闸强制的**：`test/counter-word.test.mjs` 要求引用方 MUST NOT 保留
//     条数，于是 `## 七条"不裁剪"护栏` 的正确引用形态就是 `§"不裁剪"护栏`——它是标题的**后缀**，
//     不是前缀。用前缀口径会让两条闸互斥（一条要求这么写，另一条判它红）。
//   - **右截短是本仓的通行写法**：`§默认倾向`（真标题 `### 默认倾向（四问全否之后）`）、
//     `§兼容取舍确认门`（真标题 `## 兼容取舍确认门：spec 定稿前，由拍板人拍板`）。这类是
//     **刻意**的：括号补充与冒号后的说明都不该抄进引用。"候选 ⊂ 标题"这个方向覆盖它们。
//
// 正例（MUST 判绿）：
//   `§"不裁剪"护栏`      ⊂ `七条"不裁剪"护栏`            —— 计数词闸强制的左截短
//   `§默认倾向`          ⊂ `默认倾向（四问全否之后）`     —— 刻意省掉括号补充
//   `§完成与自动合并门收尾` ⊃ `完成与自动合并门`           —— 尾部粘连的散文
//   `§批 B`              ⊂ `批 B —— 现状与边界（…）`      —— 复合指路截到第一层
// 反例（MUST 判红，即本闸的存在理由）：
//   `§Lean 特有的提醒`   与 `15. Lean 特有的四个提醒` 互不为子串 —— 标题改了名，引用没跟
//   `§触发提示`          在 `SKILL.md` 里查无此节            —— 被指的块已被删
//
// 代价说清楚：双向子串比前缀**松**，`§护栏` 这种过短的引用会蒙混过关。这是刻意的取舍——
// 本闸的价值在"报出来的每一条都是真错"，漏判只是少抓一条，误报会让人整条关掉。
//
// 归一化对两侧做同一套：去 `#` 前导、去反引号与 `*`、空白折叠、trim。**不去括号**——
// 双向子串已经覆盖"引用省掉括号补充"的情形，再去一次只会制造标题间的碰撞。
//
// ── 三、编号引用单独一路 ───────────────────────────────────────────────────────────
//
// `§3 的固定顺序`、`§2 规则 4`、`§4.1` 这类里，**序号才是标识**，后面全是散文（"规则 4"不是
// 标题的一部分，真标题是 `## 2. 五条规则`）。所以候选名以数字开头时只校验**序号**，MUST NOT
// 拿后面的字去比标题——比了必然假阳性。序号形态是 `\d+(.\d+)*`，与标题行首的序号逐位相等即通过。
//
// ── 四、目标文件怎么解析 ───────────────────────────────────────────────────────────
//
// 引用路径写法五花八门：裸文件名（`代码事实纪律.md`）、相对目录（`core/代码事实纪律.md`）、
// 带占位符（`<skills 根>/ai-dev-workflow/references/core/…`）、上跳（`../../references/core/…`）、
// 花括号（`collab/{solo,team}.md`）。解析规则：丢掉 `.`/`..`/含 `<>` 的占位段后，剩下的段
// 必须是某个真实文件路径的**结尾片段**；命中多个时按"引用方所在的那个 skill"收敛（`solo.md`
// 在两个 skill 下各有一份，引用方读的显然是自己那份）。
//
// 豁免两类：①`docs/` 下与仓库外部的引用不在本闸范围（本闸只管 skill 内部一致性）；
// ②EXEMPT_TARGETS 里逐条枚举的**举例用文件名**——正文里编出来讲道理的文件名不是断链。
// 豁免 MUST 显式枚举 + 写理由，MUST NOT 用启发式猜（猜错就是静默放宽检查面）。
//
// ── 五、跳围栏 ─────────────────────────────────────────────────────────────────────
//
// ``` 围栏内是给子代理的 prompt 模板与示例文本，按 `resident-budget.test.mjs` 的同一套写法跳过——
// **引用方与标题方都跳**。标题方也跳是有后果的：`代码评审纪律.md` 的 prompt 模板整块在 ```text
// 围栏里，里面的 `## 前置` / `## 本轴职责` / `## 硬要求` 是**发给子代理的段落标题**，不是本篇的
// 小节，因此 MUST NOT 被别的文件当成可跳转的锚点。这与 `resident-budget.test.mjs` 文首切段算法
// 第 1 条同源（那里同样因为这个围栏把一段切成了两段）。真要让它可被引用，正确处置是把那一条
// 提成文件的真小节，MUST NOT 反过来让本闸认围栏里的标题。
//
// 门禁自检：往任一 skill markdown 里写一条指向不存在小节的引用（如把 `§四条轴` 改成
// `§四条轴们`）→ 判红并点名文件:行 + 列出最接近的标题；改回去 → 转绿。自检 MUST 用这种方式做，
// MUST NOT 靠放宽 STOP_CHARS 或往 EXEMPT_TARGETS 里加条目让它绿。
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = path.join(repoRoot, 'ai-dev-system', 'skills')

/**
 * 举例用的文件名豁免：正文里为了讲清判据而虚构的文档名，不是断链。
 * MUST 逐条写理由；MUST NOT 因为"报红了很烦"往这里加真实断链。
 */
const EXEMPT_TARGETS = [
  {
    name: 'order-eng-spec.md',
    reason:
      '`文档归档与账本收敛.md` §结算示例 里虚构的订单 spec，用来演示"替换清单为空但文档已失准"这一类；'
      + '同段还有 order-refund-eng-spec.md 与它配对，都不是仓库里的真实文件。',
  },
]
const EXEMPT_NAMES = new Set(EXEMPT_TARGETS.map((e) => e.name))

/**
 * 候选小节名的**右边界**字符集（见文首第二节）。
 * 刻意 NOT 收：ASCII 空格（标题本身含空格，如 `子代理 prompt 模板`、`批 B —— 现状与边界`）、
 * ASCII `.`（`§4.1` 的小数点是序号的一部分）、各类引号（`§"不裁剪"护栏` 整条都在引号里，
 * 截在引号上会得到空串）。
 */
const STOP_CHARS = new Set([
  ...'`*|()[]{}<>+/\;,!?=#~^&@$%:',
  ...'。，、；：？！（）「」『』【】《》〈〉…—–→←↔·',
  '§', '　',
])

/** 归一化：去反引号与强调星号、折叠空白。两侧用同一套（文首第二节）。 */
const normalize = (s) => s.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim()

/**
 * 「核」= 按同一套 STOP_CHARS 截到第一个强标点为止。
 * 标题侧要它，是因为本仓的标题普遍**自带括号补充或冒号说明**——`## 四条轴（分开查、分开报）`、
 * `## 兼容取舍确认门：spec 定稿前，由拍板人拍板`——而引用方按写作纪律只写核心名。
 * 引用侧的候选名同样截一次，两侧同口径。
 */
function coreOf(text) {
  let end = 0
  while (end < text.length && !STOP_CHARS.has(text[end])) end += 1
  return text.slice(0, end).trim()
}

/**
 * 候选名的「左核」：第一个 **CJK 字符 + ASCII 空格** 处截断。
 * 为什么只认 CJK 前导的空格：中文标题内部不含空格，一个汉字后面紧跟空格几乎必然是"标题说完了、
 * 散文开始了"（`§"不裁剪"护栏 的补卡那一条` → `"不裁剪"护栏`）。而 **Latin token 后面的空格
 * 仍可能在标题内部**（`Lean 特有的四个提醒`、`card 格式约定`、`Step 0`、`批 B`），在那里截会
 * 把本闸要抓的真错放过去——真错 `§Lean 特有的提醒` 截成 `Lean` 后就成了任何 `Lean …` 标题的
 * 子串，恒绿。所以这一刀 MUST NOT 无条件砍在第一个空格上。
 * 只在长度 ≥2 时启用：截出一个字的碎片会变成"子串匹配任何标题"，等于关掉检查。
 */
function cjkHeadOf(text) {
  for (let i = 1; i < text.length; i += 1) {
    if (text[i] === ' ' && /[\u4e00-\u9fff]/.test(text[i - 1])) {
      const head = text.slice(0, i).trim()
      return head.length >= 2 ? head : null
    }
  }
  return null
}

/** 标题行首的序号，如 `4.1`、`15`；没有则 null。 */
const SERIAL_RE = /^(\d+(?:\.\d+)*)\s*[.、:：]?\s*/

function splitSerial(text) {
  const m = SERIAL_RE.exec(text)
  if (!m) return { serial: null, rest: text }
  return { serial: m[1], rest: text.slice(m[0].length).trim() }
}

/** 递归收集 .md。 */
function walkMarkdown(dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    const abs = path.join(dir, entry)
    if (statSync(abs).isDirectory()) walkMarkdown(abs, out)
    else if (entry.endsWith('.md')) out.push(abs)
  }
  return out
}

/** 仓库内相对路径统一正斜杠——`path.relative` 在 Windows 给反斜杠，本仓已因此栽过一次。 */
const relPosix = (abs) => path.relative(repoRoot, abs).split(path.sep).join('/')

// 除 skill 目录外，**治理类活文档**也在扫描面内：它们描述 skill 的结构、给出"改这条链路
// 要同改哪几处"的指引，读者会照着里面的 §小节名 跳。skill 里改了小节名而这里没跟上，得到的
// 是一条指向不存在小节的死引用——2026-09-03 的评审门上，`CLAUDE.md` 的这类死引用被四条轴
// 各自独立报了一次，正是"同一类问题被报到第二次就该有闸接手"的判据（`代码评审纪律.md` §门禁）。
//
// **`docs/spec` `docs/plan` `docs/report` 刻意不在扫描面内**：那些是带日期的历史快照，
// 按 `文档治理.md` 的「存量不批量改名」保留写作当时的说法，把它们算进来会把历史记载判成缺陷。
const GOVERNANCE_DOCS = ['CLAUDE.md', 'AGENTS.md', 'docs/index.md', 'docs/REQUIREMENTS.md', 'docs/TODO.md']
  .map((rel) => path.join(repoRoot, ...rel.split('/')))
  .filter((abs) => existsSync(abs))

const allMarkdown = [...walkMarkdown(skillsRoot), ...GOVERNANCE_DOCS]

/** 每个文件的标题清单（跳围栏）。 */
function headingsOf(abs) {
  const out = []
  let inFence = false
  const lines = readFileSync(abs, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^\s*```/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const m = /^(#{1,6})\s+(.*)$/.exec(line)
    if (!m) continue
    const full = normalize(m[2])
    const { serial, rest } = splitSerial(full)
    out.push({ line: i + 1, raw: m[2].trim(), full, serial, rest })
  }
  return out
}

const headingCache = new Map()
const getHeadings = (abs) => {
  if (!headingCache.has(abs)) headingCache.set(abs, headingsOf(abs))
  return headingCache.get(abs)
}

/** `collab/{solo,team}.md` → 两条路径。只展开一层，本仓没有嵌套花括号。 */
function expandBraces(p) {
  const m = /\{([^{}]*)\}/.exec(p)
  if (!m) return [p]
  return m[1].split(',').map((alt) => p.slice(0, m.index) + alt.trim() + p.slice(m.index + m[0].length))
}

/** 丢掉 `.` / `..` / 占位段，返回用于尾部匹配的段数组。 */
const meaningfulSegments = (p) =>
  p.split('/').filter((s) => s && s !== '.' && s !== '..' && !s.includes('<') && !s.includes('>'))

/**
 * 解析引用路径到真实文件。
 * 返回 { abs } / { missing: true } / { skipped: '理由' }。
 */
function resolveTarget(refPath, fromAbs) {
  if (/^https?:/.test(refPath)) return { skipped: '外部 URL' }
  const segs = meaningfulSegments(refPath)
  if (segs.length === 0) return { skipped: '路径只剩占位段' }
  if (segs[0] === 'docs' || segs.includes('docs')) return { skipped: 'docs/ 不在本闸范围' }
  const base = segs[segs.length - 1]
  if (EXEMPT_NAMES.has(base)) return { skipped: `举例用文件名（EXEMPT_TARGETS：${base}）` }

  const hits = allMarkdown.filter((abs) => {
    const real = relPosix(abs).split('/')
    if (real.length < segs.length) return false
    return segs.every((s, i) => real[real.length - segs.length + i] === s)
  })
  if (hits.length === 0) return { missing: true }
  if (hits.length === 1) return { abs: hits[0] }
  // 同名多份（`SKILL.md` / `solo.md` 在两个 skill 下各一份）：收敛到引用方所在的 skill。
  // 相对仓库根的路径形如 ai-dev-system/skills/<skill>/…，skill 名在第 3 段（下标 2）。
  const skillOf = (abs) => relPosix(abs).split('/')[2]
  const fromSkill = skillOf(fromAbs)
  const sameSkill = hits.filter((abs) => skillOf(abs) === fromSkill)
  if (sameSkill.length === 1) return { abs: sameSkill[0] }
  return { skipped: `同名文件多份且无法收敛（${hits.map(relPosix).join(' / ')}）` }
}

/** 按候选名与标题的字符重合度排前几个，只用于失败信息里的"你大概想写这个"。 */
function nearestHeadings(headings, candidate, n = 5) {
  const chars = new Set(candidate)
  return headings
    .map((h) => {
      let hit = 0
      for (const c of new Set(h.full)) if (chars.has(c)) hit += 1
      return { h, score: hit / Math.max(1, new Set(h.full).size) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => `§${x.h.raw}`)
}

/** 抽出全仓的交叉引用（跳围栏）。 */
function collectRefs() {
  const refs = []
  for (const abs of allMarkdown) {
    const lines = readFileSync(abs, 'utf8').split('\n')
    let inFence = false
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      if (/^\s*```/.test(line)) { inFence = !inFence; continue }
      if (inFence) continue
      for (const m of line.matchAll(/`([^`\n]+?\.md)` *§/g)) {
        const tailStart = m.index + m[0].length
        let end = tailStart
        while (end < line.length && !STOP_CHARS.has(line[end])) end += 1
        refs.push({
          file: abs,
          line: i + 1,
          refPath: m[1],
          rawSection: line.slice(tailStart, end),
          // 失败信息里带上原始上下文，人一眼能定位。
          context: line.trim(),
        })
      }
    }
  }
  return refs
}

const REFS = collectRefs()

test('交叉引用抽取本身没有静默失效（抽不到引用会让本闸凭空全绿）', () => {
  // 这道护栏钉的是"正则改坏了 / 主形态被全量改写"这类失效：抽到 0 条时上面的断言照样全绿，
  // 数字错了没有任何信号。实测当前 344 条，取 200 作地板，留足正常增删的余量。
  assert.ok(
    REFS.length >= 200,
    `全仓只抽到 ${REFS.length} 条 \`<file>.md\` §<小节> 形态的交叉引用（期望 ≥200）：`
      + '抽取正则或主形态很可能已被改写，本闸此刻是空跑。MUST 同步 collectRefs() 与文首第一节。',
  )
})

test('每条交叉引用的目标文件与目标小节都真实存在', () => {
  const problems = []
  let checked = 0
  let skipped = 0

  for (const ref of REFS) {
    for (const refPath of expandBraces(ref.refPath)) {
      const target = resolveTarget(refPath, ref.file)
      if (target.skipped) { skipped += 1; continue }
      const where = `${relPosix(ref.file)}:${ref.line}`
      const quoted = `\`${refPath}\` §${ref.rawSection}`

      if (target.missing) {
        problems.push(
          `${where}\n    引用：${quoted}\n    目标文件：**不存在**（在 ai-dev-system/skills/ 下按结尾片段找不到 ${refPath}）\n    上下文：${ref.context}`,
        )
        continue
      }

      const candidate = normalize(ref.rawSection)
      // 长度 ≤1 的候选是占位记号（如 `路径-lean.md` §x 里的 `x`），不是真引用，跳过。
      if (candidate.length <= 1) { skipped += 1; continue }

      checked += 1
      const headings = getHeadings(target.abs)
      const { serial, rest } = splitSerial(candidate)

      let ok = false
      if (serial !== null && /^\d/.test(candidate)) {
        // 编号引用：只认序号，后面的字是散文（文首第三节）。
        ok = headings.some((h) => h.serial === serial)
      } else {
        // 具名引用：两侧各取三种形态（全名 / 去序号 / 核），双向子串任一成立即算指得中。
        const candForms = [candidate, cjkHeadOf(candidate)].filter((x) => x && x.length >= 2)
        ok = headings.some((h) => {
          const headForms = [h.full, h.rest, coreOf(h.full), coreOf(h.rest)].filter((x) => x && x.length >= 2)
          return headForms.some((hf) => candForms.some((cf) => hf.includes(cf) || cf.includes(hf)))
        })
      }
      if (ok) continue

      const detail = serial !== null && /^\d/.test(candidate)
        ? `目标文件里没有序号为 ${serial} 的小节标题`
        : `目标文件里没有与「${candidate}」互为子串的小节标题`
      problems.push(
        `${where}\n    引用：${quoted}\n    目标文件：${relPosix(target.abs)}（存在）\n    问题：${detail}\n`
          + `    最接近的标题：\n      ${nearestHeadings(headings, rest || candidate).join('\n      ')}\n`
          + `    上下文：${ref.context}`,
      )
    }
  }

  console.log(
    `\n── 交叉引用实测 ──\n  抽到 ${REFS.length} 条主形态引用；实判 ${checked} 条，`
      + `跳过 ${skipped} 条（docs/ 与外部、举例文件名、占位记号、同名多份不可收敛）。\n`,
  )

  assert.equal(
    problems.length,
    0,
    `交叉引用失效 ${problems.length} 处——被指的文件或小节查无此处，顺着指针跳过去的 agent 会扑空并退回自己猜：\n\n`
      + problems.map((p, i) => `  [${i + 1}] ${p}`).join('\n\n')
      + '\n\n  处置：改引用去对齐真实标题，或改标题并同步全部引用方。'
      + 'MUST NOT 靠放宽 STOP_CHARS / 往 EXEMPT_TARGETS 加条目让它变绿。',
  )
})
