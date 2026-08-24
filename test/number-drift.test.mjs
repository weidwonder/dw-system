// 手抄数字防漂闸：**本仓文档正文 MUST NOT 出现应由机器闸产出的量的手抄值**。
//
// 为什么要有这份测试：`test/resident-budget.test.mjs` 已经把「常驻前置量」的切段算法写死在
// 一处、并无论绿红都打印实测明细，四份文档也已改成引用那条闸而不是各抄一个数。**但那个处置
// 没有防线**——下一个人（或下一个 agent）为了"读起来方便"再在正文里抄一个当时的数，不会有
// 任何东西报错；一个版本之后它又是错的，而且错得静默。那正是这条闸之前的实际历史：同一个量
// 在五处漂成五个互不相同的值（45,260 / 45,286 / 45,290 / 45,292 / 46,100），差异全部来自
// "怎么切段"、不来自文件本身。这条闸把"再抄一次"变成当场判红。
//
// ── 受管的量（当前只有这两个）────────────────────────────────────────────────────
// **常驻前置量** 与 **常驻整篇合计**——即 `test/resident-budget.test.mjs` 打印的那两个数。
// 另两个量化契约（入口 `SKILL.md` ≤ 8,000 字节、加载点清单行数）**不在本闸管辖内**，见文末
// 〈已知盲区〉。扩管辖时改 BAND 与 WHITELIST，并同步这段注释。
//
// ── 口径：白名单法（值域只用来收窄候选集，不用来做判断）────────────────────────────
// 备选过两条路，实测后选了白名单法：
//
//   **值域法**（"正文里不许出现落在某区间的数字"）——实测直接否掉：本仓 `docs/` 里落在
//   40,000–99,999 的数字有 26 个不同取值、共 60 余处，**其中没有一处是现行口径**，全是历史
//   记账（PRD §常驻负担的账 的逐笔推演中间数、真跑验收里被推翻的错值、几版被改掉的目标值）。
//   纯值域法会把这 60 余处全判红，而它们恰恰是**不该被改写的历史记载**——闸一上线就要求人去
//   篡改历史，那样的闸只会被关掉。
//
//   **白名单法**（"落在区间内的数字 MUST 在一份显式清单里登记"）——选它，因为它天然区分
//   **历史记账**与**现行口径**：历史记账登记一次、写清它记的是什么，此后永久放行；现行口径
//   压根没有合法的手抄形态，只能改成指向机器闸的句子。本仓刚在文档轴上确认过这个区分是关键的
//   （`文档治理.md` §3：历史记载 MUST NOT 被改写，现行口径失准 MUST 改），本闸沿用同一条分界。
//   代价是**新增一次历史观测就要加一行白名单**——这是刻意的摩擦：加那一行时必须写清"这个数
//   记的是什么、为什么允许写死"，写不出来就说明它其实是个现行口径，本就该改成引用。
//
// 值域 BAND = [40,000, 99,999]，只起**收窄候选集**的作用，判断仍全在白名单：
//   · 下界 40,000——两个受管量当前是 46,530 / 63,445，门槛 50,000。取 40,000 把逐文件、
//     逐小节的字节数（单文件整篇最大 26,511）挡在管辖外：那些数不是本闸受管的量。
//   · 上界 99,999——改造前基线 108,003、Lean 加载量 133,545 / 143,803 / 154,552 / 101,923
//     这批六位数历史观测值因此**天然出界、一条白名单都不用登记**。这正是任务里点名要避免的
//     那类误伤。
//   受管量真漂出这个区间时（例如整篇合计涨过十万）本闸会静默失守，**MUST 同步上调 BAND 并
//   把新区间里的历史数字登记进白名单**，MUST NOT 放着不管。
//
// ── 数字的识别形态 ──────────────────────────────────────────────────────────────
// 两种：带千位分隔符的 `46,530`（文档惯用）与裸五位数 `46530`（机器闸输出的形态，照抄最省事，
// 所以必须一并管）。两侧都不许紧邻数字、逗号、小数点或 ASCII 连字符——这三个否定实测各挡掉一类
// 假阳性：`00-流程总纲.md:53-54,120-134` 的行号区间会被读成 54,120，`docs/spec/2026-08-{10,14}-*`
// 的花括号枚举会被读成 61,416。千位分组还要求逗号后**恰好三位**，`{06,14,16}` 这类枚举因此不匹配。
//
// ── 三条边界的处置（漏一条这闸就不可用）──────────────────────────────────────────
// 1. **代码围栏内整段跳过**（``` 成对）。围栏里的是命令与命令输出——粘贴一段 `node --test`
//    的实测输出是**记账**，不是口径声明。当前仓库围栏内零命中，这条是为将来留的。
//    行内代码 `` ` `` **不豁免**：反引号里同样可以写一句现行口径，且上面那两类假阳性正好都
//    住在行内代码里、已由识别形态挡掉，不需要再放一道口子。
// 2. **`docs/report/` 不整体豁免**。它确实是记数字的地方，但整体豁免的代价太大：五处漂移里
//    有两处就住在 `docs/report/2026-08-23-渐进式披露真跑验收.md`，而"引用现行门槛"的句子也
//    住在那里——豁免掉等于把出问题最多的那份文件排除在闸外。改用同一套白名单：report 里的
//    观测记录逐个登记，登记本身就是"这个数记的是哪一次观测"的留痕。
// 3. **指向机器闸的句子 MUST NOT 被误判**。那类句子（"当前值以该命令输出为准"）本身不含受管量
//    的数值，只含门槛 50,000——门槛是**判据不是观测值**，写死在闸的 `BUDGET` 常量里，因此它以
//    `kind: 现行门槛` 登记，并由下方第三个 test 与 `BUDGET` 交叉校验，而不是盲目豁免。
//
// ── 为什么当前实测值要跑子进程去问，而不在这里再算一遍 ──────────────────────────────
// 本闸需要知道"现在这两个量是多少"，用来在失败信息里指出"你抄的正是当前实测值"，并守住
// 「白名单条目 MUST NOT 等于当前实测值」那道护栏。取值方式是**实跑
// `node --test test/resident-budget.test.mjs` 并解析它打印的明细**。
// **MUST NOT 把切段算法复制到本文件**：复制等于把"同一个量在两处各算一遍"的老毛病原样搬到
// 上一层，而且这一层还没人会去核对。解析不出来就硬判红（下方第一个 test），MUST NOT 降级成
// "取不到就跳过"——那会让本闸静默失效。
//
// ── 已知盲区（明写出来，MUST NOT 当成本闸已覆盖）────────────────────────────────
// A. **只管两个量**。入口 `SKILL.md` 字节数（当前 7,802）、加载点清单行数、逐文件/逐小节的
//    前置量与触发式量，都在 BAND 之外或本就不受管，手抄它们本闸不报。
// B. **改口径与抄数字同一次提交时抓不住**：先把文档改成让实测值变成 X，再抄 X 进正文，两者
//    都"当时正确"。门禁自检时撞到过这个形态的反面：往 `SKILL.md`（常驻六份之一）里注入一行，
//    实测值当场就不再是注入的那个数，⚠ 标记因此不亮。**被抄的数落不落在受管量上，本闸只在
//    "当前实测值"这一点上判得准**。白名单法在这里仍比值域法强（新数字未登记照样判红，只是
//    失败信息里少一条"这正是当前实测值"的指认），但登记理由是否诚实只能靠人看——这正是白名单
//    每行要求写理由的原因。
// C. **BAND 之外的手抄值不报**（见上）。
// D. **不判语义**：一个数字登记进白名单后，本闸不再管它周围的话是否还成立。文档正文是否失准
//    仍由代码评审门的 D 文档轴按 `文档治理.md` §3 判。
//
// 相关：`test/resident-budget.test.mjs`（受管量的唯一算法处）、`test/counter-word.test.mjs`
// （管的是另一类被复制的数字：轴数/门数这类计数词）。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUDGET_GATE_REL = path.join('test', 'resident-budget.test.mjs')

