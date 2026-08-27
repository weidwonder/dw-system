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
import { createHash } from 'node:crypto'
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

// 每个插槽的替换区间由容器里的 `<!-- MARK:BEGIN … -->` 与 `<!-- MARK:END -->` 界定，
// **不按缩进、也不按标签配对**。零上下文实测撞出过：区间原本用 `[\s\S]*?\n    </div>`
// 非贪婪匹配，片段内部只要出现一行 4 空格缩进的 `</div>`（§8.2 的骨架示例正是如此）就在
// 那里提前截断，于是外壳被留在文件里、旧内容没被换掉，再 slot 一次就多留一屏——退出码
// 仍是 0，check 只会莫名其妙地报"一个屏都没有"。标记是容器里的固定实现，改不了也漂不掉。
const SLOTS = {
  // title 一次写两处（`<title>` 与页头 `<h1>`），且**按形状匹配、不按出厂字面量**——
  // 出厂串 `<title>UI 原型</title>` 在 `init` 之后就不存在了，用它当探针会让
  // `slot --set title` 在任何真实原型上都报"找不到插槽"，而纪律又禁止手工改文件。
  title: {
    probe: '<title>UI 原型</title>',
    apply: (html, v) => html.replace(TITLE_RE, `<title>${v} · 原型</title>`).replace(H1_RE, `<h1 id="proto-title">${v}</h1>`),
  },
  subtitle: {
    probe: '<p id="proto-subtitle"></p>',
    wrap: (v) => `<p id="proto-subtitle">${v}</p>`,
    re: /<p id="proto-subtitle">[\s\S]*?<\/p>/,
  },
  screens: {
    probe: '<div class="devices" data-anno-canvas><!-- SCREENS --></div>',
    mark: 'SCREENS',
    shell: ['<div class="devices" data-anno-canvas>', '</div>'],
    wrap: (v) => `    <div class="devices" data-anno-canvas>\n${v}\n    </div>\n    `,
  },
  notes: {
    probe: '<div class="card-content notes-body" id="proto-notes"></div>',
    mark: 'NOTES',
    shell: ['<div class="card-content notes-body" id="proto-notes">', '</div>'],
    wrap: (v) => `\n        <div class="card-content notes-body" id="proto-notes">\n${v}\n        </div>\n        `,
  },
  theme: {
    probe: '<style id="project-theme"></style>',
    mark: 'PROJECT-THEME',
    shell: ['<style id="project-theme">', '</style>'],
    wrap: (v) => `\n  <style id="project-theme">\n${v}\n  </style>\n  `,
  },
  custom: {
    probe: '<style id="proto-custom"></style>',
    mark: 'CUSTOM-CSS',
    shell: ['<style id="proto-custom">', '</style>'],
    wrap: (v) => `\n  <style id="proto-custom">\n${v}\n  </style>\n  `,
  },
  script: {
    mark: 'CUSTOM-JS',
    shell: ['<script id="proto-script">', '</scr' + 'ipt>'],
    esc: (v) => v.replace(/<\/script/gi, '<\\/script'),
    wrap: (v) => `\n  <script id="proto-script">\n${v}\n  </scr` + `ipt>\n  `,
  },
}

// 标记界定的区间：[BEGIN 注释结束之后, END 注释开始之前)。返回 null 表示标记缺失。
function markRange(html, mark) {
  const b = html.indexOf(`<!-- ${mark}:BEGIN`)
  if (b < 0) return null
  const bEnd = html.indexOf('-->', b)
  if (bEnd < 0) return null
  const e = html.indexOf(`<!-- ${mark}:END`, bEnd)
  if (e < 0) return null
  return { from: bEnd + 3, to: e }
}

