// 评审门的「什么时候跑」与「配套测试算不算 P 面」两条契约（2.16.0，
// spec `docs/spec/2026-09-14-评审门积压通路与测试面收窄-eng-spec.md` §2.1 / FR-001~FR-016）。
//
// 为什么要有这份测试：这两条改的都是**门禁的成立条件**，而成立条件被复述在六个文件里——
// 主会话读 `代码评审纪律.md`，Lean 只读 `路径-lean.md`，完整流程的骨架读 `00-流程总纲.md`，
// 合并时读 `worktree开发纪律.md`，solo 项目另读 `collab/solo.md`，目标项目拿到的是
// `config-snippets/base.md`。漏改任一处，那条路径上的 agent 会按另一套条件决定跑不跑门，
// 而六份文件**各自读起来都自洽**——没有任何一条既有闸会报错。
//
// 失败模式排第一的那个：**把「积压」读成「豁免」**。它与 2026-09-03 撤回的裁剪准入长得很像，
// 区别全在几句话上（tag 不移动 / trailer 必写 / 结算时连同积压一起评 / 轴一条不裁）。
// 那几句话一旦在某一处被"精简"掉，那条路径上的积压就再也不会被评到，且永远静默。
//
// 作用域：只查**机械可判**的那一半——判据在不在场、阈值有没有漂、禁令有没有被删。
// 规则定得合不合理是判断题，归代码评审门自己。MUST NOT 把本闸全绿读成"这两条契约描述正确"。
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
const OUTLINE = read(wfRoot, 'references', 'core', '00-流程总纲.md')
const WORKTREE = read(wfRoot, 'references', 'core', 'worktree开发纪律.md')
const SOLO = read(wfRoot, 'references', 'collab', 'solo.md')
const SNIPPET = read(wfRoot, 'assets', 'config-snippets', 'base.md')

/**
 * 按小节切段，而不是拿整篇去 `includes`。
 *
 * 写这条闸时的反向自检当场撞出过：同一句 MUST（"MUST NOT 移动 reviewed-through tag"）
 * 在 `路径-lean.md` 的 §9 与 §11 各出现一次，把 §9 那处整条删掉，全文匹配照样全绿。
 * 判据住在哪一节是它能不能在**那一刻**被读到的全部，所以匹配 MUST 跟着节走。
 */
const cut = (body, from, to) => {
  const i = body.indexOf(from)
  assert.notEqual(i, -1, `锚点失效（文档已改写，断言需同步）：${from}`)
  const j = body.indexOf(to, i + from.length)
  assert.notEqual(j, -1, `锚点失效（文档已改写，断言需同步）：${to}`)
  return body.slice(i, j)
}

/** Lean 的评审门一节：积压通路的全部判据都 MUST 落在这里，读到 §9 才轮得到它。 */
const LEAN_REVIEW = cut(LEAN, '## 9. 第 9 步：代码评审门', '## 10. 第 10 步')
/** Lean 的完成与合并门一节：准出项那两条通路落在这里。 */
const LEAN_MERGE = cut(LEAN, '## 11. ', '## 12. ')
/** 主会话的门禁一节：第零步住在 §门禁 下，与 §评审轴 之后的内容分开。 */
const REVIEW_GATE = cut(REVIEW, '## 门禁', '## 评审轴')

/** 三处完整复述积压通路：主会话 §门禁 / Lean §9 / 目标项目。总纲与 solo 只复述要点，另表。 */
const FULL_RESTATERS = [
  ['代码评审纪律.md §门禁', REVIEW_GATE],
  ['路径-lean.md §9', LEAN_REVIEW],
  ['config-snippets/base.md', SNIPPET],
]

// ---------------------------------------------------------------------------
// 一、配套测试不单独构成 P 面（FR-001 ~ FR-004）
// ---------------------------------------------------------------------------

test('测试文件例外的两条判定口径，在每个复述对象面的文件里都齐全', () => {
  // 两条 MUST 同时成立才算测试文件。只写第一条会把产品代码里叫 `foo.test.mjs` 的
  // 工具脚本也放过去；只写第二条会把任何没人 import 的孤立源码放过去。
  for (const [name, body] of FULL_RESTATERS) {
    assert.ok(
      /既有测试目录/.test(body),
      `${name} 缺测试文件判定的第一条（位于既有测试目录内，或名字匹配）`,
    )
    assert.ok(
      body.includes('*.test.*'),
      `${name} 缺文件名匹配的取值样例——只说"测试文件"会让两个执行者算出两个结论`,
    )
    assert.ok(
      /不被任何非测试的可执行代码文件/.test(body),
      `${name} 缺测试文件判定的第二条（不被非测试代码 import / require / 加载）`,
    )
  }
})

