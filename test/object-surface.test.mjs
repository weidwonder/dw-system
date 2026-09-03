// 对象面 → 轴集合 的推导契约（2.15.0，spec §2.1 / FR-014）。
//
// 为什么要有这份测试：2.15.0 之前"派哪几条轴"是个常数（恒跑四条 + Agentic 增派一条），
// 那时 doc-axis 用几个写死的数字就能盯住它。改成按对象面推导之后，能被漏掉的东西变了——
// 不再是"数字改了没"，而是**推导规则本身有没有在每个复述它的地方保持一致**：
// 主会话读 `代码评审纪律.md`，Lean 路径只读 `路径-lean.md`，注入目标项目的是
// `config-snippets/base.md`；三处任一漏改，那条路径上的 agent 就会按另一套规则派轴，
// 而三份文件各自读起来都自洽，没有任何一条既有闸会报错。
//
// 作用域：只查**机械可判**的那一半——三类面在不在场、映射写没写、几条硬规矩有没有被删。
// 规则写得对不对是判断题，归代码评审门的文档轴（`代码评审纪律.md` §评审轴）。
// MUST NOT 把本闸全绿读成"对象面这套东西描述正确"。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wfRoot = path.join(repoRoot, 'ai-dev-system', 'skills', 'ai-dev-workflow')
const read = (...p) => readFileSync(path.join(...p), 'utf8')

const REVIEW = read(wfRoot, 'references', 'core', '代码评审纪律.md')
const LEAN = read(wfRoot, 'references', 'core', '路径-lean.md')
const SNIPPET = read(wfRoot, 'assets', 'config-snippets', 'base.md')
const INSTALLER = read(repoRoot, 'install.mjs')

// 三处都 MUST 复述这套推导：主会话读第一份，Lean 只读第二份，目标项目拿到的是第三份。
const RESTATERS = [
  ['代码评审纪律.md', REVIEW],
  ['路径-lean.md', LEAN],
  ['config-snippets/base.md', SNIPPET],
]