// 片段自带外壳时剥掉它：容器已经提供外壳，重复一层会得到 <style><style> 或双层 .devices。
// 纪律的示例带过外壳（§8.4），所以这里宽容处理并出声，而不是判错让人猜。
function stripShell(value, slot, key) {
  if (!slot.shell) return value
  const [open, close] = slot.shell
  const t = value.trim()
  if (t.startsWith(open) && t.endsWith(close)) {
    console.log(`  · 片段自带了外层 ${open}…${close}，已剥掉——外壳由容器提供，片段只写内容`)
    return t.slice(open.length, t.length - close.length)
  }
  return value
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

// 终止用抛错、不用 process.exit：`process.exit()` 会在 stdout 还没冲刷完时切断进程，
// 经管道时输出被截断而退出码仍然正常——ctx CLI 已经为这条教训付过一次代价
// （400KB 的 --json 经管道只剩 64KB、退出码 0）。顶层 catch 负责打印与设退出码。
class Abort extends Error {
  constructor(msg, code) {
    super(msg)
    this.code = code
  }
}

function fail(msg, code = 2) {
  throw new Abort(msg, code)
}

// 退出码约定与 ctx CLI 一致：2 = 用法错误（参数缺失/取值非法），其余失败一律 1。
async function readTarget(file) {
  try {
    const s = await stat(file)
    if (!s.isFile()) throw new Error('not a file')
  } catch {
    fail(`找不到原型文件：${file}`, 1)
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
  const exists = await stat(file).then(() => true, (e) => {
    if (e && e.code === 'ENOENT') return false
    throw e
  })
  if (exists) fail(`目标已存在，不覆盖：${file}\n要改内容请用 slot / screen 子命令。`, 1)
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
function screenSkeleton(name, states, desktop, annoRight) {
  const layers = states
    .map((k) => {
      const cls = k === 'is-default' ? 'status is-default' : `status ${k}`
      return `          <div class="${cls}">\n            <!-- ${STATE_LABEL[k]} -->\n          </div>`
    })
    .join('\n')
  const wrapCls = `device-wrap${desktop ? ' is-desktop' : ''}${annoRight ? ' is-anno-right' : ''}`
  return `      <section class="${wrapCls}">
        <p class="device-name">${esc(name)}</p>
        <div class="device">
          <div class="app-bar">
            <span class="app-title">${esc(name)}</span>
          </div>
          <div class="screen">
${layers}
          </div>
        </div>
        <div class="screen-notes">
          <p class="screen-notes__title">这一屏的注解 · 不属于用户界面</p>
          <div class="screen-notes__body"></div>
          <div class="screen-notes__acts"></div>
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
  // 区间一律走 markRange：SLOTS.screens 没有 `re`，此处曾误引用它——`html.match(undefined)`
  // 恒返回空匹配、`html.replace(undefined, …)` 把 undefined 当字面串找不到，于是本命令
  // **对文件零改动却打印「已加屏」并退出 0**。评审撞出，两轴各报一次。
  const r = markRange(html, SLOTS.screens.mark)
  if (!r) fail('找不到界面插槽（SCREENS 区被改写了？）', 1)
  const region = html.slice(r.from, r.to)
  const block = screenSkeleton(opts.name, states, !!opts.desktop, !!opts['anno-right'])

  // 已有屏时追加在后面，保留既有内容与批注锚点；空插槽时直接落第一屏。
  const stripped = region.replace(/^\s*<div class="devices" data-anno-canvas>/, '').replace(/<\/div>\s*$/, '')
  // 判空 MUST 在剥掉外壳**并**去掉注释之后：出厂的 `<!-- SCREENS -->` 占位注释若被
  // 当成"已有内容"保留下来，check 会一直报「界面插槽还是空的」——屏明明已经加了。
  const inner = stripped.replace(/<!--[\s\S]*?-->/g, '').trim() ? stripped.replace(/\s+$/, '') : ''
  const body = inner ? `${inner}\n\n${block}` : block
  const next = html.slice(0, r.from) + SLOTS.screens.wrap(body) + html.slice(r.to)
  await writeAtomic(file, next)
  console.log(`已加屏「${opts.name}」，状态层：${states.join(' / ')}，注解区挂${opts['anno-right'] ? '右侧' : '下方'}`)
  console.log('下一步：把这一屏的内容写成片段，用 `slot --set screens` 整体写入（MUST NOT 直接编辑原型文件）。')
}

/* ────────────────── slot ────────────────── */

async function cmdSlot(file, opts) {
  if (opts['drop-anchors']) {
    fail('`--drop-anchors` 已废除。请改用 `--agreed --agreed-plan <逐条处置>`。', 2)
  }
  const key = opts.set
  if (!key || !SLOTS[key]) fail(`slot 需要 --set <${Object.keys(SLOTS).join('|')}>`)
  let value = opts.text
  if (opts.from) value = await readFile(path.resolve(opts.from), 'utf8').catch(() => fail(`读不到片段文件：${opts.from}`, 1))
  if (value === undefined) fail('slot 需要 --from <片段文件> 或 --text <文本>')

  const html = await readTarget(file)
  const slot = SLOTS[key]
  const before = readAnnoBlock(html)
  value = stripShell(value, slot, key)
  const body = key === 'title' ? esc(value.trim()) : value.replace(/\s+$/, '')
  const payload = slot.esc ? slot.esc(body) : body

  let next
  if (slot.apply) {
    next = slot.apply(html, payload)
    if (next === html) fail(`插槽 ${key} 没有匹配到任何位置（该区被改写了？）`, 1)
  } else if (slot.mark) {
    const r = markRange(html, slot.mark)
    if (!r) fail(`找不到插槽 ${key} 的标记 ${slot.mark}:BEGIN/END（该区被改写了？）`, 1)
    next = html.slice(0, r.from) + slot.wrap(payload) + html.slice(r.to)
  } else {
    const re = slot.re || new RegExp(slot.probe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    if (!re.test(html)) fail(`找不到插槽 ${key}（该区被改写了？）`, 1)
    next = html.replace(re, slot.wrap(payload))
  }

  // 只数界面区里的锚点：框架 JS 里有 data-anno-user 的字面量，全文计数会虚高
  const anchorsOf = (s) => new Set([...screensRegion(s).matchAll(/data-anno-user="([^"]+)"/g)].map((m) => m[1]))
  const had = anchorsOf(html)
  const kept = anchorsOf(next)
  const lost = [...had].filter((id) => !kept.has(id))

  const plan = await parseAgreedPlan(opts['agreed-plan'])
  if (opts.agreed && !plan) fail('`--agreed` 必须同时给出 `--agreed-plan`，逐条写明 done|void|move。', 2)
  const data = before || { items: [], replies: [] }
  const detailOf = (id) => {
    const it = (data.items || []).find((x) => x.id === id)
    return it ? `${it.screen || '本页'} › "${it.label || ''}"：${it.text}` : '(批注数据里没有这一条)'
  }
  const noteIdsOf = (s) => new Set([...screensRegion(s).matchAll(/data-anno-id="([^"]+)"/g)].map((m) => m[1]))
  const hadNotes = noteIdsOf(html)
  const keptNotes = noteIdsOf(next)
  const lostNotes = [...hadNotes].filter((id) => !keptNotes.has(id))
  const declaredMove = plan ? Object.keys(plan).filter((id) => plan[id] === 'move') : []
  const affected = [...new Set([...lost, ...declaredMove])]
  if (lost.length && !opts.agreed) {
    fail(`拒绝写入：新内容会动到 ${lost.length} 条带用户批注的元素。\n` +
      lost.map((id) => `    ${id}  ${detailOf(id)}`).join('\n') +
      '\n  MUST 先逐条约定，再带 --agreed --agreed-plan=<id>=<done|void|move> 重跑。', 1)
  }
  let released = []
  let changedData = data
  if (affected.length && opts.agreed) {
    const missing = affected.filter((id) => !plan[id])
    if (missing.length) fail(`放行方案漏了 ${missing.length} 条，MUST 逐条给出处置：\n` + missing.map((id) => `    ${id}  ${detailOf(id)}`).join('\n'), 2)
    const moveNoAnchor = affected.filter((id) => plan[id] === 'move' && lost.includes(id))
    if (moveNoAnchor.length) fail(`这几条约定为「挪到新元素」，但新片段里找不到它们的锚点：\n` + moveNoAnchor.map((id) => `    data-anno-user="${id}"  ${detailOf(id)}`).join('\n'), 1)
    released = affected.map((id) => ({ id, act: plan[id], detail: detailOf(id) }))
    const drop = new Set(released.filter((r) => r.act !== 'move').map((r) => r.id))
    changedData = { ...data, items: (data.items || []).filter((x) => !drop.has(x.id)) }
  }
  if (lostNotes.length) {
    const dropped = (data.replies || []).filter((r) => lostNotes.includes(r.noteId))
    console.log(`  ⚠ 新内容丢掉了 ${lostNotes.length} 条 AI 说明`)
    if (dropped.length) console.log(`  ⚠ 连带丢弃 ${dropped.length} 条回复：${dropped.map((r) => r.id).join(' ')}`)
    changedData = { ...changedData, replies: (changedData.replies || []).filter((r) => !lostNotes.includes(r.noteId)) }
  }
  if (before) {
    const dropIds = new Set(released.filter((r) => r.act !== 'move').map((r) => r.id))
    const expected = { ...before, items: (before.items || []).filter((x) => !dropIds.has(x.id)) }
    if (before.replies) expected.replies = before.replies.filter((r) => !lostNotes.includes(r.noteId))
    const after = readAnnoBlock(next)
    if (!after || JSON.stringify({ ...expected, updatedAt: '' }) !== JSON.stringify({ ...after, updatedAt: '' })) {
      if (released.length || lostNotes.length) next = replaceAnnoBlock(next, changedData)
      else fail('拒绝写入：本次替换会改动批注块（放行清单与连带回复之外的改动）。这是 bug，请报告。', 1)
    }
  }

  await writeAtomic(file, next)
  console.log(`已写入插槽 ${key}`)
  if (released.length) {
    console.log('  放行清单（已与用户逐条约定）：')
    released.forEach((r) => console.log(`    ${r.id}  ${{ done: '已落实', void: '作废', move: '挪到新元素' }[r.act]}  ${r.detail}`))
  }
}

const AGREED_ACTIONS = ['done', 'void', 'move']
async function parseAgreedPlan(raw) {
  if (raw === undefined) return null
  let text = raw
  if (!raw.includes('=')) text = await readFile(path.resolve(raw), 'utf8').catch(() => fail(`读不到放行方案文件：${raw}`, 1))
  const plan = {}
  text.split(/[\n,]/).forEach((line) => {
    const s = line.trim()
    if (!s || s.startsWith('#')) return
    const i = s.indexOf('=')
    if (i < 0) fail(`放行方案格式错误：「${s}」`, 2)
    const id = s.slice(0, i).trim(); const act = s.slice(i + 1).trim()
    if (!AGREED_ACTIONS.includes(act)) fail(`未知处置「${act}」（批注 ${id}）。合法取值只有：done / void / move`, 2)
    plan[id] = act
  })
  return plan
}

function replaceAnnoBlock(html, data) {
  const s = html.indexOf(ANNO_OPEN)
  if (s < 0) fail('找不到批注块，无法放行', 1)
  const from = html.indexOf('>', s) + 1
  const to = html.indexOf(CLOSE_SCRIPT, from)
  const text = JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2)
  return html.slice(0, from) + '\n' + text.replace(/<\//g, '<\\/') + '\n  ' + html.slice(to)
}

/* ────────────────── annotations ────────────────── */

// 每一屏在全文里的区间与屏幕名——AI 侧说明要和用户批注一样说得清"这是哪一屏的哪个控件"，
// 否则落盘确认门要"逐条摆出待拍板项"时只剩一个 `div ""`，用户无从判断。
function screenSpans(html) {
  const r = markRange(html, 'SCREENS')
  if (!r) return []
  const region = html.slice(r.from, r.to)
  const spans = []
  const re = /<section class="device-wrap[^"]*">[\s\S]*?<\/section>/g
  let m
  while ((m = re.exec(region))) {
    const name = (m[0].match(/<p class="device-name">([\s\S]*?)<\/p>/) || [])[1]
    spans.push({ from: r.from + m.index, to: r.from + m.index + m[0].length, name: (name || '').trim() })
  }
  return spans
}

function collectAiNotes(html) {
  const out = []
  const spans = screenSpans(html)
  const re = /<([a-z0-9]+)\b([^>]*?)data-anno="([^"]*)"([^>]*)>/gi
  let m
  while ((m = re.exec(html))) {
    const attrs = m[2] + m[4]
    const kind = /data-anno-kind="question"/.test(attrs) ? 'question' : 'note'
    const tail = html.slice(m.index + m[0].length, m.index + m[0].length + 400)
    // 标签紧跟的文本 → 元素内部的第一段文本 → aria-label：三级回退，尽量给出人认得的名字
    const label =
      (tail.split('<')[0] || '').replace(/\s+/g, ' ').trim() ||
      (tail.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()) ||
      (attrs.match(/aria-label="([^"]*)"/) || [])[1] ||
      ''
    const span = spans.find((sp) => m.index >= sp.from && m.index < sp.to)
    const id = (attrs.match(/data-anno-id="([^"]*)"/) || [])[1] || ''
    out.push({
      line: lineOf(html, m.index),
      screen: span ? span.name : '',
      tag: m[1].toLowerCase(),
      kind,
      id,
      label: label.slice(0, 60),
      text: m[3],
    })
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
  const known = new Set(ai.map((a) => a.id).filter(Boolean))
  const replies = (data.replies || []).map((r) => ({ ...r, orphan: !known.has(r.noteId) }))

  if (opts.json) {
    console.log(JSON.stringify({
      schema: data.schema || 'prd-annotations@1',
      file: path.resolve(file),
      updatedAt: data.updatedAt || '',
      user: { items, global: data.global || [], replies },
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
    console.log(`  ${a.screen || '本页'} › ${a.tag} "${a.label}" @${path.basename(file)}:${a.line}${a.kind === 'question' ? ' [待拍板]' : ''}`)
    console.log(`        ${a.text}`)
  })
  console.log(`\n用户对说明的回复（${replies.length}）`)
  replies.forEach((r) => {
    const q = r.noteKind === 'question' ? ' [待拍板]' : ''
    const where = r.orphan ? '（这条说明已不在页面上）' : ''
    console.log(`  [${r.id}] ${r.screen || '本页'} › ${r.tag || '?'} "${r.label || ''}"${q}${where}`)
    console.log(`        回的是：${r.noteText}`)
    console.log(`        回复：${r.text}`)
  })
}

/* ────────────────── check ────────────────── */

const FIXED_REGIONS = ['THEME', 'DESIGN-SYSTEM', 'ICONS', 'SCREEN-SCRIPT', 'ANNO-FRAMEWORK:CSS', 'ANNO-FRAMEWORK:JS', 'ANNOTATIONS']

// 控件的子元素结构契约：容器 CSS 靠这些形态才生效，写错了页面不报错、只是版式塌掉。
const STRUCTURE = [
  { cls: 'kv-row', need: /<dt[\s>]/, msg: '.kv-row 的两个子元素 MUST 是 <dt> 与 <dd>（容器用 dt/dd 排版）' },
  { cls: 'alert', need: /class="alert-title"/, msg: '.alert 里 MUST 有 .alert-title；title/description MUST 是 .alert 的直接子元素（grid 布局）' },
  { cls: 'checkbox', need: /aria-checked=/, msg: '.checkbox MUST 带 aria-checked，且内含 <svg class="icon">；MUST NOT 用原生 <input type="checkbox">' },
  { cls: 'switch', need: /aria-checked=/, msg: '.switch MUST 带 aria-checked' },
  { cls: 'tabs-trigger', need: /aria-selected=/, msg: '.tabs-trigger MUST 带 aria-selected，且 MUST 放在 .tabs-list 内' },
  // `not` 排除状态层：状态层的 class 是 `status empty`，与空态组件 `.empty` 撞名，
  // 不排除的话每个带空态的屏都会被报一条根本不适用的结构错误。
  { cls: 'empty', not: 'status', need: /class="empty-title"/, msg: '.empty 里 MUST 有 .empty-title（另可配 .empty-icon / .empty-description）' },
  { cls: 'input-group', need: /<svg class="icon/, msg: '.input-group 里 MUST 有 <svg class="icon">，否则左内边距留白但没有图标' },
  { cls: 'select-wrap', need: /<select class="select"/, msg: '.select-wrap 里 MUST 是 <select class="select">，箭头由外层伪元素画' },
]

function sliceRegion(html, mark) {
  const b = html.indexOf(`<!-- ${mark}:BEGIN`)
  const e = html.indexOf(`<!-- ${mark}:END`)
  return b >= 0 && e > b ? html.slice(b, e) : ''
}

function screensRegion(html) {
  const r = markRange(html, 'SCREENS')
  return r ? html.slice(r.from, r.to) : ''
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
    // 同 STRUCTURE 那处：`\b` 会让 `status-pill` 这类合法业务 class 命中，
    // 于是一枚普通标签被报成「状态层放错位置」，还把人指去改它的层级。
    if (cls.split(/\s+/).includes('status') && depth !== 0) bad.push(cls.trim())
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
    if (b < 0 || e <= b) add('P0', `固定实现区 ${mark} 缺失或被改写`, '原型 MUST 由 init 命令从容器建出，固定实现区 MUST NOT 被改写')
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

  // 5b. 孤儿批注：批注块里有、界面上却找不到锚点的条目 —— 用户意见已断链
  const annoData = readAnnoBlock(html)
  if (annoData) {
    const anchors = new Set([...screensRegion(html).matchAll(/data-anno-user="([^"]+)"/g)].map((m) => m[1]))
    const orphans = (annoData.items || []).filter((it) => it.id && !anchors.has(it.id))
    orphans.forEach((it) =>
      add('P0', `用户批注「${it.text}」已失联（锚点 data-anno-user="${it.id}" 不在界面上）`,
        '改稿时把该 data-anno-user 属性写回对应元素；这条意见交付时看不出任何症状')
    )
  }

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
    if (!/<div class="screen-notes">/.test(w)) {
      add('P1', `第 ${i + 1} 屏缺 .screen-notes 注解区`, '注解区由 screen 命令生成；手工拼屏才会缺它')
    } else {
      const body = (w.match(/<div class="screen-notes__body">([\s\S]*?)<\/div>/) || [])[1] || ''
      if (!body.replace(/<[^>]*>/g, '').trim()) {
        add('P2', `第 ${i + 1} 屏没写注解`, '有的屏确实没什么可说，这条只是提示')
      }
    }
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

  const scriptRegion = sliceRegion(html, 'CUSTOM-JS')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  const actNames = [...screens.matchAll(/<button[^>]*data-act="([^"]+)"/g)].map((m) => m[1])
  actNames.forEach((name) => {
    if (!scriptRegion.includes(name)) {
      add('P2', `注解区按钮「${name}」没有对应的点击行为`,
        '外观由容器给，行为写进 script 插槽：preview.mjs slot --set script')
    }
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
    // class MUST 按空格分词精确比对：`\b` 会让 `alert-description` 命中 `alert`，
    // 于是一个结构完全正确的提示条被判红，而唯一"消掉"它的办法是删掉 .alert-description
    // ——正好违反同一张表的要求。实测撞出过。
    const re = new RegExp(`<[a-z0-9]+[^>]*class="(?:[^"]*\\s)?${s.cls}(?:\\s[^"]*)?"[^>]*>`, 'gi')
    let m
    while ((m = re.exec(screens))) {
      if (s.not) {
        const cls = (m[0].match(/class="([^"]*)"/) || [])[1] || ''
        if (cls.split(/\s+/).includes(s.not)) continue
      }
      const tail = screens.slice(m.index, m.index + 600)
      if (!s.need.test(tail) && !s.need.test(m[0])) {
        add('P1', `${path.basename(file)}:${lineOf(html, html.indexOf(m[0]))} ${s.msg}`)
        break
      }
    }
  })

  // 9. class 是否有定义（设计系统 + 项目主题 + 自定义 CSS 三处）
  // 四处都按标记取：曾误用 SLOTS.custom.re / SLOTS.theme.re（两者都没有 `re`），
  // 于是写进 custom / theme 插槽的 class 从不算"已定义"，正确用法反被报成没定义——
  // 而提示要求做的正是已经做过的事，把作者逼回行内样式（又撞上写死颜色那条）。
  const styleText = sliceRegion(html, 'DESIGN-SYSTEM') + sliceRegion(html, 'THEME') +
    sliceRegion(html, 'CUSTOM-CSS') + sliceRegion(html, 'PROJECT-THEME')
  // 字符类里的 `_` 是必须的：屏注解区用 .screen-notes__title 这类 BEM 命名，
  // 不认下划线就会把它们全报成「没有样式定义的 class」——而样式明明就在上面。
  const defined = new Set([...styleText.matchAll(/\.([a-z][a-z0-9_-]*)/g)].map((m) => m[1]))
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

  const DIFF_WORDS = ['相比上一轮', '相比上一版', '原方案', '本轮把', '上一稿', '改为原来的', '与上一版相比']
  const proseRegions = screensRegion(html) + sliceRegion(html, 'NOTES') +
    [...html.matchAll(/data-anno="([^"]*)"/g)].map((m) => m[1]).join(' ')
  DIFF_WORDS.forEach((w) => {
    if (proseRegions.includes(w)) add('P2', `稿间对比措辞「${w}」`, '未定稿前的改稿只写最新设计；业务文案里正好有这个词就忽略本条')
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
  process.exitCode = problems.some((p) => p.level === 'P0') ? 1 : 0
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
  async function versionOf(target) {
    const buf = await readFile(target)
    return createHash('sha256').update(buf).digest('hex').slice(0, 16)
  }
  let writeChain = Promise.resolve()
  function serializeWrite(fn) {
    const next = writeChain.then(fn, fn)
    writeChain = next.catch(() => {})
    return next
  }

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

    if ((req.method === 'GET' || req.method === 'HEAD') && (url === '/' || url === '/index.html')) {
      try {
        const html = await readFile(file, 'utf8')
        const headers = {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'x-proto-version': await versionOf(file),
        }
        if (req.method === 'HEAD') res.writeHead(200, headers).end()
        else res.writeHead(200, headers).end(html)
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
        const query = (req.url || '').split('?')[1] || ''
        const want = req.headers['if-match'] || new URLSearchParams(query).get('v') || ''
        const outcome = await serializeWrite(async () => {
          const now = await versionOf(file)
          if (!want || want !== now) return { stale: true, now, latest: await readFile(file, 'utf8') }
          await writeAtomic(file, body)
          return { stale: false, version: await versionOf(file) }
        })
        if (outcome.stale) {
          res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' })
            .end(JSON.stringify({ ok: false, error: 'stale', version: outcome.now, html: outcome.latest }))
          process.stdout.write(`  ⚠ 拒绝一次过期写回（页面版本 ${want || '未带'}，磁盘 ${outcome.now}）\n`)
          return
        }
        saves += 1
        process.stdout.write(`  ✓ 第 ${saves} 次写回 ${path.basename(file)}（${body.length} 字节）\n`)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          .end(JSON.stringify({ ok: true, version: outcome.version }))
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
    fail(`预览服务启动失败：${e && e.message}`, 1)
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
  screen <文件> --name <屏名> [--desktop] [--anno-right] [--states …]
         加一屏（结构、状态层与屏注解区由本命令保证）
         --anno-right：注解区挂这一屏右侧；不给即挂下方
  slot   <文件> --set <名> (--from <片段> | --text <文本>)
         插槽名：title | subtitle | screens | notes | theme | custom | script
         script 装注解区按钮的点击行为，与原型同文件，MUST NOT 引外部脚本
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
    else if (a === '--anno-right') out['anno-right'] = true
    else if (a === '--json') out.json = true
    else if (a === '--agreed') out.agreed = true
    else if (a === '--drop-anchors') out['drop-anchors'] = true
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
    process.exitCode = opts.help ? 0 : 2
    return
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

// 顶层兜底：任何没被上面各层接住的异常 MUST NOT 以 Node 堆栈的形式出现——
// 拿到堆栈的 agent 会把"工具坏了"读成"这条路走不通"，转而手工改原型文件，
// 那正是本工具要消灭的行为。同一条教训在 ctx CLI 的 run() 里已写过一次。
main().catch((e) => {
  if (e instanceof Abort) {
    console.error(e.message)
    process.exitCode = e.code
    return
  }
  console.error(`preview.mjs 执行失败：${(e && e.message) || e}`)
  console.error('这是工具自身的问题，MUST NOT 因此改用手工编辑原型文件——请报告这条信息。')
  process.exitCode = 1
})