test('例外的反向条款在场：混进一个非测试可执行文件，整个范围照常按 P 面处理', () => {
  // 这是本例外最容易被做错的一半。少了它，执行者会把 diff 按文件拆开、
  // 给测试那部分派 {S,A}、给非测试那部分派 {A,B,C,D}——而"一次评审门只有一个轴集合"。
  for (const [name, body] of FULL_RESTATERS) {
    assert.ok(
      /整个范围照常按 P 面处理/.test(body),
      `${name} 缺反向条款：只要有一个可执行文件不满足那两条，整个范围照常按 P 面处理`,
    )
    assert.ok(
      /轴是按面派的.*不是按文件派的/.test(body),
      `${name} 缺"轴是按面派的不是按文件派的"——它是上一条的理由，删了理由就会被当成可商量的`,
    )
  }
  assert.ok(
    /整个范围照常按 P 面处理/.test(OUTLINE),
    '00-流程总纲.md 缺反向条款',
  )
})

test('例外命中时轴集合是 {S, A}，且 A 轴在此另查哑闸', () => {
  // A 轴保留不是随手留的：它是唯一在看这份测试代码的轴。如果哪天有人把它也去掉，
  // 机器闸自身的质量就再没有任何一轴在管——这正是本仓库记忆里那条"机器闸要做反向自检"
  // 要防的事，而它恰恰只能靠一条判断题轴发现。
  for (const [name, body] of FULL_RESTATERS) {
    assert.ok(/恒绿/.test(body), `${name} 缺 A 轴在测试文件在场时的加重职责（查哑闸 / 恒绿）`)
  }
  assert.ok(/`\{S, A\}`/.test(REVIEW_GATE), '代码评审纪律.md §门禁 未写明该场景的轴集合是 {S, A}')
  assert.ok(/`\{S, A\}`/.test(LEAN_REVIEW), '路径-lean.md §9 未写明该场景的轴集合是 {S, A}')
  assert.ok(/恒绿/.test(OUTLINE), '00-流程总纲.md 缺 A 轴查哑闸这一条')
})

test('例外 MUST NOT 被读成"测试文件可以不评"', () => {
  // 范围里除了测试什么都没有时没有别的面可归，P 面照常命中。
  // 少了这句，"不单独构成 P 面"会被读成"不构成任何面"，于是只改测试的那次改动零轴可派。
  for (const [name, body] of FULL_RESTATERS) {
    assert.ok(
      /MUST NOT 被读成.*测试文件不属于任何面/.test(body),
      `${name} 缺"MUST NOT 被读成测试文件不属于任何面、可以不评"`,
    )
  }
})

// ---------------------------------------------------------------------------
// 二、积压通路（FR-005 ~ FR-014）
// ---------------------------------------------------------------------------

test('五个阈值的取值与比较方向，在四处完整复述里都一致', () => {
  // 阈值漂移是这类判据最典型的失效方式：某一处被"顺手调宽"，那条路径上的门就松了，
  // 而各份文件读起来都自洽。
  //
  // **方向必须一起查**。本闸的第一版只验"数字与单位出现过"，评审门 A 轴用 scratch 副本实测
  // 把三份文件的 `代码 >100 行` 全改成 `代码 <100 行`（语义从"超过封顶才当场跑"反转成
  // "低于封顶才当场跑"，累计封顶彻底失效）——16 项照样全绿。数字对、方向反，是比数字漂移
  // 更隐蔽的一种失效：diff 上只差一个字符。
  //
  // 覆盖面取**四处**而不是三处：`00-流程总纲.md` 同样完整复述了这五个阈值，它单独漂移时
  // 一样要报红。`worktree开发纪律.md` 与 `collab/solo.md` 本就不复述具体数字，不在此列。
  const NUMERIC = [
    // [阈值, 正确的比较方向, 反向（出现即判红）, 这一维失效时会发生什么]
    ['20 行', '≥', '<', '单次阈值：任何大小的改动都能积压'],
    ['40 行', '≥', '<', '单次阈值：任何大小的文档改动都能积压'],
    ['100 行', '>', '<', '累计封顶失效：攒多少积压都不会强制结算'],
    ['200 行', '>', '<', '累计封顶失效：攒多少文档积压都不会强制结算'],
    ['14 天', '>', '<', '时间封顶失效：积压可以无限期不结算'],
  ]
  const SCOPE = [...FULL_RESTATERS, ['00-流程总纲.md §代码评审门', OUTLINE]]
  for (const [name, body] of SCOPE) {
    for (const [value, dir, wrongDir, consequence] of NUMERIC) {
      assert.ok(
        body.includes(`${dir}${value}`) || body.includes(`${dir} ${value}`),
        `${name} 缺阈值「${dir}${value}」——${consequence}`,
      )
      assert.ok(
        !body.includes(`${wrongDir}${value}`) && !body.includes(`${wrongDir} ${value}`),
        `${name} 出现了反向的「${wrongDir}${value}」——${consequence}。`
          + '数字对、方向反，diff 上只差一个字符，是比数字漂移更隐蔽的一种失效',
      )
    }
  }
})