// 扫描范围（任务规定）：仓库根 CLAUDE.md + docs/ 全部 md + 两个 skill 的全部 md。
const SCAN_ROOTS = ['CLAUDE.md', 'docs', path.join('ai-dev-system', 'skills')]

// 见文首〈口径〉。改这两个数等于改管辖范围，MUST 同步文首注释与白名单。
const BAND_LO = 40000
const BAND_HI = 99999

/**
 * 白名单：BAND 内**允许写死**的数字，逐条登记「记的是什么 / 为什么允许写死」。
 *
 * kind 只有两个取值：
 *   `现行门槛` —— 有且只有一条，取值 MUST 等于 `resident-budget.test.mjs` 的 `BUDGET`
 *                （下方第三个 test 交叉校验）。它是判据，不是观测值。
 *   `历史记账` —— 某次观测、某版被改掉的目标值、某轮推演的中间数。它记的是**当时的状态**，
 *                MUST NOT 因为现在的实测值变了就去改它（`文档治理.md` §3：历史记载不改写）。
 *
 * 加一条的规矩：`why` MUST 写清这个数记的是哪一次、哪个口径下的什么量。**MUST NOT 只填数字**，
 * 也 MUST NOT 拿 `历史记账` 去放行一个现行口径——现行口径的正确形态是删掉数字、改成指向机器闸。
 */