test('三类对象面是闭集，且在每个复述它的文件里都齐全', () => {
  for (const [name, body] of RESTATERS) {
    // 面名与代号分开查：权威定义处用表格（`| **P** | 程序代码面 |`），复述处用连写
    // （`**P 程序代码面**`）。两种都是正常写法，闸 MUST NOT 逼着其中一处改成另一种。
    for (const [code, face] of [['P', '程序代码面'], ['K', 'skill 文档面'], ['G', 'agent 架构面']]) {
      assert.ok(
        body.includes(face),
        `${name} 里缺对象面「${face}」——少一类就有一批改动算不出轴集合，而漏掉的那类不会报错`,
      )
      assert.ok(
        new RegExp(`\\*\\*${code}\\*\\*|${code} ${face.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(body),
        `${name} 里对象面「${face}」缺代号 ${code}——报告首行要按代号写判定结论`,
      )
    }
    assert.ok(
      /MUST NOT 自造第四类/.test(body),
      `${name} 未写明三类是闭集：没有这条，遇到没见过的改动形态就会有人现编一个面`,
    )
  }
})

test('面 → 轴的映射三处一致，且写明多面命中取并集', () => {
  for (const [name, body] of RESTATERS) {
    // P 面带四条轴：逐条查，写成"等等"或省略号会让读者自己猜。
    for (const axis of ['规范', '忠实', '残留', '文档']) {
      assert.ok(body.includes(axis), `${name} 的映射里缺 ${axis}轴`)
    }
    assert.ok(/skill 原则轴/.test(body), `${name} 的映射里缺 K 面带来的 skill 原则轴`)
    assert.ok(/agent 架构轴/.test(body), `${name} 的映射里缺 G 面带来的 agent 架构轴`)
    assert.ok(/取并集/.test(body), `${name} 未写明多面命中取并集——不写就会有人按"取第一个命中的面"执行`)
  }
})

test('两条伴生轴都写明加载伴生 skill 而不是本 skill', () => {
  // 这两轴的价值全在"换一套判据来看"。子代理若加载了 ai-dev-workflow，
  // 交回来的会是一份别的轴已经给过的报告，而它看上去完全正常。
  for (const [name, body] of [['代码评审纪律.md', REVIEW], ['路径-lean.md', LEAN]]) {
    assert.ok(
      /加载 `skill-principle`/.test(body),
      `${name} 未写明 S 轴加载 skill-principle`,
    )
    assert.ok(
      /加载 `agentic-principle`/.test(body),
      `${name} 未写明 E 轴加载 agentic-principle`,
    )
    assert.ok(
      /不是本 skill|而不是本 skill|不加载\s*\n?\s*ai-dev-workflow/.test(body),
      `${name} 未挡住"这两轴也加载 ai-dev-workflow"`,
    )
    assert.ok(
      /整体不在场/.test(body),
      `${name} 缺"只有整体不在场才算不在场"——少了它，找不到某个内部文件就会被判成 skill 没装`,
    )
  }
})

test('文档说的伴生 skill 与安装器真正会装的是同两个', () => {
  // 防的是这种漂移：判据里写着 K 面加载 skill-principle，而安装器压根没装它，
  // 于是每次 S 轴都标"未执行 + 原因"，看起来像 skill 的问题，其实是接线断了。
  for (const name of ['agentic-principle', 'skill-principle']) {
    assert.ok(
      new RegExp(`name: '${name}'`).test(INSTALLER),
      `install.mjs 的 COMPANION_SKILLS 里没有 ${name}，但判据文件要求加载它`,
    )
    assert.ok(REVIEW.includes(name), `代码评审纪律.md 未提到伴生 skill ${name}`)
  }
})

test('裁剪准入三条齐全，且 B / A / S 轴不可裁剪', () => {
  for (const [name, body] of [['代码评审纪律.md', REVIEW], ['路径-lean.md', LEAN]]) {
    assert.ok(/替换清单为空/.test(body), `${name} 缺裁剪准入第 1 条`)
    assert.ok(/只触碰 1 个文件/.test(body), `${name} 缺裁剪准入第 2 条`)
    assert.ok(/未触碰任何权威面/.test(body), `${name} 缺裁剪准入第 3 条`)
    assert.ok(
      /三条全满足|全部满足/.test(body),
      `${name} 未写明三条要同时满足——写成"任一"会让绝大多数改动都可裁剪`,
    )
    assert.ok(
      /MUST NOT 被裁剪/.test(body),
      `${name} 未写明哪些轴不可裁剪：B 轴是验收本体，A 与 S 各是所在面唯一的质量出口`,
    )
    assert.ok(/MUST NOT 静默裁剪/.test(body), `${name} 未要求裁剪时写明依据`)
  }
})

test('模型档位是两档加一条下限，且没有写死厂商型号当取值', () => {
  for (const [name, body] of [['代码评审纪律.md', REVIEW], ['路径-lean.md', LEAN]]) {
    assert.ok(/普通档/.test(body) && /高档/.test(body), `${name} 缺两档档位定义`)
    assert.ok(
      /MUST NOT 派该 harness 的最低档|MUST NOT 派该 harness 的\*\*最低档\*\*/.test(body),
      `${name} 缺"MUST NOT 派最低档"这条下限——没有它，"尽量便宜"会一路探到最低档`,
    )
    assert.ok(
      /MUST NOT 写死|MUST NOT 当成取值清单/.test(body),
      `${name} 未挡住把举例的厂商型号当成取值清单——本体系同时跑在多个 harness 上`,
    )
  }
})

test('纯 K 面跳过 spec 与 plan，且理由与"门不豁免"都在场', () => {
  for (const [name, body] of RESTATERS) {
    assert.ok(/PRD 即 spec/.test(body), `${name} 未写明纯 skill 改动 PRD 即 spec`)
    assert.ok(
      /跳过的是产物，不是门/.test(body),
      `${name} 缺"跳过的是产物不是门"——少了它，跳过 spec 会被顺手读成跳过兼容取舍与过稿两道门`,
    )
    assert.ok(
      /含可执行代码/.test(body),
      `${name} 未写明"范围一旦含可执行代码，代码那部分照常写 spec"`,
    )
  }
  // 只跑 S 轴这条 MUST 带着它的理由一起出现，否则下一个读到的人会当成漏了而加回来。
  for (const [name, body] of [['代码评审纪律.md', REVIEW], ['路径-lean.md', LEAN]]) {
    assert.ok(/没有参照物/.test(body), `${name} 未写明纯 K 面不跑 B/C 轴的理由（那两轴没有参照物）`)
  }
})

test('判定结论必须写进报告首行，缺它视为未过门', () => {
  for (const [name, body] of RESTATERS) {
    assert.ok(/首行/.test(body), `${name} 未要求把判定结论写进报告首行`)
  }
  for (const [name, body] of [['代码评审纪律.md', REVIEW], ['路径-lean.md', LEAN]]) {
    assert.ok(
      /视为未过门/.test(body),
      `${name} 未写明缺首行结论的后果——不写后果，这条就只是建议`,
    )
  }
})
