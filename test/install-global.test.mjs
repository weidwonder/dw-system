import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const installer = path.join(repoRoot, 'install.mjs')
const sourceVersion = readFileSync(path.join(repoRoot, 'dw-system', 'VERSION'), 'utf8').trim()
const sourceSkills = readdirSync(path.join(repoRoot, 'dw-system', 'skills'), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(path.join(repoRoot, 'dw-system', 'skills', entry.name, 'SKILL.md')))
  .map(entry => entry.name)
  .sort()

function legacyTable() {
  const source = readFileSync(installer, 'utf8')
  const start = source.indexOf('const LEGACY = Object.freeze({')
  const end = source.indexOf('});', start) + 3
  const table = source.slice(start, end)
  const skills = [...table.matchAll(/skills:\s*\[([^\]]+)\]/g)][0][1]
    .match(/'[^']+'/g).map(value => value.slice(1, -1))
  const versionStamp = table.match(/versionStamp:\s*'([^']+)'/)[1]
  return { skills, versionStamp }
}

function snapshot(root) {
  const out = {}
  const walk = (abs, rel) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = path.join(abs, entry.name)
      const key = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(child, key)
      else out[key] = readFileSync(child)
    }
  }
  walk(root, '')
  return out
}

function runGlobalEnv(home, cwd, extraEnv, ...args) {
  return spawnSync(process.execPath, [installer, '--global', `--source-dir=${repoRoot}`, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv, HOME: home, USERPROFILE: home },
  })
}

function runGlobal(home, cwd, ...args) {
  return runGlobalEnv(home, cwd, {}, ...args)
}

function withSandbox(prefix, fn) {
  const root = mkdtempSync(path.join(tmpdir(), `dw-global-${prefix}-`))
  const home = path.join(root, 'home')
  const cwd = path.join(root, 'cwd')
  mkdirSync(home, { recursive: true })
  mkdirSync(cwd, { recursive: true })
  try { return fn({ root, home, cwd }) } finally { rmSync(root, { recursive: true, force: true }) }
}

// 收窄的 PATH：只放假 CLI。Windows 上安装器先用 System32 下的 where.exe 探测
// claude / codex 在不在，缺了它假 CLI 会被当成"没装"，整条卸载路径被悄悄跳过。
function narrowPath(binDir) {
  if (process.platform !== 'win32') return binDir
  return [binDir, path.join(process.env.SystemRoot || 'C:\\Windows', 'System32')].join(path.delimiter)
}

const safeFlags = ['--no-plugins', '--no-companions', '--no-codegraph', '--no-ctx-link']
const externalFlags = ['--no-companions', '--no-codegraph', '--no-ctx-link']

function writeExecutable(dir, name, body) {
  writeFileSync(path.join(dir, name), body)
  chmodSync(path.join(dir, name), 0o755)
  if (process.platform === 'win32') {
    writeFileSync(path.join(dir, `${name}.cmd`), `@"${process.execPath}" "%~dp0${name}" %*\r\n`)
  }
}

function fakePluginCli(binDir, vendor) {
  const script = `#!${process.execPath}
const fs = require('node:fs')
const args = process.argv.slice(2)
const vendor = ${JSON.stringify(vendor)}
const log = process.env.FAKE_PLUGIN_LOG
fs.appendFileSync(log, vendor + ' ' + args.join(' ') + '\\n')
if (args[0] === 'plugin' && args[1] === 'list' && args[2] === '--json') {
  if (process.env.FAKE_${vendor.toUpperCase()}_LIST_MODE === 'fail') { console.error('fake list failure'); process.exit(9) }
  const payload = vendor === 'claude'
    ? [{ id: 'superpowers@claude-plugins-official', scope: 'user' }, { id: 'oh-my-claudecode@omc', scope: 'project' }, { id: 'unrelated@market', scope: 'user' }]
    : { installed: [{ pluginId: 'superpowers@openai-curated' }, { pluginId: 'unrelated@market' }] }
  console.log(JSON.stringify(payload))
  process.exit(0)
}
if (vendor === 'claude' && args[0] === 'plugin' && args[1] === 'uninstall') {
  if (process.env.FAKE_CLAUDE_UNINSTALL_MODE === 'fail') { console.error('fake uninstall failure'); process.exit(7) }
  process.exit(0)
}
if (vendor === 'codex' && args[0] === 'plugin' && args[1] === 'remove') {
  if (process.env.FAKE_CODEX_UNINSTALL_MODE === 'fail') { console.error('fake remove failure'); process.exit(7) }
  process.exit(0)
}
process.exit(2)
`
  writeExecutable(binDir, vendor, script)
}

