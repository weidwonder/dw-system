// 2.7.0 原型预览服务（`dw-prd/scripts/preview.mjs`）的契约测试。
//
// 为什么要有它：浏览器不允许网页未经用户手势就写本地文件，所以 `file://` 打开的原型
// 只能靠用户点一次「保存到文件」并在弹窗里选中文件本身。原型是 agent 生成的、路径它
// 自己就知道，让用户再选一次纯属多余——这个服务把原型用 http 提供出去，页面就能把
// 批注直接 POST 回来写进原文件，全程零操作。
//
// 这里锁三件事：①回写真的落到磁盘且内容可解析；②非原型 payload 不会把文件写坏；
// ③只服务回环（挡 DNS rebinding）。都用真进程 + 真端口跑，不 mock。
//
// spec：docs/spec/2026-08-25-原型批注框架-lean-change-spec.md
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { request } from 'node:http'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { composeTemplate } from '../dw-system/skills/dw-prd/scripts/preview.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const script = path.join(repoRoot, 'dw-system', 'skills', 'dw-prd', 'scripts', 'preview.mjs')
const composedTemplate = await composeTemplate()

const SLOT_OPEN = '<script type="application/json" id="anno-data">'
const SLOT_CLOSE = '</scr' + 'ipt>'

function readAnnotations(html) {
  const s = html.indexOf(SLOT_OPEN)
  assert.ok(s >= 0, '找不到批注数据块')
  const from = html.indexOf('>', s) + 1
  const to = html.indexOf(SLOT_CLOSE, from)
  return JSON.parse(html.slice(from, to))
}

function withAnnotations(html, data) {
  const s = html.indexOf(SLOT_OPEN)
  const from = html.indexOf('>', s) + 1
  const to = html.indexOf(SLOT_CLOSE, from)
  const text = JSON.stringify(data, null, 2).replace(/<\//g, '<\\/')
  return html.slice(0, from) + '\n' + text + '\n  ' + html.slice(to)
}

// 起真进程，等它打印出监听地址
function startServer(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, file, '--port', '0', '--no-open'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    const onData = (buf) => {
      out += String(buf)
      const m = out.match(/http:\/\/127\.0\.0\.1:(\d+)\//)
      if (m) {
        child.stdout.off('data', onData)
        resolve({ child, base: m[0], port: Number(m[1]) })
      }
    }
    child.stdout.on('data', onData)
    child.on('error', reject)
    setTimeout(() => reject(new Error(`预览服务未在 5s 内就绪，输出：${out}`)), 5000).unref()
  })
}

// 手动设 Host 发请求：fetch 不让改 Host，用它测不出 DNS rebinding 防护
function rawGet(port, pathname, host) {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path: pathname, method: 'GET', headers: { Host: host } },
      (res) => {
        res.resume()
        resolve(res.statusCode)
      }
    )
    req.on('error', reject)
    req.end()
  })
}

async function stopServer(child) {
  child.kill('SIGTERM')
  await new Promise((r) => {
    child.on('exit', r)
    setTimeout(r, 1000).unref()
  })
}

