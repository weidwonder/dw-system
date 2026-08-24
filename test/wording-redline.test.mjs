// 措辞精简的「红线比对」机器闸（FR-006 / AC-007，spec §4.2 + §6 Invariant 1/2）。
//
// 为什么要有这份测试：本次变更要对全部 references / assets 做一遍措辞精简，把体积压下去。
// 压体积和删判据在 diff 上长得一模一样——都是"少了几行"。人肉 review 一批几千字的精简，
// 漏掉一条 `MUST NOT` 或一行"算/不算"对照不会有任何信号，而这两类东西正是零上下文 agent
// 唯一能照着执行的部分。所以要一条机器闸：**同一个文件，精简前后，规范条数与判据正反例
// 条目数只准增不准减**。
//
// 比对基线是**真棘轮：该文件在本分支上出现过的历史最大值**——
//   基线 = max(文件在 `git merge-base HEAD main` 处的计数, 文件在本分支每个 commit 处的计数)
// 三种口径里只有它两个方向都堵得住，另外两种各漏一半，后来的人一定会想改回去，所以写清：
//   - **父提交**（spec §6 强制机制的原始措辞）：精简是分批多次 commit 的（plan Task 11 的
//     11a–11f），只跟上一个 commit 比，"这次删一条、下次补一条"永远绿。漏"慢性失血"。
//   - **仅分支起点**：本分支的执行顺序是 Task 1–9 先往这些文件里**净增**大量条款、
//     Task 11 才做精简。以起点作唯一地板，等于分支内新增的条款全都没有地板——
//     T11 把它们删干净，计数仍高于起点，闸照样绿。实测过：`代码评审纪律.md` 的
//     MUST NOT 在分支内从 26 涨到 32，此时删掉一条是绿的。漏"新增条款被回收"。
//   - **历史最大值（本闸采用）**：跌破起点红，跌破分支内曾达到的峰值也红。
//     代价是"分支内删过的东西补不回去"——那正是要的：想降条数就得回退精简，
//     而不是让它悄悄少一条。
//
// 因为地板取历史最大值，**本分支新建的文件也照样受管**（Task 6 移出的三篇、Lean 自足册
// 都是这一类，它们恰恰是新增条款最密集的地方）：它们在起点没有前身，但在分支内的某个
// commit 之后就有了峰值，从那一刻起地板成立。
//
// 本闸**只管同一个文件内部的措辞**，三种情况不在它的射程内，一律跳过并在输出里点名：
//   - 文件在起点与分支内每个 commit 都不存在（只在工作区里、尚未提交过）——还没有地板；
//   - 文件在当前工作区不存在（本分支删除或移出改名）——移出的判据由加载点清单契约
//     与自足册覆盖率检查保护，不是本闸的活；
//   - 非 markdown 文件。
// 还有一种整体失效：`main` 与 `origin/main` 都取不到时立不起基线，本闸纳入 0 个文件并在
// 输出里显著打印「本闸未生效：取不到分支起点」——MUST NOT 抛错（抛错会把同一文件里两条
// 纯函数门禁自检一起带挂），也 MUST NOT 静默全绿。
//
// 两条自检（本文件末尾两个 test）：一条对**计数器**植入人为降条数的样本，一条对**棘轮**
// 植入"分支内涨上去又删回来"的样本。两条 MUST 保留——一个只会绿的门禁比没有门禁更坏。
//
// spec：docs/spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md §4.2 / §6 / AC-007
// plan：docs/plan/2026-08-23-渐进式披露与需求追溯-coding-plan.md Task 10
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 只读的 git 调用。`core.quotepath=false` 是必须的：默认配置会把非 ASCII 路径转义成
// `"\346\226\207"` 这种带引号的八进制串，本仓库几乎全是中文文件名，不关它整份清单会解析错。
const git = (args) =>
  execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // stderr 也收进管道：`git show <基线>:<新建文件>` 必然报 fatal，那是**预期路径**
    // （用它判"基线里有没有前身"），不关掉会往测试输出里灌一堆假错误吓人。
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const gitLines = (args) =>
  git(args)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