const WHITELIST = new Map([
  // ── 现行门槛（唯一一条，与 BUDGET 交叉校验）────────────────────────────────────
  [50000, { kind: '现行门槛', why: 'AC-003 的常驻前置量门槛，写死在 resident-budget.test.mjs 的 BUDGET；是判据不是观测值，MUST NOT 下调' }],

  // ── 历史记账：几版被改掉的常驻负担目标值（PRD 变更记录 / §为什么不定体积阈值）──────
  [70000, { kind: '历史记账', why: 'PRD 2026-08-22 上午定过的常驻目标值，同日收紧为 50,000；记的是当时的取舍' }],
  [45000, { kind: '历史记账', why: 'PRD 定过的"全程累计 ≤45,000"目标，验证轮后改为"任一阶段峰值 ≤50,000"；记的是被推翻的那一版口径' }],

  // ── 历史记账：PRD §常驻负担的账 的逐笔推演中间数（一列减法，每行一个中间余额）──────
  [84853, { kind: '历史记账', why: 'PRD §常驻负担的账 推演行「移出 文档治理.md −23,150」后的中间余额' }],
  [80340, { kind: '历史记账', why: 'PRD §常驻负担的账 推演行「移出 spec写作纪律.md −4,513」后的中间余额' }],
  [70934, { kind: '历史记账', why: 'PRD §常驻负担的账 推演行「移出 worktree开发纪律.md −9,406」后的中间余额' }],
  [62786, { kind: '历史记账', why: 'PRD §常驻负担的账 推演行「入口瘦身 16,148 → 8,000」后的中间余额' }],
  [56586, { kind: '历史记账', why: 'PRD §常驻负担的账 推演行「总纲补 文档治理 §硬规则 +1,800」后的中间余额' }],
  [57186, { kind: '历史记账', why: 'PRD §常驻负担的账 推演的最终估算值，兼 §达标临界精简率 的起点（57,186 → 50,000）' }],
  [54786, { kind: '历史记账', why: 'PRD §常驻负担的账 推演行「总纲抽掉历史沿革论证 −8,000」后的中间余额' }],
  [48608, { kind: '历史记账', why: 'PRD §常驻负担的账 推演行「全篇措辞精简（保守按 15%）」后的中间余额' }],

  // ── 历史记账：实现与真跑验收阶段的观测值（含被推翻的错值）────────────────────────
  [73546, { kind: '历史记账', why: 'coding-plan Task 4 当时的常驻集合整篇合计（108,003 − 37,069 + 2,612）；记的是那一刻的中间态' }],
  [75000, { kind: '历史记账', why: 'coding-plan Step 4 当时用的中间验收阈值，后被 AC-003 的常驻前置量口径取代' }],
  [56196, { kind: '历史记账', why: '两轮措辞精简后按整篇口径实测的常驻集合合计，是"仍 > 50,000"的证据；触发了 spec §5 错误处理表第一条' }],
  [60352, { kind: '历史记账', why: 'PRD 验证轮里按累计口径补齐漏算项后达到的数，是"累计口径列不全"的证据' }],
  [45258, { kind: '历史记账', why: '真跑验收 Task 13 实测的常驻六份前置量（当时入口把六份排在 Triage 之前）；记的是被修正掉的那条路径' }],
  [49431, { kind: '历史记账', why: '真跑验收 Task 13 实测的 路径-lean.md 前置节字节数（同上，重复加载那一版）' }],
  [49677, { kind: '历史记账', why: '修正后重新核算的 路径-lean.md 前置节字节数（spec §7 与验收报告的 Lean 加载量表）' }],
  [49678, { kind: '历史记账', why: '验收报告自评里记的同一量的正确值，与 49,677 差 1 字节，原样保留以留痕两次核算的差异' }],
  [61376, { kind: '历史记账', why: 'Lean 分支一次加载量的合计（自足册前置节 + collab/solo.md + lean 模板）；是观测量不是门槛' }],
  [67840, { kind: '历史记账', why: '验收报告自评里记的一个算错的中间值（无标注小节被误算成前置），正确值 49,678；错值本身是留痕' }],
  [77420, { kind: '历史记账', why: '验收报告与 spec 里记的上一版 Lean 加载量（漏算三道必然触发的门 18,791），偏乐观；错值本身是留痕' }],

  // ── 历史记账：同一个量漂成五个值的那四个（本闸存在的理由本身）────────────────────
  [45260, { kind: '历史记账', why: '常驻前置量五处漂移中 CLAUDE.md 当时写的值；作为"同一个量漂成五个数"的证据留在验收报告与 spec' }],
  [45286, { kind: '历史记账', why: '常驻前置量五处漂移中真跑验收报告当时写的值；同上' }],
  [45290, { kind: '历史记账', why: '常驻前置量五处漂移中 spec §7 当时写的值；同上' }],
  [45292, { kind: '历史记账', why: '常驻前置量五处漂移中评审复算得到的值；同上' }],
])