test('预览服务：批注 POST 回来后真的写进磁盘上的原型文件', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-preview-'))
  const file = path.join(dir, 'demo.html')
  writeFileSync(file, composedTemplate, 'utf8')
  const { child, base } = await startServer(file)
  try {
    const health = await fetch(base + 'health')
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { ok: true })

    // GET / 拿到的就是文件当前内容
    const servedRes = await fetch(base)
    const served = await servedRes.text()
    const servedVersion = servedRes.headers.get('x-proto-version')
    assert.ok(servedVersion)
    assert.ok(served.startsWith('<!doctype html>'), 'GET / 应返回原型文件本身')

    const before = statSync(file).size
    const payload = {
      schema: 'prd-annotations@1',
      updatedAt: '2026-08-26T12:00:00.000Z',
      global: [{ id: 'g1', text: '整体没问题', at: '2026-08-26T12:00:00.000Z' }],
      items: [
        {
          id: 'u1',
          screen: '退款审核 · 待处理列表',
          tag: 'button',
          label: '批量通过',
          path: 'section > div.card > button.btn',
          text: '这里要二次确认',
          at: '2026-08-26T12:00:00.000Z',
        },
      ],
    }
    const res = await fetch(base + 'save', {
      method: 'POST',
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'If-Match': servedVersion },
      body: withAnnotations(served, payload),
    })
    assert.equal(res.status, 200)
    const saved = await res.json()
    assert.equal(saved.ok, true)
    assert.ok(saved.version)

    const disk = readFileSync(file, 'utf8')
    assert.notEqual(statSync(file).size, before, '磁盘文件应被改写')
    const back = readAnnotations(disk)
    assert.equal(back.items.length, 1)
    assert.equal(back.global.length, 1)
    assert.equal(back.items[0].label, '批量通过')
    assert.equal(back.items[0].screen, '退款审核 · 待处理列表')
    assert.equal(back.items[0].text, '这里要二次确认')
  } finally {
    await stopServer(child)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('预览服务：非原型 payload 不写盘，回环之外一律拒绝', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-preview-'))
  const file = path.join(dir, 'demo.html')
  const original = composedTemplate
  writeFileSync(file, original, 'utf8')
  const { child, base, port } = await startServer(file)
  try {
    // 垃圾 payload：拒绝且文件原封不动
    const bad = await fetch(base + 'save', { method: 'POST', body: 'hello' })
    assert.equal(bad.status, 400, '非原型内容必须拒绝')
    assert.equal(readFileSync(file, 'utf8'), original, '被拒的请求不得改动文件')

    // 看着像 HTML 但不是原型（没有批注区）：同样拒绝
    const notProto = await fetch(base + 'save', {
      method: 'POST',
      body: '<!doctype html><html><body>hi</body></html>',
    })
    assert.equal(notProto.status, 400)
    assert.equal(readFileSync(file, 'utf8'), original)

    // 伪造 Host：DNS rebinding 的典型形态，必须挡住。
    // 注意不能用 fetch —— Host 是它的 forbidden header，会被静默忽略，实际发出去的
    // 仍是真实回环地址，于是测试永远绿。必须用 node:http 手动设头。
    const rebind = await rawGet(port, '/health', 'evil.example.com')
    assert.equal(rebind, 403, '非回环 Host 必须拒绝')

    assert.equal((await fetch(base + 'nope')).status, 404)
  } finally {
    await stopServer(child)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('容器在 http 下走自动回写，在 file:// 下降级到手动', () => {
  const template = composedTemplate
  assert.match(template, /location\.protocol === "http:"/, '容器必须能识别自己是被预览服务提供的')
  assert.match(template, /fetch\("save"/, 'http 模式下必须把批注 POST 回服务')
  assert.match(template, /if \(SERVED\) return;/, '自动回写时不该再弹"为什么要点保存"的说明')
  // file:// 的两条降级路径都还在
  assert.match(template, /showOpenFilePicker/, 'file:// 下仍要保留手动授权写回')
  assert.match(template, /a\.download = FILE/, '不支持直写的浏览器仍要能下载副本')
})

// ── 工具族的端到端契约 ────────────────────────────────────────────────────────
// 建原型（init/screen/slot）、自检（check）、取批注（annotations）是 agent 与容器之间
// 唯一的接触面。它们坏掉的方式都是静默的：slot 定位不到就"没改动"，check 漏判就"看着挺好"，
// annotations 少一类就"用户没提意见"。所以这里真跑进程、真读文件。

const run = (...args) => {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
}

test('init → screen → slot：改稿不丢用户批注，也不丢元素锚点', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-tool-'))
  const file = path.join(dir, 'p.html')

  assert.equal(run('init', file, '--title', '订单改期', '--subtitle', '样式依据：现有设计 token').code, 0)
  assert.equal(run('screen', file, '--name', '订单详情', '--states', 'is-default,empty').code, 0)
  const screenHtml =
    '<section class="device-wrap"><p class="device-name">订单详情</p><div class="device">' +
    '<div class="screen"><div class="status is-default">' +
    '<button class="btn" data-anno="点这里改期" data-anno-user="u1">改期</button>' +
    '</div></div></div></section>'
  assert.equal(run('slot', file, '--set', 'screens', '--text', screenHtml).code, 0)

  // 模拟用户在页面上写了批注（容器回写后的形态）。
  const before = readFileSync(file, 'utf8')
  const at = before.indexOf(SLOT_OPEN)
  assert.ok(at >= 0)
  const from = at + SLOT_OPEN.length
  const to = before.indexOf(SLOT_CLOSE, from)
  const filled = JSON.stringify(
    {
      schema: 'prd-annotations@1',
      updatedAt: '2026-08-26T00:00:00.000Z',
      global: [{ id: 'g1', text: '整体节奏偏慢' }],
      items: [{ id: 'u1', screen: '订单详情', label: '改期', text: '这里要能选时间段' }],
    },
    null,
    2
  )
  writeFileSync(file, before.slice(0, from) + '\n' + filled + '\n' + before.slice(to))

  // 改稿：只换设计说明栏，批注与锚点必须原样还在。
  assert.equal(run('slot', file, '--set', 'notes', '--text', '<p>样式依据：现有 token</p>').code, 0)
  const after = readFileSync(file, 'utf8')
  assert.ok(after.includes('这里要能选时间段'), '改稿抹掉了用户批注——这正是禁止手工改稿的理由')
  assert.ok(after.includes('整体节奏偏慢'), '改稿抹掉了全局反馈')
  assert.ok(after.includes('data-anno-user="u1"'), '改稿抹掉了元素锚点，批注就再也定位不到元素')
  assert.ok(after.includes('样式依据：现有 token'), '改稿没生效')

  // 取批注：三类必须一次给全。
  const anno = run('annotations', file, '--json')
  assert.equal(anno.code, 0, anno.out)
  const parsed = JSON.parse(anno.out)
  assert.equal(parsed.user.items.length, 1, '用户逐元素批注缺失')
  assert.equal(parsed.user.items[0].screen, '订单详情', '批注必须带所在屏')
  assert.equal(parsed.user.global.length, 1, '全局反馈缺失')
  assert.ok(
    parsed.ai.some((n) => n.text === '点这里改期'),
    'AI 侧 data-anno 说明缺失——它在界面上看不到，漏了不会有任何症状'
  )

  rmSync(dir, { recursive: true, force: true })
})

test('check 逐类抓出"写错了也不报错"的结构问题', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-check-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)

  const head = '<section class="device-wrap"><p class="device-name">A</p><div class="device"><div class="screen">'
  const tail = '</div></div></section>'
  // P0：一定要拦下（退出码 1，CI 可判）。
  const blocking = [
    ['状态层不是 .screen 的直接子元素', head + '<div class="wrap"><div class="status is-default">x</div></div>' + tail],
    ['图标 id 未定义', head + '<div class="status is-default"><svg class="icon"><use href="#i-not-a-real-icon"/></svg></div>' + tail],
  ]
  for (const [what, html] of blocking) {
    assert.equal(run('slot', file, '--set', 'screens', '--text', html).code, 0)
    assert.equal(
      run('check', file).code,
      1,
      `check 没把它判成 P0：${what}（页面照常打开，只是版式塌掉或图标空白，零报错）`
    )
  }

  // P1：不阻断交付，但必须报出来——agent 只看退出码会漏掉，所以断言报告里有这一条。
  const kvBad = head + '<div class="status is-default"><div class="kv"><div class="kv-row"><span>金额</span></div></div></div>' + tail
  assert.equal(run('slot', file, '--set', 'screens', '--text', kvBad).code, 0)
  const report = JSON.parse(run('check', file, '--json').out)
  assert.ok(
    report.problems.some((p) => /kv-row/.test(p.msg)),
    'check 没报出 .kv-row 缺 <dt>——版式会塌掉却零报错'
  )

  rmSync(dir, { recursive: true, force: true })
})

// ── 零上下文实测（2026-08-26）撞出的五个缺陷，逐条固化 ──────────────────────
// 这一组全部来自"照文档做一遍"而不是"读代码找问题"：五条在当时的 305 项测试下全绿，
// 却让一份原型静默变成错的。共同点是**没有任何报错**——正是最该由闸接手的那一类。

// P0-1/P0-2：替换区间曾用 `[\s\S]*?\n    </div>` 非贪婪匹配，片段内部只要出现一行
// 4 空格缩进的 `</div>`（纪律 §8.2 的骨架示例正是如此）就在那里提前截断：外壳留在
// 文件里、旧内容没换掉，再 slot 一次就多留一屏，退出码全程 0，check 却报"一个屏都没有"。
test('slot 的替换区间不受片段缩进影响，重复写入同一片段不会越写越多', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-indent-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)

  // 逐字采用纪律 §8.2 的缩进形态：闭合标签落在 4 空格。
  const frag = [
    '<section class="device-wrap">',
    '  <p class="device-name">订单列表</p>',
    '  <div class="device">',
    '    <div class="screen">',
    '      <div class="status is-default">',
    '        <button class="btn">批量改期</button>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</section>',
  ].join('\n')

  assert.equal(run('slot', file, '--set', 'screens', '--text', frag).code, 0)
  const once = readFileSync(file, 'utf8')
  assert.equal(run('check', file).code, 0, 'check 把一份结构合规的原型判成 P0——区间截断的典型症状')

  assert.equal(run('slot', file, '--set', 'screens', '--text', frag).code, 0)
  const twice = readFileSync(file, 'utf8')
  const count = (s) => (s.match(/<section class="device-wrap/g) || []).length
  assert.equal(count(twice), count(once), '同一片段写第二次屏数增加了：区间没盖住旧内容，静默重复插入')
  assert.equal(count(once), 1, '片段里只有一屏，文件里就该只有一屏')

  rmSync(dir, { recursive: true, force: true })
})

// P0-3：用户批注挂在界面元素上，而界面元素全住在 screens 插槽里——改稿会连锚点一起换掉。
// 失联的表现是"批注还在文件里、却指不到任何元素"，交付时没有任何症状。
test('slot 丢掉用户批注锚点时拒绝写入，并说清丢的是哪几条', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-anchor-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const withAnchor = '<section class="device-wrap"><p class="device-name">A</p><div class="device"><div class="screen">' +
    '<div class="status is-default"><button class="btn" data-anno-user="a1">改期</button></div></div></div></section>'
  assert.equal(run('slot', file, '--set', 'screens', '--text', withAnchor).code, 0)

  const html = readFileSync(file, 'utf8')
  const at = html.indexOf(SLOT_OPEN)
  const from = at + SLOT_OPEN.length
  const to = html.indexOf(SLOT_CLOSE, from)
  const data = JSON.stringify({
    schema: 'prd-annotations@1', updatedAt: '', global: [],
    items: [{ id: 'a1', screen: 'A', label: '改期', text: '这里要能选时间段' }],
  }, null, 2)
  writeFileSync(file, html.slice(0, from) + '\n' + data + '\n' + html.slice(to))

  const noAnchor = withAnchor.replace(' data-anno-user="a1"', '')
  const rejected = run('slot', file, '--set', 'screens', '--text', noAnchor)
  assert.equal(rejected.code, 1, '丢掉锚点仍然写入了——用户的意见会静默失联')
  assert.match(rejected.out, /a1/, '拒绝信息必须点名是哪个锚点')
  assert.match(rejected.out, /这里要能选时间段/, '拒绝信息必须带上那条批注的正文，否则看不出丢的是什么')
  assert.ok(readFileSync(file, 'utf8').includes('data-anno-user="a1"'), '拒绝写入时文件必须原样未动')

  const rejectedDeprecated = run('slot', file, '--set', 'screens', '--text', noAnchor, '--drop-anchors')
  assert.equal(rejectedDeprecated.code, 2)
  assert.match(rejectedDeprecated.out, /--agreed/)

  rmSync(dir, { recursive: true, force: true })
})

