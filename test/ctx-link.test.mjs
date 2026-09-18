// ctx CLI 的全局链接（npm link）与可用性验证。
// 全部用【假 npm + 假 ctx 放进 PATH 最前】跑，不碰跑测试这台机器的全局安装：
// 真机的 npm 在 /opt/homebrew 等目录，被下面收窄的 PATH 排除在外。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync, rmSync } from 'node:fs'
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
if (args[0] === 'root' && args[1] === '-g') {
  console.log(path.join(dir, 'globalroot'))
  process.exit(0)
}
if (args[0] !== 'link') process.exit(0)
if (state.linkFails) {
  console.error('npm error code EACCES')
  console.error('npm error syscall symlink')
  process.exit(1)
}
// Windows 的 npm：全局命令目录里已有同名文件时拒绝覆盖，除非 --force。复刻它的报错原文。
if (state.eexist && !args.includes('--force')) {
  console.error('npm error code EEXIST')
  console.error('npm error path ' + path.join(dir, 'globalroot-bin', 'ctx'))
  console.error('npm error EEXIST: file already exists')
  process.exit(1)
}
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
  if (state.ownCtx) writeExecutable(fake, 'ctx', fakeCtx(true))
  // 全局 node_modules（假 `npm root -g` 的返回值）里那个 ctx 包的三种形态，
  // 决定 EEXIST 之后安装器判不判得出"这是我们上次留下的"。
  if (state.globalCtx) {
    const pkg = path.join(fake, 'globalroot', 'ctx')
    if (state.globalCtx === 'ours-symlink' || state.globalCtx === 'legacy-symlink') {
      // npm link 的产物：指向某个项目里 skill 副本的符号链接，且目标已经不存在
      // （项目被删/改名，正是 Windows 上 EEXIST 的成因之一）。安装器只读链接字符串。
      mkdirSync(path.join(fake, 'globalroot'), { recursive: true })
      // legacy-symlink：3.0 之前的安装把 ctx 放在旧名字的 skill 下，升级后第一次 link 撞上的就是它。
      const owner = state.globalCtx === 'legacy-symlink' ? 'ai-dev-workflow' : 'dw-code-facts'
      symlinkSync(path.join(fake, 'gone', '.claude', 'skills', owner, 'scripts', 'ctx'), pkg)
    } else {
      mkdirSync(path.join(pkg, 'src'), { recursive: true })
      writeFileSync(path.join(pkg, 'src', 'cli.js'),
        state.globalCtx === 'ours-file' ? `const HELP = \`${SIGNATURE}\`` : 'const HELP = `ctx — somebody else`')
    }
  }
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

const ctxPkgDir = target => path.join(target, '.claude', 'skills', 'dw-code-facts', 'scripts', 'ctx')
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('本机没有 ctx：在安装好的 ctx 目录里 npm link，并实跑 --help 验证', () => {
  sandbox({}, ({ target, run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    // 只断言 cwd 的尾部：macOS 的 tmpdir 是 /var→/private/var 的软链，子进程读到的是解析后的实路径。
    assert.match(r.calls, new RegExp(`^npm link @ .*${esc(path.join('.claude', 'skills', 'dw-code-facts', 'scripts', 'ctx'))}$`, 'm'))
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
    assert.ok(existsSync(path.join(target, '.claude', 'skills', 'dw-workflow', 'SKILL.md')))
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

// —— Windows 换项目重装的必现路径：全局命令目录里已有上次留下的 ctx，npm link 报 EEXIST ——
// unix 侧 npm 直接替换自己的符号链接，撞不出这条；下面三例全用假 npm 复刻它的报错原文。

test('EEXIST + PATH 上就是本体系的 ctx：确认归属后 --force 覆盖成本次这份', () => {
  sandbox({ eexist: true, ownCtx: true }, ({ run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.calls, /^npm link @ /m)
    assert.match(r.calls, /^npm link --force @ /m)
    assert.match(r.stdout, /全局命令目录里已有本体系上次留下的 ctx/)
    assert.match(r.stdout, /✓ ctx 已全局可用/)
  })
})

test('EEXIST + 命令不在 PATH 上，但全局包目录里那个 ctx 认得出是本体系的：同样 --force 覆盖', () => {
  const cases = process.platform === 'win32' ? ['ours-file'] : ['ours-file', 'ours-symlink', 'legacy-symlink']
  for (const globalCtx of cases) {
    sandbox({ eexist: true, globalCtx }, ({ run }) => {
      const r = run()
      assert.equal(r.status, 0, r.stderr || r.stdout)
      assert.match(r.calls, /^npm root -g @ /m, globalCtx)
      assert.match(r.calls, /^npm link --force @ /m, globalCtx)
      assert.match(r.stdout, /✓ ctx 已全局可用/, globalCtx)
    })
  }
})

test('EEXIST + 判不出那个文件是谁的：不覆盖，给出处置指引与兜底方式，安装仍然成功', () => {
  for (const state of [{ eexist: true }, { eexist: true, globalCtx: 'foreign' }]) {
    sandbox(state, ({ target, run }) => {
      const r = run()
      assert.equal(r.status, 0, r.stderr || r.stdout)
      assert.doesNotMatch(r.calls, /^npm link --force/m)
      assert.match(r.stdout, /判不出是谁的，不覆盖/)
      assert.match(r.stdout, /npm rm -g ctx/)
      // 这一支同样要回显 npm 原文：只给我们提炼过的一行，等于扣下了 npm 报的错误码。
      assert.match(r.stdout, /^ {5}\| npm error code EEXIST$/m)
      assert.match(r.stdout, /node .*cli\.js <命令>/)
      assert.doesNotMatch(r.stdout, /✓ ctx 已全局可用/)
      assert.ok(existsSync(path.join(ctxPkgDir(target), 'src', 'cli.js')))
    })
  }
})

test('npm link 失败时如实回显 npm 自己的输出，不只给一句概括', () => {
  sandbox({ linkFails: true }, ({ run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /⚠ npm link 失败/)
    // 捕获输出后若不回显，使用者就丢掉了 npm 给的真正原因（这里是 EACCES）。
    assert.match(r.stdout, /^ {5}\| npm error code EACCES$/m)
  })
})
