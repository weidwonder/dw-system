// 为什么要有这份测试：六个固定实现区搬出 ui-prototype.html 之后，容器与框架源文件之间
// 多了一条谁都看不见的约定——区标记在容器里、正文在别的文件里。这条约定断掉时页面照常
// 生成、命令照常退出 0，只是产出的原型缺一整块样式或整个批注框架。
//
// 本闸 MUST NOT 断言“装配结果等于某个历史字节”：那条等值只在外置落地的那一次成立，
// 固化成常驻闸之后，日后每改一次 anno.css 都会判红——而让改框架变容易正是外置的目的。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeTemplate, FRAMEWORK, FRAMEWORK_DIR, FRAMEWORK_PRE, FRAMEWORK_POST } from '../ai-dev-system/skills/ai-prd/scripts/preview.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const container = path.join(repoRoot, 'ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html')

function markRange(h, m) {
  const b = h.indexOf(`<!-- ${m}:BEGIN`); if (b < 0) return null
  const be = h.indexOf('-->', b);          if (be < 0) return null
  const e = h.indexOf(`<!-- ${m}:END`, be); if (e < 0) return null
  return { from: be + 3, to: e }
}

test('容器的六个固定区区间为空——正文只有一处，在框架源文件里', () => {
  const html = readFileSync(container, 'utf8')
  for (const it of FRAMEWORK) {
    const r = markRange(html, it.mark)
    assert.ok(r, `容器缺固定区标记：${it.mark}`)
    assert.equal(
      html.slice(r.from, r.to).trim(), '',
      `容器的 ${it.mark} 区间不为空。正文 MUST 只住在 ${it.file} 里；容器里再留一份会让装配后同一段内容出现两次，而页面照常打开。`,
    )
  }
})

test('装配表每项都对应一个存在且非空的框架源文件', () => {
  for (const it of FRAMEWORK) {
    // `files` 与 `baselineFiles` 都要查：后者只在 --with-baseline 时装配，漏查会让
    // 外观层源文件被删掉也全绿，而默认路径不装它、正好一路查不出来。
    for (const f of [...it.files, ...(it.baselineFiles || [])]) {
      const p = path.join(FRAMEWORK_DIR, f)
      assert.ok(existsSync(p), `装配表指向的框架源文件不存在：${it.mark} → ${p}`)
      assert.ok(readFileSync(p, 'utf8').trim().length > 0, `框架源文件是空的：${p}`)
    }
  }
})

// 这条 MUST 断言“区间正文 === 对应源文件的内容”，MUST NOT 只验“非空 + 含 open/close”:
// 后者是同义反复——open/close 来自同一张装配表，把 anno.css 装进 THEME 区照样全绿，
// 而那正是这条闸唯一挡得住、别处又挡不住的错误（映射错位）。
// 两条装配路径都要验：默认只装 `files`，`--with-baseline` 追加 `baselineFiles`。
// 只验其中一条，另一条串错了照样全绿——而默认路径正是绝大多数原型走的那条。
for (const baseline of [false, true]) {
  test(`装配结果每个区的正文逐字节等于它那份源文件（baseline=${baseline}）`, async () => {
    const html = await composeTemplate({ baseline })
    for (const it of FRAMEWORK) {
      const r = markRange(html, it.mark)
      assert.ok(r, `装配结果缺固定区标记：${it.mark}`)
      const files = [...it.files, ...(baseline && it.baselineFiles ? it.baselineFiles : [])]
      const body = files.map((f) => readFileSync(path.join(FRAMEWORK_DIR, f), 'utf8')).join('')
      assert.equal(
        html.slice(r.from, r.to),
        FRAMEWORK_PRE + it.open + body + it.close + FRAMEWORK_POST,
        `${it.mark} 区的装配结果与 ${files.join(' + ')} 不一致——要么装配串错了，要么装配表把这个区指向了别的文件`,
      )
    }
  })
}

test('外观层默认不装配，只有 --with-baseline 才进产物', async () => {
  const plain = await composeTemplate()
  const withBase = await composeTemplate({ baseline: true })
  const probe = readFileSync(path.join(FRAMEWORK_DIR, 'components.css'), 'utf8').split('\n')
    .find((l) => l.includes('.btn {'))
  assert.ok(probe, 'components.css 里找不到 .btn 定义——探针失效，这条闸已退化')
  assert.ok(!plain.includes(probe), '默认装配不应含外观层：风格 MUST 由项目真实样式来源决定')
  assert.ok(withBase.includes(probe), '--with-baseline 应装入外观层')
  // 结构层两条路径都必须在，否则批注框架与 check 会失去锚点
  const structProbe = readFileSync(path.join(FRAMEWORK_DIR, 'structure.css'), 'utf8').split('\n')
    .find((l) => l.includes('.device-wrap {'))
  assert.ok(structProbe, 'structure.css 里找不到 .device-wrap——探针失效')
  for (const [name, html] of [['默认', plain], ['基线', withBase]]) {
    assert.ok(html.includes(structProbe), `${name}路径缺结构层：批注框架与 check 会失去锚点`)
  }
})

