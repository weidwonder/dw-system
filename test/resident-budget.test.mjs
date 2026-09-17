// 常驻前置量机器闸（AC-003 / spec §7 三个量化契约之一）。
//
// 为什么要有这份测试：**"常驻前置量"是一个取决于切段算法的数字**，而它此前被硬抄进四份
// 文档（CLAUDE.md / spec §7 / 真跑验收报告 / 复算稿），四处各写了一个不同的值。一个人手算
// 一遍就多一个版本——差异全部来自"怎么切段"，不来自文件本身。所以这里把**算法写死在一处**，
// 由测试当场算、当场打印，文档只负责引用这一处算出来的数；再漂就是文档的错，不是算法的。
//
// ── 切段算法（改这段等于改契约，MUST 同步 spec §7 与 CLAUDE.md 引用的数字）──────────
//
// 1. **逐标题切段，任意层级**（`^#{1,6} `）。不按 `##` 单层切：`代码事实纪律.md` 的 §4.1 /
//    §4.2 是 `###`，它们各自带自己的〈何时读本节〉标注，按 `##` 切会把这两节的标注吞掉，
//    整个 §4 只剩一个标注——那正是四份文档里数字打架的主要来源。
//    标题识别 MUST 跳过 ``` 围栏内的行：`代码事实纪律.md` 的示例块里有 `# 在项目根跑…`，
//    `代码评审纪律.md` 的 prompt 模板里有 `## 本轴职责`，当成标题会把一段切成两段。
// 2. **每段取自己的标注**：段内第一行形如 `> **何时读本节**：…` 的即是。MUST 行首锚定——
//    文件抬头那句"每个小节标题下都有一行 `> **何时读本节**`"是**反引号内的说明**，不是标注，
//    不锚定行首会把它误当成 H1 段的标注。
// 3. **没有自己标注的段，继承最近祖先标题的标注**（按层级栈回溯）。这样 `###` 子节不必重复
//    标注，也保证"给 §4 标了触发式、它的子节自动跟着触发式"。
// 4. **祖先也没有标注 → 默认判为前置**。理由：没标注就意味着没人声明它可以延后，延后一个
//    未声明的判据是静默丢判据，比多算几个字节危险得多。这条同时覆盖了"整篇没有任何标注的
//    文件"（`用户沟通纪律.md` / `上下文卫生.md` / `collab/*.md` / `SKILL.md`）——它们整篇计入前置。
// 5. **标注里含带括号的分类标记 `（前置` 判为前置**，否则判触发式。标记取自两份文件抬头自己
//    声明的分类法（"取值只有两类——**前置** … 与 **触发式** …"），前置标注一律写成
//    `…（前置）` 或 `…（前置，本文唯一在分流前取的一节）`。
//    MUST NOT 拿标注里的**动作描述**当特征（曾用过「立即读」）：动作措辞会随加载模型演进
//    改写——`每次唤起时立即读（前置）` 一次改成 `完整分支补齐常驻时读（前置）`，分类没变，
//    以「立即读」判定的结果却从 13,492 掉到 2,159 字节，而且**全绿**。分类标记是契约，
//    动作描述是文案，机器闸只认前者。
//    也 MUST NOT 只匹配裸的「前置」二字：触发式标注里会出现"…前置节…""未命中前 MUST NOT
//    预读"这类词，那会把触发式误判成前置。带括号的 `（前置` 两头都不沾。
//    这条判定另有一道护栏（下方第二个 test）：两份带标注的文件各自 MUST 同时数得出前置节与
//    触发式节，标记再被改写时当场判红，而不是静默把一整类算错。
// 6. **段的字节数含标题行与每行末尾换行**，因此逐段字节数之和恰好等于整篇字节数（可自校验）。
//
// ── 为什么门槛判前置量而不是整篇合计 ────────────────────────────────────────────
// 按节加载是本次改造的核心：常驻六份**没有任何一次真实加载会读完整篇**——触发式节要等各自的
// 触发点，而多数触发点在单次任务里根本不命中。整篇合计（当前 62,195 字节）因此不对应任何一次
// 真实的上下文占用，拿它当门槛既高估了成本，也会诱导用"删内容"而不是"标对加载时机"去过闸。
// 门槛判的是**每次唤起都必然付出的那部分**，也就是前置量。整篇合计仍然打印出来，作为
// "触发式节到底延后了多少"的参照，MUST NOT 拿它去和 50,000 比。
//
// ── collab/ 为什么取两者较大值 ──────────────────────────────────────────────────
// `collab/{solo,team}.md` 是二选一，但常驻集合的**真实成本是最坏情况**：一个 team 项目付的是
// team.md 那份。取较大值当上界，才不会出现"按 solo 算过闸、换个项目就超"的情况。
//
// spec：docs/spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md §7（AC-003）
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wfRoot = path.join(repoRoot, 'dw-system', 'skills', 'dw-workflow')

