// codegraph（外部代码知识图谱 CLI）的检测 / 安装 / 升级 / 接线 / 建索引。
// 全部用【假 codegraph + 假 npm 放进 PATH 最前】跑，不联网、不碰真实全局安装：
// 真机上的 codegraph 与 npm 都在 /opt/homebrew 等目录，被下面收窄的 PATH 排除在外。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const installer = path.join(repoRoot, 'install.mjs')
const PKG = '@colbymchenry/codegraph'

// 假 codegraph：行为全部由 state.json 驱动，每次调用追加一行到 calls.log。
// 覆盖真实 CLI 在本安装器里被用到的四个子命令：--version / upgrade --check / upgrade / install / init / index。
// shebang 直接钉在当前 node 绝对路径上：PATH 被收窄到不含 node 的目录，
// `#!/usr/bin/env node` 会找不到解释器。
const FAKE_CODEGRAPH = `#!${process.execPath}
'use strict'
const fs = require('fs')
const path = require('path')
const dir = process.env.CG_FAKE_DIR
const stateFile = path.join(dir, 'state.json')
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
const args = process.argv.slice(2)
fs.appendFileSync(path.join(dir, 'calls.log'), 'codegraph ' + args.join(' ') + '\\n')
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state))
const db = () => {
  fs.mkdirSync(path.join(process.cwd(), '.codegraph'), { recursive: true })
  fs.writeFileSync(path.join(process.cwd(), '.codegraph', 'codegraph.db'), 'fake')
}
if (args[0] === '--version') {
  console.log(state.version)
  process.exit(0)
}
if (args[0] === 'upgrade') {
  if (state.noUpgradeCmd) {
    console.error("error: unknown command 'upgrade'")
    process.exit(1)
  }
  if (args.includes('--check')) {
    console.log('CodeGraph  current v' + state.version + '  latest v' + state.latest)
    process.exit(0)
  }
  if (state.upgradeFails) process.exit(1)
  state.version = state.latest
  save()
  console.log('upgraded to v' + state.version)
  process.exit(0)
}
if (args[0] === 'install') {
  if (state.wireFails) process.exit(1)
  fs.writeFileSync(path.join(process.cwd(), '.mcp.json'), '{}')
  process.exit(0)
}
if (args[0] === 'init') {
  if (state.initFails) process.exit(1)
  // 旧版本的 init 只初始化目录、不建索引；新版本一步到底。
  if (state.initSkipsIndex) fs.mkdirSync(path.join(process.cwd(), '.codegraph'), { recursive: true })
  else db()
  process.exit(0)
}
if (args[0] === 'index') {
  db()
  process.exit(0)
}
process.exit(0)
`