// P1-2：class 曾用 `\b` 匹配，于是 `alert-description` 命中 `alert`，一个结构完全正确的
// 提示条被判红——而"消掉"它最顺手的办法是删掉 .alert-description，正好违反同一张表。
test('结构契约按 class token 精确比对，不误伤同前缀的子元素 class', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-token-'))
  const file = path.join(dir, 'p.html')
  // 这条测的是 .alert 一族的**结构契约**，属于外观层范畴，因此 MUST 用基线装配建原型。
  // 默认装配下这些 class 压根没有样式，会先撞上"未定义 class"那条 P1，断言就不再是在
  // 验结构契约了。
  assert.equal(run('init', file, '--title', 'T', '--with-baseline').code, 0)
  const ok = '<section class="device-wrap"><p class="device-name">A</p><div class="device"><div class="screen">' +
    '<div class="status is-default"><div class="alert alert-info">' +
    '<div class="alert-title">提示</div><div class="alert-description">有 2 单不可改期</div>' +
    '</div></div></div></div></section>'
  assert.equal(run('slot', file, '--set', 'screens', '--text', ok).code, 0)
  const report = JSON.parse(run('check', file, '--json').out)
  assert.ok(
    !report.problems.some((p) => /alert-title/.test(p.msg)),
    '结构正确的 .alert 被判红：class 匹配把 alert-description 当成了 .alert'
  )
  rmSync(dir, { recursive: true, force: true })
})

// P1-4/P1-5：纪律的示例带过外壳，照抄会得到 <style><style> 或双层 .devices，而这两种
// 都不报错。工具兜底剥掉重复外壳并出声——但纪律侧也不许再教人带外壳。
test('片段自带外壳时被剥掉，不产生嵌套', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-shell-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const r = run('slot', file, '--set', 'custom', '--text', '<style id="proto-custom">.x{color:red}</style>')
  assert.equal(r.code, 0)
  assert.match(r.out, /剥掉/, '剥外壳这件事必须出声，否则作者不知道自己写法有问题')
  const html = readFileSync(file, 'utf8')
  assert.equal((html.match(/<style id="proto-custom">/g) || []).length, 1, '产生了嵌套 <style>')
  rmSync(dir, { recursive: true, force: true })
})

// P2-4：AI 侧待拍板项要在落盘确认门逐条摆给用户看，只给 `div ""` 说不清是哪个控件。
test('annotations 的 AI 侧条目也带屏幕名与元素文字', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ai-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const html = '<section class="device-wrap"><p class="device-name">订单列表</p><div class="device"><div class="screen">' +
    '<div class="status is-default"><div class="alert alert-info" data-anno="按商家规则算" data-anno-kind="question">' +
    '<div class="alert-title">有 2 单不可改期</div></div></div></div></div></section>'
  assert.equal(run('slot', file, '--set', 'screens', '--text', html).code, 0)
  const parsed = JSON.parse(run('annotations', file, '--json').out)
  const q = parsed.ai.find((a) => a.kind === 'question')
  assert.ok(q, '待拍板项没被识别出来')
  assert.equal(q.screen, '订单列表', 'AI 侧条目必须带所在屏')
  assert.ok(q.label, 'AI 侧条目必须带元素上认得出的文字，否则用户看到的是一个匿名 div')
  rmSync(dir, { recursive: true, force: true })
})

// ── 评审门（2026-08-26）撞出的缺陷，逐条固化 ────────────────────────────────
// 这一组的共同点是**命令报成功却什么都没做**，或**闸把正确写法判成错**。
// 前者让 agent 带着错误信念继续走，后者主动教 agent 把对的改成错的——两类都比不报更贵。

// P0：cmdScreen 曾引用 SLOTS.screens.re（改标记定界时已删掉该字段）。
// `html.match(undefined)` 恒返回空匹配、`html.replace(undefined, …)` 把 undefined 当字面串
// 找不到，于是命令对文件零改动却打印「已加屏」并退出 0。旧断言只看退出码，恒真。
test('screen 真的把一屏写进文件，结构与状态层齐全', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-screen-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const before = readFileSync(file, 'utf8')

  assert.equal(run('screen', file, '--name', '订单列表', '--states', 'is-default,empty').code, 0)
  const after = readFileSync(file, 'utf8')
  assert.notEqual(after, before, 'screen 命令对文件零改动——它打印的"已加屏"是假的')
  assert.match(after, /<section class="device-wrap">/, '缺 .device-wrap 外壳')
  assert.match(after, /<p class="device-name">订单列表<\/p>/, '屏幕名没写进去，批注就分不清是哪一屏')
  assert.match(after, /class="status is-default"/, '缺默认态状态层')
  assert.match(after, /class="status empty"/, '缺 --states 指定的空态层')
  assert.doesNotMatch(after, /<!-- SCREENS -->/, '出厂占位注释没被换掉，check 会一直报"界面插槽还是空的"')
  assert.equal(run('check', file).code, 0, 'init + screen 之后就该无 P0——报错把人指回刚跑过的那条命令')

  // 第二屏追加，不覆盖第一屏。
  assert.equal(run('screen', file, '--name', '改期结果', '--desktop', '--states', 'is-default,error').code, 0)
  const two = readFileSync(file, 'utf8')
  assert.equal((two.match(/<section class="device-wrap/g) || []).length, 2, '第二屏没追加上，或把第一屏覆盖了')
  assert.match(two, /device-wrap is-desktop/, '--desktop 没生效')
  assert.match(two, /class="status error"/, '第二屏的 error 状态层没生成')

  rmSync(dir, { recursive: true, force: true })
})

test('screen 加屏时连注解区外壳一起给出，默认挂下方', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-anno-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  assert.equal(run('screen', file, '--name', '工单列表').code, 0)
  const html = readFileSync(file, 'utf8')
  assert.match(html, /<div class="screen-notes">/)
  assert.match(html, /class="screen-notes__title">这一屏的注解 · 不属于用户界面</)
  assert.match(html, /<div class="screen-notes__body">/)
  assert.match(html, /<div class="screen-notes__acts">/)
  const wrap = html.match(/<section class="device-wrap[^"]*">[\s\S]*?<\/section>/)[0]
  assert.ok(wrap.indexOf('</div>\n        <div class="screen-notes">') > wrap.indexOf('<div class="device">'))
  assert.doesNotMatch(wrap, /class="device-wrap is-anno-right"/)
  rmSync(dir, { recursive: true, force: true })
})

// 2.12.0 废除 --anno-right：屏在画布上矩阵排列，注解区一律挂该屏下方。旧路径把
// .device-wrap 整个改成 flex-direction: row，而它有三个子元素、规则只写了后两个，屏名
// 被一并排进同一行；叠加 --desktop 时两条同特异性的 width 后写者赢，宽度锁死又塞不下。
test('--anno-right 已废除：传入即报错，且不留下半成品', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-anno-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const before = readFileSync(file, 'utf8')
  const r = run('screen', file, '--name', '详情', '--anno-right')
  assert.equal(r.code, 2, '废除的参数 MUST 硬失败，MUST NOT 静默忽略')
  assert.match(r.out + r.err, /--anno-right 已废除/)
  assert.equal(readFileSync(file, 'utf8'), before, '报错路径 MUST NOT 改动文件')
  rmSync(dir, { recursive: true, force: true })
})