function pluginEnv(binDir, logFile, options = {}) {
  if (options.claude !== false) fakePluginCli(binDir, 'claude')
  if (options.codex !== false) fakePluginCli(binDir, 'codex')
  return {
    ...process.env,
    PATH: narrowPath(binDir),
    FAKE_PLUGIN_LOG: logFile,
    FAKE_CLAUDE_LIST_MODE: options.claudeListMode || 'ok',
    FAKE_CODEX_LIST_MODE: options.codexListMode || 'ok',
    FAKE_CLAUDE_UNINSTALL_MODE: options.claudeUninstallMode || 'ok',
    FAKE_CODEX_UNINSTALL_MODE: options.codexUninstallMode || 'ok',
  }
}

function withPluginSandbox(prefix, options, fn) {
  return withSandbox(prefix, ({ root, home, cwd }) => {
    const binDir = path.join(root, 'bin')
    const logFile = path.join(root, 'plugins.log')
    mkdirSync(binDir, { recursive: true })
    writeFileSync(logFile, '')
    return fn({ home, cwd, logFile, env: pluginEnv(binDir, logFile, options) })
  })
}

test('全局安装把全部 skill 与版本戳写入两个用户级目录且不碰当前目录', () => {
  withSandbox('fresh', ({ home, cwd }) => {
    writeFileSync(path.join(cwd, 'CLAUDE.md'), 'do not read\n')
    writeFileSync(path.join(cwd, '.gitignore'), 'sentinel\n')
    mkdirSync(path.join(cwd, '.claude'), { recursive: true })
    writeFileSync(path.join(cwd, '.claude', 'settings.local.json'), '{ invalid json')
    const before = snapshot(cwd)

    const result = runGlobal(home, cwd, '--yes', ...safeFlags)

    assert.equal(result.status, 0, result.stderr || result.stdout)
    for (const dir of [path.join(home, '.claude', 'skills'), path.join(home, '.codex', 'skills')]) {
      assert.equal(readFileSync(path.join(dir, 'dw-system.version'), 'utf8').trim(), sourceVersion)
      for (const skill of sourceSkills) assert.ok(existsSync(path.join(dir, skill, 'SKILL.md')), `${dir}/${skill}`)
    }
    assert.deepEqual(snapshot(cwd), before)
  })
})

test('全局安装只清理 LEGACY 登记的旧目录与旧戳并保留他人 skill', () => {
  withSandbox('legacy', ({ home, cwd }) => {
    const legacy = legacyTable()
    for (const root of [path.join(home, '.claude', 'skills'), path.join(home, '.codex', 'skills')]) {
      mkdirSync(root, { recursive: true })
      mkdirSync(path.join(root, legacy.skills[0]), { recursive: true })
      writeFileSync(path.join(root, legacy.skills[0], 'SKILL.md'), 'legacy\n')
      writeFileSync(path.join(root, legacy.versionStamp), '2.0.0\n')
      mkdirSync(path.join(root, 'foo'), { recursive: true })
      writeFileSync(path.join(root, 'foo', 'SKILL.md'), 'keep me\n')
    }

    const result = runGlobal(home, cwd, '--yes', ...safeFlags)

    assert.equal(result.status, 0, result.stderr || result.stdout)
    for (const root of [path.join(home, '.claude', 'skills'), path.join(home, '.codex', 'skills')]) {
      assert.equal(existsSync(path.join(root, legacy.skills[0])), false)
      assert.equal(existsSync(path.join(root, legacy.versionStamp)), false)
      assert.equal(readFileSync(path.join(root, 'foo', 'SKILL.md'), 'utf8'), 'keep me\n')
    }
  })
})