// ── 数字识别（见文首〈数字的识别形态〉）──────────────────────────────────────────
// 千位分组：逗号后恰好三位；或裸五位数。两侧都不许紧邻 数字 / 逗号 / 小数点 / ASCII 连字符。
const NUMBER_RE = /(?<![\d,.\-])(?:\d{1,3}(?:,\d{3})+|\d{5})(?![\d,.\-])/g

/** 递归收集扫描范围内的 .md 文件（相对仓库根的路径）。 */
function collectMarkdown() {
  const out = []
  const walk = (rel) => {
    const absPath = path.join(repoRoot, rel)
    if (!existsSync(absPath)) return
    const st = statSync(absPath)
    if (st.isFile()) {
      if (rel.toLowerCase().endsWith('.md')) out.push(rel)
      return
    }
    for (const name of readdirSync(absPath).sort()) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      walk(path.join(rel, name))
    }
  }
  for (const root of SCAN_ROOTS) walk(root)
  return out
}

/** 逐行扫一份文件，返回 BAND 内的命中；代码围栏内整段跳过。 */
function scanFile(rel) {
  const hits = []
  const lines = readFileSync(path.join(repoRoot, rel), 'utf8').split('\n')
  let inFence = false
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence) return
    for (const m of line.matchAll(NUMBER_RE)) {
      const value = Number(m[0].replace(/,/g, ''))
      if (value < BAND_LO || value > BAND_HI) continue
      hits.push({ rel, line: i + 1, raw: m[0], value, text: line.trim() })
    }
  })
  return hits
}

/**
 * 实跑那条闸并解析它打印的实测值。见文首〈为什么当前实测值要跑子进程去问〉。
 * 返回 [{ label, value }]。**解析不到就抛**——MUST NOT 返回空数组让调用方带着空参照物继续跑，
 * 那会让下面几条断言退化成"无声通过"。
 *
 * 两个跨平台细节：
 *   · 子进程 MUST 清掉 `NODE_TEST_CONTEXT`。本文件本身是在 `node --test` 里跑的，该环境变量
 *     还在，node:test 会判定"递归调用 run()"并**直接跳过运行文件**（只打一行 Warning，退出码
 *     仍是 0）——参照物静默变空，正是这条闸最怕的失效形态。
 *   · `shell: false`：Windows 上 `process.execPath` 是 .exe，不需要 shell，显式关掉以免参数被二次解析。
 * 结果缓存一次：下面有三条断言要用，没必要重复付子进程的开销。
 */