test('派给子代理的〈评审对象〉用的是评审基点，不是目标主分支', () => {
  // 这一行是真正被复制进子代理 prompt 的那句话。它若还写着 `git diff 【目标主分支】...HEAD`，
  // 结算积压那次子代理拿到的范围就退化成"本次任务分支"，此前积压的改动整批漏出评审范围——
  // 直接违反 spec Invariant 1，而其余所有断言都照样绿（评审门 C 残留轴实测报出）。
  for (const [name, body] of [['代码评审纪律.md §子代理 prompt 模板', REVIEW], ['路径-lean.md §9.3', LEAN_REVIEW]]) {
    assert.ok(
      /改动范围：`git diff 【评审基点】\.\.\.HEAD`|\*\*评审对象\*\*：`git diff 【评审基点】\.\.\.HEAD`/.test(body),
      `${name} 的〈评审对象〉未用【评审基点】——结算积压那次会把积压整批漏出评审范围`,
    )
    assert.ok(
      !/git diff 【目标主分支】\.\.\.HEAD` 这个范围|改动范围：`git diff 【目标主分支】/.test(body),
      `${name} 的〈评审对象〉残留 \`git diff 【目标主分支】...HEAD\` 的旧写法`,
    )
  }
})

test('单次与累计是两个不同的范围，且消歧句在场', () => {
  // 合一会让累计封顶永远轮不到：第二次积压时累计就已超过单次阈值。
  // 这条是写 spec 时推演出来的，不是事后补的——删掉它，两个范围会在下一次重写时被合并。
  for (const [name, body] of FULL_RESTATERS) {
    assert.ok(
      /MUST NOT 混为一谈/.test(body),
      `${name} 缺"两个范围 MUST NOT 混为一谈"的消歧句`,
    )
    assert.ok(
      /MUST NOT 按单个 commit 算/.test(body),
      `${name} 缺"阈值按整条任务分支算、MUST NOT 按单个 commit 算"——少了它拆 commit 就能绕过阈值`,
    )
  }
})

test('禁止积压清单三类齐全，且写明不看行数', () => {
  const CLASSES = ['安全与鉴权面', '流程与门禁判据本身', '对外契约变更']
  for (const [name, body] of FULL_RESTATERS) {
    for (const c of CLASSES) {
      assert.ok(body.includes(c), `${name} 缺禁止积压清单的「${c}」`)
    }
    assert.ok(
      /MUST NOT 看行数/.test(body),
      `${name} 缺"判定时 MUST NOT 看行数"——三行改得起一个漏洞，行数在这里不是风险的度量`,
    )
  }
  // 第②类是自指的：改门禁判据的改动不能用它自己新造的通路给自己开口子。
  assert.ok(
    /MUST NOT 用它自己新造的通路给自己开口子/.test(REVIEW_GATE),
    '代码评审纪律.md §门禁 缺第②类的自指说明',
  )
})

test('积压路径的三件事齐全，其中不移动 tag 是它能被评到的全部机制', () => {
  for (const [name, body] of FULL_RESTATERS) {
    assert.ok(body.includes('Review-Deferred'), `${name} 缺 trailer 登记`)
    assert.ok(
      /MUST NOT 移动 `reviewed-through` tag/.test(body),
      `${name} 缺"合并时 MUST NOT 移动 reviewed-through tag"——动了它，那批改动再也不会进入任何一次评审范围`,
    )
    assert.ok(
      /MUST NOT 另立台账文档/.test(body),
      `${name} 缺"MUST NOT 另立台账文档"——第二份账本只会产生第二份要同步的真相`,
    )
    assert.ok(
      /MUST NOT 逐次征求同意/.test(body) && /MUST NOT 不告知/.test(body),
      `${name} 的决策归属两半不全：MUST 机械判定不逐次问，但 MUST NOT 不告知`,
    )
  }
})