test('屏注解区恒挂在该屏下方，且屏名恒在设备壳之外', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-below-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  assert.equal(run('screen', file, '--name', '详情', '--desktop').code, 0)
  const html = readFileSync(file, 'utf8')
  assert.match(html, /<section class="device-wrap is-desktop">/, 'desktop 屏不应再带 is-anno-right')
  assert.ok(!html.includes('is-anno-right'), '容器与产物都不应再出现 is-anno-right')
  const wrap = html.slice(html.indexOf('<section class="device-wrap'))
  const iName = wrap.indexOf('device-name')
  const iDevice = wrap.indexOf('<div class="device">')
  const iNotes = wrap.indexOf('screen-notes')
  assert.ok(iName >= 0 && iDevice > iName, '屏名 MUST 在设备壳之前（左上角）')
  assert.ok(iNotes > iDevice, '注解区 MUST 排在设备壳之后（下方）')
  rmSync(dir, { recursive: true, force: true })
})

test('屏注解区仍是画布内的元素，用户能在它上面写批注', () => {
  const html = composedTemplate
  const js = html.slice(html.indexOf('ANNO-FRAMEWORK:JS:BEGIN'), html.indexOf('ANNO-FRAMEWORK:JS:END'))
  assert.doesNotMatch(js, /screen-notes[^\n]*(return|continue)/, '拾取模式 MUST NOT 排除注解区')
  assert.match(js, /closest\(["']\.device-wrap["']\)/)
})

test('check 对没写注解的屏报 P2 提示且不拦交付', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-anno-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  assert.equal(run('screen', file, '--name', '工单列表').code, 0)
  const r = run('check', file, '--json')
  const out = JSON.parse(r.out)
  const hit = out.problems.filter((p) => /没写注解/.test(p.msg))
  assert.equal(hit.length, 1)
  assert.equal(hit[0].level, 'P2')
  assert.equal(out.ok, true)
  rmSync(dir, { recursive: true, force: true })
})

test('画布右侧不再有常驻列，NOTES 插槽仍在', async () => {
  const html = composedTemplate
  assert.doesNotMatch(html, /class="aside-stack"/)
  assert.doesNotMatch(html, /grid-template-columns:\s*minmax\(0, 1fr\) 340px/)
  assert.match(html, /<!-- NOTES:BEGIN/)
  assert.match(html, /id="proto-notes"/)
})

test('说明入口与展开的面板都不随页面滚动', () => {
  const html = composedTemplate
  const css = html.slice(html.indexOf('ANNO-FRAMEWORK:CSS:BEGIN'), html.indexOf('ANNO-FRAMEWORK:CSS:END'))
  const panel = css.slice(css.indexOf('.anno-notes-panel'))
  assert.match(panel.slice(0, 400), /position:\s*(sticky|fixed)/)
})

test('设计说明面板展开状态不会写进源文件', () => {
  const html = composedTemplate
  const serialize = html.slice(html.indexOf('function serialize()'), html.indexOf('function idb('))
  assert.match(serialize, /querySelector\("#proto-notes-panel"\)/)
  assert.match(serialize, /notesPanel\.setAttribute\("hidden",\s*""\)/)
})

test('设计说明入口在工具栏右段第一枚、写回按钮左侧，文字只有四个字', () => {
  const html = composedTemplate
  const bar = html.slice(html.indexOf('bar.innerHTML'), html.indexOf('document.body.insertBefore'))
  const iNotes = bar.indexOf('data-act="notes"')
  const iSave = bar.indexOf('data-act="save"')
  const iSpacer = bar.indexOf('anno-bar__spacer')
  const iCount = bar.indexOf('anno-count')
  assert.ok(iSpacer < iNotes && iNotes < iSave, '设计说明 MUST 在 spacer 之后、写回按钮之前')
  assert.ok(iCount < iSpacer, '批注计数 MUST 在左段')
  assert.match(bar, /data-act="notes"[^>]*>[^<]*<svg[\s\S]{0,200}?设计说明/)
  assert.doesNotMatch(bar, /设计说明（/)
})

test('slot --set notes 写入路径不变', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-anno-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  assert.equal(run('slot', file, '--set', 'notes', '--text', '<strong>样式依据</strong>沿用中性亮色基线').code, 0)
  const html = readFileSync(file, 'utf8')
  assert.match(html, /样式依据/)
  rmSync(dir, { recursive: true, force: true })
})

test('页面的旧版本写不掉磁盘上的新版本', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ver-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  assert.equal(run('screen', file, '--name', 'S').code, 0)
  const { child, base } = await startServer(file)
  try {
    const got = await fetch(base)
    const ver = got.headers.get('x-proto-version')
    assert.ok(ver, 'GET MUST 下发 X-Proto-Version')
    const stale = await got.text()
    assert.equal(run('slot', file, '--set', 'subtitle', '--text', '改过一轮').code, 0)
    const res = await fetch(base + 'save', {
      method: 'POST',
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'If-Match': ver },
      body: stale,
    })
    assert.equal(res.status, 409)
    const body = await res.json()
    assert.equal(body.error, 'stale')
    assert.match(body.html, /改过一轮/)
    assert.match(readFileSync(file, 'utf8'), /改过一轮/)
  } finally {
    await stopServer(child)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('缺 If-Match 且缺 ?v= 时按冲突处理，不当强制覆盖', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ver-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const before = readFileSync(file, 'utf8')
  const { child, base } = await startServer(file)
  try {
    const res = await fetch(base + 'save', { method: 'POST', headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: before })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).error, 'stale')
    assert.equal(readFileSync(file, 'utf8'), before)
  } finally {
    await stopServer(child)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('sendBeacon 那条路：?v= 与 If-Match 等价', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ver-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const { child, base } = await startServer(file)
  try {
    const got = await fetch(base)
    const ver = got.headers.get('x-proto-version')
    const html = await got.text()
    const changed = html.replace('<p id="proto-subtitle"></p>', '<p id="proto-subtitle">beacon 写回</p>')
    const res = await fetch(base + `save?v=${encodeURIComponent(ver)}`, {
      method: 'POST', headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: changed,
    })
    assert.equal(res.status, 200)
    assert.match(readFileSync(file, 'utf8'), /beacon 写回/)
  } finally {
    await stopServer(child)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('版本串是内容哈希：同毫秒内同大小的两次写入版本仍变', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-hash-'))
  const file = path.join(dir, 'p.html')
  writeFileSync(file, 'A'.repeat(64), 'utf8')
  const { child, base } = await startServer(file)
  try {
    const v1 = (await fetch(base)).headers.get('x-proto-version')
    writeFileSync(file, 'B'.repeat(64), 'utf8')
    const v2 = (await fetch(base)).headers.get('x-proto-version')
    assert.notEqual(v1, v2)
  } finally {
    await stopServer(child)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('并发两个写回时后到的那个基于前一个的结果判定', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-race-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const { child, base } = await startServer(file)
  try {
    const got = await fetch(base)
    const ver = got.headers.get('x-proto-version')
    const html = await got.text()
    const a = html.replace('<p id="proto-subtitle"></p>', '<p id="proto-subtitle">并发 A</p>')
    const b = html.replace('<p id="proto-subtitle"></p>', '<p id="proto-subtitle">并发 B</p>')
    const responses = await Promise.all([a, b].map((body) => fetch(base + 'save', {
      method: 'POST', headers: { 'Content-Type': 'text/html; charset=utf-8', 'If-Match': ver }, body,
    })))
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409])
  } finally {
    await stopServer(child)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('画布上没有第二处能切状态的地方', () => {
  const html = composedTemplate
  assert.doesNotMatch(html, /aria-label="原型状态切换"/)
  assert.doesNotMatch(html, /class="state-buttons"/)
})

test('容器只导出状态表达函数，不导出任何认识按钮的函数', () => {
  const html = composedTemplate
  assert.match(html, /window\.setScreenState\s*=/)
  assert.doesNotMatch(html, /protoSetState/)
  assert.doesNotMatch(html, /window\.\w+\s*=\s*function\s*\([^)]*actName/)
  const seg = html.slice(html.indexOf('data-submit'))
  assert.match(seg.slice(0, 400), /closest\(["']\.screen["']\)/)
})

test('SCREEN-SCRIPT 是固定实现区，CUSTOM-JS 是插槽', () => {
  const html = composedTemplate
  assert.match(html, /<!-- SCREEN-SCRIPT:BEGIN/)
  assert.match(html, /<!-- CUSTOM-JS:BEGIN/)
})

test('slot --set script 写进 CUSTOM-JS 区并转义脚本结束标签', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-anno-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  assert.equal(run('screen', file, '--name', 'S').code, 0)
  const behavior = 'document.querySelector(\'[data-act="s1-empty"]\').addEventListener("click", function (e) {' +
    ' window.setScreenState(e.currentTarget.closest(".device-wrap").querySelector(".screen"), "state-empty"); });\n' +
    '// </script> must remain in the script body'
  assert.equal(run('slot', file, '--set', 'script', '--text', behavior).code, 0)
  const html = readFileSync(file, 'utf8')
  const from = html.indexOf('CUSTOM-JS:BEGIN')
  const to = html.indexOf('CUSTOM-JS:END')
  const region = html.slice(from, to)
  assert.ok(region.includes('s1-empty'))
  assert.ok(region.includes('<\\/script>'))
  rmSync(dir, { recursive: true, force: true })
})

// 2.12.0：状态切换的行为由容器的 [data-state] hook 统一提供，产出方不写绑定，因此这条
// 查的不再是"有没有绑定"，而是**属性值对不对**。旧检查按"按钮名在不在 script 区的字符串
// 里"判定，一个 supportedStates 数组字面量就能骗过它——真跑撞出过：按钮属性名写的是
// data-act、脚本选择器查的是 [data-state]，零个监听器绑上，而 check 全绿。
test('check 抓出 data-state 写错前缀或指向本屏没有的状态层', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-act-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const wrap = (btns) => '<section class="device-wrap"><p class="device-name">S</p><div class="device">' +
    '<div class="screen"><div class="status is-default">内容</div></div></div><div class="screen-notes">' +
    '<p class="screen-notes__title">这一屏的注解 · 不属于用户界面</p><div class="screen-notes__body">x</div>' +
    '<div class="screen-notes__acts">' + btns + '</div></div></section>'

  // ① 漏了 state- 前缀：按钮能点、页面零报错、状态就是不切
  assert.equal(run('slot', file, '--set', 'screens', '--text',
    wrap('<button type="button" data-state="loading">加载</button>')).code, 0)
  let out = JSON.parse(run('check', file, '--json').out)
  assert.equal(out.problems.filter((p) => /data-state="loading"/.test(p.msg) && /不是合法状态/.test(p.msg)).length, 1)

  // ② 前缀对但本屏没有这个状态层：点下去回落默认态，看起来像按钮坏了
  assert.equal(run('slot', file, '--set', 'screens', '--text',
    wrap('<button type="button" data-state="state-empty">空态</button>')).code, 0)
  out = JSON.parse(run('check', file, '--json').out)
  assert.equal(out.problems.filter((p) => /指向本屏没有的状态层/.test(p.msg)).length, 1)

  // ③ 空串回默认态恒合法，MUST NOT 报
  assert.equal(run('slot', file, '--set', 'screens', '--text',
    wrap('<button type="button" data-state="">默认</button>')).code, 0)
  out = JSON.parse(run('check', file, '--json').out)
  assert.equal(out.problems.filter((p) => /data-state/.test(p.msg)).length, 0)
  rmSync(dir, { recursive: true, force: true })
})

test('screen 生成的状态按钮开箱即用：值合法且被 check 认可', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-gen-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  assert.equal(run('screen', file, '--name', 'S', '--states', 'is-default,loading,empty').code, 0)
  const html = readFileSync(file, 'utf8')
  // 生成的值 MUST 带 state- 前缀——漏了它按钮照样能点、状态永远不切，真跑时是 check
  // 当场抓到本命令自己写错的
  assert.match(html, /data-state="state-loading"/)
  assert.match(html, /data-state="state-empty"/)
  assert.match(html, /data-state="" aria-pressed="true"/)
  const out = JSON.parse(run('check', file, '--json').out)
  assert.equal(out.problems.filter((p) => /data-state/.test(p.msg)).length, 0,
    'screen 自己生成的按钮不应被 check 判红')
  rmSync(dir, { recursive: true, force: true })
})

// P1：title 插槽的探针曾是容器出厂字面量 `<title>UI 原型</title>`，而 init 一定会改写它，
// 于是 `slot --set title` 在任何真实原型上都失败——而纪律同时禁止手工编辑原型文件。
test('slot --set title 在 init 之后仍可用，且一次写 <title> 与页头 <h1> 两处', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-title-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', '旧标题').code, 0)
  const r = run('slot', file, '--set', 'title', '--text', '订单批量改期')
  assert.equal(r.code, 0, `slot --set title 失败了：${r.out}`)
  const html = readFileSync(file, 'utf8')
  assert.match(html, /<title>订单批量改期 · 原型<\/title>/, '<title> 没改')
  assert.match(html, /<h1 id="proto-title">订单批量改期<\/h1>/, '页头 <h1> 没改——纪律说这个插槽一次填两处')
  rmSync(dir, { recursive: true, force: true })
})

// P1：check 的"已定义 class"集合曾用 SLOTS.custom.re / SLOTS.theme.re（都没有 re 字段），
// 于是写进 custom / theme 插槽的 class 从不算已定义——提示要求做的正是已经做过的事。
test('写进 custom / theme 插槽的 class 算已定义，不被报成"没有样式定义"', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-defined-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  assert.equal(run('slot', file, '--set', 'custom', '--text', '.my-hero { color: var(--primary); }').code, 0)
  assert.equal(run('slot', file, '--set', 'theme', '--text', '.brand-strip { height: 4px; }').code, 0)
  assert.equal(run('slot', file, '--set', 'screens', '--text',
    '<section class="device-wrap"><p class="device-name">A</p><div class="device"><div class="screen">' +
    '<div class="status is-default"><div class="my-hero">x</div><div class="brand-strip"></div></div>' +
    '</div></div></section>').code, 0)
  const report = JSON.parse(run('check', file, '--json').out)
  const undef = report.problems.filter((p) => /没有样式定义/.test(p.msg)).map((p) => p.msg).join(' ')
  assert.ok(!/my-hero/.test(undef), `custom 插槽里定义过的 class 被报没定义：${undef}`)
  assert.ok(!/brand-strip/.test(undef), `theme 插槽里定义过的 class 被报没定义：${undef}`)
  rmSync(dir, { recursive: true, force: true })
})

// P1：状态层检查曾用 `\b` 匹配，`status-pill` 这类合法业务 class 被报成"状态层放错位置"（P0）；
// 同理 `.empty` 组件契约与状态层 class `status empty` 撞名，每个带空态的屏都会挨一条误报。
test('状态层与组件契约不误伤同前缀 class，也不与状态层 class 撞名', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-collide-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T', '--with-baseline').code, 0)
  assert.equal(run('slot', file, '--set', 'screens', '--text',
    '<section class="device-wrap"><p class="device-name">A</p><div class="device"><div class="screen">' +
    '<div class="status is-default"><div class="row"><span class="status-pill">已完成</span></div></div>' +
    '<div class="status empty"><div class="empty"><div class="empty-title">还没有订单</div></div></div>' +
    '</div></div></section>').code, 0)
  const report = JSON.parse(run('check', file, '--json').out)
  assert.ok(
    !report.problems.some((p) => p.level === 'P0' && /status-pill/.test(p.msg)),
    'status-pill 被误判成放错位置的状态层——提示还会教人去改它的层级'
  )
  assert.ok(
    !report.problems.some((p) => /empty-title/.test(p.msg)),
    '状态层 class `status empty` 被当成空态组件 .empty，报了一条根本不适用的结构错误'
  )
  rmSync(dir, { recursive: true, force: true })
})

// P1：任何失败都 MUST NOT 以 Node 堆栈的形式出现——拿到堆栈的 agent 会把"工具坏了"
// 读成"这条路走不通"，转而手工改原型文件，正是本工具要消灭的行为。
test('失败给中文提示而不是 Node 堆栈，退出码区分用法错误与其它失败', () => {
  const missing = run('slot', path.join(tmpdir(), 'no-such-dir-xyz', 'p.html'), '--set', 'custom', '--text', 'x')
  assert.equal(missing.code, 1, '资源类失败应退 1（2 留给用法错误，与 ctx CLI 一致）')
  assert.doesNotMatch(missing.out, /\n\s+at .*\(node:/, '吐出了 Node 堆栈')
  assert.match(missing.out, /找不到原型文件/, '没给出可读的中文原因')

  const dir = mkdtempSync(path.join(tmpdir(), 'proto-usage-'))
  const file = path.join(dir, 'p.html')
  run('init', file, '--title', 'T')
  const badArg = run('slot', file, '--set', 'nonexistent-slot', '--text', 'x')
  assert.equal(badArg.code, 2, '用法错误应退 2')
  rmSync(dir, { recursive: true, force: true })
})

test('check 只在屏内容、屏注解、元素说明、设计说明中提示稿间对比措辞', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-diff-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  assert.equal(run('screen', file, '--name', 'S').code, 0)
  assert.equal(run('slot', file, '--set', 'notes', '--text', '相比上一轮把筛选挪到了顶部').code, 0)
  const out = JSON.parse(run('check', file, '--json').out)
  const hit = out.problems.filter((p) => /稿间对比/.test(p.msg))
  assert.equal(hit.length, 1)
  assert.equal(hit[0].level, 'P2')
  assert.equal(out.ok, true)
  rmSync(dir, { recursive: true, force: true })
})

test('agreed move 在锚点随新片段带回时成功并保留批注条目', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-move-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const oldFrag = '<section class="device-wrap"><p class="device-name">S</p><div class="device"><div class="screen"><div class="status is-default"><button data-anno-user="u1">旧</button></div></div></div><div class="screen-notes"><p class="screen-notes__title">注解</p><div class="screen-notes__body"></div><div class="screen-notes__acts"></div></div></section>'
  assert.equal(run('slot', file, '--set', 'screens', '--text', oldFrag).code, 0)
  let html = readFileSync(file, 'utf8')
  html = withAnnotations(html, { schema: 'prd-annotations@1', updatedAt: '', global: [], items: [{ id: 'u1', text: '意见', screen: 'S', label: '旧' }], replies: [] })
  writeFileSync(file, html)
  const moved = oldFrag.replace('>旧</button>', ' class="moved">新</button>')
  const r = run('slot', file, '--set', 'screens', '--text', moved, '--agreed', '--agreed-plan=u1=move')
  assert.equal(r.code, 0)
  assert.match(r.out, /放行清单/)
  assert.match(r.out, /u1.*挪到新元素/)
  assert.match(readFileSync(file, 'utf8'), /data-anno-user="u1"/)
  rmSync(dir, { recursive: true, force: true })
})

// 批注块的定位一律限定在 ANNOTATIONS 标记区间内，且片段里不许出现它的开标签。
// 这条闸来自一次实测：放行路径上，插槽片段里混进一个同样带 id="anno-data" 的块，
// 于是 indexOf 认前不认后——放行数据被写进片段里那个假块，真批注块原封不动（要清掉
// 的批注还在），而命令照常打印「放行清单」并退出 0，全程零报错。交付时看不出任何症状。
test('片段里混进批注块开标签时拒绝写入，真批注块不被动到', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-fakeblock-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  assert.equal(run('screen', file, '--name', 'S').code, 0)

  const shell =
    '<div class="screen-notes"><p class="screen-notes__title">这一屏的注解 · 不属于用户界面</p>' +
    '<div class="screen-notes__body">x</div><div class="screen-notes__acts"></div></div>'
  const withAnchor =
    '<section class="device-wrap"><p class="device-name">S</p><div class="device"><div class="screen">' +
    '<div class="status is-default"><button class="btn" data-anno-user="u1">甲</button></div>' +
    '</div></div>' + shell + '</section>'
  assert.equal(run('slot', file, '--set', 'screens', '--text', withAnchor).code, 0)
  writeFileSync(file, withAnnotations(readFileSync(file, 'utf8'), {
    schema: 'prd-annotations@1',
    updatedAt: '2026-08-27T00:00:00.000Z',
    global: [],
    items: [{ id: 'u1', screen: 'S', tag: 'button', label: '甲', text: '甲的意见' }],
    replies: [],
  }), 'utf8')

  const fake =
    '<section class="device-wrap"><p class="device-name">S</p><div class="device"><div class="screen">' +
    '<div class="status is-default">' + SLOT_OPEN + '{"schema":"FAKE"}' + SLOT_CLOSE + '<b>没了</b></div>' +
    '</div></div>' + shell + '</section>'
  const r = run('slot', file, '--set', 'screens', '--text', fake, '--agreed', '--agreed-plan=u1=done')
  assert.notEqual(r.code, 0, '片段里出现批注块开标签时 MUST 拒绝写入')
  assert.match(r.out, /批注块的开标签/)
  const after = readAnnotations(readFileSync(file, 'utf8'))
  assert.deepEqual(after.items.map((x) => x.id), ['u1'], '写入被拒，真批注块 MUST 原封不动')
})

// 与上一条相对：正常放行路径必须真的把已约定的条目从真批注块里清掉。
test('正常放行把已约定的条目从真批注块里清掉', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-release-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  assert.equal(run('screen', file, '--name', 'S').code, 0)
  const shell =
    '<div class="screen-notes"><p class="screen-notes__title">这一屏的注解 · 不属于用户界面</p>' +
    '<div class="screen-notes__body">x</div><div class="screen-notes__acts"></div></div>'
  const withAnchor =
    '<section class="device-wrap"><p class="device-name">S</p><div class="device"><div class="screen">' +
    '<div class="status is-default"><button class="btn" data-anno-user="u1">甲</button></div>' +
    '</div></div>' + shell + '</section>'
  assert.equal(run('slot', file, '--set', 'screens', '--text', withAnchor).code, 0)
  writeFileSync(file, withAnnotations(readFileSync(file, 'utf8'), {
    schema: 'prd-annotations@1',
    updatedAt: '2026-08-27T00:00:00.000Z',
    global: [],
    items: [{ id: 'u1', screen: 'S', tag: 'button', label: '甲', text: '甲的意见' }],
    replies: [],
  }), 'utf8')
  const gone =
    '<section class="device-wrap"><p class="device-name">S</p><div class="device"><div class="screen">' +
    '<div class="status is-default"><b>甲没了</b></div></div></div>' + shell + '</section>'
  const r = run('slot', file, '--set', 'screens', '--text', gone, '--agreed', '--agreed-plan=u1=done')
  assert.equal(r.code, 0)
  assert.match(r.out, /放行清单/)
  assert.deepEqual(readAnnotations(readFileSync(file, 'utf8')).items, [], '放行 MUST 真的清掉那条')
})

