// ctx CLI 的全局链接（npm link）与可用性验证。
// 全部用【假 npm + 假 ctx 放进 PATH 最前】跑，不碰跑测试这台机器的全局安装：
// 真机的 npm 在 /opt/homebrew 等目录，被下面收窄的 PATH 排除在外。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const installer = path.join(repoRoot, 'install.mjs')
// 安装器据此判定 PATH 上那个 ctx 确实是本体系的；假 ctx 必须复刻这一行。
const SIGNATURE = 'ctx — Engineering Context CLI'

// 假 npm：只认 `link`。link 成功就把假 ctx 写进 PATH 目录，模拟"链接完命令就有了"。
// shebang 钉在当前 node 绝对路径上：PATH 被收窄到不含 node 的目录。
const FAKE_NPM = `#!${process.execPath}
'use strict'
const fs = require('fs')
const path = require('path')
const dir = process.env.CTX_FAKE_DIR
const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'))
const args = process.argv.slice(2)
fs.appendFileSync(path.join(dir, 'calls.log'), 'npm ' + args.join(' ') + ' @ ' + process.cwd() + '\\n')
if (args[0] !== 'link') process.exit(0)
if (state.linkFails) process.exit(1)
// 只有 shim 落在 PATH 上时命令才真的可用；linkedButNotOnPath 模拟 npm 全局 bin 不在 PATH。
if (!state.linkedButNotOnPath) {
  fs.writeFileSync(path.join(dir, 'ctx'), fs.readFileSync(path.join(dir, 'ctx.template')))
  fs.chmodSync(path.join(dir, 'ctx'), 0o755)
}
process.exit(0)
`

// 假 ctx：只需回答 --help。ours=false 时输出别的东西，冒充"用户自己的同名 ctx"。
const fakeCtx = ours => `#!${process.execPath}
'use strict'
const fs = require('fs')
const path = require('path')
fs.appendFileSync(path.join(process.env.CTX_FAKE_DIR, 'calls.log'), 'ctx ' + process.argv.slice(2).join(' ') + '\\n')
console.log(${JSON.stringify(ours ? SIGNATURE : 'ctx - somebody else\'s context switcher')})
process.exit(0)
`

function writeExecutable(dir, name, body) {
  const file = path.join(dir, name)
  writeFileSync(file, body)
  chmodSync(file, 0o755)
  // Windows 的 PATH 查找靠扩展名：安装器在 win32 上经 shell 调用，需要一个 .cmd shim。
  if (process.platform === 'win32') {
    writeFileSync(path.join(dir, `${name}.cmd`), `@"${process.execPath}" "%~dp0${name}" %*\r\n`)
  }
}

function sandbox(state, fn) {
  const fake = mkdtempSync(path.join(tmpdir(), 'ctx-bin-'))
  const home = mkdtempSync(path.join(tmpdir(), 'ctx-home-'))
  const target = mkdtempSync(path.join(tmpdir(), 'ctx-target-'))
  writeFileSync(path.join(fake, 'state.json'), JSON.stringify(state))
  writeFileSync(path.join(fake, 'calls.log'), '')
  // ctx.template 始终存在，假 npm link 装的就是它；默认不放到 PATH 名下（= 本机还没有 ctx）。
  writeFileSync(path.join(fake, 'ctx.template'), fakeCtx(true))
  if (state.foreignCtx) writeExecutable(fake, 'ctx', fakeCtx(false))
  writeExecutable(fake, 'npm', FAKE_NPM)
  try {
    fn({
      target,
      // --no-codegraph：本组只验 ctx 那条链，不让 codegraph 段调到假 npm 污染 calls.log。
      run(extraArgs = []) {
        const r = spawnSync(process.execPath, [
          installer, target, `--source-dir=${repoRoot}`, '--yes', '--no-plugins', '--no-agentic',
          '--no-codegraph', ...extraArgs,
        ], {
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: home,
            USERPROFILE: home,
            CTX_FAKE_DIR: fake,
            PATH: [fake, '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(path.delimiter),
          },
        })
        return { ...r, calls: readFileSync(path.join(fake, 'calls.log'), 'utf8') }
      },
    })
  } finally {
    for (const d of [fake, home, target]) rmSync(d, { recursive: true, force: true })
  }
}

const ctxPkgDir = target => path.join(target, '.claude', 'skills', 'ai-dev-workflow', 'scripts', 'ctx')
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('本机没有 ctx：在安装好的 ctx 目录里 npm link，并实跑 --help 验证', () => {
  sandbox({}, ({ target, run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    // 只断言 cwd 的尾部：macOS 的 tmpdir 是 /var→/private/var 的软链，子进程读到的是解析后的实路径。
    assert.match(r.calls, new RegExp(`^npm link @ .*${esc(path.join('.claude', 'skills', 'ai-dev-workflow', 'scripts', 'ctx'))}$`, 'm'))
    assert.match(r.calls, /^ctx --help$/m)
    assert.match(r.stdout, /✓ ctx 已全局可用（已实跑 ctx --help 验证）/)
  })
})

test('npm link 失败：只警告并给出 node 兜底调用方式，skill 安装仍然成功', () => {
  sandbox({ linkFails: true }, ({ target, run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /⚠ npm link 失败/)
    assert.match(r.stdout, new RegExp(`node .*${esc(path.join('scripts', 'ctx', 'src', 'cli.js'))} <命令>`))
    // 主安装的产物必须完好
    assert.ok(existsSync(path.join(target, '.claude', 'skills', 'ai-dev-workflow', 'SKILL.md')))
    assert.ok(existsSync(path.join(ctxPkgDir(target), 'src', 'cli.js')))
  })
})

test('link 跑通但命令不在 PATH 上：如实报告失败，不谎报成功', () => {
  sandbox({ linkedButNotOnPath: true }, ({ run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.calls, /^npm link @ /m)
    assert.match(r.stdout, /⚠ npm link 跑通了，但 PATH 上仍找不到 ctx/)
    assert.doesNotMatch(r.stdout, /✓ ctx 已全局可用/)
    assert.match(r.stdout, /node .*cli\.js <命令>/)
  })
})

test('PATH 上已有别人的同名 ctx：不 link，不顶掉它，只给兜底调用方式', () => {
  sandbox({ foreignCtx: true }, ({ run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.doesNotMatch(r.calls, /^npm link/m)
    assert.match(r.stdout, /⚠ PATH 上已有另一个同名 ctx 命令/)
    assert.match(r.stdout, /node .*cli\.js <命令>/)
  })
})

test('--no-ctx-link：不调用 npm，但仍打印兜底调用方式', () => {
  sandbox({}, ({ run }) => {
    const r = run(['--no-ctx-link'])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.equal(r.calls.trim(), '')
    assert.match(r.stdout, /跳过 ctx 全局链接（--no-ctx-link）/)
    assert.match(r.stdout, /node .*cli\.js <命令>/)
  })
})

test('--dry-run：只做只读探测，不 link', () => {
  sandbox({}, ({ run }) => {
    const r = run(['--dry-run'])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.doesNotMatch(r.calls, /^npm link/m)
    assert.match(r.stdout, /\[--dry-run\] 将在 .* 执行 npm link，并用 ctx --help 验证/)
  })
})

test('帮助文本说明新选项', () => {
  const help = spawnSync(process.execPath, [installer, '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0)
  assert.match(help.stdout, /--no-ctx-link/)
})