test('全局 dry-run 读取用户级迁移版本但不改 HOME', () => {
  withSandbox('migration', ({ home, cwd }) => {
    for (const root of [path.join(home, '.claude', 'skills'), path.join(home, '.codex', 'skills')]) {
      mkdirSync(root, { recursive: true })
      writeFileSync(path.join(root, 'dw-system.version'), '0.0.1\n')
    }
    const before = snapshot(home)

    const result = runGlobal(home, cwd, '--dry-run', ...safeFlags)

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /迁移指南/)
    assert.match(result.stdout, /\[--dry-run\] 未做任何改动。/)
    assert.deepEqual(snapshot(home), before)
  })
})

test('全局模式拒绝项目级位置参数与五种项目级选项', () => {
  const cases = [
    { args: [path.join('missing-target')], hint: '不接受目标目录' },
    { args: ['--shared'], hint: '只对项目级安装有意义' },
    { args: ['--docs-in-git=yes'], hint: '只对项目级安装有意义' },
    { args: ['--codex-conflicts=guard'], hint: '只对项目级安装有意义' },
    { args: ['--codegraph-location=local'], hint: '只对项目级安装有意义' },
  ]
  for (const [index, item] of cases.entries()) {
    withSandbox(`mutual-${index}`, ({ home, cwd }) => {
      const result = runGlobal(home, cwd, ...item.args)
      assert.notEqual(result.status, 0, JSON.stringify(item))
      assert.match(result.stderr, new RegExp(item.hint))
      assert.equal(existsSync(path.join(home, '.claude', 'skills')), false)
      assert.equal(existsSync(path.join(home, '.codex', 'skills')), false)
    })
  }
})

test('--help 展示 --global', () => {
  const result = spawnSync(process.execPath, [installer, '--help'], { cwd: repoRoot, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /--global/)
})

test('全局安装按完整 ID 与 user scope 卸载 Claude/Codex 冲突插件', () => {
  withPluginSandbox('plugins-happy', {}, ({ home, cwd, logFile, env }) => {
    const result = runGlobalEnv(home, cwd, env, '--yes', ...externalFlags)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    const log = readFileSync(logFile, 'utf8')
    assert.match(log, /claude plugin list --json/)
    assert.match(log, /claude plugin uninstall superpowers@claude-plugins-official --scope user/)
    assert.match(log, /codex plugin list --json/)
    assert.match(log, /codex plugin remove superpowers@openai-curated/)
    assert.doesNotMatch(log, /oh-my-claudecode@omc/)
    assert.ok(existsSync(path.join(home, '.claude', 'skills', 'dw-workflow', 'SKILL.md')))
  })
})

test('全局冲突插件支持 --keep=superpowers', () => {
  withPluginSandbox('plugins-keep', {}, ({ home, cwd, logFile, env }) => {
    const result = runGlobalEnv(home, cwd, env, '--yes', '--keep=superpowers', ...externalFlags)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    const log = readFileSync(logFile, 'utf8')
    assert.match(log, /plugin list --json/)
    assert.doesNotMatch(log, /plugin uninstall/)
    assert.doesNotMatch(log, /plugin remove/)
  })
})

test('全局 --no-plugins 不调用两侧插件 CLI', () => {
  withPluginSandbox('plugins-skip', {}, ({ home, cwd, logFile, env }) => {
    const result = runGlobalEnv(home, cwd, env, '--yes', ...safeFlags)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.equal(readFileSync(logFile, 'utf8'), '')
    // 跳过插件处理时不该再打印任何"卸载 / 未发现插件"的结果行。
    assert.doesNotMatch(result.stdout, /卸载|未发现/)
  })
})

test('全局 dry-run 只列冲突插件不卸载', () => {
  withPluginSandbox('plugins-dry', {}, ({ home, cwd, logFile, env }) => {
    const result = runGlobalEnv(home, cwd, env, '--dry-run', ...externalFlags)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    const log = readFileSync(logFile, 'utf8')
    assert.match(log, /claude plugin list --json/)
    assert.match(log, /codex plugin list --json/)
    assert.doesNotMatch(log, /plugin uninstall/)
    assert.doesNotMatch(log, /plugin remove/)
    assert.equal(existsSync(path.join(home, '.claude', 'skills')), false)
  })
})

test('插件 CLI 缺失时打印手动命令但仍完成全局安装', () => {
  withPluginSandbox('plugins-missing', { claude: false, codex: false }, ({ home, cwd, logFile, env }) => {
    const result = runGlobalEnv(home, cwd, env, '--yes', ...externalFlags)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /claude plugin uninstall .* --scope user/)
    assert.match(result.stdout, /codex plugin remove /)
    assert.ok(existsSync(path.join(home, '.codex', 'skills', 'dw-system.version')))
    assert.equal(readFileSync(logFile, 'utf8'), '')
  })
})