let liveCache = null
function readLiveMeasurements() {
  if (liveCache) return liveCache
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const r = spawnSync(process.execPath, ['--test', BUDGET_GATE_REL], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    shell: false,
  })
  const stdout = `${r.stdout ?? ''}\n${r.stderr ?? ''}`
  const found = []
  // 匹配那条闸的明细行：`【collab 取 solo.md】前置合计 46530 / 整篇合计 63445 字节`
  for (const m of stdout.matchAll(/【collab 取 ([^】]+)】前置合计 (\d+) \/ 整篇合计 (\d+) 字节/g)) {
    found.push({ label: `常驻前置量（collab=${m[1]}）`, value: Number(m[2]) })
    found.push({ label: `常驻整篇合计（collab=${m[1]}）`, value: Number(m[3]) })
  }
  if (found.length === 0) {
    throw new Error(
      `解析不出 \`node --test ${BUDGET_GATE_REL}\` 的实测明细——本闸失去参照物。\n` +
        '可能原因：那条闸的打印格式被改了（本闸靠明细行 `【collab 取 <文件>】前置合计 N / 整篇合计 N 字节` 定位），' +
        '或那条闸本身跑不起来。\n' +
        'MUST 同改本文件的 readLiveMeasurements()，MUST NOT 把它改成"取不到就返回空"——那等于静默关掉整条闸。\n' +
        `--- 子进程输出前 800 字符 ---\n${stdout.slice(0, 800)}`,
    )
  }
  liveCache = found
  return found
}

/** 从那条闸的源码里取门槛常量，用于与白名单的〈现行门槛〉条目交叉校验。 */
function readBudgetConstant() {
  const src = readFileSync(path.join(repoRoot, BUDGET_GATE_REL), 'utf8')
  const m = /^const BUDGET = (\d+)\s*$/m.exec(src)
  return m ? Number(m[1]) : null
}

test('拿得到当前实测值（取不到 MUST 硬判红，MUST NOT 静默跳过）', () => {
  // 参照物取不到时 readLiveMeasurements() 直接抛，本条与下面用到它的两条会一起判红——
  // 刻意不做成"取不到就跳过"：没有参照物的白名单闸看起来全绿，实际已经不认识现行口径了。
  const live = readLiveMeasurements()
  assert.ok(live.length > 0, '实测值列表为空')
})

test('文档正文没有手抄受管量的值（未登记的数字一律判红）', () => {
  const live = readLiveMeasurements()
  const liveByValue = new Map()
  for (const m of live) {
    if (!liveByValue.has(m.value)) liveByValue.set(m.value, [])
    liveByValue.get(m.value).push(m.label)
  }

  const files = collectMarkdown()
  const offenders = []
  for (const rel of files) {
    for (const hit of scanFile(rel)) {
      if (WHITELIST.has(hit.value)) continue
      offenders.push(hit)
    }
  }

  // 无论绿红都打印一行扫描规模：闸的作用域悄悄缩小（比如范围写错扫了 0 个文件）时能看见。
  console.log(
    `\n── 手抄数字防漂闸：扫描 ${files.length} 份 markdown，` +
      `管辖区间 [${BAND_LO}, ${BAND_HI}]，白名单 ${WHITELIST.size} 条，` +
      `当前实测受管量 ${[...liveByValue.keys()].sort((a, b) => a - b).join(' / ')} ──`,
  )

  if (offenders.length === 0) return

  const detail = offenders
    .map((o) => {
      const labels = liveByValue.get(o.value)
      const flag = labels
        ? `\n        ⚠ 这正是 \`node --test ${BUDGET_GATE_REL}\` 当前实测的【${labels.join(' / ')}】——` +
          '文档一旦写死它，下次这个量一变就静默失准。'
        : ''
      return `  ${o.rel}:${o.line}  抄的数：${o.raw}${flag}\n        行：${o.text.slice(0, 120)}`
    })
    .join('\n')

  assert.fail(
    `文档正文里有 ${offenders.length} 处未登记的数字落在受管区间 [${BAND_LO}, ${BAND_HI}]：\n${detail}\n\n` +
      '两条合法出口，按这个数**是什么**二选一（MUST NOT 靠放宽 BAND 或删掉本闸过关）：\n' +
      '  A. 它在陈述**现行口径**（这个量现在是多少）→ MUST 删掉数字，改成指向机器闸的句子，例如：\n' +
      `     「当前值以 \`node --test ${BUDGET_GATE_REL}\` 的输出为准（该命令无论绿红都打印逐文件明细）」。\n` +
      '     常驻前置量与常驻整篇合计**没有**合法的手抄形态：切段口径一变，抄下来的数就错，而且不会报错。\n' +
      '  B. 它在做**历史记账**（某次观测、某版被改掉的目标值、某轮推演的中间数）→ 把它加进本文件的\n' +
      '     WHITELIST，写成 `[<数值>, { kind: \'历史记账\', why: \'<记的是哪一次、哪个口径下的什么量>\' }]`。\n' +
      '     why MUST 写清来历，MUST NOT 只填数字；历史记载 MUST NOT 被改写（`文档治理.md` §3）。\n' +
      '  判不准是 A 还是 B 时问自己：这个量下个月会变吗？会变 → A；它记的是某一刻发生过的事 → B。',
  )
})