test('积压只豁免评审门这一道，基础验证不豁免', () => {
  // 少了这条，"积压"会被读成"这次什么都不用做"。
  for (const [name, body] of FULL_RESTATERS) {
    assert.ok(
      /积压只豁免/.test(body),
      `${name} 缺"积压只豁免本门这一道"`,
    )
    assert.ok(
      /基础验证/.test(body) && /测试跑绿/.test(body),
      `${name} 缺"基础验证（测试跑绿、无编译/语法错）不豁免"`,
    )
  }
})

test('结算路径：按含住积压的那个范围判面，过门并合并成功后才移动 tag', () => {
  for (const [name, body] of FULL_RESTATERS) {
    assert.ok(
      /git tag -f reviewed-through/.test(body),
      `${name} 缺结算时移动 tag 的动作`,
    )
    assert.ok(
      /合并失败时 MUST NOT/.test(body),
      `${name} 缺"合并失败时 MUST NOT 移动 tag"——合并没成功却挪了基点，那批改动同样丢失`,
    )
    assert.ok(
      /结算积压/.test(body),
      `${name} 缺报告首行的〈结算积压〉一项`,
    )
  }
  assert.ok(
    /含此前全部积压/.test(REVIEW_GATE) && /MUST NOT 只按本次任务分支算/.test(LEAN_REVIEW),
    '结算时"对象面按整个范围算"这条在权威处或 Lean 侧缺失',
  )
})

test('tag 缺失与失效都是降级不是错误', () => {
  // 存量项目、刚 clone 的仓库一律没有这个 tag。把它做成硬依赖，
  // 等于让本次升级对所有存量项目都变成"需要手动动作"。
  for (const [name, body] of FULL_RESTATERS) {
    assert.ok(
      /MUST NOT 报错/.test(body),
      `${name} 缺"tag 不存在 MUST NOT 报错、MUST NOT 阻断本门"`,
    )
    assert.ok(
      /MUST NOT 要求推送/.test(body),
      `${name} 缺"tag 是本地资产、MUST NOT 要求推送到远端"`,
    )
  }
  assert.ok(/基点失效已退回主分支/.test(REVIEW_GATE), '代码评审纪律.md §门禁 缺 tag 失效的降级')
  assert.ok(/基点失效已退回主分支/.test(LEAN_REVIEW), '路径-lean.md §9 缺 tag 失效的降级')
})

test('积压 MUST NOT 被读成裁剪：轴一条不裁，且与 2026-09-03 撤回的那条准入划清界限', () => {
  // 这两条长得很像，区别全在"推后 vs 取消"上。判据里 MUST 自己说清楚，
  // 否则下一个读到的人会以为裁剪准入被悄悄复活了，然后照着它裁轴。
  for (const [name, body] of FULL_RESTATERS) {
    assert.ok(
      /MUST NOT 使轴集合为空/.test(body) && /MUST NOT 使任何一轴被裁剪/.test(body),
      `${name} 缺"积压 MUST NOT 使轴集合为空、MUST NOT 使任何一轴被裁剪"`,
    )
  }
  assert.ok(/2026-09-03/.test(REVIEW_GATE), '代码评审纪律.md §门禁 未与撤回的裁剪准入划清界限')
  assert.ok(/2026-09-03/.test(LEAN_REVIEW), '路径-lean.md §9 未与撤回的裁剪准入划清界限')
  // 反向护栏：撤回的那条准入 MUST NOT 以任何形态残留。
  for (const [name, body] of [['代码评审纪律.md', REVIEW], ['路径-lean.md', LEAN], ['config-snippets/base.md', SNIPPET], ['00-流程总纲.md', OUTLINE], ['worktree开发纪律.md', WORKTREE]]) {
    assert.ok(
      !/三条准入/.test(body) && !/裁剪 C\/D/.test(body),
      `${name} 残留已撤回的裁剪准入表述`,
    )
  }
})