test('缺框架源文件时 init 报错退出且不留残页', async () => {
  const { spawnSync } = await import('node:child_process')
  const { cpSync, mkdtempSync, rmSync, unlinkSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-missing-'))
  // 在临时副本中删文件，避免测试并发时短暂改名共享源码，干扰其他测试读装配表。
  const skillCopy = path.join(dir, 'ai-prd')
  cpSync(path.join(repoRoot, 'ai-dev-system/skills/ai-prd'), skillCopy, { recursive: true })
  const script = path.join(skillCopy, 'scripts/preview.mjs')
  const victim = path.join(skillCopy, 'assets/templates/ui-prototype-framework', FRAMEWORK[0].files[0])
  const target = path.join(dir, 'p.html')

  unlinkSync(victim)
  try {
    const r = spawnSync(process.execPath, [script, 'init', target, '--title', '缺文件'], { encoding: 'utf8' })
    const out = (r.stdout || '') + (r.stderr || '')
    assert.equal(r.status, 1, `缺框架源文件时 init 必须以退出码 1 终止，实际 ${r.status}：${out}`)
    assert.ok(out.includes(FRAMEWORK[0].mark), '错误文案必须指出是哪个区')
    assert.ok(out.includes(FRAMEWORK[0].files[0]), '错误文案必须给出源文件路径')
    assert.ok(!existsSync(target), 'init 失败时 MUST NOT 留下一个缺样式的残页')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('icons.svg 不得含 xmlns——它是 sprite 片段，不是独立 SVG 文档', () => {
  const svg = readFileSync(path.join(FRAMEWORK_DIR, 'icons.svg'), 'utf8')
  assert.doesNotMatch(svg, /xmlns/, 'xmlns 会带进 http:// 串，当场挂掉容器的零外链自检')
})

// ── 2.12.0：两条"页面照常打开、零报错"的框架自护契约 ──
// 它们锁的都是 CSS 层叠层面的事，跑不出浏览器，所以只能断言源码里的保护还在。弱闸，
// 但挡得住"重构时顺手删掉一个 !important"这类回归——而那正是这两个 bug 的复发路径。

test('框架 UI 内的 [hidden] 恒生效：不被自己的 display 声明击穿', () => {
  const css = readFileSync(path.join(FRAMEWORK_DIR, 'anno.css'), 'utf8')
  // `[hidden]` 的 display:none 来自 UA 样式表，任何作者的 display 都压过它——元素照样
  // 占位可点，而 JS 里的 `x.hidden = true` 看起来完全正常。实测踩过三次。
  const rule = css.match(/\[class\^="anno-"\]\[hidden\][\s\S]{0,400}?\{[^}]*\}/)
  assert.ok(rule, 'anno.css 缺覆盖整个框架 UI 的 [hidden] 规则——新加的隐藏元素会恒显示')
  assert.match(rule[0], /display:\s*none\s*!important/, '该规则必须用 !important，否则压不过带 !important 的 display')
  // 覆盖面：框架三个容器 + anno- 前缀自身，缺一个下次加元素就漏
  for (const sel of ['.anno-bar [hidden]', '.anno-pop [hidden]', '.anno-notes-panel [hidden]']) {
    assert.ok(rule[0].includes(sel) || css.includes(sel), `[hidden] 规则未覆盖 ${sel}`)
  }
})

test('图钉的尺寸盒对产出方样式免疫', () => {
  const css = readFileSync(path.join(FRAMEWORK_DIR, 'anno.css'), 'utf8')
  const js = readFileSync(path.join(FRAMEWORK_DIR, 'anno.js'), 'utf8')
  // 前提：图钉是 <button> 且挂进产出方元素内部，所以 `.act button {…}`(0,1,1) 压过
  // `.anno-pin`(0,1,0)。这个前提若变了，下面的断言就该重写而不是删掉。
  assert.match(js, /function mkPin[\s\S]{0,200}createElement\("button"\)/,
    '图钉不再是 button 了——本条断言的前提已变，MUST 重新评估保护方式而不是删掉它')
  assert.match(js, /host\.appendChild\(pin\)/, '图钉不再挂进宿主内部了——同上')
  const block = css.match(/\.anno-pin\s*\{[^}]*\}/)
  assert.ok(block, 'anno.css 里找不到 .anno-pin 定义')
  // 只锁"会让它变形或盖住宿主"的那几条：实测 .act button{width:100%;height:40px} 把
  // 18px 的图钉撑成整块深色，宿主按钮上只剩一个感叹号
  for (const prop of ['position', 'width', 'height', 'padding', 'font-size', 'box-sizing']) {
    // 前置边界是必须的：`width:[^;]*!important` 会命中 `min-width: 0 !important` 的子串，
    // `height` 同样被 line-height / max-height 骗过——反向自检当场撞出：把
    // `width: 18px !important` 的 !important 拿掉，这条断言照样全绿。
    assert.match(block[0], new RegExp(`(?:^|[;{\\s])${prop}:[^;]*!important`, 'm'),
      `.anno-pin 的 ${prop} 缺 !important——产出方一条标签选择器就能把图钉撑变形`)
  }
  // 三种图钉靠背景色区分，被 `button { background: … }` 刷成同色就分不出来
  for (const v of ['note', 'ask', 'user']) {
    const m = css.match(new RegExp(`\\.anno-pin--${v}\\s*\\{[^}]*\\}`))
    assert.ok(m && /background:[^;]*!important/.test(m[0]), `.anno-pin--${v} 的背景色缺 !important`)
  }
})

test('弹窗里绑定的 data-role 都是同一个函数自己渲染过的', () => {
  const js = readFileSync(path.join(FRAMEWORK_DIR, 'anno.js'), 'utf8')
  // 为什么要这条闸：`pop.querySelector('[data-role="x"]').onclick = …` 在该函数没渲染
  // 这个 role 时会 `null.onclick` 抛 TypeError，**函数从这一行整个中断**——后面的
  // place(pop, …) 再也执行不到，表现只是"这个按钮点了没反应"，控制台以外毫无线索。
  // 真跑撞出过：给 openNote 加"放弃修改"绑定时用字符串替换，锚点在四个函数里都存在，
  // 于是 openGlobal / openEditor / newNote 各被塞进一行，三个弹窗全打不开。
  const bodies = js.split(/\n    function (?=\w)/).slice(1)
  const offenders = []
  for (const body of bodies) {
    const name = (body.match(/^(\w+)/) || [])[1] || '?'
    if (!/pop\.innerHTML\s*=/.test(body)) continue          // 不渲染弹窗的函数不在此列
    const declared = new Set([...body.matchAll(/data-role="([^"]+)"/g)]
      .filter((m) => !/querySelector/.test(body.slice(Math.max(0, m.index - 30), m.index)))
      .map((m) => m[1]))
    for (const m of body.matchAll(/querySelector\('\[data-role="([^"]+)"\]'\)/g)) {
      if (!declared.has(m[1])) offenders.push(`${name} 绑定了自己没渲染的 data-role="${m[1]}"`)
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'))
})

test('框架 JS 只用私有 class，MUST NOT 借用默认不装配的外观层', () => {
  // 为什么要这条闸：外观层（components.css）默认不装配之后，框架自己的 UI 一旦还挂着
  // `.btn` / `.card-content` 这类外观层 class，在**默认路径**下就完全没有样式可用——
  // 按钮渲染成裸 <button>，而页面照常打开、命令照常退出 0，没有任何一处会报错。
  // 2.12.0 已经为此把框架 UI 私有化过一轮（.anno-btn / .anno-notes-body），但 paint()
  // 里 5 处运行时 className 赋值漏改，默认路径下"保存"按钮当场裸奔——同一类问题第二次
  // 出现，因此固化成闸：初始 innerHTML 里的 class 与运行时改写的 className 一并查。
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
  const classesIn = (f) =>
    new Set([...strip(readFileSync(path.join(FRAMEWORK_DIR, f), 'utf8'))
      .matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))

  // 禁用集 = 只有开了基线才存在的 class。结构层与批注层自带的一律放行。
  const allowed = new Set([...classesIn('structure.css'), ...classesIn('anno.css')])
  const forbidden = new Set([...classesIn('components.css')].filter((c) => !allowed.has(c)))
  assert.ok(forbidden.size > 20, '禁用集异常地小——多半是 components.css 的路径或切分线变了')

  const offenders = []
  // 扫目录下**全部** .js：写死文件名会让日后新增的框架 JS 静默逃逸。
  const jsFiles = readdirSync(FRAMEWORK_DIR).filter((f) => f.endsWith('.js'))
  assert.ok(jsFiles.length >= 2, `框架 JS 少于 2 个（实测 ${jsFiles.length}），装配表或目录结构变了`)
  for (const f of jsFiles) {
    const js = readFileSync(path.join(FRAMEWORK_DIR, f), 'utf8')
    // 四种写法都要查：模板串里的 class="…"、运行时 className = "…"、classList.add/toggle/replace，
    // 三种引号各算一遍。只查其中一种正是这次漏网的成因——初始 innerHTML 全对，paint() 里全错；
    // 而 classList 与单引号/模板串在框架里本就在用（screen.js 的 classList.add 就是）。
    for (const re of [
      /class=["'`]([^"'`]*)["'`]/g,
      /className\s*=\s*["'`]([^"'`]*)["'`]/g,
      /classList\.(?:add|toggle|replace)\(([^)]*)\)/g,
    ]) {
      for (const m of js.matchAll(re)) {
        // classList 分支捕获的是整个参数列表（含引号与逗号），先把字面量抽出来；
        // 另两个分支捕获的已经是空格分隔的 class 串，split 后同形。
        const toks = /classList/.test(m[0])
          ? [...m[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1])
          : m[1].split(/\s+/)
        for (const tok of toks.filter(Boolean)) {
          if (forbidden.has(tok)) {
            const line = js.slice(0, m.index).split('\n').length
            offenders.push(`${f}:${line} 用了外观层 class「${tok}」——默认不装配时它没有任何样式`)
          }
        }
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'))
})