test('列冲突插件清单失败时复制 skill 前中止', () => {
  withPluginSandbox('plugins-list-fail', { claudeListMode: 'fail' }, ({ home, cwd, logFile, env }) => {
    const result = runGlobalEnv(home, cwd, env, '--yes', ...externalFlags)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Claude Code 插件列表读取失败/)
    assert.equal(existsSync(path.join(home, '.claude', 'skills')), false)
    assert.equal(existsSync(path.join(home, '.codex', 'skills')), false)
    assert.doesNotMatch(readFileSync(logFile, 'utf8'), /plugin uninstall|plugin remove/)
  })
})

test('卸载冲突插件失败时复制 skill 前中止', () => {
  withPluginSandbox('plugins-uninstall-fail', { claudeUninstallMode: 'fail' }, ({ home, cwd, logFile, env }) => {
    const result = runGlobalEnv(home, cwd, env, '--yes', ...externalFlags)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Claude Code 插件卸载失败/)
    assert.equal(existsSync(path.join(home, '.claude', 'skills')), false)
    assert.equal(existsSync(path.join(home, '.codex', 'skills')), false)
    assert.match(readFileSync(logFile, 'utf8'), /plugin uninstall superpowers@claude-plugins-official/)
  })
})

function ctxFakeNpm(binDir) {
  const body = `#!${process.execPath}
const fs = require('node:fs')
const path = require('node:path')
const args = process.argv.slice(2)
fs.appendFileSync(process.env.FAKE_EXTERNAL_LOG, 'npm ' + args.join(' ') + ' @ ' + process.cwd() + '\\n')
if (args[0] === 'link') {
  const ctx = '#!' + process.execPath + '\\n' +
    "console.log('ctx — Engineering Context CLI')\\n"
  fs.writeFileSync(path.join(process.env.PATH.split(path.delimiter)[0], 'ctx'), ctx)
  fs.chmodSync(path.join(process.env.PATH.split(path.delimiter)[0], 'ctx'), 0o755)
  if (process.platform === 'win32') fs.writeFileSync(path.join(process.env.PATH.split(path.delimiter)[0], 'ctx.cmd'), '@"' + process.execPath + '" "%~dp0ctx" %*\\r\\n')
}
process.exit(0)
`
  writeExecutable(binDir, 'npm', body)
}

function projectInstall(home, cwd, ...args) {
  return spawnSync(process.execPath, [installer, cwd, `--source-dir=${repoRoot}`, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  })
}

