// 2.7.0「原型容器」的契约测试。
//
// 为什么要有这份测试：`ui-prototype.html` 是**容器不是范例**——它自带设计系统、图标库、
// 批注层，agent 只往具名插槽里盲填，全程不读它。这套设计同时靠三件事成立，三件都静默易碎：
//   ① 插槽的逐字原文——纪律里写的锚点与容器里的实际文本一旦不一致，盲填就落空，
//      而落空的表现是"内容没进去"，不是报错；
//   ② 固定实现区的标记——被改写或删掉，批注层与设计系统静默失效（页面照样打开）；
//   ③ 纪律 §8.3 列的 class / 图标 id 与容器实际提供的一致——纪律里多列一个容器没有的
//      class，agent 会照抄一个不存在的样式，产出的原型缺样式却零报错。
// 所以这里锁的是"纪律与容器之间的一致性"，不锁 CSS/JS 的具体写法。
//
// 另一半锁**跨文件接线**：出口写在纪律里而流程步骤不提，agent 永远走不到它；用户批注的
// 读法只写在 ai-prd 侧而 ai-dev-workflow 读原型时不知道，下游就漏掉气泡里的行为契约。
//
// spec：docs/spec/2026-08-25-原型批注框架-lean-change-spec.md
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = path.join(repoRoot, 'ai-dev-system', 'skills')
const prdRoot = path.join(skillsRoot, 'ai-prd')
const read = (...seg) => readFileSync(path.join(...seg), 'utf8')

const template = read(prdRoot, 'assets', 'templates', 'ui-prototype.html')
const discipline = read(prdRoot, 'references', 'UI原型纪律.md')

// 切段取子串：锚点找不到必须当场红，否则 slice 会静默退化成"整个文件"。
const cut = (body, from, to) => {
  const i = body.indexOf(from)
  assert.ok(i >= 0, `锚点失效（文档已改写，断言需同步）：${from}`)
  const j = to === undefined ? body.length : body.indexOf(to, i)
  assert.ok(to === undefined || j > i, `结束锚点失效：${to}`)
  return body.slice(i, j)
}

// 插槽的逐字原文。产出原型的唯一途径是 preview.mjs，所以这份清单真正的契约方是
// **工具的 SLOTS 探针与容器**——纪律只列插槽名，不再逐字复述 HTML（复述一份就会漂）。
const SLOTS = [
  '<title>UI 原型</title>',
  '<h1 id="proto-title">UI 原型</h1>',
  '<p id="proto-subtitle"></p>',
  '<div class="devices" data-anno-canvas><!-- SCREENS --></div>',
  '<div class="card-content notes-body" id="proto-notes"></div>',
  '<style id="project-theme"></style>',
  '<style id="proto-custom"></style>',
  '<script id="proto-script"></script>',
]

// 纪律 §8.1 插槽表里的插槽名，与工具 `slot --set` 的取值一一对应。
const SLOT_NAMES = ['title', 'subtitle', 'screens', 'notes', 'theme', 'custom', 'script']
const DOCUMENTED_SLOT_NAMES = ['title', 'subtitle', 'screens', 'notes', 'theme', 'custom']

const FIXED_REGIONS = ['THEME', 'DESIGN-SYSTEM', 'ICONS', 'SCREEN-SCRIPT', 'ANNO-FRAMEWORK:CSS', 'ANNO-FRAMEWORK:JS', 'ANNOTATIONS']

test('每个插槽在容器里逐字出现且各只出现一次', () => {
  for (const slot of SLOTS) {
    const hits = template.split(slot).length - 1
    assert.equal(hits, 1, `插槽必须唯一可定位（实际 ${hits} 次）：${slot}`)
  }
})