test('总纲与 solo 的护栏条已从"不许不派"改成"不许免掉"，且没把积压读成豁免', () => {
  // 旧措辞「MUST NOT 因为改动很小就一个子代理都不派」与积压通路直接冲突：
  // 积压恰恰就是"这次一个都不派"。两条同时留着，执行者只能二选一猜。
  for (const [name, body] of [['00-流程总纲.md', OUTLINE], ['collab/solo.md', SOLO]]) {
    assert.ok(
      /而免掉|就把这道门\*\*免掉\*\*/.test(body),
      `${name} 的护栏条仍是旧措辞（"一个子代理都不派"），与积压通路冲突`,
    )
    assert.ok(
      /积压是推后不是取消/.test(body),
      `${name} 缺"积压是推后不是取消"`,
    )
  }
  assert.ok(
    /MUST NOT 读成豁免|MUST NOT 把积压读成豁免/.test(OUTLINE),
    '00-流程总纲.md 护栏条缺"MUST NOT 把积压读成豁免"',
  )
})

test('旧措辞"就一个子代理都不派"全仓零残留', () => {
  // 写这条闸时的自查当场撞出过：护栏条（总纲 §13 / solo §4）改了，`路径-lean.md` §9.1 里
  // 还单独留着一条一模一样的旧措辞。它与积压通路直接冲突——积压恰恰就是"这次一个都不派"——
  // 两条同时在场，执行者只能二选一猜，而两份文件各自读起来都自洽。
  // 上一条测试按小节查"新措辞在不在"，这条按全仓查"旧措辞还在不在"：缺任一半都拦不住漏改。
  const FILES = [
    ['代码评审纪律.md', REVIEW],
    ['路径-lean.md', LEAN],
    ['00-流程总纲.md', OUTLINE],
    ['worktree开发纪律.md', WORKTREE],
    ['collab/solo.md', SOLO],
    ['config-snippets/base.md', SNIPPET],
  ]
  for (const [name, body] of FILES) {
    assert.ok(
      !/就一个子代理都不派。\*\*$|就一个子代理都不派。\*\*\n/m.test(body)
        && !/因为"改动很小"就一个子代理都不派/.test(body),
      `${name} 残留旧措辞"MUST NOT 因为改动很小就一个子代理都不派"——它与积压通路直接冲突，`
        + 'MUST 改成"就把这道门**免掉**"，并说明积压是推后不是取消',
    )
  }
})

// ---------------------------------------------------------------------------
// 三、完成与自动合并门的准出项（FR-013）
// ---------------------------------------------------------------------------

test('完成门准出项已放宽为两条通路，且 pr 那一条明确不放宽', () => {
  for (const [name, body] of [['worktree开发纪律.md', WORKTREE], ['路径-lean.md §11', LEAN_MERGE]]) {
    assert.ok(
      /已登记积压/.test(body),
      `${name} 的完成门准出项未放宽——积压路径会永远卡在这道门上`,
    )
    assert.ok(
      /只对 `merge-gate="direct"` 成立/.test(body),
      `${name} 缺"这条通路只对 merge-gate=direct 成立"`,
    )
    assert.ok(
      /开 PR 之前把积压结清/.test(body),
      `${name} 缺"pr 项目 MUST 在开 PR 之前把积压结清"——带着未评审的积压开 PR 等于把未完成的门禁推给审批人`,
    )
  }
})

test('注入目标项目的片段里 MUST NOT 出现看起来像字段声明的写法', () => {
  // 标记块的字段面是闭集（`workflow-block.test.mjs` 盯着）。散文里写 `merge-gate="pr"`
  // 会被字段抽取当成多出来的一个字段声明，而那条闸的报错读起来完全不像"措辞问题"。
  // 块头那一行是**真正的**字段声明行（`(mode="team" collaboration="..." ...)`），它当然长这样，
  // 按"一行里同时出现 collaboration= 与 merge-gate=" 把它识别出来剔除，其余行才是散文。
  const prose = SNIPPET.split('\n')
    .filter(line => !(line.includes('collaboration=') && line.includes('merge-gate=')))
    .join('\n')
  const fieldLike = prose.match(/`?(collaboration|merge-gate|worktree-dir|mode)="[^"]*"`?/g) || []
  assert.deepEqual(
    fieldLike,
    [],
    `base.md 里出现了字段声明形态的写法：${fieldLike.join(' / ')}——散文里 MUST 改写成"合并方式为 \`pr\` 时"这类形态`,
  )
})