test('全局 ctx link 的 cwd 指向 HOME 下 Claude Code skill 副本', () => {
  withSandbox('ctx-global', ({ root, home, cwd }) => {
    const binDir = path.join(root, 'bin')
    const logFile = path.join(root, 'external.log')
    mkdirSync(binDir, { recursive: true })
    writeFileSync(logFile, '')
    ctxFakeNpm(binDir)
    const env = { ...process.env, HOME: home, USERPROFILE: home, PATH: narrowPath(binDir), FAKE_EXTERNAL_LOG: logFile }
    const result = spawnSync(process.execPath, [installer, '--global', `--source-dir=${repoRoot}`, '--yes', '--no-plugins', '--no-companions', '--no-codegraph'], {
      cwd,
      encoding: 'utf8',
      env,
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    const linked = readFileSync(logFile, 'utf8').split(/\r?\n/)
      .filter(line => line.startsWith('npm link @ '))
      .map(line => line.slice('npm link @ '.length))
    assert.equal(linked.length, 1, `应当恰好 link 一次：${linked.join(' | ')}`)
    // 比真实路径：macOS 的临时目录 /var 是 /private/var 的软链接，进程 cwd 报的是后者。
    const expected = path.join(home, '.claude', 'skills', 'dw-code-facts', 'scripts', 'ctx')
    assert.equal(realpathSync(linked[0]), realpathSync(expected))
  })
})

function codegraphFake(binDir) {
  const body = `#!${process.execPath}
const fs = require('node:fs')
const args = process.argv.slice(2)
fs.appendFileSync(process.env.FAKE_EXTERNAL_LOG, 'codegraph ' + args.join(' ') + '\\n')
if (args[0] === '--version') { console.log('1.5.0'); process.exit(0) }
if (args[0] === 'upgrade' && args[1] === '--check') { console.log('CodeGraph  current v1.5.0  latest v1.5.0'); process.exit(0) }
if (args[0] === 'install') process.exit(0)
if (args[0] === 'init' || args[0] === 'index') process.exit(0)
process.exit(0)
`
  writeExecutable(binDir, 'codegraph', body)
}

test('全局 codegraph 只做 global 接线，不在 HOME 或当前目录 init/index', () => {
  withSandbox('codegraph-global', ({ root, home, cwd }) => {
    const binDir = path.join(root, 'bin')
    const logFile = path.join(root, 'external.log')
    mkdirSync(binDir, { recursive: true })
    writeFileSync(logFile, '')
    codegraphFake(binDir)
    const result = spawnSync(process.execPath, [installer, '--global', `--source-dir=${repoRoot}`, '--yes', '--no-plugins', '--no-companions', '--no-ctx-link'], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home, PATH: narrowPath(binDir), FAKE_EXTERNAL_LOG: logFile },
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    const log = readFileSync(logFile, 'utf8')
    assert.match(log, /^codegraph install --target=auto --location=global --yes$/m)
    assert.doesNotMatch(log, /^codegraph init$/m)
    assert.doesNotMatch(log, /^codegraph index$/m)
    assert.match(result.stdout, /索引按项目建立：在项目根执行 codegraph init/)
    assert.equal(existsSync(path.join(cwd, '.codegraph')), false)
    assert.equal(existsSync(path.join(home, '.codegraph')), false)
  })
})

test('项目级安装检测到用户级版本戳时打印全局并存提示', () => {
  withSandbox('coexist-present', ({ home, cwd }) => {
    mkdirSync(path.join(home, '.claude', 'skills'), { recursive: true })
    writeFileSync(path.join(home, '.claude', 'skills', 'dw-system.version'), sourceVersion + '\n')
    const result = projectInstall(home, cwd, '--yes', ...safeFlags)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.ok(result.stdout.includes(`本机另有全局安装 v${sourceVersion}`), result.stdout)
  })
  withSandbox('coexist-absent', ({ home, cwd }) => {
    const result = projectInstall(home, cwd, '--yes', ...safeFlags)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.doesNotMatch(result.stdout, /本机另有全局安装/)
  })
})
