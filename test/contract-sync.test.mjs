// 契约数字的引用一致性闸（FR-014 / AC-024）。
//
// 病史：本仓已经三次栽在"同一个量在多处各写一份"上。第三次是加载点清单的行数下限——
// `cards-mandatory.test.mjs` 的断言收紧到 18 之后，spec §6 Invariant 3 的强制机制行与
// `CLAUDE.md` 的契约条目都还写着 14，**三处不一致而全量测试全绿**：断言判的是清单，
// 没有任何东西判"文档里说的门槛与断言判的门槛是不是同一个数"。轻量复核的忠实轴与文档轴
// 各自独立报了这一条（B#2 / D#1），按 `代码评审纪律.md` §门禁「同一类问题被报到第二次
// 就该有闸接手」的判据，上本闸。
//
// 判据：`contract-numbers.mjs` 是**唯一定义处**；下面每个量列出它在文档里的全部引用点，
// 断言引用处出现的数字与定义值一致。
//
// 设计取舍（三条，都是实测逼出来的）：
//  1. **按"引用点 + 该行必须含定义值"判，不按"全文不得出现别的数"判**。后者会把历史记账
//     （"此前写死 14"这类叙述）判红，而那类句子恰恰是本仓刻意保留的——`number-drift.test.mjs`
//     已经证明过：纯值域法一上线就要求人篡改历史记载，那样的闸只会被关掉。
//  2. **引用点用「文件 + 锚点串」定位，不用行号**。行号会随任何一次编辑漂移，锚点串跟着
//     语义走。锚点串找不到时**判红而不是跳过**——找不到通常意味着那句话被改写或删了，
//     静默跳过等于悄悄放弃这个引用点的防线。
//  3. **同一行里允许出现别的数字**（如 "十四个 + 四个 = 18"），只要求定义值在场：
//     本仓的措辞习惯是把推导过程写进同一句，强求"只出现一个数"会逼人把判据写得更难读。
//
// 新增一个契约数字时 MUST 在 CONTRACTS 里给它加引用点清单，MUST NOT 只在
// `contract-numbers.mjs` 加个常量就完事——那只是换了个地方硬编码，一个引用点都没被盯住。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { LOADING_POINT_MIN } from './contract-numbers.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(path.join(repoRoot, ...rel.split('/')), 'utf8')

const CONTRACTS = [
  {
    name: '加载点清单行数下限',
    value: LOADING_POINT_MIN,
    // 锚点串 = 该引用点所在句子里稳定不变的一小段；MUST 唯一命中。
    refs: [
      { file: 'docs/spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md', anchor: '断言清单行数 ≥' },
      { file: 'CLAUDE.md', anchor: '清单 ≥' },
    ],
  },
]

test('契约数字：文档里的引用与单点定义一致', () => {
  const problems = []
  for (const { name, value, refs } of CONTRACTS) {
    for (const { file, anchor } of refs) {
      const body = read(file)
      const hits = body.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => l.includes(anchor))
      if (hits.length === 0) {
        problems.push(
          `【${name}】引用点失联：${file} 里找不到锚点串「${anchor}」。\n` +
            '    锚点串找不到 MUST 判红而不是跳过——通常意味着那句话被改写或删了，' +
            '静默跳过等于悄悄放弃这个引用点的防线。请核对该处现在怎么写的，并同步本闸的锚点串。',
        )
        continue
      }
      for (const [lineNo, line] of hits) {
        // 取该行里紧跟锚点之后的第一个整数，与定义值比。
        const after = line.slice(line.indexOf(anchor) + anchor.length)
        const m = after.match(/\**\s*(\d+)/)
        if (!m) {
          problems.push(`【${name}】${file}:${lineNo} 锚点「${anchor}」之后取不到数字：\n    ${line.trim().slice(0, 160)}`)
          continue
        }
        if (Number(m[1]) !== value) {
          problems.push(
            `【${name}】${file}:${lineNo} 写的是 ${m[1]}，而单点定义是 ${value}\n` +
              `    定义处：test/contract-numbers.mjs\n` +
              `    原文：${line.trim().slice(0, 160)}\n` +
              '    处置：改文档去对齐定义值；若确实要改门槛，MUST 先改 contract-numbers.mjs，' +
              '再把全部引用点一起改，MUST NOT 只改一处。',
          )
        }
      }
    }
  }
  assert.equal(problems.length, 0, `\n${problems.join('\n\n')}\n`)
})

test('护栏：每个契约数字至少有一个引用点，且定义值是正整数', () => {
  // 防退化：CONTRACTS 里留一个空 refs 的条目，本闸对它就恒绿，看起来在盯实际没盯。
  assert.ok(CONTRACTS.length > 0, 'CONTRACTS 是空的——本闸没有在盯任何东西')
  for (const { name, value, refs } of CONTRACTS) {
    assert.ok(refs.length > 0, `【${name}】没有列任何引用点：只在 contract-numbers.mjs 加常量等于换个地方硬编码`)
    assert.ok(Number.isInteger(value) && value > 0, `【${name}】定义值不是正整数：${value}`)
  }
})