test('工具的插槽探针与容器逐字一致，纪律 §8.1 的插槽名与工具取值一一对应', () => {
  // 工具侧：每个 SLOTS 探针都要能在容器里定位到，否则 `slot --set` 会静默不改。
  const tool = read(prdRoot, 'scripts', 'preview.mjs')
  const probes = [...cut(tool, 'const SLOTS = {', '\nconst TITLE_RE').matchAll(/probe: '([^']+)'/g)].map((m) => m[1])
  assert.equal(probes.length, SLOT_NAMES.length - 1, `工具里的可探针插槽数与 §8.1 表对不上（工具 ${probes.length} / 表 ${SLOT_NAMES.length}）`)
  for (const probe of probes) {
    assert.ok(template.includes(probe), `工具的插槽探针在容器里定位不到，slot 命令会静默不改：${probe}`)
  }

  // 工具侧的键名：`slot --set <名>` 的取值集合。
  const keys = [...cut(tool, 'const SLOTS = {', '\nconst TITLE_RE').matchAll(/^  ([a-z]+): \{/gm)].map((m) => m[1])
  assert.deepEqual(keys.sort(), [...SLOT_NAMES].sort(), '工具的插槽键与 §8.1 表的插槽名必须一致')

  // 纪律侧：§8.1 的表里每个插槽名都在场，agent 才知道 --set 能填什么。
  const table = cut(discipline, '### 8.1 ', '### 8.2')
  for (const name of DOCUMENTED_SLOT_NAMES) {
    assert.ok(table.includes('`' + name + '`'), `§8.1 表格里缺插槽名，agent 无从知道 --set 能填什么：${name}`)
  }
  for (const cmd of ['init', 'screen', 'slot', 'check']) {
    assert.ok(table.includes('preview.mjs ' + cmd) || table.includes('… ' + cmd), `§8.1 命令表里缺 ${cmd}`)
  }
})

test('固定实现区的标记成对在场且顺序正确', () => {
  for (const mark of FIXED_REGIONS) {
    // 认 `<!-- ` 前缀的那一处：标记名本身还会作为读法示例出现在注释正文与纪律里。
    const begin = template.indexOf(`<!-- ${mark}:BEGIN`)
    const end = template.indexOf(`<!-- ${mark}:END`)
    assert.ok(begin >= 0, `容器缺标记 ${mark}:BEGIN——该区被改写或删掉了`)
    assert.ok(end > begin, `${mark} 的 BEGIN 必须在 END 之前`)
  }
  assert.ok(template.includes('SCREENS:BEGIN') && template.includes('SCREENS:END'), '容器缺 SCREENS 插槽标记')
  assert.ok(template.includes('PROJECT-THEME:BEGIN'), '容器缺 PROJECT-THEME 插槽标记')
})

test('容器不含示例业务内容——范例会锚定 agent 的产出', () => {
  // SCREENS 区只允许是注释 + 那一行空插槽；塞进一屏示例，这里会立刻涨到几千字节。
  const region = cut(template, '<!-- SCREENS:BEGIN', '<!-- SCREENS:END')
  assert.ok(
    region.length < 400,
    `SCREENS 区应只有空插槽（当前 ${region.length} 字节）——容器里放示例屏会让产出照抄示例的业务场景与布局`
  )
  // 容器自身不含占位符：残留的【一定来自 agent 填进插槽的内容，这让 §6 那道自检有确定语义。
  assert.doesNotMatch(template, /【/, '容器全文不得含【占位符')
})

test('批注数据块是可解析的 JSON，且带定位所需的字段骨架', () => {
  const start = template.indexOf('<script type="application/json" id="anno-data">')
  assert.ok(start >= 0, '批注数据块必须是 id="anno-data" 的 application/json 脚本块')
  const from = template.indexOf('>', start) + 1
  const to = template.indexOf('</script>', from)
  const data = JSON.parse(template.slice(from, to))
  assert.equal(data.schema, 'prd-annotations@1')
  assert.ok(Array.isArray(data.global), 'global[] 收整体反馈')
  assert.ok(Array.isArray(data.items), 'items[] 收元素批注')
  assert.ok(template.indexOf('<!-- ANNOTATIONS:BEGIN') < start, '数据块必须在 ANNOTATIONS:BEGIN 之后')
  assert.ok(to < template.indexOf('<!-- ANNOTATIONS:END'), '数据块必须在 ANNOTATIONS:END 之前')
})

// 纪律 §7.3 教 agent 用 `sed -n '/ANNOTATIONS:BEGIN/,/ANNOTATIONS:END/p'` 取批注。
// 这条命令按**行**取段，取到第一个含结束标记字样的行就停——所以容器里任何地方
// （包括注释里的命令示例本身）出现结束标记字样，都会让这条读法在那里提前截断，
// 拿到一段不完整、解析不出 JSON 的文本。真跑时正是这样：注释里写着的命令示例把
// 命令自己废掉了，读回来只有三行注释。这里按同一套行语义复现该命令。
test('纪律教的取段读法在容器上真能跑通', () => {
  const lines = template.split('\n')
  const from = lines.findIndex((l) => l.includes('ANNOTATIONS:BEGIN'))
  assert.ok(from >= 0, '容器里找不到 ANNOTATIONS:BEGIN')
  const rel = lines.slice(from + 1).findIndex((l) => l.includes('ANNOTATIONS:END'))
  assert.ok(rel >= 0, '容器里找不到 ANNOTATIONS:END')
  const region = lines.slice(from, from + 1 + rel + 1).join('\n')

  const open = region.indexOf('{')
  const close = region.lastIndexOf('}')
  assert.ok(open >= 0 && close > open, '取到的段落里没有完整 JSON——结束标记字样在数据块之前就出现了')
  assert.doesNotThrow(
    () => JSON.parse(region.slice(open, close + 1)),
    '取到的段落解析不出 JSON：这条读法在容器上是坏的'
  )
})

// 批注文本是用户自由输入，里面出现脚本结束标签会把数据块提前闭合，整份文件的批注报废。
test('写回数据块前转义了脚本结束标签', () => {
  const closer = '<' + '/'
  assert.ok(
    template.includes('text.replace(/<\\//g, "<\\\\/")'),
    `persist 必须把批注 JSON 里的 "${closer}" 转义后再写进数据块`
  )
})

test('两种批注各自的锚点属性都在', () => {
  assert.match(template, /\[data-anno\]/, '框架必须扫描 [data-anno]（AI 侧说明）')
  assert.match(template, /data-anno-kind/, '待拍板批注靠 data-anno-kind="question" 区分')
  assert.match(template, /data-anno-user/, '用户批注必须落一个 data-anno-user 锚点在元素上')
  assert.match(template, /data-anno-rt/, '运行时节点必须带 data-anno-rt 以便回写时剥离')
  assert.match(template, /querySelectorAll\("\[data-anno-rt\]"\)/, '回写前必须剥离运行时节点')
})

// 运行时元素靠 el.hidden 控制显隐，但作者样式里的 display 会压过 [hidden] 的 UA 默认值。
// 真跑撞出过：.anno-cursor 写了 display:flex，于是那枚跟随光标的气泡从头到尾没能藏住，
// 取消批注后残留在页面上。凡是用 hidden 控制的运行时元素，都要有配套的 [hidden] 规则。
test('用 hidden 控制显隐的运行时元素都有配套的 [hidden] 规则', () => {
  for (const cls of ['.anno-pop', '.anno-cursor']) {
    assert.match(
      template,
      new RegExp(`\\${cls}\\[hidden\\]\\s*\\{[^}]*display:\\s*none`),
      `${cls} 设了 display，就必须显式写 ${cls}[hidden]{display:none}，否则 hidden 属性无效`
    )
  }
})

test('容器不带明暗切换装置——多数项目没有暗色，容器的能力不该变成对内容的要求', () => {
  assert.doesNotMatch(template, /data-theme/, '容器不应有主题切换属性')
  assert.doesNotMatch(template, /prefers-color-scheme/, '容器不应按系统偏好切换主题')
  const sec = cut(discipline, '### 8.4', undefined)
  assert.match(sec, /MUST NOT 假设产品有暗色模式/, '§8.4 必须写明不得假设产品有暗色')
})

test('容器是零外链单文件', () => {
  assert.equal((template.match(/https?:\/\//g) || []).length, 0, '不得出现 http(s) 外链')
  assert.doesNotMatch(template, /<script[^>]+src=/, '不得引用外部脚本')
  assert.doesNotMatch(template, /<link[^>]+href=/, '不得引用外部样式')
  assert.doesNotMatch(template, /@import\s+url\(/, '不得 @import 网络资源')
  // 内联 SVG 不需要 xmlns；一旦出现就说明用了 data-URI 图标，会把 http:// 带进来。
  assert.doesNotMatch(template, /xmlns/, '不得出现 xmlns（图标必须是内联 SVG，不能用 data-URI）')
})

test('容器内联脚本语法可解析', () => {
  const re = /<script(?![^>]*type="application)[^>]*>([\s\S]*?)<\/script>/g
  let m
  let count = 0
  while ((m = re.exec(template))) {
    count += 1
    assert.doesNotThrow(() => new Function(m[1]), `内联脚本 #${count} 语法错误`)
  }
  assert.ok(count >= 2, '容器应有原型交互脚本与批注框架脚本两段')
})

test('纪律 §8.3 列的每个 class 都在容器里真有定义', () => {
  const table = cut(discipline, '### 8.3', '### 8.4')
  const listed = new Set()
  for (const m of table.matchAll(/`([^`]+)`/g)) {
    for (const c of m[1].matchAll(/\.[a-z][a-z0-9-]*/g)) listed.add(c[0])
  }
  assert.ok(listed.size >= 40, `§8.3 应列出成套 class（当前只抽到 ${listed.size} 个，表格格式可能变了）`)
  const missing = [...listed].filter((cls) => !new RegExp(`\\${cls}(?![a-z0-9-])`).test(template))
  assert.deepEqual(missing, [], `纪律列了容器里不存在的 class，agent 会照抄一个没样式的名字：${missing.join(' ')}`)
})

test('§8.2 的结构 class 与状态类都在容器里', () => {
  for (const cls of ['.devices', '.device-wrap', '.device-name', '.device', '.app-bar', '.screen', '.status', '.is-default', '.is-desktop']) {
    assert.ok(new RegExp(`\\${cls}(?![a-z0-9-])`).test(template), `容器缺结构样式 ${cls}`)
  }
})

test('图标 id 双向一致：纪律列的容器都有，容器有的纪律都列了', () => {
  const inTemplate = new Set([...template.matchAll(/<symbol id="(i-[a-z-]+)"/g)].map((m) => m[1]))
  const section = cut(discipline, '图标 id：', '### 8.4')
  const inDoc = new Set([...section.matchAll(/`(i-[a-z-]+)`/g)].map((m) => m[1]))
  assert.ok(inTemplate.size >= 30, `容器应内置成套图标（当前 ${inTemplate.size} 个）`)
  const missing = [...inDoc].filter((id) => !inTemplate.has(id))
  const unlisted = [...inTemplate].filter((id) => !inDoc.has(id))
  assert.deepEqual(missing, [], `纪律列了容器没有的图标 id：${missing.join(' ')}`)
  assert.deepEqual(unlisted, [], `容器有但纪律没列的图标 id（agent 不会知道能用）：${unlisted.join(' ')}`)
})

test('容器里 JS 动态引用的图标 id 都已定义', () => {
  const defined = new Set([...template.matchAll(/<symbol id="(i-[a-z-]+)"/g)].map((m) => m[1]))
  const used = new Set([
    ...[...template.matchAll(/ico\("(i-[a-z-]+)"/g)].map((m) => m[1]),
    ...[...template.matchAll(/<use href="#(i-[a-z-]+)"/g)].map((m) => m[1]),
  ])
  const missing = [...used].filter((id) => !defined.has(id))
  assert.deepEqual(missing, [], `引用了未定义的图标：${missing.join(' ')}`)
})

test('ai-prd 侧接线：纪律 §7/§8 立判据，流程两步与质量清单都提到它', () => {
  assert.match(discipline, /##\s*7\.\s*界面批注框架/, 'UI原型纪律 必须有批注框架一节')
  assert.match(discipline, /##\s*8\.\s*怎么往容器里填内容/, 'UI原型纪律 必须有插槽契约一节')

  const sec7 = cut(discipline, '## 7.', '## 8.')
  assert.match(sec7, /MUST NOT\s*\*{0,2}逐字重写/, '§7 必须禁止逐字重写固定实现')
  assert.match(sec7, /data-anno=/, '§7 必须给出元素说明的写法')
  assert.match(sec7, /ANNOTATIONS:BEGIN/, '§7 必须给出只读批注块的读法')
  assert.match(sec7, /MUST NOT 为此通读整份 HTML/, '§7 必须禁止为取批注通读整份 HTML')

  const sec8 = cut(discipline, '## 8.')
  assert.match(sec8, /MUST NOT 通读容器/, '§8 必须明确产出原型不用读容器')
  assert.match(sec8, /MUST NOT 被读成["“]?要求项目采用某个 UI 框架/, '§8 必须声明容器不构成对项目的技术要求')

  const flow = read(prdRoot, 'references', '00-prd生成流程.md')
  assert.match(flow, /MUST 走 `scripts\/preview\.mjs` 的 `init`/, '组稿生成原型那步必须要求走工具，而不是手工复制容器')
  assert.match(flow, /MUST NOT 手工复制容器再逐行替换/, '组稿生成原型那步必须禁止手工复制再逐行替换')
  assert.match(flow, /MUST 同时告诉用户可以直接在原型上批注/, '用户过稿门必须告知用户批注入口')
  assert.match(flow, /preview\.mjs annotations/, '收回意见那步必须给出取批注的命令')

  const checklist = read(prdRoot, 'references', 'prd质量清单.md')
  assert.match(checklist, /preview\.mjs check/, '质量清单必须要求跑 check')
  assert.match(checklist, /固定实现区\*{0,2}全部\*{0,2}未被改写/, '质量清单必须验固定实现区完整')
  assert.match(read(prdRoot, 'SKILL.md'), /原型批注框架/, 'ai-prd SKILL.md 的关键纪律必须收录本条')
})

test('ai-dev-workflow 侧接线：下游读原型时被告知连元素批注一起读', () => {
  const wf = path.join(skillsRoot, 'ai-dev-workflow')
  for (const rel of [
    ['references', 'core', '00-流程总纲.md'],
    ['references', 'core', '路径-lean.md'],
  ]) {
    const body = read(wf, ...rel)
    assert.match(body, /MUST 连元素批注一起读|MUST 连元素批注/, `${rel.join('/')} 必须要求连元素批注一起读`)
    assert.match(body, /ANNOTATIONS:BEGIN/, `${rel.join('/')} 必须给出批注块的读法`)
  }
})

// 真正打开原型的是这几个执行点。判据只写在总纲/自足册里，等于写给一个当时不在场的读者：
// Step 1 是完整路径上第一次打开原型的地方，Step 4 落 spec，Step 8 落测试用例。
test('ai-dev-workflow 侧接线：每个真打开原型的执行点都给出了取批注的命令', () => {
  const wf = path.join(skillsRoot, 'ai-dev-workflow')
  const POINTS = [
    [['references', 'core', '00-流程总纲.md'], null],
    [['references', 'core', '路径-lean.md'], null],
    [['references', 'core', '步骤-1-7-设计与实现.md'], 'Step 1'],
    [['references', 'core', '步骤-1-7-设计与实现.md'], 'Step 4'],
    [['references', 'core', '步骤-8-10-测试.md'], 'Step 8'],
  ]
  for (const [rel, step] of POINTS) {
    const body = read(wf, ...rel)
    const scope = step ? cut(body, `## ${step}`, `## Step ${Number(step.split(' ')[1]) + 1}`) : body
    assert.match(
      scope,
      /preview\.mjs annotations/,
      `${rel.join('/')}${step ? ' ' + step : ''} 必须给出取批注的命令——只说"要连批注一起读"而不说怎么取，agent 只能去通读整份 HTML`
    )
    assert.match(scope, /data-anno/, `${rel.join('/')}${step ? ' ' + step : ''} 必须点名 AI 侧 data-anno 说明也要读`)
  }
})

// 工具是唯一入口，那么"取批注"这件事就必须真能一条命令拿全三类。
test('annotations 命令一次给出三类批注：用户逐元素、全局反馈、AI 侧 data-anno', () => {
  const tool = read(prdRoot, 'scripts', 'preview.mjs')
  const fn = cut(tool, 'function cmdAnnotations', '\nfunction ')
  for (const [needle, what] of [
    ['items', '用户逐元素批注'],
    ['global', '全局反馈'],
    ['collectAiNotes', 'AI 侧 data-anno 说明'],
  ]) {
    assert.ok(fn.includes(needle), `annotations 命令没有输出${what}，三类少一类就得靠通读 HTML 补`)
  }
  assert.ok(fn.includes('json'), 'annotations 必须支持 --json，下游要结构化取用')
})

test('三类 PRD 模板的「不在用户界面内展示」项指向气泡出口', () => {
  for (const name of ['change-prd.md', 'lite-issue-prd.md', 'product-prd.md']) {
    const body = read(prdRoot, 'assets', 'templates', name)
    const row = body.split('\n').find((l) => l.includes('不在用户界面内展示'))
    assert.ok(row, `${name} 缺「不在用户界面内展示」项`)
    assert.match(row, /data-anno/, `${name} 该项必须指出元素级说明的出口`)
  }
})

// FR-011 此前是唯一一条零 AC 的需求，而它管的正是"用户写了一堆批注、文件里一条都没有
// 却以为存好了"这个最贵的失败。行为在浏览器里，这里锁它的两条短路与触发点。
test('首次写批注会主动说明"批注要存进文件"，且只在真需要用户动手时说', () => {
  const fn = cut(template, 'function explainOnce()', '\n    function ')
  assert.match(fn, /if \(SERVED\) return/, '被 http 提供时自动写回，不该弹说明')
  assert.match(fn, /if \(handle && granted\) return/, '已授权过就不该再弹')
  assert.match(fn, /localStorage[\s\S]*?:explained/, '弹过一次要记住，否则每次都弹')
  assert.match(fn, /批注要存进文件/, '说明必须点破"不点就写不回文件、AI 读不到"这件事')
  // 触发点：第一次真正写下批注的那一刻，而不是打开页面就弹。
  assert.match(template, /explainOnce\(\);/, 'explainOnce 必须真的被调用')
})

test('批注数据结构容纳 replies 且旧数据缺省为空数组', () => {
  assert.match(template, /replies\s*:/)
  const seg = cut(template, 'function blank()', 'function load()')
  assert.match(seg, /replies:\s*\[\]/)
  const parseSeg = cut(template, 'function parse(', 'function load()')
  assert.match(parseSeg, /d\.replies\s*=\s*Array\.isArray\(d\.replies\)\s*\?\s*d\.replies\s*:\s*\[\]/)
})

test('AI 说明气泡带稳定锚点并提供回复编辑删除入口', () => {
  assert.match(template, /data-anno-id/)
  assert.match(template, /data-anno-note-id/)
  assert.match(template, /function nextAnnoId\(/)
  assert.match(template, /function openNote\(/)
  assert.match(template, /data-redit/)
  assert.match(template, /data-rdel/)
  assert.match(template, /data-anno-text/)
  assert.match(template, /逐字比对|=== want/)
  assert.match(template, /el\.setAttribute\("data-anno-id", nid\)/)
})

test('annotations 输出用户对说明的回复，包含快照字段与孤儿标记', () => {
  const tool = read(prdRoot, 'scripts', 'preview.mjs')
  const fn = cut(tool, 'async function cmdAnnotations', '\n/* ────────────────── check')
  assert.match(fn, /replies/)
  assert.match(fn, /noteText/)
  assert.match(fn, /noteKind/)
  assert.match(fn, /orphan/)
  assert.match(fn, /用户对说明的回复/)
})

test('批注出口明确包含用户对说明的回复第四类', () => {
  const tool = read(prdRoot, 'scripts', 'preview.mjs')
  const fn = cut(tool, 'async function cmdAnnotations', '\n/* ────────────────── check')
  assert.match(fn, /用户对说明的回复/)
  assert.match(fn, /user:\s*\{[\s\S]*replies/)
})

// ---------------------------------------------------------------------------
// 批注框架不得改写被批注元素的定位，图钉不得被裁切或遮挡
// spec：docs/spec/2026-08-27-原型批注框架绝对定位与图钉可见性-lean-change-spec.md
//
// 这三条锁的都是**写错了页面照常打开、只是悄悄错位或看不见**的那类知识（缺陷报告
// docs/report/2026-08-27-ai-prd-批注框架缺陷报告.md 记录的两处正是如此），静态断言是
// 唯一可行的闸——容器的 DOM 行为要真浏览器才跑得起来，本仓库零第三方依赖、没有。
// ---------------------------------------------------------------------------

// 取某个选择器块里的 z-index。找不到就当场红：选择器改名后断言必须跟着改，
// 静默退化成"没查到就算过"会让整条层级契约失效。
const zIndexOf = (selector) => {
  const i = template.indexOf(selector + ' {')
  assert.ok(i >= 0, `选择器失效（容器已改写，断言需同步）：${selector}`)
  const block = template.slice(i, template.indexOf('}', i))
  const m = block.match(/z-index:\s*(\d+)/)
  assert.ok(m, `${selector} 块里没有 z-index`)
  return Number(m[1])
}

test('提升定位只作用于取值 rel 的宿主——绝对定位元素打了批注不会被打回文档流', () => {
  // 缺陷 1：[data-anno-host] 与作者的单 class 规则同权重且排在后面，无条件提升会让
  // position: absolute 的元素当场错位，而作者会误判成自己布局写错。
  assert.ok(
    template.includes('[data-anno-host="rel"] { position: relative; }'),
    '提升定位的规则 MUST 按取值收窄为 [data-anno-host="rel"]，MUST NOT 作用于全部宿主',
  )
  assert.ok(
    !/\[data-anno-host\]\s*\{[^}]*position:/.test(template),
    'MUST NOT 存在无条件给 [data-anno-host] 设 position 的规则',
  )

  const attach = cut(template, 'function attach(el, pin)', 'function render()')
  assert.ok(
    attach.includes('getComputedStyle(host)') && attach.includes('=== "static"'),
    'attach() MUST 按 computed position 判定，只有本来是 static 的宿主才提升',
  )
  // 同一元素挂多枚图钉时，第二枚会读到已被提升的 relative；不设守卫就会把提升撤掉。
  assert.ok(
    attach.includes('getAttribute("data-anno-host") === null'),
    'attach() MUST 只在首枚图钉时判定定位，后续沿用已有取值',
  )
  // 属性本身要恒加：点图钉靠 pin.closest("[data-anno-host]") 回到宿主再找说明元素，
  // 属性缺席会让绝对定位元素上的 AI 说明打不开（回复功能一并失效）。
  assert.ok(
    template.includes('pin.closest("[data-anno-host]")'),
    '点击图钉仍靠 [data-anno-host] 回溯宿主——该属性 MUST 恒加，只用取值区分要不要提升',
  )
  assert.ok(
    /setAttribute\("data-anno-host",\s*pos === "static" \? "rel" : ""\)/.test(attach),
    '属性 MUST 无条件写上，用 "rel" / "" 两个取值区分是否提升定位',
  )
})

test('图钉贴元素内侧——外侧偏移会被任何 overflow 祖先裁掉', () => {
  // 缺陷 2 的一半：画布类原型几乎必然有滚动容器，负偏移正好落在裁切区外，
  // 图钉整枚看不见，用户会以为批注没保存成功。
  const pinCss = cut(template, '.anno-pin {', '}')
  const top = pinCss.match(/top:\s*(-?\d+)px/)
  assert.ok(top, '.anno-pin MUST 显式给出 top')
  assert.ok(Number(top[1]) >= 0, `.anno-pin 的 top MUST NOT 为负（当前 ${top[1]}px）——负值会被 overflow 裁掉`)

  const attach = cut(template, 'function attach(el, pin)', 'function render()')
  const right = attach.match(/pin\.style\.right = \((-?\d+) \+ n \* \d+\)/)
  assert.ok(right, 'attach() MUST 计算图钉的水平偏移')
  assert.ok(Number(right[1]) >= 0, `图钉水平偏移的起点 MUST NOT 为负（当前 ${right[1]}px）`)
})

test('图钉的层级高于原型内容、低于批注框架自身的每一层', () => {
  // 缺陷 2 的另一半：z-index 60 会被原型里任何稍高的自定义层盖住；但拉到极大值又会
  // 反过来盖住框架自己的工具栏与弹窗。所以是一段区间，两头都要锁。
  const pin = zIndexOf('.anno-pin')
  assert.ok(pin > 100, `.anno-pin 的 z-index MUST 高于原型自定义内容的常用层级（当前 ${pin}）`)
  ;['.anno-notes-panel', '.anno-bar', '.anno-pop', '.anno-cursor'].forEach((sel) => {
    assert.ok(pin < zIndexOf(sel), `.anno-pin(${pin}) MUST 低于 ${sel}(${zIndexOf(sel)})，否则会遮住框架自己的 UI`)
  })

  // 这个取值被复制到纪律、卡片与需求真相源三处：纪律要告诉作者这条上限（否则他在 custom
  // 插槽里写个更高的值就又把图钉盖住了），卡片与真相源是下一个零上下文 agent 的入口。
  // 三处各记一个数就会漂，所以按容器的实际取值逐处比对。
  ;[
    ['UI原型纪律 §8.4', discipline],
    ['engineering-context/cards/ai-dev-system.md', read(repoRoot, 'engineering-context', 'cards', 'ai-dev-system.md')],
    ['docs/REQUIREMENTS.md', read(repoRoot, 'docs', 'REQUIREMENTS.md')],
  ].forEach(([where, body]) => {
    // 只查 body.includes(pin) 太弱——文件别处出现过这个数就恒真，写上限那句写错了照样绿。
    // 所以抓「上限」二字近旁的数字逐个比对。
    const written = [...body.matchAll(/上限[^\d\n]{0,12}(\d{2,})|(\d{2,})[^\d\n]{0,12}上限/g)]
      .map((m) => Number(m[1] ?? m[2]))
    assert.ok(written.length > 0, `${where} MUST 写明自定义样式的 z-index 上限（${pin}），否则作者无从避让`)
    written.forEach((n) => {
      assert.equal(n, pin, `${where} 写的 z-index 上限 ${n} 与容器实际取值 ${pin} 不一致——同一个量 MUST NOT 各记一个数`)
    })
  })
})