// 常驻六份（spec §4.1 判定结果 / FR-002）：入口 + core 四篇 + collab 一份。
// collab 那一份二选一，所以这里列成两个候选，下面各算一遍取较大值。
const FIXED_RESIDENT = [
  'SKILL.md',
  'references/core/00-流程总纲.md',
  'references/core/代码事实纪律.md',
  'references/core/用户沟通纪律.md',
  'references/core/上下文卫生.md',
]
const COLLAB_CANDIDATES = ['references/collab/solo.md', 'references/collab/team.md']

// AC-003 的门槛。压不下去时 MUST 扩大拆分范围，MUST NOT 下调这个值（spec §7）。
const BUDGET = 50000

// 分类标记：见文首算法第 5 条。改这个常量等于改判定口径，MUST 同步文首注释。
const FRONT_MARKER = '（前置'
const isFrontAnnotation = (a) => a.includes(FRONT_MARKER)

// 带〈何时读本节〉标注的常驻分册。用于下方的分类护栏：其余四份整篇前置、没有标注可校验。
const ANNOTATED = ['references/core/00-流程总纲.md', 'references/core/代码事实纪律.md']

const abs = (rel) => path.join(wfRoot, ...rel.split('/'))
const bytes = (s) => Buffer.byteLength(s, 'utf8')

/** 段自己的〈何时读本节〉标注行（行首锚定，无则 null）。 */
function ownAnnotation(lines) {
  for (const line of lines) {
    if (/^>\s*\*\*何时读本节\*\*/.test(line)) return line
  }
  return null
}

/**
 * 按上面的算法切段并判定前置/触发式。
 * 返回 { total, front, sections: [{ title, level, size, isFront, annotated }] }。
 */
function analyze(body) {
  const lines = body.split('\n')
  // 结尾换行会切出一个空串元素；去掉它，逐段字节数之和才等于整篇字节数。
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

  const sections = []
  let inFence = false
  let current = { title: '（文件抬头）', level: 0, lines: [] }
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence
    const m = inFence ? null : /^(#{1,6}) (.*)$/.exec(line)
    if (m) {
      sections.push(current)
      current = { title: m[2].trim(), level: m[1].length, lines: [line] }
      continue
    }
    current.lines.push(line)
  }
  sections.push(current)

  // 逐段定标注：自己的优先，否则继承最近祖先（层级栈）。
  const stack = [] // [{ level, annotation }]
  const out = []
  for (const sec of sections) {
    while (stack.length > 0 && stack[stack.length - 1].level >= sec.level) stack.pop()
    const own = ownAnnotation(sec.lines)
    const inherited = stack.length > 0 ? stack[stack.length - 1].annotation : null
    const effective = own ?? inherited
    stack.push({ level: sec.level, annotation: effective })
    out.push({
      title: sec.title,
      level: sec.level,
      // 每行都补回自己的换行，段和 = 整篇。
      size: bytes(sec.lines.map((l) => `${l}\n`).join('')),
      // 无标注（自己没有、祖先也没有）→ 默认前置，见算法第 4 条。
      isFront: effective === null || isFrontAnnotation(effective),
      annotated: own !== null,
    })
  }

  const total = out.reduce((a, s) => a + s.size, 0)
  const front = out.filter((s) => s.isFront).reduce((a, s) => a + s.size, 0)
  return { total, front, sections: out }
}

/** 算一套常驻集合（固定五份 + 指定的 collab 分册）的前置量与整篇量。 */
function measure(collabRel) {
  const files = [...FIXED_RESIDENT, collabRel]
  const rows = files.map((rel) => {
    const body = readFileSync(abs(rel), 'utf8')
    const { total, front, sections } = analyze(body)
    return { rel, total, front, sections }
  })
  return {
    rows,
    front: rows.reduce((a, r) => a + r.front, 0),
    total: rows.reduce((a, r) => a + r.total, 0),
  }
}