// 假 npm：只认 install -g <spec>。装成功就把假 codegraph 写进 PATH 目录，模拟"装完命令就有了"。
const FAKE_NPM = `#!${process.execPath}
'use strict'
const fs = require('fs')
const path = require('path')
const dir = process.env.CG_FAKE_DIR
const stateFile = path.join(dir, 'state.json')
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
const args = process.argv.slice(2)
fs.appendFileSync(path.join(dir, 'calls.log'), 'npm ' + args.join(' ') + '\\n')
if (state.npmFails) process.exit(1)
fs.writeFileSync(path.join(dir, 'codegraph'), fs.readFileSync(path.join(dir, 'codegraph.template')))
fs.chmodSync(path.join(dir, 'codegraph'), 0o755)
state.version = state.latest
fs.writeFileSync(stateFile, JSON.stringify(state))
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
  const fake = mkdtempSync(path.join(tmpdir(), 'codegraph-bin-'))
  const home = mkdtempSync(path.join(tmpdir(), 'codegraph-home-'))
  const target = mkdtempSync(path.join(tmpdir(), 'codegraph-target-'))
  const full = { version: '1.5.0', latest: '1.5.0', ...state }
  writeFileSync(path.join(fake, 'state.json'), JSON.stringify(full))
  writeFileSync(path.join(fake, 'calls.log'), '')
  // codegraph.template 始终存在，假 npm 装的就是它；absent 场景只是先不放到 PATH 名下。
  writeFileSync(path.join(fake, 'codegraph.template'), FAKE_CODEGRAPH)
  if (!state.absent) writeExecutable(fake, 'codegraph', FAKE_CODEGRAPH)
  writeExecutable(fake, 'npm', FAKE_NPM)
  try {
    fn({
      target,
      run(extraArgs = []) {
        const r = spawnSync(process.execPath, [
          installer, target, `--source-dir=${repoRoot}`, '--yes', '--no-plugins', '--no-agentic', ...extraArgs,
        ], {
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: home,
            USERPROFILE: home,
            CG_FAKE_DIR: fake,
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

const indexDb = target => path.join(target, '.codegraph', 'codegraph.db')

test('未安装 codegraph：用 npm 全局装，然后接线并建索引', () => {
  sandbox({ absent: true, version: '1.5.0', latest: '1.5.0' }, ({ target, run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.calls, new RegExp(`^npm install -g ${PKG.replace('/', '\\/')}$`, 'm'))
    assert.match(r.calls, /^codegraph install --target=auto --location=local --yes$/m)
    assert.match(r.calls, /^codegraph init$/m)
    assert.ok(existsSync(indexDb(target)), '应建立 .codegraph/codegraph.db')
  })
})

test('已安装且有新版本：走 codegraph upgrade，不用 npm 装第二份', () => {
  sandbox({ version: '1.4.0', latest: '1.5.0' }, ({ run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.calls, /^codegraph upgrade --check$/m)
    assert.match(r.calls, /^codegraph upgrade$/m)
    assert.doesNotMatch(r.calls, /^npm /m)
    assert.match(r.stdout, /已升级到 v1\.5\.0/)
  })
})

test('已是最新：跳过升级，仍然接线并建索引', () => {
  sandbox({ version: '1.5.0', latest: '1.5.0' }, ({ target, run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.calls, /^codegraph upgrade --check$/m)
    assert.doesNotMatch(r.calls, /^codegraph upgrade$/m)
    assert.doesNotMatch(r.calls, /^npm /m)
    assert.match(r.stdout, /已是最新，跳过升级/)
    assert.ok(existsSync(indexDb(target)))
  })
})

test('太旧的 codegraph 没有 upgrade 子命令：退回 npm 装最新版', () => {
  sandbox({ version: '0.7.9', latest: '1.5.0', noUpgradeCmd: true }, ({ run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.calls, new RegExp(`^npm install -g ${PKG.replace('/', '\\/')}@latest$`, 'm'))
  })
})

test('目标项目已有索引：不重复建索引', () => {
  sandbox({}, ({ target, run }) => {
    mkdirSync(path.join(target, '.codegraph'), { recursive: true })
    writeFileSync(indexDb(target), 'existing')
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.doesNotMatch(r.calls, /^codegraph init$/m)
    assert.match(r.stdout, /跳过建索引/)
    assert.equal(readFileSync(indexDb(target), 'utf8'), 'existing')
  })
})

test('init 只初始化没建索引时，补跑一次 index', () => {
  sandbox({ initSkipsIndex: true }, ({ target, run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.calls, /^codegraph init$/m)
    assert.match(r.calls, /^codegraph index$/m)
    assert.ok(existsSync(indexDb(target)))
  })
})

test('--codegraph-location=global：接线范围传给 codegraph，且不提示 Codex 项目级缺口', () => {
  sandbox({}, ({ run }) => {
    const r = run(['--codegraph-location=global'])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.calls, /^codegraph install --target=auto --location=global --yes$/m)
    assert.doesNotMatch(r.stdout, /Codex CLI 没有项目级 MCP 配置/)
  })
})

test('项目级接线：明确提示 Claude Code 需重启、Codex 未接线', () => {
  sandbox({}, ({ run }) => {
    const r = run()
    assert.match(r.stdout, /Claude Code：重启后加载 codegraph MCP server/)
    assert.match(r.stdout, /Codex CLI 没有项目级 MCP 配置/)
    assert.match(r.stdout, /codegraph install --target=codex --location=global --yes/)
  })
})

test('--no-codegraph：完全不调用 codegraph 与 npm', () => {
  sandbox({}, ({ target, run }) => {
    const r = run(['--no-codegraph'])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.equal(r.calls.trim(), '')
    assert.match(r.stdout, /跳过 codegraph 检查与建索引/)
    assert.ok(!existsSync(path.join(target, '.codegraph')))
  })
})

test('--dry-run：只做只读检测，不装、不接线、不建索引', () => {
  sandbox({ version: '1.4.0', latest: '1.5.0' }, ({ target, run }) => {
    const r = run(['--dry-run'])
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.calls, /^codegraph --version$/m)
    assert.match(r.calls, /^codegraph upgrade --check$/m)
    assert.doesNotMatch(r.calls, /^codegraph upgrade$/m)
    assert.doesNotMatch(r.calls, /^codegraph (install|init|index)/m)
    assert.doesNotMatch(r.calls, /^npm /m)
    assert.ok(!existsSync(path.join(target, '.codegraph')))
    assert.match(r.stdout, /\[--dry-run\] 将执行 codegraph upgrade/)
  })
})

test('codegraph 装不上：只警告并给手动命令，skill 安装仍然成功', () => {
  sandbox({ absent: true, npmFails: true }, ({ target, run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /⚠ 安装失败，本次跳过接线与建索引/)
    assert.match(r.stdout, new RegExp(`手动安装：npm install -g ${PKG.replace('/', '\\/')}`))
    // 主安装的产物必须完好
    assert.ok(existsSync(path.join(target, '.claude', 'skills', 'ai-dev-workflow', 'SKILL.md')))
    assert.ok(existsSync(path.join(target, '.agents', 'skills', 'ai-prd', 'SKILL.md')))
  })
})

test('接线失败不影响建索引', () => {
  sandbox({ wireFails: true }, ({ target, run }) => {
    const r = run()
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /⚠ agent 接线失败/)
    assert.ok(existsSync(indexDb(target)))
  })
})

test('.gitignore 忽略 codegraph 索引目录；帮助文本说明新选项', () => {
  sandbox({}, ({ target, run }) => {
    run()
    assert.match(readFileSync(path.join(target, '.gitignore'), 'utf8'), /^\/\.codegraph\/$/m)
  })
  const help = spawnSync(process.execPath, [installer, '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0)
  assert.match(help.stdout, /--no-codegraph/)
  assert.match(help.stdout, /--codegraph-location=<local\|global>/)
})
