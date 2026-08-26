#!/usr/bin/env node
// 原型工具：建原型、加屏、填插槽、取批注、查交付、起预览。
//
// 为什么这些是命令而不是文档条款：原型容器里有三类只有它自己知道的规格——控件的子元素
// 结构、交互 hook 属性、状态层的全局语义。把它们抄进纪律让 agent 背，必然抄漏、抄不全，
// 而且抄错了没有任何东西会报错（真跑实测：agent 照文档产的原型，三处结构猜错、三个 hook
// 全漏，所有静态自检仍判过）。能被脚本读出来的东西不该写进文档——同 CLAUDE.md「探测得
// 出来的不设字段」。
//
// 用法：
//   node preview.mjs init   <文件> --title <名> [--subtitle <一句话>]
//   node preview.mjs screen <文件> --name <屏名> [--desktop] [--states a,b,c]
//   node preview.mjs slot   <文件> --set <title|subtitle|screens|notes|theme|custom> (--from <片段文件> | --text <文本>)
//   node preview.mjs annotations <文件> [--json]
//   node preview.mjs check  <文件> [--json]
//   node preview.mjs serve  <文件> [--port <n>] [--no-open]
//   node preview.mjs <文件>            # 等价于 serve
//
// 零第三方依赖；路径一律走 node:path，跨平台。
import { createServer } from 'node:http'
import { readFile, writeFile, rename, stat, copyFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE = path.join(HERE, '..', 'assets', 'templates', 'ui-prototype.html')
const MAX_BODY = 32 * 1024 * 1024
const LOOPBACK = /^(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?$/

/* ────────────────── 插槽契约（与容器逐字对应） ────────────────── */

const SLOTS = {
  title: { probe: '<title>UI 原型</title>', wrap: (v) => `<title>${v}</title>` },
  subtitle: {
    probe: '<p id="proto-subtitle"></p>',
    wrap: (v) => `<p id="proto-subtitle">${v}</p>`,
    re: /<p id="proto-subtitle">[\s\S]*?<\/p>/,
  },
  screens: {
    probe: '<div class="devices" data-anno-canvas><!-- SCREENS --></div>',
    wrap: (v) => `<div class="devices" data-anno-canvas>\n${v}\n    </div>`,
    re: /<div class="devices" data-anno-canvas>[\s\S]*?\n    <\/div>|<div class="devices" data-anno-canvas><!-- SCREENS --><\/div>/,
  },
  notes: {
    probe: '<div class="card-content notes-body" id="proto-notes"></div>',
    wrap: (v) => `<div class="card-content notes-body" id="proto-notes">\n${v}\n        </div>`,
    re: /<div class="card-content notes-body" id="proto-notes">[\s\S]*?<\/div>/,
  },
  theme: {
    probe: '<style id="project-theme"></style>',
    wrap: (v) => `<style id="project-theme">\n${v}\n  </style>`,
    re: /<style id="project-theme">[\s\S]*?<\/style>/,
  },
  custom: {
    probe: '<style id="proto-custom"></style>',
    wrap: (v) => `<style id="proto-custom">\n${v}\n  </style>`,
    re: /<style id="proto-custom">[\s\S]*?<\/style>/,
  },
}

const TITLE_RE = /<title>[\s\S]*?<\/title>/
const H1_RE = /<h1 id="proto-title">[\s\S]*?<\/h1>/

const STATE_KEYS = ['is-default', 'loading', 'empty', 'error', 'success']
const STATE_LABEL = {
  'is-default': '默认态：这一屏正常情况下用户看到什么',
  loading: '加载中',
  empty: '空态：告诉用户下一步能做什么，别只写"暂无数据"',
  error: '错误 / 无权限：写清用户可理解的原因与兜底动作',
  success: '成功反馈：写清业务结果与下一步',
}

const CLOSE_SCRIPT = '</scr' + 'ipt>'
const ANNO_OPEN = '<script type="application/json" id="anno-data">'

/* ────────────────── 通用 ────────────────── */

function fail(msg, code = 2) {
  console.error(msg)
  process.exit(code)
}

async function readTarget(file) {
  try {
    const s = await stat(file)
    if (!s.isFile()) throw new Error('not a file')
  } catch {
    fail(`找不到原型文件：${file}`)
  }
  return readFile(file, 'utf8')
}

// 原子写：先落同目录临时文件再改名，中途崩溃不会留下半份原型。
async function writeAtomic(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp`)
  await writeFile(tmp, text, 'utf8')
  await rename(tmp, file)
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

function readAnnoBlock(html) {
  const s = html.indexOf(ANNO_OPEN)
  if (s < 0) return null
  const from = html.indexOf('>', s) + 1
  const to = html.indexOf(CLOSE_SCRIPT, from)
  if (to < 0) return null
  try {
    return JSON.parse(html.slice(from, to))
  } catch {
    return null
  }
}

function lineOf(html, index) {
  return html.slice(0, index).split('\n').length
}

/* ────────────────── init ────────────────── */

async function cmdInit(file, opts) {
  if (!opts.title) fail('init 需要 --title <需求名>')
  try {
    await stat(file)
    fail(`目标已存在，不覆盖：${file}\n要改内容请用 slot / screen 子命令。`)
  } catch (e) {
    if (e && e.message && e.message.startsWith('目标已存在')) throw e
  }
  await copyFile(TEMPLATE, file)
  let html = await readFile(file, 'utf8')
  html = html.replace(TITLE_RE, `<title>${esc(opts.title)} · 原型</title>`)
  html = html.replace(H1_RE, `<h1 id="proto-title">${esc(opts.title)}</h1>`)
  if (opts.subtitle) html = html.replace(SLOTS.subtitle.re, SLOTS.subtitle.wrap(esc(opts.subtitle)))
  await writeAtomic(file, html)
  console.log(`已创建原型：${file}`)
  console.log('下一步：preview.mjs screen <文件> --name <屏名> 加屏，再往各状态层里填内容。')
}

/* ────────────────── screen ────────────────── */

// 生成一屏的结构骨架。骨架只给结构与状态层，不含任何业务内容——
// 容器里放示例会锚定产出，这条是 2.7.0 立下的判据，工具同样受它约束。
function screenSkeleton(name, states, desktop) {
  const layers = states
    .map((k) => {
      const cls = k === 'is-default' ? 'status is-default' : `status ${k}`
      return `          <div class="${cls}">\n            <!-- ${STATE_LABEL[k]} -->\n          </div>`
    })
    .join('\n')
  return `      <section class="device-wrap${desktop ? ' is-desktop' : ''}">
        <p class="device-name">${esc(name)}</p>
        <div class="device">
          <div class="app-bar">
            <span class="app-title">${esc(name)}</span>
          </div>
          <div class="screen">
${layers}
          </div>
        </div>
      </section>`
}

async function cmdScreen(file, opts) {
  if (!opts.name) fail('screen 需要 --name <屏名>')
  const states = opts.states
    ? opts.states.split(',').map((s) => s.trim()).filter(Boolean)
    : STATE_KEYS
  const bad = states.filter((s) => !STATE_KEYS.includes(s))
  if (bad.length) fail(`未知状态：${bad.join(', ')}\n可用：${STATE_KEYS.join(', ')}`)

  const html = await readTarget(file)
  const m = html.match(SLOTS.screens.re)
  if (!m) fail('找不到界面插槽（SCREENS 区被改写了？）')
  const block = screenSkeleton(opts.name, states, !!opts.desktop)

  let next
  if (m[0].includes('<!-- SCREENS -->')) {
    next = html.replace(SLOTS.screens.re, SLOTS.screens.wrap(block))
  } else {
    // 已有屏：追加到最后一个 </section> 之后，保留既有内容与批注锚点
    const inner = m[0].replace(/^<div class="devices" data-anno-canvas>\n?/, '').replace(/\n?    <\/div>$/, '')
    next = html.replace(SLOTS.screens.re, SLOTS.screens.wrap(`${inner}\n\n${block}`))
  }
  await writeAtomic(file, next)
  console.log(`已加屏「${opts.name}」，状态层：${states.join(' / ')}`)
  console.log('往各 <div class="status …"> 里填内容即可；结构与状态类名已由本命令保证。')
}

/* ────────────────── slot ────────────────── */

async function cmdSlot(file, opts) {
  const key = opts.set
  if (!key || !SLOTS[key]) fail(`slot 需要 --set <${Object.keys(SLOTS).join('|')}>`)
  let value = opts.text
  if (opts.from) value = await readFile(path.resolve(opts.from), 'utf8').catch(() => fail(`读不到片段文件：${opts.from}`))
  if (value === undefined) fail('slot 需要 --from <片段文件> 或 --text <文本>')

  const html = await readTarget(file)
  const slot = SLOTS[key]
  const before = readAnnoBlock(html)
  const re = slot.re || new RegExp(slot.probe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!re.test(html)) fail(`找不到插槽 ${key}（该区被改写了？）`)

  const next = html.replace(re, slot.wrap(key === 'title' ? esc(value.trim()) : value.replace(/\s+$/, '')))

  // 插槽写入 MUST NOT 动到批注：这正是"改稿会抹掉用户批注"那条死结的解法。
  const after = readAnnoBlock(next)
  if (before && (!after || JSON.stringify(before) !== JSON.stringify(after))) {
    fail('拒绝写入：本次替换会改动批注块。这是 bug，请报告。', 1)
  }
  // 只数界面区里的锚点：框架 JS 里有 data-anno-user 的字面量，全文计数会虚高
  const countAnchors = (s) => (screensRegion(s).match(/data-anno-user="/g) || []).length
  const keptAnchors = countAnchors(next)
  const hadAnchors = countAnchors(html)
  await writeAtomic(file, next)
  console.log(`已写入插槽 ${key}`)
  if (hadAnchors && key === 'screens' && keptAnchors < hadAnchors) {
    console.log(`  ⚠ 界面里原有 ${hadAnchors} 个批注锚点，新内容里只剩 ${keptAnchors} 个——`)
    console.log('    被删掉的元素上的用户批注会失联（数据仍在批注块里，可在页面上查看/清理）。')
  }
}

/* ────────────────── annotations ────────────────── */

function collectAiNotes(html) {
  const out = []
  const re = /<([a-z0-9]+)\b([^>]*?)data-anno="([^"]*)"([^>]*)>/gi
  let m
  while ((m = re.exec(html))) {
    const attrs = m[2] + m[4]
    const kind = /data-anno-kind="question"/.test(attrs) ? 'question' : 'note'
    const after = html.slice(m.index + m[0].length, m.index + m[0].length + 200)
    const label = (after.split('<')[0] || '').replace(/\s+/g, ' ').trim().slice(0, 60)
    out.push({ line: lineOf(html, m.index), tag: m[1].toLowerCase(), kind, label, text: m[3] })
  }
  return out
}

function anchorLines(html) {
  const map = {}
  const re = /data-anno-user="([^"]+)"/g
  let m
  while ((m = re.exec(html))) map[m[1]] = lineOf(html, m.index)
  return map
}

async function cmdAnnotations(file, opts) {
  const html = await readTarget(file)
  const data = readAnnoBlock(html)
  if (!data) fail('读不到批注块（ANNOTATIONS 区缺失或被改写）', 1)
  const lines = anchorLines(html)
  const items = (data.items || []).map((it) => ({ ...it, line: lines[it.id] || null }))
  const ai = collectAiNotes(html)

  if (opts.json) {
    console.log(JSON.stringify({
      schema: data.schema || 'prd-annotations@1',
      file: path.resolve(file),
      updatedAt: data.updatedAt || '',
      user: { items, global: data.global || [] },
      ai,
    }, null, 2))
    return
  }

  console.log(`用户元素批注（${items.length}）`)
  items.forEach((it) => {
    const where = it.line ? `${path.basename(file)}:${it.line}` : '已失联（元素被改掉了）'
    console.log(`  [${it.id}] ${it.screen || '本页'} › ${it.tag || '?'} "${it.label || ''}" @${where}`)
    console.log(`        ${it.text}`)
  })
  console.log(`\n用户全局反馈（${(data.global || []).length}）`)
  ;(data.global || []).forEach((g) => console.log(`  [${g.id}] ${g.text}`))
  const q = ai.filter((a) => a.kind === 'question')
  console.log(`\nAI 侧元素说明（${ai.length}，其中待拍板 ${q.length}）`)
  ai.forEach((a) => {
    console.log(`  ${path.basename(file)}:${a.line} ${a.tag} "${a.label}"${a.kind === 'question' ? ' [待拍板]' : ''}`)
    console.log(`        ${a.text}`)
  })
}

/* ────────────────── check ────────────────── */

const FIXED_REGIONS = ['THEME', 'DESIGN-SYSTEM', 'ICONS', 'ANNO-FRAMEWORK:CSS', 'ANNO-FRAMEWORK:JS', 'ANNOTATIONS']

// 控件的子元素结构契约：容器 CSS 靠这些形态才生效，写错了页面不报错、只是版式塌掉。
const STRUCTURE = [
  { cls: 'kv-row', need: /<dt[\s>]/, msg: '.kv-row 的两个子元素 MUST 是 <dt> 与 <dd>（容器用 dt/dd 排版）' },
  { cls: 'alert', need: /class="alert-title"/, msg: '.alert 里 MUST 有 .alert-title；title/description MUST 是 .alert 的直接子元素（grid 布局）' },
  { cls: 'checkbox', need: /aria-checked=/, msg: '.checkbox MUST 带 aria-checked，且内含 <svg class="icon">；MUST NOT 用原生 <input type="checkbox">' },
  { cls: 'switch', need: /aria-checked=/, msg: '.switch MUST 带 aria-checked' },
  { cls: 'tabs-trigger', need: /aria-selected=/, msg: '.tabs-trigger MUST 带 aria-selected，且 MUST 放在 .tabs-list 内' },
]

function sliceRegion(html, mark) {
  const b = html.indexOf(`<!-- ${mark}:BEGIN`)
  const e = html.indexOf(`<!-- ${mark}:END`)
  return b >= 0 && e > b ? html.slice(b, e) : ''
}

function screensRegion(html) {
  const m = html.match(SLOTS.screens.re)
  return m ? m[0] : ''
}

// HTML 里所有 class 含 `status` 却不是 `.screen` 直接子元素的那些状态层。
// 只做浅层深度计数：原型由 screen 命令生成、标签规整，够用且零依赖。
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr', 'use', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon'])

function nestedStates(wrap) {
  const start = wrap.indexOf('<div class="screen">')
  if (start < 0) return []
  const body = wrap.slice(start + '<div class="screen">'.length)
  const bad = []
  let depth = 0
  for (const m of body.matchAll(/<(\/?)([a-z][a-z0-9]*)([^>]*)>/gi)) {
    const [, slash, tag, attrs] = m
    if (slash) { depth -= 1; if (depth < 0) break; continue }
    const cls = (attrs.match(/class="([^"]*)"/) || [])[1] || ''
    if (/\bstatus\b/.test(cls) && depth !== 0) bad.push(cls.trim())
    if (!VOID_TAGS.has(tag.toLowerCase()) && !/\/\s*$/.test(attrs)) depth += 1
  }
  return bad
}

async function cmdCheck(file, opts) {
  const html = await readTarget(file)
  const problems = []
  const add = (level, msg, hint) => problems.push({ level, msg, hint })

  // 1. 零外链
  const links = html.match(/https?:\/\//g) || []
  if (links.length) add('P0', `外链数 ${links.length} ≠ 0`, '原型 MUST 能离线打开')
  if (/xmlns/.test(html)) add('P0', '出现 xmlns', '图标 MUST 用内联 <svg>，MUST NOT 用 data-URI（它会带进 http://）')
  if (/<script[^>]+src=/.test(html)) add('P0', '引用了外部脚本')
  if (/<link[^>]+href=/.test(html)) add('P0', '引用了外部样式')
  if (/@import\s+url\(/.test(html)) add('P0', '使用了 @import url(...)')

  // 2. 占位符
  const ph = (html.match(/【/g) || []).length
  if (ph) add('P0', `残留 ${ph} 处【占位符`, '容器本身不含占位符，残留的一定来自填进插槽的内容')

  // 3. 固定实现区完整
  FIXED_REGIONS.forEach((mark) => {
    const b = html.indexOf(`<!-- ${mark}:BEGIN`)
    const e = html.indexOf(`<!-- ${mark}:END`)
    if (b < 0 || e <= b) add('P0', `固定实现区 ${mark} 缺失或被改写`, 'MUST 由容器整份复制得到')
  })

  // 4. 插槽已填
  if (html.includes('<title>UI 原型</title>')) add('P1', '文档标题还是默认值', 'preview.mjs init --title')
  if (html.includes('<h1 id="proto-title">UI 原型</h1>')) add('P1', '页头标题还是默认值')
  if (html.includes('<p id="proto-subtitle"></p>')) add('P1', '页头副标题为空', '写一句：样式依据 + 覆盖路径')
  if (html.includes('<!-- SCREENS -->')) add('P0', '界面插槽还是空的', 'preview.mjs screen --name <屏名>')
  if (/<div class="card-content notes-body" id="proto-notes">\s*<\/div>/.test(html))
    add('P1', '设计说明栏为空', '写样式依据 / 覆盖范围 / 开放问题三段')

  // 5. 批注块可解析
  if (!readAnnoBlock(html)) add('P0', '批注块解析不了', 'ANNOTATIONS 区被改写或写坏了')

  // 6. 屏结构
  const screens = screensRegion(html)
  const wraps = screens.match(/<section class="device-wrap[^"]*">[\s\S]*?<\/section>/g) || []
  if (!wraps.length) add('P0', '一个屏都没有')
  const declared = new Set()
  wraps.forEach((w, i) => {
    const name = (w.match(/<p class="device-name">([\s\S]*?)<\/p>/) || [])[1]
    if (!name) add('P0', `第 ${i + 1} 屏缺 .device-name`, '屏幕名 MUST 在 .device 之外，批注按它区分是哪一屏')
    if (!/<div class="device">/.test(w)) add('P0', `第 ${i + 1} 屏缺 .device`)
    if (!/<div class="screen">/.test(w)) add('P0', `第 ${i + 1} 屏缺 .screen`)
    const dn = w.indexOf('device-name')
    const dv = w.indexOf('<div class="device">')
    if (dn > 0 && dv > 0 && dn > dv) add('P0', `第 ${i + 1} 屏的 .device-name 写进了 .device 里`, '它 MUST 在 .device 之外')
    STATE_KEYS.forEach((k) => {
      const cls = k === 'is-default' ? 'status is-default' : `status ${k}`
      if (w.includes(`class="${cls}"`)) declared.add(k)
    })
    // 状态层 MUST 是 .screen 的直接子元素：容器靠 `.screen > .status` 控制显隐，
    // 包一层就永远不显示，而页面照常打开、零报错——这是最贵的那类静默错误。
    nestedStates(w).forEach((cls) =>
      add('P0', `第 ${i + 1} 屏的「${cls}」状态层不是 .screen 的直接子元素`,
        '容器按 .screen > .status 控制显隐，包一层这个状态就永远不显示（页面不会报错）')
    )
  })
  // 7. 状态层一致性：某个状态只在部分屏上有 → 切到那个状态时其余屏会回落到默认态
  wraps.forEach((w, i) => {
    declared.forEach((k) => {
      const cls = k === 'is-default' ? 'status is-default' : `status ${k}`
      if (!w.includes(`class="${cls}"`)) {
        add('P2', `第 ${i + 1} 屏没有「${k}」状态层`, '切到该状态时这一屏会继续显示默认态（容器已做回落，不会空白）')
      }
    })
  })

  // 8. 结构契约
  STRUCTURE.forEach((s) => {
    const re = new RegExp(`<[a-z0-9]+[^>]*class="[^"]*\\b${s.cls}\\b[^"]*"[^>]*>`, 'gi')
    let m
    while ((m = re.exec(screens))) {
      const tail = screens.slice(m.index, m.index + 600)
      if (!s.need.test(tail) && !s.need.test(m[0])) {
        add('P1', `${path.basename(file)}:${lineOf(html, html.indexOf(m[0]))} ${s.msg}`)
        break
      }
    }
  })

  // 9. class 是否有定义（设计系统 + 项目主题 + 自定义 CSS 三处）
  const styleText = sliceRegion(html, 'DESIGN-SYSTEM') + sliceRegion(html, 'THEME') +
    (html.match(SLOTS.custom.re) || [''])[0] + (html.match(SLOTS.theme.re) || [''])[0]
  const defined = new Set([...styleText.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]))
  const used = new Set()
  for (const m of screens.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => c && used.add(c))
  const unknown = [...used].filter((c) => !defined.has(c))
  if (unknown.length) add('P1', `用到了没有样式定义的 class：${unknown.join(' ')}`, '写进 proto-custom 插槽，或改用 §8.3 表里的 class')

  // 10. 图标 id
  const haveIcons = new Set([...html.matchAll(/<symbol id="(i-[a-z-]+)"/g)].map((m) => m[1]))
  const useIcons = new Set([...screens.matchAll(/<use href="#(i-[a-z-]+)"/g)].map((m) => m[1]))
  const missIcons = [...useIcons].filter((i) => !haveIcons.has(i))
  if (missIcons.length) add('P0', `引用了不存在的图标：${missIcons.join(' ')}`)

  // 11. 写死颜色
  const hard = [...screens.matchAll(/style="[^"]*(#[0-9a-f]{3,8}|rgba?\()/gi)]
  if (hard.length) add('P1', `${hard.length} 处行内样式写死了颜色`, '取色 MUST 用 var(--…) token，否则换项目主题时不跟着变')

  // 12. 内联脚本语法
  const scripts = html.split(/<script(?![^>]*type="application)[^>]*>/).slice(1)
  scripts.forEach((chunk, i) => {
    const body = chunk.slice(0, chunk.indexOf(CLOSE_SCRIPT))
    try {
      new Function(body)
    } catch (e) {
      add('P0', `内联脚本 #${i + 1} 语法错误：${e.message}`)
    }
  })

  if (opts.json) {
    console.log(JSON.stringify({ file: path.resolve(file), ok: !problems.some((p) => p.level === 'P0'), problems }, null, 2))
  } else {
    const n = { P0: 0, P1: 0, P2: 0 }
    problems.forEach((p) => { n[p.level] += 1 })
    if (!problems.length) console.log(`✓ ${path.basename(file)} 交付自检全过`)
    else {
      console.log(`${path.basename(file)}：P0 ${n.P0} / P1 ${n.P1} / P2 ${n.P2}`)
      ;['P0', 'P1', 'P2'].forEach((lv) => {
        problems.filter((p) => p.level === lv).forEach((p) => {
          console.log(`  [${lv}] ${p.msg}`)
          if (p.hint) console.log(`        → ${p.hint}`)
        })
      })
    }
  }
  process.exit(problems.some((p) => p.level === 'P0') ? 1 : 0)
}