test('常驻六份的文件都存在（改名后静默漏算一份会让数字凭空变小）', () => {
  for (const rel of [...FIXED_RESIDENT, ...COLLAB_CANDIDATES]) {
    assert.ok(
      existsSync(abs(rel)),
      `常驻分册缺失或已改名：${rel}——本闸会因此少算一整份，MUST 同步更新 FIXED_RESIDENT/COLLAB_CANDIDATES`,
    )
  }
})

test('前置/触发式的分类标记仍然判得出来（标注改写不得静默塌成一类）', () => {
  // 这道护栏钉的是文首算法第 5 条的失效形态：标注被改写后分类标记不再匹配，所有节被算成
  // 同一类，前置量凭空变小或变大，而断言照样全绿——数字错了没有任何信号。
  // 判法：带标注的两份文件，各自 MUST 同时数得出「自己带标注且判为前置」与「自己带标注且
  // 判为触发式」的节。任一为 0 就说明标记失配（或那份文件真的只剩一类，同样要人来看一眼）。
  for (const rel of ANNOTATED) {
    const { sections } = analyze(readFileSync(abs(rel), 'utf8'))
    const annotated = sections.filter((s) => s.annotated)
    const front = annotated.filter((s) => s.isFront).length
    const trig = annotated.length - front
    assert.ok(
      annotated.length > 0,
      `${rel} 里一行 \`> **何时读本节**\` 标注都找不到——本闸会把整篇算成前置，MUST 检查标注写法`,
    )
    assert.ok(
      front > 0 && trig > 0,
      `${rel} 的〈何时读本节〉标注只判出一类（前置 ${front} 节 / 触发式 ${trig} 节，共 ${annotated.length} 节带标注）：` +
        `分类标记 \`${FRONT_MARKER}\` 很可能已被改写。MUST 同步本文件的 FRONT_MARKER 与文首算法第 5 条，` +
        'MUST NOT 放着不管——那会让前置量整类算错且全绿。',
    )
  }
})

test(`常驻前置量 ≤ ${BUDGET} 字节（AC-003）`, () => {
  const byCollab = COLLAB_CANDIDATES.map((rel) => [rel, measure(rel)])
  // 最坏情况才是常驻集合的真实成本，见文首说明。
  const [worstCollab, worst] = byCollab.reduce((a, b) => (b[1].front >= a[1].front ? b : a))

  // 无论绿红都打印：这个数要被文档引用，MUST 能一条命令拿到。
  // 测试静默通过的话，人还是会去手抄，四份文档四个数就是这么来的。
  const lines = []
  lines.push('')
  lines.push('── 常驻前置量实测（算法见 test/resident-budget.test.mjs 文首）──────────────')
  for (const [rel, m] of byCollab) {
    lines.push(`  【collab 取 ${path.basename(rel)}】前置合计 ${m.front} / 整篇合计 ${m.total} 字节`)
  }
  lines.push(`  取两者较大值（上界）：collab=${path.basename(worstCollab)} → 前置 ${worst.front} / 整篇 ${worst.total}`)
  lines.push('')
  lines.push('  逐文件明细（按上界那一套算）：')
  for (const r of worst.rows) {
    const trig = r.total - r.front
    lines.push(
      `    ${r.rel.padEnd(34, ' ')} 前置 ${String(r.front).padStart(6)} | 触发式 ${String(trig).padStart(6)} | 整篇 ${String(r.total).padStart(6)}`,
    )
  }
  lines.push('')
  lines.push(`  前置合计 ${worst.front} / 门槛 ${BUDGET}（余量 ${BUDGET - worst.front}）`)
  lines.push(`  整篇合计 ${worst.total}——仅作参照：常驻六份没有任何一次真实加载会读完整篇，`)
  lines.push('           触发式节要等各自的触发点，MUST NOT 拿整篇合计去和门槛比。')
  lines.push('────────────────────────────────────────────────────────────────────────')
  console.log(lines.join('\n'))

  // 自校验：逐段字节数之和 = 整篇字节数。切段逻辑漏行/重复计数会在这里当场暴露。
  for (const r of worst.rows) {
    assert.equal(
      r.sections.reduce((a, s) => a + s.size, 0),
      r.total,
      `切段自校验失败（逐段之和 ≠ 整篇）：${r.rel}`,
    )
  }

  assert.ok(
    worst.front <= BUDGET,
    `常驻前置量 ${worst.front} 字节超出门槛 ${BUDGET}（AC-003）。` +
      'MUST 扩大拆分范围把节标成触发式或移出常驻（下一顺位是把 `代码事实纪律.md` 拆成常驻要点 + 延后细则），' +
      'MUST NOT 下调门槛值。',
  )
})