// ── 量 1：规范条数（Invariant 1）────────────────────────────────────────────
//
// 四个桶，逐桶比对。**`MUST NOT` 单独成桶，且不计进 `MUST`**——否则把一条
// `MUST NOT 保留数字` 改写成 `MUST 删除数字`，总数没变、语义已经反转，闸却是绿的。
// `SHOULD NOT` 不单独设桶（全仓只有一处，在 `spec写作纪律.md` 的词表定义里），
// 但它**计进 `SHOULD` 桶**，所以删掉一条 SHOULD NOT 同样会让 SHOULD 掉数、同样判红。
// 只认大写形态：RFC2119 词表是 `spec写作纪律.md` 规定的写法，小写的 "must" 是普通英文。
// 代码围栏内的出现也照数——基线与当前用同一把尺，前后一致即可。
const NORMATIVE_BUCKETS = [
  ['MUST NOT', /MUST\s+NOT\b/g],
  ['MUST', /\bMUST\b(?!\s+NOT\b)/g],
  ['SHOULD', /\bSHOULD\b/g],
  ['MAY', /\bMAY\b/g],
]

const countNormative = (text) => {
  const out = {}
  for (const [name, re] of NORMATIVE_BUCKETS) out[name] = (text.match(re) || []).length
  return out
}

// ── 量 2：判据正反例条目数（Invariant 2）──────────────────────────────────────
//
// 计数单位是**带正反例标记的"判据条目行"**，条目有且只有两种形态，都由 markdown 语法
// 本身钉住起始位置：
//   ① **表格数据行**——以 `|` 开头，既不是分隔行（`|---|---|`）也不是表头行
//      （表头 = 下一行是分隔行）。如 `用户沟通纪律.md` 的 `| **算** | … |`。
//   ② **列表项的首行**——`- ` / `* ` / `1. ` 开头那一行。**续行不计**。
//      如 `00-流程总纲.md` 的 `- **大架构确认门**：…形状变才算…取值变不算…`。
//
// 为什么不按"全文行数"数：精简会重排折行（三行散文并成一行），按行数比对会被折行误伤，
// 逼着实现者去放宽断言。表格行与列表项首行是**语法强制的一条一行**，折行动不了它们。
// 为什么续行不计：同一条判据折成两行还是三行是排版自由，不该影响判据数。
//
// 为什么两种形态一起数、而不是只数表格：spec §4.2 第 3 步正是"把解释性散文改写成判据表"。
// 只数表格的话，散文里的正反例被直接删掉时计数纹丝不动（0→0），闸对**最该拦的那种删除**
// 完全失明；而两种形态一起数时，"一条列表项 → 一行表格"的合法转写是 1:1 的，不判红。
//
// 命中判定（两种形态共用）：
//   a. 某个表格单元格**整格就是**判据标签（去掉 `**`、反引号、空白后精确相等）；或
//   b. 该行里出现闭集里的字面标记（`不算` / `才算` / `正例` / `反例`）。
//
// 标记集刻意收窄，不收 `✅`/`❌`/`正确`/`错误`：本仓库里 ✅ 多是交付状态、"错误"多是
// "错误处理/错误码"，收进来会把普通行也算成判据行，于是任何表格合并、任何列表合并都判红——
// 那会把这条闸变成"一行都不许动"，实现者只能去关它。宁可少收，也不制造假红。
// 同理不收裸的 `算`：`预算` / `计算` / `结算` / `打算` 里都有它。
const EXACT_CELL_MARKERS = new Set(['算', '不算', '正例', '反例'])
const SUBSTRING_MARKERS = ['不算', '才算', '正例', '反例']

const isTableRow = (line) => line.trimStart().startsWith('|')
const isSeparatorRow = (line) => /^\s*\|[\s:|+-]+\|?\s*$/.test(line) && /-/.test(line)
// 列表项首行：允许任意缩进（嵌套列表），`- ` / `* ` / `+ ` / `1. ` / `1) ` 五种起手式。
const isListItemStart = (line) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(line)