test('文档按次产出范式带日期前缀', () => {
  const docs = [
    'dw-system/skills/dw-doc-governance/references/文档治理.md',
    'dw-system/skills/dw-prd/references/00-prd生成流程.md',
  ]
  docs.forEach((rel) => {
    const body = readFileSync(path.join(repoRoot, rel), 'utf8')
    assert.doesNotMatch(body, /docs\/(spec|plan|report)\/(?:<name>|<feature>|<repo>|<change-name>|<project-name>)/)
  })
})

test('extract 只给界面内容，正文真的在里面，且远小于全文', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-extract-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', '取段测试标题ZZQ').code, 0)
  assert.equal(run('screen', file, '--name', '列表页').code, 0)
  // 三个区各塞一段唯一文案，用来验"正文真的被输出了"，而不是只输出了段头。
  assert.equal(run('slot', file, '--set', 'notes', '--text', '<p>说明正文NOTESZZQ</p>').code, 0)
  assert.equal(run('slot', file, '--set', 'screens', '--text',
    '<section class="device-wrap"><p class="device-name">列表页</p><div class="device">' +
    '<div class="screen"><div class="status is-default"><button class="btn">屏内文案SCREENSZZQ</button>' +
    '</div></div></div></section>').code, 0)
  assert.equal(run('slot', file, '--set', 'custom', '--text', '.zzq-only { color: red; }').code, 0)

  const r = run('extract', file)
  assert.equal(r.code, 0, r.out)

  // ① 段头齐全且顺序固定：TITLE → NOTES → SCREENS
  const order = ['TITLE', 'NOTES', 'SCREENS'].map((m) => r.out.indexOf(`===== ${m} `))
  assert.ok(order.every((i) => i >= 0), `段头不全：${JSON.stringify(order)}`)
  assert.deepEqual([...order].sort((a, b) => a - b), order, '段序 MUST 固定为 TITLE → NOTES → SCREENS')
  assert.match(r.out, /===== TITLE （源文件第 \d+ 行起） =====/, 'TITLE 段头格式或行号不正确')
  assert.match(r.out, /===== NOTES （源文件第 \d+ 行起） =====/, 'NOTES 段头格式或行号不正确')
  assert.match(r.out, /===== SCREENS （源文件第 \d+ 行起） =====/, 'SCREENS 段头格式或行号不正确')

  // ② 正文真的被输出了——只验段头的话，一个只打印段头的实现也会全绿
  assert.match(r.out, /取段测试标题ZZQ/, 'TITLE 正文没出现在输出里')
  assert.match(r.out, /说明正文NOTESZZQ/, 'NOTES 正文没出现在输出里')
  assert.match(r.out, /屏内文案SCREENSZZQ/, 'SCREENS 正文没出现在输出里')

  // ③ 默认不带样式区，也不带任何固定实现区
  assert.doesNotMatch(r.out, /zzq-only/, '默认输出 MUST NOT 含 CUSTOM-CSS')
  assert.doesNotMatch(r.out, /ANNO-FRAMEWORK/, 'MUST NOT 输出批注框架区')
  assert.doesNotMatch(r.out, /<symbol id="i-/, 'MUST NOT 输出图标 sprite')
  assert.doesNotMatch(r.out, /--radius-sm/, 'MUST NOT 输出设计系统样式')

  // ④ 末尾指引
  assert.match(r.out, /preview\.mjs annotations/, '末尾必须指引去 annotations 取批注')

  // ⑤ 降载这件事本身
  const full = readFileSync(file, 'utf8')
  assert.ok(
    Buffer.byteLength(r.out, 'utf8') < Buffer.byteLength(full, 'utf8') * 0.2,
    `extract 输出应远小于全文，实测 ${Buffer.byteLength(r.out, 'utf8')} / ${Buffer.byteLength(full, 'utf8')}`,
  )

  // ⑥ --with-css 补两段，且补的是正文不只是段名
  const w = run('extract', file, '--with-css')
  assert.equal(w.code, 0, w.out)
  assert.ok(w.out.indexOf('===== PROJECT-THEME ') >= 0, '--with-css 必须补 PROJECT-THEME 段')
  assert.ok(w.out.indexOf('===== CUSTOM-CSS ') > w.out.indexOf('===== PROJECT-THEME '),
    '--with-css 的两段 MUST 排在末尾且 PROJECT-THEME 在前')
  assert.match(w.out, /zzq-only/, '--with-css 必须输出 CUSTOM-CSS 的正文')

  rmSync(dir, { recursive: true, force: true })
})

