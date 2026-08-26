// 2.7.0 原型预览服务（`ai-prd/scripts/preview.mjs`）的契约测试。
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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const script = path.join(repoRoot, 'ai-dev-system', 'skills', 'ai-prd', 'scripts', 'preview.mjs')
const templatePath = path.join(repoRoot, 'ai-dev-system', 'skills', 'ai-prd', 'assets', 'templates', 'ui-prototype.html')

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
  writeFileSync(file, readFileSync(templatePath, 'utf8'), 'utf8')
  const { child, base } = await startServer(file)
  try {
    const health = await fetch(base + 'health')
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { ok: true })

    // GET / 拿到的就是文件当前内容
    const served = await (await fetch(base)).text()
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
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: withAnnotations(served, payload),
    })
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true })

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
  const original = readFileSync(templatePath, 'utf8')
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
  const template = readFileSync(templatePath, 'utf8')
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