const splitCells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.replace(/[*`\s]/g, ''))

const countCriteriaRows = (text) => {
  const lines = text.split(/\r?\n/)
  let count = 0
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    let isEntry = false
    if (isTableRow(line)) {
      // 分隔行不是条目；表头行也不是（表头 = 下一行是分隔行，它给的是列名不是判据）。
      if (isSeparatorRow(line)) continue
      if (i + 1 < lines.length && isSeparatorRow(lines[i + 1])) continue
      isEntry = true
    } else if (isListItemStart(line)) {
      isEntry = true
    }
    if (!isEntry) continue
    const hit =
      splitCells(line).some((c) => EXACT_CELL_MARKERS.has(c)) ||
      SUBSTRING_MARKERS.some((m) => line.includes(m))
    if (hit) count += 1
  }
  return count
}

// ── 取比对范围 ──────────────────────────────────────────────────────────────
// 基分支按 `main` → `origin/main` 依次尝试：本仓的默认分支叫 main，但只有 fetch 过的克隆
// 才一定有本地 `main` ref（CI 的浅克隆、只检出特性分支的机器都可能只有 `origin/main`）。
//
// 两条都取不到时**MUST NOT 抛错**。此前它在模块顶层抛，整份文件的 5 条测试会一起挂——
// 其中包含两条门禁自检，而自检是纯函数、压根不需要 git。基线取不到只该让"比对"这半失效，
// 不该连"这条闸本身还成不成立"一起失效。
// 失效的形态是**纳入 0 个文件 + 显著打印**，与本闸自己的设计一致（见 §比对范围 那条：
// 一个纳入 0 个文件却全绿的门禁与没有门禁等价，必须在输出里看得见）。
const BASE_REF_CANDIDATES = ['main', 'origin/main']
const { mergeBase, baseRef, mergeBaseError } = (() => {
  const tried = []
  for (const ref of BASE_REF_CANDIDATES) {
    try {
      const sha = gitLines(['merge-base', 'HEAD', ref])[0]
      if (sha) return { mergeBase: sha, baseRef: ref, mergeBaseError: null }
      tried.push(`${ref}（命令成功但没有输出）`)
    } catch (err) {
      tried.push(`${ref}（${err.message.split('\n')[0]}）`)
    }
  }
  return { mergeBase: null, baseRef: null, mergeBaseError: tried.join('；') }
})()

const changedMarkdown = (() => {
  // 取不到分支起点 → 纳入 0 个文件（下方的显著打印会把这件事说出来），MUST NOT 静默全绿。
  if (mergeBase === null) return []
  const set = new Set()
  const collect = (args) => {
    for (const p of gitLines(args)) if (p.endsWith('.md')) set.add(p)
  }
  collect(['diff', '--name-only', `${mergeBase}...HEAD`]) // 分支上已提交的
  collect(['diff', '--name-only']) // 工作区未暂存的
  collect(['diff', '--cached', '--name-only']) // 已暂存未提交的
  return [...set].sort()
})()

// ── 逐文件采样：起点 + 分支内每个 commit ────────────────────────────────────
//
// 采样点按时间顺序排列，第 0 个是分支起点。`git show <sha>:<path>` 在该 commit 没有这个
// 文件时会失败，那是**预期路径**（文件还没建 / 已被移走），跳过那个采样点即可。
const branchCommits = mergeBase === null ? [] : gitLines(['rev-list', '--reverse', `${mergeBase}..HEAD`])
const shortSha = (sha) => sha.slice(0, 7)

// `<sha>:<path>` → 文本 的内存缓存。文件数 × commit 数会相乘，同一个键只 `git show` 一次；
// 而且只对**当前范围内**的文件走历史，MUST NOT 遍历全仓（分支 commit 数是个位数，
// 到此为止就够了，不必再优化）。
const showCache = new Map()
const showAt = (sha, rel) => {
  const key = `${sha}:${rel}`
  if (!showCache.has(key)) {
    let text = null
    try {
      text = git(['show', `${sha}:${rel}`])
    } catch {
      text = null // 该 commit 没有这个文件
    }
    showCache.set(key, text)
  }
  return showCache.get(key)
}

const measure = (text) => ({ norm: countNormative(text), crit: countCriteriaRows(text) })

const samplesOf = (rel) => {
  const out = []
  const points = [{ sha: mergeBase, isStart: true }, ...branchCommits.map((sha) => ({ sha, isStart: false }))]
  for (const pt of points) {
    const text = showAt(pt.sha, rel)
    if (text === null) continue
    out.push({ ...pt, m: measure(text) })
  }
  return out
}

// 取某个量在采样序列里的峰值。**并列时取时间最早的那个**——这样"从没涨过"的文件会把
// 峰值归给分支起点，失败信息就能如实说"跌破分支起点"，而不是甩一个跟起点同值的 commit。
const peakOf = (samples, pick) => {
  let best = samples[0]
  for (const s of samples) if (pick(s) > pick(best)) best = s
  return { value: pick(best), at: best }
}

// 纯函数，两个 Invariant 测试与门禁自检共用一份实现——自检要能对着**同一段逻辑**
// 植入必错样本，另写一份简化版等于自检了个寂寞。
const ratchetViolations = (rel, samples, current) => {
  const cur = measure(current)
  const out = { normative: [], criteria: [] }
  const say = (metric, peak, now) => {
    const gap = peak.value - now
    return peak.at.isStart
      ? `${rel}：${metric} 跌破分支起点——从 ${peak.value} 降到 ${now}（少了 ${gap} 条）`
      : `${rel}：${metric} 跌破分支内峰值 ${peak.value}（峰值出现在 commit ${shortSha(peak.at.sha)}），现为 ${now}（少了 ${gap} 条）`
  }
  for (const [name] of NORMATIVE_BUCKETS) {
    const peak = peakOf(samples, (s) => s.m.norm[name])
    if (cur.norm[name] < peak.value) out.normative.push(say(name, peak, cur.norm[name]))
  }
  const peakCrit = peakOf(samples, (s) => s.m.crit)
  if (cur.crit < peakCrit.value) out.criteria.push(say('判据正反例条目', peakCrit, cur.crit))
  return out
}

const scope = (() => {
  const checked = []
  const noHistory = []
  const goneFiles = []
  for (const rel of changedMarkdown) {
    const abs = path.join(repoRoot, ...rel.split('/'))
    const samples = samplesOf(rel)
    if (samples.length === 0) {
      noHistory.push(rel) // 起点与分支内每个 commit 都没有它 = 还没提交过，立不起地板
      continue
    }
    if (!existsSync(abs)) {
      goneFiles.push(rel)
      continue
    }
    checked.push({ rel, samples, current: readFileSync(abs, 'utf8') })
  }
  return { checked, noHistory, goneFiles }
})()

// 把范围与实测条数打进测试输出：这条闸的结论只有配上"它到底看了哪几个文件、地板立在哪"
// 才可信，一个纳入 0 个文件却全绿的门禁与没有门禁等价，必须在输出里看得见。
test('比对范围与棘轮地板（供人核对，不做断言）', () => {
  const say = (s) => console.log(s)
  if (mergeBase === null) {
    say('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    say('!! 本闸未生效：取不到分支起点（措辞红线比对被整体跳过，纳入 0 个文件）      !!')
    say(`!! 依次试过：${mergeBaseError}`)
    say('!! 本次运行 MUST NOT 被读成"措辞红线已通过"——它一个文件都没比。            !!')
    say('!! 处置：把基分支 fetch 下来（git fetch origin main）后重跑本闸。           !!')
    say('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    return
  }
  say(`分支起点：${shortSha(mergeBase)}（基分支 ${baseRef}）；分支内 commit：${branchCommits.length} 个`)
  say(`纳入比对的 markdown：${scope.checked.length} 个（地板 = 起点与分支内各 commit 的历史最大值）`)
  for (const f of scope.checked) {
    const cur = measure(f.current)
    const mark = (peak) => (peak.at.isStart ? '@起点' : `@${shortSha(peak.at.sha)}`)
    const norm = NORMATIVE_BUCKETS.map(([n]) => {
      const peak = peakOf(f.samples, (s) => s.m.norm[n])
      return `${n} 地板${peak.value}${mark(peak)}→${cur.norm[n]}`
    }).join('，')
    const pc = peakOf(f.samples, (s) => s.m.crit)
    say(`  - ${f.rel}（采样 ${f.samples.length} 点）：${norm}；判据正反例条目 地板${pc.value}${mark(pc)}→${cur.crit}`)
  }
  say(`跳过（分支内尚无任何提交版本，立不起地板）：${scope.noHistory.length} 个`)
  for (const p of scope.noHistory) say(`  - ${p}`)
  say(`跳过（已删除或移出改名，当前无对应文件）：${scope.goneFiles.length} 个`)
  for (const p of scope.goneFiles) say(`  - ${p}`)
})

test('Invariant 1：每个被改 markdown 的 MUST / MUST NOT / SHOULD / MAY 条数不跌破棘轮地板', () => {
  const violations = []
  for (const f of scope.checked) violations.push(...ratchetViolations(f.rel, f.samples, f.current).normative)
  assert.deepEqual(
    violations,
    [],
    '措辞精简踩到红线①：规范结论被删或被改写。逐条核对下列文件，' +
      '把丢掉的 MUST / MUST NOT / SHOULD / MAY 结论补回原文件（spec §4.2 红线四条 / §6 Invariant 1）。' +
      '写着"跌破分支内峰值"的，去 `git show <该 commit>` 看当时那份，删掉的就是它带进来的条款。' +
      `\n${violations.join('\n')}`,
  )
})

test('Invariant 2：每个被改 markdown 的判据正反例条目数不跌破棘轮地板', () => {
  const violations = []
  for (const f of scope.checked) violations.push(...ratchetViolations(f.rel, f.samples, f.current).criteria)
  assert.deepEqual(
    violations,
    [],
    '措辞精简踩到红线②：判据消歧的正反例被删。正反例是判据唯一的可执行部分，' +
      '删掉它等于把判断权还给语感（spec §4.2 红线四条 / §6 Invariant 2）。' +
      `\n${violations.join('\n')}`,
  )
})

// ── 门禁自检：植入必错样本，确认两个计数器真的抓得住条数下降 ──────────────────
test('门禁自检：人为降条数的样本 MUST 被判红', () => {
  const baseline = [
    '# 样例',
    '',
    '- 实现者 MUST 补卡；MUST NOT 顺延；SHOULD 当场提交；MAY 附一句理由。',
    '- 主干路形状变了才算，取值变了不算——散文形态的正反例。',
    '  这是上一条的续行，里面也写了不算，但续行不参与计数。',
    '',
    '| | 例子 |',
    '|---|---|',
    '| **算** | 职责跨槽位搬移 |',
    '| **不算** | 换存储实现 |',
    '| 说明 | 判据见上表，卡片查不到不算"说不清" |',
    '',
    '| 名称 | 含义 |',
    '|---|---|',
    '| 预算 | 与判据无关的普通表格行（「预算」里的"算"不得命中）|',
  ].join('\n')

  // 基线读数：先钉住，免得日后改计数口径时自检跟着一起漂。
  const b = countNormative(baseline)
  assert.equal(b['MUST NOT'], 1, 'MUST NOT MUST 单独计数')
  assert.equal(b.MUST, 1, 'MUST 桶 MUST NOT 把 MUST NOT 吞进来')
  assert.equal(b.SHOULD, 1)
  assert.equal(b.MAY, 1)
  // 四条命中：列表项 `…才算…不算…`，表格行 `**算**` / `**不算**`（整格标记），
  // 以及含"不算"的说明行。**不计**的四类：表头行、分隔行、列表续行、含「预算」的普通行。
  assert.equal(countCriteriaRows(baseline), 4, '判据正反例条目的计数口径漂了')

  // 破坏样本 A：把一条 MUST NOT 改写成 MUST（总数不变，语义反转）。
  const mutA = baseline.replace('MUST NOT 顺延', 'MUST 立刻处理')
  assert.equal(countNormative(mutA)['MUST NOT'], 0, '改写 MUST NOT MUST 被抓住')
  assert.ok(countNormative(mutA)['MUST NOT'] < b['MUST NOT'], '样本 A MUST 判红')

  // 破坏样本 B：删掉一条 SHOULD。
  const mutB = baseline.replace('SHOULD 当场提交；', '')
  assert.ok(countNormative(mutB).SHOULD < b.SHOULD, '样本 B MUST 判红')

  // 破坏样本 C：删掉一行"不算"对照。
  const mutC = baseline.replace('| **不算** | 换存储实现 |\n', '')
  assert.ok(countCriteriaRows(mutC) < countCriteriaRows(baseline), '样本 C MUST 判红')

  // 破坏样本 D：把两行正反例合并成一段散文（精简最常见的手法——看着只是"更紧凑"）。
  const mutD = baseline
    .replace('| **算** | 职责跨槽位搬移 |\n', '')
    .replace('| **不算** | 换存储实现 |\n', '搬移算、换实现不算。\n')
  assert.ok(countCriteriaRows(mutD) < countCriteriaRows(baseline), '样本 D MUST 判红')

  // 破坏样本 E：删掉散文形态（列表项）的正反例。只数表格的口径会对它完全失明，
  // 这条自检就是钉住"列表项也要数"这件事的。
  const mutE = baseline.replace('- 主干路形状变了才算，取值变了不算——散文形态的正反例。\n', '')
  assert.ok(countCriteriaRows(mutE) < countCriteriaRows(baseline), '样本 E MUST 判红')

  // 合法改写 1（只压论证、不动结论与正反例）MUST 保持绿。
  const benign = baseline.replace(
    '| 说明 | 判据见上表，卡片查不到不算"说不清" |',
    '| 说明 | 卡片查不到不算"说不清" |',
  )
  assert.deepEqual(countNormative(benign), b, '合法改写不得判红（规范条数）')
  assert.equal(countCriteriaRows(benign), countCriteriaRows(baseline), '合法改写不得判红（正反例条目）')

  // 合法改写 2（spec §4.2 第 3 步：把散文正反例改写成判据表）MUST 保持绿——
  // 一条列表项换成一行表格是 1:1 的，计数不动。这条自检防的是"闸把该做的事判红"。
  const converted = baseline.replace(
    '- 主干路形状变了才算，取值变了不算——散文形态的正反例。',
    '| **不算** | 主干路取值变了（配套判据：形状变了才算）|',
  )
  assert.equal(countCriteriaRows(converted), countCriteriaRows(baseline), '散文改写成判据表不得判红')

  // 合法改写 3：整条判据折行重排 MUST 保持绿——排版不是判据。
  const rewrapped = baseline.replace(
    '- 主干路形状变了才算，取值变了不算——散文形态的正反例。\n  这是上一条的续行，里面也写了不算，但续行不参与计数。',
    '- 主干路形状变了才算，取值变了不算——散文形态的正反例。这是原来的续行，里面也写了不算。',
  )
  assert.equal(countCriteriaRows(rewrapped), countCriteriaRows(baseline), '折行重排不得判红')
})

// ── 门禁自检（棘轮）：分支内涨上去又删回来 ──────────────────────────────────
//
// 专钉一条语义：地板是**历史最大值**，不是分支起点。旧口径（仅起点作地板）下这个样本是
// 绿的——现在的计数仍高于起点，只是把分支内新增的条款回收了。而那恰恰是 Task 11 精简
// 误删的典型形态：Task 1–9 净增，Task 11 净减，两头一抵，起点比对看不出任何异常。
test('门禁自检（棘轮）：分支内涨到峰值后又降回来 MUST 被判红', () => {
  // 造一份计数可控的文档：n 条 MUST NOT（列表项，不含正反例标记）+ k 行判据正反例。
  const doc = (mustNot, crit) =>
    [
      ...Array.from({ length: mustNot }, (_, i) => `- 第 ${i + 1} 条：MUST NOT 删。`),
      ...Array.from({ length: crit }, (_, i) => `| **不算** | 第 ${i + 1} 例 |`),
    ].join('\n')

  assert.deepEqual(countNormative(doc(2, 1))['MUST NOT'], 2, '合成样本的计数口径漂了')
  assert.equal(countCriteriaRows(doc(2, 1)), 1, '合成样本的计数口径漂了')

  const PEAK_SHA = 'abcdef1234567890'
  const samples = [
    { sha: mergeBase, isStart: true, m: measure(doc(2, 1)) }, // 分支起点：2 / 1
    { sha: PEAK_SHA, isStart: false, m: measure(doc(6, 4)) }, // Task 1–9 净增到峰值：6 / 4
  ]
  const current = doc(3, 2) // Task 11 精简后：3 / 2 —— 仍高于起点，但回收了分支内新增的条款

  // 先钉住"旧口径下这是绿的"，否则这条自检证明不了它到底拦住了什么。
  assert.ok(
    countNormative(current)['MUST NOT'] > samples[0].m.norm['MUST NOT'] &&
      countCriteriaRows(current) > samples[0].m.crit,
    '样本必须仍高于分支起点，否则测不出"起点作地板"的漏洞',
  )

  const v = ratchetViolations('样例.md', samples, current)
  assert.deepEqual(v.normative, [
    '样例.md：MUST NOT 跌破分支内峰值 6（峰值出现在 commit abcdef1），现为 3（少了 3 条）',
  ])
  assert.deepEqual(v.criteria, [
    '样例.md：判据正反例条目 跌破分支内峰值 4（峰值出现在 commit abcdef1），现为 2（少了 2 条）',
  ])

  // 另一半语义：从没涨过的文件，跌破时要说"跌破分支起点"，而不是甩一个跟起点同值的 commit。
  const flat = [
    { sha: mergeBase, isStart: true, m: measure(doc(2, 1)) },
    { sha: PEAK_SHA, isStart: false, m: measure(doc(2, 1)) },
  ]
  assert.deepEqual(ratchetViolations('样例.md', flat, doc(1, 1)).normative, [
    '样例.md：MUST NOT 跌破分支起点——从 2 降到 1（少了 1 条）',
  ])

  // 只增不减 MUST 保持绿：峰值之上继续加条款不判红。
  const grown = ratchetViolations('样例.md', samples, doc(9, 5))
  assert.deepEqual(grown.normative, [])
  assert.deepEqual(grown.criteria, [])
})