test('白名单里的〈现行门槛〉与那条闸的 BUDGET 一致（门槛改了文档不能不动）', () => {
  const budget = readBudgetConstant()
  assert.ok(
    budget !== null,
    `读不出 ${BUDGET_GATE_REL} 里的 \`const BUDGET = <数字>\`——门槛交叉校验失效。` +
      'MUST 同改本文件的 readBudgetConstant()。',
  )
  const thresholds = [...WHITELIST.entries()].filter(([, v]) => v.kind === '现行门槛')
  assert.equal(
    thresholds.length,
    1,
    `白名单里 kind 为〈现行门槛〉的条目应有且只有一条，实际 ${thresholds.length} 条。` +
      '门槛是判据不是观测值，多一条就说明有个现行口径被当历史记账放行了。',
  )
  assert.equal(
    thresholds[0][0],
    budget,
    `门槛不一致：${BUDGET_GATE_REL} 的 BUDGET = ${budget}，白名单登记的现行门槛 = ${thresholds[0][0]}。\n` +
      '门槛在闸里改了，文档里那几十处写死的门槛数字不会自己变——MUST 全仓改一遍再改这条白名单，' +
      'MUST NOT 只改白名单让本条变绿。',
  )
})

test('白名单条目 MUST NOT 等于当前实测值（历史记账不得用来放行现行口径）', () => {
  // 这道护栏钉的是白名单法唯一的结构性漏洞：把一个**活的**值以"历史观测"的名义登记进白名单，
  // 此后正文里怎么抄都放行。判法很简单——历史记账登记的是"当时"的数，它等于"现在"的数只有
  // 两种可能：要么登记错了，要么这个量恰好漂回了那个历史值。两种都要人来看一眼，不能静默放过。
  const live = readLiveMeasurements()
  const clashes = []
  for (const m of live) {
    const entry = WHITELIST.get(m.value)
    if (entry && entry.kind === '历史记账') clashes.push({ ...m, entry })
  }
  assert.equal(
    clashes.length,
    0,
    `白名单里有条目与当前实测值撞上：\n` +
      clashes.map((c) => `  ${c.value} 登记为「${c.entry.why}」，而它正是当前的【${c.label}】`).join('\n') +
      '\n两种可能，MUST 当场分辨：\n' +
      '  · 登记错了——它其实是个现行口径被当成历史记账放行了 → MUST 删掉这条白名单，把正文改成引用机器闸。\n' +
      '  · 这个量恰好漂回了那个历史值——罕见但可能 → MUST 确认正文那几处写的确实是历史那一次的记账，' +
      '确认后把 why 补上"与当前实测值同值，属巧合"再放行。\n' +
      '  MUST NOT 只为了让本条变绿就删白名单或改数字。',
  )
})

test('白名单没有死条目（登记过的数字仍出现在文档里）', () => {
  // 卫生检查：一条白名单在文档里已经找不到对应处，就成了**潜在的静默豁免**——将来某个受管量
  // 漂到那个数、有人抄进正文时，本闸会因为这条死条目而放行。修法只有一步：删掉那一行。
  const seen = new Set()
  for (const rel of collectMarkdown()) {
    for (const hit of scanFile(rel)) seen.add(hit.value)
  }
  const dead = [...WHITELIST.keys()].filter((v) => !seen.has(v))
  assert.equal(
    dead.length,
    0,
    `白名单里有 ${dead.length} 条已经在文档里找不到对应处：${dead.join(' / ')}。\n` +
      '死条目是潜在的静默豁免：将来受管量漂到这个数、有人抄进正文时，本闸会因为它而放行。\n' +
      'MUST 删掉本文件 WHITELIST 里对应的那一行（这就是全部修法）。' +
      '若这个数只是暂时被移出文档、之后还要写回来，可以留着，但 MUST 在 why 里注明原因。',
  )
})