test('extract 拒绝非原型文件；--with-css 放在文件名之前也不吞掉文件名', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-extract-bad-'))
  const bad = path.join(dir, 'not-a-prototype.html')
  writeFileSync(bad, '<!doctype html><html><body>hi</body></html>', 'utf8')

  const r = run('extract', bad)
  assert.equal(r.code, 2, '不是原型文件必须以退出码 2 终止')
  assert.match(r.out, /SCREENS/, '错误文案必须指出缺的是 SCREENS 分区标记')
  assert.doesNotMatch(r.out, /=====|=====\s/, '拒绝时不得输出任何区段')

  // parseArgs 对未登记的 --flag 走 `out[key] = argv[++i]`，会吞掉下一个 argv。
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', '顺序测试').code, 0)
  const flagFirst = run('extract', '--with-css', file)
  assert.equal(flagFirst.code, 0, '--with-css 放在文件名之前时不得吞掉文件名：' + flagFirst.out)
  assert.match(flagFirst.out, /===== SCREENS /, '参数顺序颠倒后仍应正常取段')

  rmSync(dir, { recursive: true, force: true })
})

test('import preview.mjs 不产生副作用（不跑 CLI）', () => {
  const r = spawnSync(process.execPath,
    ['--input-type=module', '-e', `import(${JSON.stringify(script)}).then(() => console.log('imported-ok'))`],
    { encoding: 'utf8' })
  assert.equal(r.status, 0, `import 时 CLI 被连带执行了：${(r.stdout || '') + (r.stderr || '')}`)
  assert.match(r.stdout, /imported-ok/)
  assert.doesNotMatch(r.stdout, /原型工具（dw-prd）/, 'import 时 MUST NOT 打印 HELP')
})

