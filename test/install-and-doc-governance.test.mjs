import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const installer = path.join(repoRoot, 'install.mjs')
const skillsRoot = path.join(repoRoot, 'dw-system', 'skills')
const workflowRoot = path.join(skillsRoot, 'dw-workflow')
const prdRoot = path.join(repoRoot, 'dw-system', 'skills', 'dw-prd')

const read = (...parts) => readFileSync(path.join(...parts), 'utf8')
// --no-agentic：本组测试不涉及伴生 skill，且必须避免安装器联网并写入
// 跑测试这台机器的用户级 skills 目录。伴生 skill 另见 companion-skill.test.mjs。
// --no-codegraph：同理——不许升级这台机器的全局 codegraph，也不许对临时目录建索引。
// --no-ctx-link：同理——不许把测试用的临时目录 npm link 成这台机器的全局 ctx 命令。
// codegraph 那条链另见 codegraph.test.mjs（用假 CLI 跑）。
const localInstallArgs = (target, ...args) =>
  [installer, target, '--source-dir=' + repoRoot, '--no-agentic', '--no-codegraph', '--no-ctx-link', ...args]

function runGit(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

function fakeCodex(binDir, logFile) {
  const script = path.join(binDir, 'codex-fake.js')
  writeFileSync(script, [
    "const fs = require('node:fs')",
    "const args = process.argv.slice(2)",
    "if (args[0] === 'plugin' && args[1] === 'list') { if (process.env.CODEX_FAKE_LIST_MODE === 'invalid') { console.log('not-json'); process.exit(0) } if (process.env.CODEX_FAKE_LIST_MODE === 'schema') { console.log(JSON.stringify({ available: [] })); process.exit(0) } if (process.env.CODEX_FAKE_LIST_STATUS) process.exit(Number(process.env.CODEX_FAKE_LIST_STATUS)); console.log(JSON.stringify({ installed: [{ pluginId: process.env.CODEX_FAKE_PLUGIN_ID || 'superpowers@openai-api-curated' }], available: [] })); process.exit(0) }",
    "if (args[0] === 'plugin' && args[1] === 'remove') { if (process.env.CODEX_FAKE_REMOVE_STATUS) { console.error('fake remove failure'); process.exit(Number(process.env.CODEX_FAKE_REMOVE_STATUS)) } fs.appendFileSync(process.env.CODEX_FAKE_LOG, args[2] + '\\n'); process.exit(0) }",
    'process.exit(2)',
  ].join('\n'))
  if (process.platform === 'win32') {
    writeFileSync(path.join(binDir, 'codex.cmd'), '@echo off\r\nnode "%~dp0codex-fake.js" %*\r\n')
  } else {
    const launcher = path.join(binDir, 'codex')
    writeFileSync(launcher, '#!/bin/sh\nexec node "$(dirname "$0")/codex-fake.js" "$@"\n')
    chmodSync(launcher, 0o755)
  }
  return { ...process.env, PATH: [binDir, process.env.PATH].filter(Boolean).join(path.delimiter), CODEX_FAKE_LOG: logFile }
}

test('installer writes the Codex guard and backfills the workflow mode', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-install-'))
  try {
    writeFileSync(
      path.join(target, 'CLAUDE.md'),
      '# Fixture\n\n<!-- ai-dev-workflow:start -->\nmode="personal"\n<!-- ai-dev-workflow:end -->\n',
    )

    const result = spawnSync(process.execPath, localInstallArgs(target, '--yes'), {
      cwd: repoRoot,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /superpowers@openai-api-curated/)
    const agents = read(target, 'AGENTS.md')
    assert.match(agents, /dw-system:codex-conflicts:start/)
    assert.match(agents, /dw-workflow:start/)
    // 旧 mode="personal" 被迁移改写成协作字段（详见 workflow-block.test.mjs）
    assert.match(agents, /collaboration="solo"/)
    assert.match(agents, /merge-gate="direct"/)
    assert.match(agents, /docs\/spec\//)
    assert.match(agents, /docs\/plan\//)
    assert.match(agents, /docs\/report\//)
    assert.match(agents, /worktree/)

    const rerun = spawnSync(process.execPath, localInstallArgs(target, '--yes'), {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout)
    const rerunAgents = read(target, 'AGENTS.md')
    assert.equal((rerunAgents.match(/dw-system:codex-conflicts:start/g) || []).length, 1)
    assert.equal((rerunAgents.match(/dw-workflow:start/g) || []).length, 1)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('explicit Codex uninstall removes the global plugin and the project guard', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-codex-uninstall-'))
  const binDir = mkdtempSync(path.join(tmpdir(), 'dw-system-fake-codex-'))
  const logFile = path.join(binDir, 'removed.log')
  try {
    const result = spawnSync(process.execPath, localInstallArgs(target, '--yes', '--codex-conflicts=uninstall'), {
      cwd: repoRoot,
      encoding: 'utf8',
      env: fakeCodex(binDir, logFile),
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /全局卸载/)
    assert.equal(readFileSync(logFile, 'utf8').trim(), 'superpowers@openai-api-curated')
    assert.equal(existsSync(path.join(target, 'AGENTS.md')), false)
  } finally {
    rmSync(target, { recursive: true, force: true })
    rmSync(binDir, { recursive: true, force: true })
  }
})

test('Codex uninstall failure leaves the target project untouched', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-codex-remove-failure-'))
  const binDir = mkdtempSync(path.join(tmpdir(), 'dw-system-fake-codex-remove-failure-'))
  const logFile = path.join(binDir, 'removed.log')
  try {
    const env = { ...fakeCodex(binDir, logFile), CODEX_FAKE_REMOVE_STATUS: '7' }
    const result = spawnSync(process.execPath, localInstallArgs(target, '--yes', '--codex-conflicts=uninstall'), {
      cwd: repoRoot,
      encoding: 'utf8',
      env,
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Codex 插件卸载失败/)
    assert.equal(existsSync(path.join(target, '.agents')), false)
    assert.equal(existsSync(path.join(target, '.claude')), false)
    assert.equal(existsSync(path.join(target, 'AGENTS.md')), false)
  } finally {
    rmSync(target, { recursive: true, force: true })
    rmSync(binDir, { recursive: true, force: true })
  }
})

test('invalid Codex plugin output aborts before target changes', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-codex-list-invalid-'))
  const binDir = mkdtempSync(path.join(tmpdir(), 'dw-system-fake-codex-list-invalid-'))
  const logFile = path.join(binDir, 'removed.log')
  try {
    const env = { ...fakeCodex(binDir, logFile), CODEX_FAKE_LIST_MODE: 'schema' }
    const result = spawnSync(process.execPath, localInstallArgs(target, '--yes', '--codex-conflicts=uninstall'), {
      cwd: repoRoot,
      encoding: 'utf8',
      env,
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /缺少有效的 installed 数组/)
    assert.equal(existsSync(path.join(target, '.agents')), false)
    assert.equal(existsSync(path.join(target, '.claude')), false)
  } finally {
    rmSync(target, { recursive: true, force: true })
    rmSync(binDir, { recursive: true, force: true })
  }
})

test('missing Codex CLI aborts global uninstall before target changes', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-codex-cli-missing-'))
  const binDir = mkdtempSync(path.join(tmpdir(), 'dw-system-empty-codex-bin-'))
  try {
    const result = spawnSync(process.execPath, localInstallArgs(target, '--yes', '--codex-conflicts=uninstall'), {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, PATH: binDir },
    })
    assert.notEqual(result.status, 0)
    assert.equal(existsSync(path.join(target, '.agents')), false)
    assert.equal(existsSync(path.join(target, '.claude')), false)
    assert.equal(existsSync(path.join(target, 'AGENTS.md')), false)
  } finally {
    rmSync(target, { recursive: true, force: true })
    rmSync(binDir, { recursive: true, force: true })
  }
})

test('third-party superpowers marketplace entries are not globally removed', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-codex-third-party-'))
  const binDir = mkdtempSync(path.join(tmpdir(), 'dw-system-fake-codex-third-party-'))
  const logFile = path.join(binDir, 'removed.log')
  try {
    const env = { ...fakeCodex(binDir, logFile), CODEX_FAKE_PLUGIN_ID: 'superpowers@third-party' }
    const result = spawnSync(process.execPath, localInstallArgs(target, '--yes', '--codex-conflicts=uninstall'), {
      cwd: repoRoot,
      encoding: 'utf8',
      env,
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.doesNotMatch(result.stdout, /已全局卸载 Codex 冲突插件/)
    assert.equal(existsSync(logFile), false)
    assert.equal(existsSync(path.join(target, 'AGENTS.md')), false)
  } finally {
    rmSync(target, { recursive: true, force: true })
    rmSync(binDir, { recursive: true, force: true })
  }
})

test('installer appends installed skill ignore rules to .gitignore idempotently', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-gitignore-'))
  try {
    writeFileSync(path.join(target, '.gitignore'), 'node_modules/\n')

    const first = spawnSync(process.execPath, localInstallArgs(target, '--yes'), { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(first.status, 0, first.stderr || first.stdout)

    const gitignore = read(target, '.gitignore')
    assert.match(gitignore, /node_modules\//)
    assert.match(gitignore, /# dw-system:gitignore:start/)
    assert.match(gitignore, /\/\.claude\/skills\/dw-workflow\//)
    assert.match(gitignore, /\/\.claude\/skills\/dw-prd\//)
    assert.match(gitignore, /\/\.agents\/skills\/dw-workflow\//)
    assert.match(gitignore, /\/\.agents\/skills\/dw-prd\//)
    assert.match(gitignore, /\/\.claude\/skills\/dw-system\.version/)
    assert.match(gitignore, /\/\.agents\/skills\/dw-system\.version/)

    const rerun = spawnSync(process.execPath, localInstallArgs(target, '--yes'), { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout)
    const rerunGitignore = read(target, '.gitignore')
    assert.equal((rerunGitignore.match(/# dw-system:gitignore:start/g) || []).length, 1)
    assert.match(rerunGitignore, /node_modules\//)

    runGit(target, 'init', '-b', 'main')
    const check = spawnSync('git', ['check-ignore', '.claude/skills/dw-workflow/SKILL.md'], {
      cwd: target,
      encoding: 'utf8',
    })
    assert.equal(check.status, 0, 'installed skill files should be git-ignored')
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('--keep=superpowers removes a guard and Claude disable left by a previous install', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-keep-'))
  try {
    const first = spawnSync(process.execPath, localInstallArgs(target, '--yes'), { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(first.status, 0, first.stderr || first.stdout)

    const second = spawnSync(process.execPath, localInstallArgs(target, '--yes', '--keep=superpowers'), {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    assert.equal(second.status, 0, second.stderr || second.stdout)

    const settings = JSON.parse(read(target, '.claude', 'settings.local.json'))
    assert.equal(settings.enabledPlugins['superpowers@claude-plugins-official'], undefined)
    assert.doesNotMatch(read(target, 'AGENTS.md'), /dw-system:codex-conflicts:start/)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('malformed Claude settings abort before installed skills are replaced', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-invalid-settings-'))
  try {
    const sentinel = path.join(target, '.agents', 'skills', 'dw-workflow', 'sentinel.txt')
    mkdirSync(path.dirname(sentinel), { recursive: true })
    mkdirSync(path.join(target, '.claude'), { recursive: true })
    writeFileSync(sentinel, 'preserve me')
    writeFileSync(path.join(target, '.claude', 'settings.local.json'), '{ invalid json')

    const result = spawnSync(process.execPath, localInstallArgs(target, '--yes'), { cwd: repoRoot, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.equal(readFileSync(sentinel, 'utf8'), 'preserve me')
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('a valid AGENTS block wins when the CLAUDE block is malformed', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-mode-fallback-'))
  try {
    writeFileSync(
      path.join(target, 'CLAUDE.md'),
      '<!-- ai-dev-workflow:start -->\nmode="invalid"\n<!-- ai-dev-workflow:end -->\n',
    )
    writeFileSync(
      path.join(target, 'AGENTS.md'),
      '<!-- ai-dev-workflow:start -->\nmode="personal"\n<!-- ai-dev-workflow:end -->\n',
    )

    const result = spawnSync(process.execPath, localInstallArgs(target, '--yes'), { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    // CLAUDE 块读不出任何已知字段 → 由 AGENTS 的旧块接管，并迁移成协作字段
    assert.match(read(target, 'CLAUDE.md'), /collaboration="solo"/)
    assert.match(read(target, 'AGENTS.md'), /collaboration="solo"/)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

// CLAUDE.md / AGENTS.md 常被软链接到同一份指导文件。Windows 上无权限时创建软链接会失败，
// 这类环境跳过而不是让整组测试红。
function trySymlink(linkTargetPath, linkPath, t) {
  try {
    symlinkSync(linkTargetPath, linkPath)
    return true
  } catch {
    t.skip('this environment cannot create symlinks')
    return false
  }
}

const countMatches = (text, pattern) => (text.match(pattern) || []).length

test('an AGENTS.md symlinked to CLAUDE.md keeps the link and is written only once', (t) => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-symlink-entry-'))
  try {
    writeFileSync(
      path.join(target, 'CLAUDE.md'),
      '# Fixture\n\n<!-- ai-dev-workflow:start -->\nmode="personal"\n<!-- ai-dev-workflow:end -->\n\nkeep me\n',
    )
    if (!trySymlink('CLAUDE.md', path.join(target, 'AGENTS.md'), t)) return

    const result = spawnSync(process.execPath, localInstallArgs(target, '--yes'), { cwd: repoRoot, encoding: 'utf8' })

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.equal(lstatSync(path.join(target, 'AGENTS.md')).isSymbolicLink(), true, 'the symlink must survive the install')
    const shared = read(target, 'CLAUDE.md')
    assert.equal(countMatches(shared, /dw-workflow:start/g), 1)
    assert.equal(countMatches(shared, /dw-system:codex-conflicts:start/g), 1)
    assert.match(shared, /keep me/)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('both entries symlinked to one shared file receive a single set of blocks', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'dw-system-shared-guide-'))
  const target = path.join(root, 'proj')
  try {
    mkdirSync(target)
    const shared = path.join(root, 'shared-guide.md')
    writeFileSync(shared, '# Shared\n\n<!-- ai-dev-workflow:start -->\nmode="team"\n<!-- ai-dev-workflow:end -->\n')
    if (!trySymlink(path.join('..', 'shared-guide.md'), path.join(target, 'CLAUDE.md'), t)) return
    if (!trySymlink(path.join('..', 'shared-guide.md'), path.join(target, 'AGENTS.md'), t)) return

    const result = spawnSync(process.execPath, localInstallArgs(target, '--yes'), { cwd: repoRoot, encoding: 'utf8' })

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.equal(lstatSync(path.join(target, 'CLAUDE.md')).isSymbolicLink(), true)
    assert.equal(lstatSync(path.join(target, 'AGENTS.md')).isSymbolicLink(), true)
    const guide = readFileSync(shared, 'utf8')
    assert.equal(countMatches(guide, /dw-workflow:start/g), 1)
    assert.equal(countMatches(guide, /dw-system:codex-conflicts:start/g), 1)
    assert.match(guide, /collaboration="team"/)
    assert.doesNotMatch(guide, /ai-dev-workflow|mode="/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a broken symlink entry aborts before the target project is touched', (t) => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-broken-link-'))
  try {
    writeFileSync(path.join(target, 'CLAUDE.md'), '# Fixture\n')
    if (!trySymlink(path.join('..', 'nowhere', 'shared.md'), path.join(target, 'AGENTS.md'), t)) return

    const result = spawnSync(process.execPath, localInstallArgs(target, '--yes'), { cwd: repoRoot, encoding: 'utf8' })

    assert.notEqual(result.status, 0)
    assert.match(result.stdout + result.stderr, /软链接/)
    assert.equal(existsSync(path.join(target, '.claude', 'skills')), false, 'no skill may be installed before the abort')
    assert.equal(lstatSync(path.join(target, 'AGENTS.md')).isSymbolicLink(), true)
    assert.equal(read(target, 'CLAUDE.md'), '# Fixture\n')
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('installer obtains skills from the selected Git repository and ref', () => {
  const source = mkdtempSync(path.join(tmpdir(), 'dw-system-source-'))
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-remote-install-'))
  try {
    const fixtureSkill = path.join(source, 'dw-system', 'skills', 'remote-fixture')
    mkdirSync(fixtureSkill, { recursive: true })
    writeFileSync(path.join(fixtureSkill, 'SKILL.md'), '---\nname: remote-fixture\ndescription: Remote fixture.\n---\n')
    runGit(source, 'init', '-b', 'main')
    runGit(source, 'config', 'user.email', 'test@example.com')
    runGit(source, 'config', 'user.name', 'Installer Test')
    runGit(source, 'add', '.')
    runGit(source, 'commit', '-m', 'fixture')

    const result = spawnSync(
      process.execPath,
      [installer, target, '--yes', '--no-plugins', '--no-agentic', '--no-codegraph', '--no-ctx-link', '--repo=' + source, '--ref=main'],
      { cwd: repoRoot, encoding: 'utf8' },
    )

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /安装源：.*main/)
    assert.equal(existsSync(path.join(target, '.agents', 'skills', 'remote-fixture', 'SKILL.md')), true)
    assert.equal(existsSync(path.join(target, '.claude', 'skills', 'remote-fixture', 'SKILL.md')), true)
    assert.equal(existsSync(path.join(target, '.agents', 'skills', 'dw-workflow')), false)
  } finally {
    rmSync(source, { recursive: true, force: true })
    rmSync(target, { recursive: true, force: true })
  }
})

test('source download failure leaves the target project unchanged', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-source-failure-'))
  try {
    const sentinel = path.join(target, '.agents', 'skills', 'existing', 'sentinel.txt')
    mkdirSync(path.dirname(sentinel), { recursive: true })
    writeFileSync(sentinel, 'preserve me')

    const result = spawnSync(
      process.execPath,
      [installer, target, '--yes', '--no-agentic', '--no-codegraph', '--no-ctx-link', '--repo=' + path.join(target, 'missing-repository'), '--ref=main'],
      { cwd: repoRoot, encoding: 'utf8' },
    )

    assert.notEqual(result.status, 0)
    assert.equal(readFileSync(sentinel, 'utf8'), 'preserve me')
    assert.equal(existsSync(path.join(target, '.claude')), false)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('installer help documents the default GitHub source and version controls', () => {
  const result = spawnSync(process.execPath, [installer, '--help'], { cwd: repoRoot, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /https:\/\/github\.com\/weidwonder\/dw-system\.git/)
  assert.match(result.stdout, /--repo=/)
  assert.match(result.stdout, /--ref=/)
  assert.match(result.stdout, /--codex-conflicts=<mode>/)
})

test('skills enforce the shared spec plan and report directories', () => {
  const governance = read(skillsRoot, 'dw-doc-governance', 'references', '文档治理.md')
  assert.match(governance, /docs\/spec\//)
  assert.match(governance, /docs\/plan\//)
  assert.match(governance, /docs\/report\//)
  assert.match(governance, /不得.*docs\/superpowers\//)

  // 旧 company/mode-team.md 的目录约定已随 mode 外壳删除，落点改为常驻内核（T2）。
  const flow = read(workflowRoot, 'references', '00-流程总纲.md')
  // 这里判的是**语义不是子串**：旧约定"把 spec 放项目根"MUST NOT 复活，但总纲把
  // `文档治理.md` 的结论行收进来之后，正当地写着"MUST NOT 把 spec 或 plan 放项目根"
  // ——同一个子串，意思正好相反。子串黑名单会把禁止条款误判成规定条款，所以逐行判：
  // 提到这两个旧落点的行，MUST 同时带着禁止词（MUST NOT / 不得 / 禁止），否则就是复活。
  for (const legacy of ['放项目根', '各自仓库根目录生成']) {
    const prescribing = flow
      .split('\n')
      .filter((line) => line.includes(legacy))
      .filter((line) => !/MUST NOT|不得|禁止/.test(line))
    assert.deepEqual(
      prescribing,
      [],
      `00-流程总纲.md 出现了没有禁止词的「${legacy}」——旧目录约定不得以规定形式复活：\n${prescribing.join('\n')}`,
    )
  }
  assert.match(flow, /docs\/spec\//)
  assert.match(flow, /docs\/plan\//)

  const codingPlan = read(workflowRoot, 'assets', 'templates', 'coding-plan.md')
  assert.doesNotMatch(codingPlan, /superpowers/)

  const prdFlow = read(prdRoot, 'references', '00-prd生成流程.md')
  assert.match(prdFlow, /docs\/spec\//)
  assert.doesNotMatch(prdFlow, /写入 `docs\/`/)
})

test('the distribution repository uses tool-neutral document paths', () => {
  assert.equal(existsSync(path.join(repoRoot, 'docs', 'superpowers')), false)

  const readme = read(repoRoot, 'README.md')
  const claude = read(repoRoot, 'CLAUDE.md')
  assert.doesNotMatch(readme, /docs\/superpowers/)
  assert.doesNotMatch(claude, /docs\/superpowers/)
  assert.match(readme, /superpowers@openai-api-curated/)
  assert.doesNotMatch(readme, /superpowers@openai-curated`/)
})

test('dw-workflow keeps user communication at the business level', () => {
  const communication = read(workflowRoot, 'references', '用户沟通纪律.md')
  assert.match(communication, /所有与用户的沟通.*业务语言/)
  assert.match(communication, /大架构.*必须.*用户确认/)
  assert.match(communication, /模块内.*业务问题/)
  assert.match(communication, /详细程序设计.*无需.*用户确认/)

  const flow = read(workflowRoot, 'references', '00-流程总纲.md')
  assert.match(flow, /大架构确认门/)
  assert.match(flow, /业务语言摘要/)
  assert.match(flow, /内部技术自检/)
  assert.doesNotMatch(flow, /重点确认两类：前后端\*\*数据结构\*\*、具体\*\*落地方向\*\*/)

  const overview = read(workflowRoot, 'assets', 'templates', 'overview.md')
  assert.match(overview, /用户确认摘要（业务语言）/)
})

test('dw-workflow uses worktrees for the whole development lifecycle and merges automatically', () => {
  const discipline = read(skillsRoot, 'dw-worktree', 'references', 'worktree开发纪律.md')
  // 强制性不再挂在 mode 上：无论协作面与项目资产如何，worktree 都不豁免（T3）
  assert.match(discipline, /强制执行/)
  assert.doesNotMatch(discipline, /个人版|团队版/)
  assert.match(discipline, /任何文档或代码.*落盘前.*worktree/)
  assert.match(discipline, /Lean Change Spec.*不得跳过/)
  assert.match(discipline, /每个仓库.*独立.*worktree/)
  assert.match(discipline, /非 Git 仓库.*中止/)
  assert.match(discipline, /不得.*stash|不得.*reset/)
  assert.match(discipline, /无需再次询问用户.*自动合并/)
  assert.match(discipline, /不得绕过.*保护分支|保护分支.*不得绕过/)
  assert.match(discipline, /合并失败.*保留.*worktree/)

  // 两道 worktree 门的入口是 dw-worktree；dw-workflow 入口只把这一步指过去。
  const skill = read(skillsRoot, 'dw-worktree', 'SKILL.md')
  assert.match(skill, /worktree开发纪律\.md/)
  assert.match(skill, /全程使用独立 worktree/)
  assert.match(skill, /完成与自动合并门/)
  assert.match(read(workflowRoot, 'SKILL.md'), /`dw-worktree`/)

  const flow = read(workflowRoot, 'references', '00-流程总纲.md')
  assert.match(flow, /工作区隔离门/)
  assert.match(flow, /完成与自动合并门/)

  // 两个 mode 外壳已删：worktree 属"不裁剪"护栏，落点是常驻内核（T2）；
  // 保护分支 / 平台自动合并落点是 worktree 纪律的 merge-gate="pr" 分支（T3）。
  assert.match(flow, /worktree.*不裁剪|不裁剪.*worktree/)
  assert.match(discipline, /保护分支.*自动合并|自动合并.*保护分支/)

  // config-snippet 拆成公共 base + 协作面两份（T7）；worktree-dir 是 base 的字段。
  const baseSnippet = read(workflowRoot, 'assets', 'config-snippets', 'base.md')
  assert.match(baseSnippet, /worktree/)
  for (const collab of ['solo', 'team']) {
    const snippet = read(workflowRoot, 'assets', 'config-snippets', `collab-${collab}.md`)
    assert.doesNotMatch(snippet, /个人版|团队版/)
  }

  const codingPlan = read(workflowRoot, 'assets', 'templates', 'coding-plan.md')
  assert.match(codingPlan, /Worktree/)
  assert.match(codingPlan, /目标主分支/)
  assert.match(codingPlan, /自动合并/)
})

test('dw-prd questions and deliverables use business language only', () => {
  const discipline = read(prdRoot, 'references', '业务语言纪律.md')
  assert.match(discipline, /对话、问题和 PRD 成稿.*业务语言/)
  assert.match(discipline, /不得要求用户理解.*程序实现/)

  const userFacingFiles = [
    path.join(prdRoot, 'assets', 'question-bank.md'),
    path.join(prdRoot, 'assets', 'templates', 'change-prd.md'),
    path.join(prdRoot, 'assets', 'templates', 'lite-issue-prd.md'),
    path.join(prdRoot, 'assets', 'templates', 'product-prd.md'),
    path.join(prdRoot, 'assets', 'templates', 'requirements-module.md'),
  ]
  const forbidden = /模块\s*\/\s*服务|接口|数据结构|字段|状态机|行为\/调度|字段\/结构|埋点|Technical Success|Non-functional Requirements/
  for (const file of userFacingFiles) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), forbidden, file)
  }
})

// docs/ 与 engineering-context/ 是目标项目自己的产物，入不入库没有唯一答案，
// 所以由安装器问一次并把结果记进标记块。下面这组守的是"只问一次"与"非交互零改动"。
test('installer records the docs/engineering-context in-git decision once', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dw-system-docsgit-'))
  try {
    writeFileSync(path.join(target, '.gitignore'), 'node_modules/\n')

    const first = spawnSync(process.execPath, localInstallArgs(target, '--yes', '--docs-in-git=no'), { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(first.status, 0, first.stderr || first.stdout)
    const gitignore = read(target, '.gitignore')
    assert.match(gitignore, /^# dw-system:project-docs-in-git=no$/m)
    assert.match(gitignore, /^\/docs\/$/m)
    assert.match(gitignore, /^\/engineering-context\/$/m)
    // 两条规则必须落在标记块【内】，否则下次安装的幂等改写会把它们留成孤儿。
    const block = gitignore.slice(gitignore.indexOf('# dw-system:gitignore:start'), gitignore.indexOf('# dw-system:gitignore:end'))
    assert.match(block, /^\/docs\/$/m)
    assert.match(block, /^\/engineering-context\/$/m)

    // 重装不带任何选项：沿用已记的决定，既不重复追加也不回退。
    const rerun = spawnSync(process.execPath, localInstallArgs(target, '--yes'), { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout)
    const rerunGitignore = read(target, '.gitignore')
    assert.equal((rerunGitignore.match(/^\/docs\/$/gm) || []).length, 1)
    assert.equal((rerunGitignore.match(/project-docs-in-git=no/g) || []).length, 1)

    runGit(target, 'init', '-b', 'main')
    for (const p of ['docs/spec/x.md', 'engineering-context/cards/a.md']) {
      const check = spawnSync('git', ['check-ignore', p], { cwd: target, encoding: 'utf8' })
      assert.equal(check.status, 0, `${p} 应被忽略：${check.stderr || check.stdout}`)
    }
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('installer keeps docs/ tracked when the user says yes, and falls back to the default otherwise', () => {
  const yesTarget = mkdtempSync(path.join(tmpdir(), 'dw-system-docsgit-yes-'))
  const quietTarget = mkdtempSync(path.join(tmpdir(), 'dw-system-docsgit-quiet-'))
  const ownTarget = mkdtempSync(path.join(tmpdir(), 'dw-system-docsgit-own-'))
  try {
    // 选"提交"：只留决定记号，不写任何忽略规则——记号是把"选过提交"与"从没问过"分开的唯一依据。
    const yes = spawnSync(process.execPath, localInstallArgs(yesTarget, '--yes', '--docs-in-git=yes'), { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(yes.status, 0, yes.stderr || yes.stdout)
    const yesGitignore = read(yesTarget, '.gitignore')
    assert.match(yesGitignore, /^# dw-system:project-docs-in-git=yes$/m)
    assert.doesNotMatch(yesGitignore, /^\/docs\/$/m)
    assert.doesNotMatch(yesGitignore, /^\/engineering-context\/$/m)

    // 非交互（--yes / CI / npx）取与回车相同的默认值 no，一次落定并记进块内。
    const quiet = spawnSync(process.execPath, localInstallArgs(quietTarget, '--yes'), { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(quiet.status, 0, quiet.stderr || quiet.stdout)
    const quietGitignore = read(quietTarget, '.gitignore')
    assert.match(quietGitignore, /^# dw-system:project-docs-in-git=no$/m)
    assert.match(quietGitignore, /^\/docs\/$/m)
    assert.match(quietGitignore, /^\/engineering-context\/$/m)

    // 使用者自己早就忽略过：不发问，也不把他的规则搬进我们的标记块。
    writeFileSync(path.join(ownTarget, '.gitignore'), 'docs/\nengineering-context/\n')
    const own = spawnSync(process.execPath, localInstallArgs(ownTarget, '--yes'), { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(own.status, 0, own.stderr || own.stdout)
    assert.match(own.stdout, /不发问，也不接管这些规则/)
    const ownGitignore = read(ownTarget, '.gitignore')
    assert.doesNotMatch(ownGitignore, /project-docs-in-git/)
    const ownBlock = ownGitignore.slice(ownGitignore.indexOf('# dw-system:gitignore:start'))
    assert.doesNotMatch(ownBlock, /^docs\/$/m)

    // 非法取值硬失败，不静默按默认走。
    const bogus = spawnSync(process.execPath, localInstallArgs(yesTarget, '--yes', '--docs-in-git=maybe'), { cwd: repoRoot, encoding: 'utf8' })
    assert.notEqual(bogus.status, 0)
    assert.match(bogus.stderr + bogus.stdout, /--docs-in-git 只能是 yes 或 no/)
  } finally {
    for (const t of [yesTarget, quietTarget, ownTarget]) rmSync(t, { recursive: true, force: true })
  }
})