/* ────────────────── serve ────────────────── */

function openInBrowser(url) {
  const isWin = process.platform === 'win32'
  const bin = isWin ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const args = isWin ? ['/c', 'start', '', url] : [url]
  try {
    spawn(bin, args, { stdio: 'ignore', detached: true }).unref()
  } catch {
    // 打不开浏览器不影响服务，用户照打印的 URL 手动开
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function cmdServe(rel, opts) {
  const file = path.resolve(rel)
  await readTarget(file)
  let saves = 0

  const server = createServer(async (req, res) => {
    const host = req.headers.host || ''
    if (!LOOPBACK.test(host)) {
      res.writeHead(403).end('forbidden')
      return
    }
    // 跨站写入防护：浏览器给同源请求发 same-origin，别的页面发 cross-site。
    // 老浏览器不发这个头，那时退回 Origin 比对。
    const site = req.headers['sec-fetch-site']
    const origin = req.headers.origin
    if (req.method === 'POST') {
      const sameOrigin = !origin || LOOPBACK.test(origin.replace(/^https?:\/\//, ''))
      if ((site && site !== 'same-origin') || !sameOrigin) {
        res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
          .end('{"ok":false,"error":"cross-site write rejected"}')
        return
      }
    }
    const url = (req.url || '/').split('?')[0]

    if (req.method === 'GET' && url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end('{"ok":true}')
      return
    }

    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      try {
        const html = await readFile(file, 'utf8')
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html)
      } catch (e) {
        res.writeHead(500).end(String(e && e.message))
      }
      return
    }

    if (req.method === 'POST' && url === '/save') {
      try {
        const body = await readBody(req)
        if (!/^\s*<!doctype html>/i.test(body) || !body.includes('ANNOTATIONS')) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
            .end('{"ok":false,"error":"payload is not a prototype document"}')
          return
        }
        await writeAtomic(file, body)
        saves += 1
        process.stdout.write(`  ✓ 第 ${saves} 次写回 ${path.basename(file)}（${body.length} 字节）\n`)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end('{"ok":true}')
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
          .end(JSON.stringify({ ok: false, error: String(e && e.message) }))
      }
      return
    }

    res.writeHead(404).end('not found')
  })

  server.on('error', (e) => {
    if (e && e.code === 'EADDRINUSE') {
      console.error(`端口 ${opts.port} 被占用，改用随机端口。`)
      server.listen(0, '127.0.0.1')
      return
    }
    fail(`预览服务启动失败：${e && e.message}`)
  })

  server.listen(opts.port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}/`
    console.log(`原型预览：${url}`)
    console.log(`回写目标：${file}`)
    console.log('页面里的批注会自动写回上面这个文件，无需任何操作。按 Ctrl+C 结束预览。')
    if (opts.open) openInBrowser(url)
  })

  const bye = () => {
    console.log(`\n预览结束，共写回 ${saves} 次。`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 500).unref()
  }
  process.on('SIGINT', bye)
  process.on('SIGTERM', bye)
}

/* ────────────────── argv ────────────────── */

const HELP = `原型工具（ai-prd）

  init   <文件> --title <名> [--subtitle <一句话>]      从容器建一份原型
  screen <文件> --name <屏名> [--desktop] [--states …]  加一屏（结构与状态层由本命令保证）
  slot   <文件> --set <名> (--from <片段> | --text <文本>)
         插槽名：title | subtitle | screens | notes | theme | custom
         改稿走它：只换插槽内容，批注块与 data-anno-user 锚点原样保留
  annotations <文件> [--json]                           取用户批注 + AI 侧说明（带行号）
  check  <文件> [--json]                                交付前自检（P0 存在则退出码 1）
  serve  <文件> [--port <n>] [--no-open]                起预览服务，页面批注自动写回该文件

不带子命令时等价于 serve。`

function parseArgs(argv) {
  const out = { _: [], open: true, port: 0 }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--no-open') out.open = false
    else if (a === '--desktop') out.desktop = true
    else if (a === '--json') out.json = true
    else if (a === '--help' || a === '-h') out.help = true
    else if (a === '--port') out.port = normPort(argv[++i])
    else if (a.startsWith('--port=')) out.port = normPort(a.slice(7))
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1)
      else out[a.slice(2)] = argv[++i]
    } else out._.push(a)
  }
  return out
}

function normPort(v) {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    console.error(`忽略非法端口值 ${JSON.stringify(v)}，改用随机端口。`)
    return 0
  }
  return n
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help || !opts._.length) {
    console.log(HELP)
    process.exit(opts.help ? 0 : 2)
  }
  const known = ['init', 'screen', 'slot', 'annotations', 'check', 'serve']
  let cmd = 'serve'
  let file = opts._[0]
  if (known.includes(opts._[0])) {
    cmd = opts._[0]
    file = opts._[1]
  }
  if (!file) fail(`${cmd} 需要一个原型文件路径\n\n${HELP}`)
  const target = path.resolve(file)

  if (cmd === 'init') return cmdInit(target, opts)
  if (cmd === 'screen') return cmdScreen(target, opts)
  if (cmd === 'slot') return cmdSlot(target, opts)
  if (cmd === 'annotations') return cmdAnnotations(target, opts)
  if (cmd === 'check') return cmdCheck(target, opts)
  return cmdServe(target, opts)
}

main()