// ── 2.12.0：改稿时 data-anno-id 的续接 ──
// `data-anno-id` 不是产出方写的，是用户第一次回复某条 AI 说明时由页面运行时补进 DOM 的。
// AI 手里的片段来源没有它，于是一次正常改稿就让整批 id 消失、挂在上面的用户回复被当成
// "说明已删除"连带丢弃。真跑撞出过，且页面端发号只看 DOM，下次回复会从 a1 重新发，把
// 残留的旧回复挂到毫不相干的新说明上——比丢失更糟，因为它看起来"有数据"。
const withReply = (dir, annoText) => {
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const screens = '<section class="device-wrap"><p class="device-name">S</p><div class="device">' +
    '<div class="screen"><div class="status is-default">' +
    `<button data-anno-id="a1" data-anno="${annoText}">导出</button>` +
    '</div></div></div></section>'
  assert.equal(run('slot', file, '--set', 'screens', '--text', screens).code, 0)
  // 直接构造"用户已回复过"的状态：正常路径下这一步由页面写回完成
  let html = readFileSync(file, 'utf8')
  html = html.replace(/(<script type="application\/json" id="anno-data">)([\s\S]*?)(<\/script>)/,
    (m, a, body, c) => {
      const d = JSON.parse(body)
      d.replies = [{ id: 'r1', noteId: 'a1', noteText: annoText, text: '这里要分两份', at: '2026-08-28T00:00:00Z' }]
      return a + JSON.stringify(d, null, 2) + c
    })
  writeFileSync(file, html)
  return file
}

test('改稿漏抄 data-anno-id 时按说明文本续回去，用户回复不丢', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-reattach-'))
  const anno = '导出是否需要按付款状态分开导两份'
  const file = withReply(dir, anno)
  // 新片段抄了说明文本、改了按钮文案，但漏了 data-anno-id——这是改稿的常态
  const next = '<section class="device-wrap"><p class="device-name">S</p><div class="device">' +
    '<div class="screen"><div class="status is-default">' +
    `<button data-anno="${anno}">导出对账单</button>` +
    '</div></div></div></section>'
  const r = run('slot', file, '--set', 'screens', '--text', next)
  assert.equal(r.code, 0)
  const html = readFileSync(file, 'utf8')
  assert.match(html, /data-anno-id="a1"/, 'id 没被续回，挂在它上面的用户回复会被当成孤儿丢掉')
  assert.match(html, /导出对账单/, '界面改动本身要生效')
  const replies = JSON.parse(html.match(/id="anno-data"[^>]*>([\s\S]*?)<\/script>/)[1]).replies
  assert.equal(replies.length, 1, `用户回复被丢了：${JSON.stringify(replies)}`)
  rmSync(dir, { recursive: true, force: true })
})

test('说明文本在新片段里不唯一时不猜，照走丢弃路径并出声', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ambig-'))
  const anno = '这里待确认'
  const file = withReply(dir, anno)
  // 两个元素带同一段说明文本 → 续到哪个都可能错，MUST NOT 猜
  const next = '<section class="device-wrap"><p class="device-name">S</p><div class="device">' +
    '<div class="screen"><div class="status is-default">' +
    `<button data-anno="${anno}">A</button><button data-anno="${anno}">B</button>` +
    '</div></div></div></section>'
  const r = run('slot', file, '--set', 'screens', '--text', next)
  assert.equal(r.code, 0)
  const html = readFileSync(file, 'utf8')
  assert.ok(!/data-anno-id="a1"/.test(html), '有歧义时 MUST NOT 硬续一个 id')
  assert.match(r.out + r.err, /丢掉了 1 条 AI 说明/, '不续接时 MUST 出声，MUST NOT 静默丢回复')
  rmSync(dir, { recursive: true, force: true })
})

test('并发改同一份原型不再撞 ENOENT：临时文件名唯一', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-race-'))
  const file = path.join(dir, 'p.html')
  assert.equal(run('init', file, '--title', 'T').code, 0)
  const mk = (n) => '<section class="device-wrap"><p class="device-name">S' + n + '</p><div class="device">' +
    '<div class="screen"><div class="status is-default">屏 ' + n + '</div></div></div></section>'
  // 固定临时名时，先完成的那条 rename 走 tmp，后一条撞 ENOENT——报错文案却是"文件找不到"
  const rs = await Promise.all([1, 2, 3, 4].map((n) => new Promise((res) => {
    const c = spawn(process.execPath, [script, 'slot', file, '--set', 'screens', '--text', mk(n)], { encoding: 'utf8' })
    let out = ''
    c.stdout.on('data', (d) => { out += d }); c.stderr.on('data', (d) => { out += d })
    c.on('close', (code) => res({ code, out }))
  })))
  const crashed = rs.filter((r) => /ENOENT/.test(r.out))
  assert.deepEqual(crashed.map((r) => r.out.slice(0, 120)), [], '并发写撞了 ENOENT')
  assert.ok(readFileSync(file, 'utf8').includes('device-wrap'), '文件应仍是完整原型')
  // 半成品 MUST 清干净：check 只看原型文件，攒下的 .tmp 永远不会被提起
  const leftover = (await import('node:fs')).readdirSync(dir).filter((f) => f.endsWith('.tmp'))
  assert.deepEqual(leftover, [], `残留临时文件：${leftover.join(' ')}`)
  rmSync(dir, { recursive: true, force: true })
})
