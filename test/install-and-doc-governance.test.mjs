import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const installer = path.join(repoRoot, 'install.mjs')
const workflowRoot = path.join(repoRoot, 'ai-dev-system', 'skills', 'ai-dev-workflow')
const prdRoot = path.join(repoRoot, 'ai-dev-system', 'skills', 'ai-prd')

const read = (...parts) => readFileSync(path.join(...parts), 'utf8')
const localInstallArgs = (target, ...args) => [installer, target, '--source-dir=' + repoRoot, ...args]

function runGit(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

test('installer writes the Codex guard and backfills the workflow mode', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-install-'))
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
    assert.match(result.stdout, /superpowers@openai-curated/)
    const agents = read(target, 'AGENTS.md')
    assert.match(agents, /ai-dev-system:codex-conflicts:start/)
    assert.match(agents, /ai-dev-workflow:start/)
    assert.match(agents, /mode="personal"/)
    assert.match(agents, /docs\/spec\//)
    assert.match(agents, /docs\/plan\//)
    assert.match(agents, /docs\/report\//)
    assert.match(agents, /worktree/)
    assert.match(agents, /自动合并主分支/)

    const rerun = spawnSync(process.execPath, localInstallArgs(target, '--yes'), {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout)
    const rerunAgents = read(target, 'AGENTS.md')
    assert.equal((rerunAgents.match(/ai-dev-system:codex-conflicts:start/g) || []).length, 1)
    assert.equal((rerunAgents.match(/ai-dev-workflow:start/g) || []).length, 1)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('installer appends installed skill ignore rules to .gitignore idempotently', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-gitignore-'))
  try {
    writeFileSync(path.join(target, '.gitignore'), 'node_modules/\n')

    const first = spawnSync(process.execPath, localInstallArgs(target, '--yes'), { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(first.status, 0, first.stderr || first.stdout)

    const gitignore = read(target, '.gitignore')
    assert.match(gitignore, /node_modules\//)
    assert.match(gitignore, /# ai-dev-system:gitignore:start/)
    assert.match(gitignore, /\/\.claude\/skills\/ai-dev-workflow\//)
    assert.match(gitignore, /\/\.claude\/skills\/ai-prd\//)
    assert.match(gitignore, /\/\.agents\/skills\/ai-dev-workflow\//)
    assert.match(gitignore, /\/\.agents\/skills\/ai-prd\//)
    assert.match(gitignore, /\/\.claude\/skills\/ai-dev-system\.version/)
    assert.match(gitignore, /\/\.agents\/skills\/ai-dev-system\.version/)

    const rerun = spawnSync(process.execPath, localInstallArgs(target, '--yes'), { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout)
    const rerunGitignore = read(target, '.gitignore')
    assert.equal((rerunGitignore.match(/# ai-dev-system:gitignore:start/g) || []).length, 1)
    assert.match(rerunGitignore, /node_modules\//)

    runGit(target, 'init', '-b', 'main')
    const check = spawnSync('git', ['check-ignore', '.claude/skills/ai-dev-workflow/SKILL.md'], {
      cwd: target,
      encoding: 'utf8',
    })
    assert.equal(check.status, 0, 'installed skill files should be git-ignored')
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('--keep=superpowers removes a guard and Claude disable left by a previous install', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-keep-'))
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
    assert.doesNotMatch(read(target, 'AGENTS.md'), /ai-dev-system:codex-conflicts:start/)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('malformed Claude settings abort before installed skills are replaced', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-invalid-settings-'))
  try {
    const sentinel = path.join(target, '.agents', 'skills', 'ai-dev-workflow', 'sentinel.txt')
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

test('a valid AGENTS mode wins when the CLAUDE mode block is malformed', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-mode-fallback-'))
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
    assert.match(read(target, 'CLAUDE.md'), /mode="personal"/)
    assert.match(read(target, 'AGENTS.md'), /mode="personal"/)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('installer obtains skills from the selected Git repository and ref', () => {
  const source = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-source-'))
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-remote-install-'))
  try {
    const fixtureSkill = path.join(source, 'ai-dev-system', 'skills', 'remote-fixture')
    mkdirSync(fixtureSkill, { recursive: true })
    writeFileSync(path.join(fixtureSkill, 'SKILL.md'), '---\nname: remote-fixture\ndescription: Remote fixture.\n---\n')
    runGit(source, 'init', '-b', 'main')
    runGit(source, 'config', 'user.email', 'test@example.com')
    runGit(source, 'config', 'user.name', 'Installer Test')
    runGit(source, 'add', '.')
    runGit(source, 'commit', '-m', 'fixture')

    const result = spawnSync(
      process.execPath,
      [installer, target, '--yes', '--no-plugins', '--repo=' + source, '--ref=main'],
      { cwd: repoRoot, encoding: 'utf8' },
    )

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /安装源：.*main/)
    assert.equal(existsSync(path.join(target, '.agents', 'skills', 'remote-fixture', 'SKILL.md')), true)
    assert.equal(existsSync(path.join(target, '.claude', 'skills', 'remote-fixture', 'SKILL.md')), true)
    assert.equal(existsSync(path.join(target, '.agents', 'skills', 'ai-dev-workflow')), false)
  } finally {
    rmSync(source, { recursive: true, force: true })
    rmSync(target, { recursive: true, force: true })
  }
})

test('source download failure leaves the target project unchanged', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-source-failure-'))
  try {
    const sentinel = path.join(target, '.agents', 'skills', 'existing', 'sentinel.txt')
    mkdirSync(path.dirname(sentinel), { recursive: true })
    writeFileSync(sentinel, 'preserve me')

    const result = spawnSync(
      process.execPath,
      [installer, target, '--yes', '--repo=' + path.join(target, 'missing-repository'), '--ref=main'],
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
  assert.match(result.stdout, /https:\/\/github\.com\/weidwonder\/ai-dev-system\.git/)
  assert.match(result.stdout, /--repo=/)
  assert.match(result.stdout, /--ref=/)
})

test('skills enforce the shared spec plan and report directories', () => {
  const governance = read(workflowRoot, 'references', 'core', '文档治理.md')
  assert.match(governance, /docs\/spec\//)
  assert.match(governance, /docs\/plan\//)
  assert.match(governance, /docs\/report\//)
  assert.match(governance, /不得.*docs\/superpowers\//)

  const flow = read(workflowRoot, 'references', 'core', '00-流程总纲.md')
  assert.doesNotMatch(flow, /放项目根/)
  assert.match(flow, /docs\/plan\//)

  const team = read(workflowRoot, 'references', 'company', 'mode-team.md')
  assert.doesNotMatch(team, /各自仓库根目录生成/)
  assert.match(team, /docs\/spec\//)
  assert.match(team, /docs\/plan\//)

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
  assert.doesNotMatch(readme, /superpowers@openai-api-curated/)
  assert.match(readme, /superpowers@openai-curated/)
})

test('ai-dev-workflow keeps user communication at the business level', () => {
  const communication = read(workflowRoot, 'references', 'core', '用户沟通纪律.md')
  assert.match(communication, /所有与用户的沟通.*业务语言/)
  assert.match(communication, /大架构.*必须.*用户确认/)
  assert.match(communication, /模块内.*业务问题/)
  assert.match(communication, /详细程序设计.*无需.*用户确认/)

  const flow = read(workflowRoot, 'references', 'core', '00-流程总纲.md')
  assert.match(flow, /大架构确认门/)
  assert.match(flow, /业务语言摘要/)
  assert.match(flow, /内部技术自检/)
  assert.doesNotMatch(flow, /重点确认两类：前后端\*\*数据结构\*\*、具体\*\*落地方向\*\*/)

  const overview = read(workflowRoot, 'assets', 'templates', 'overview.md')
  assert.match(overview, /用户确认摘要（业务语言）/)
})

test('ai-dev-workflow uses worktrees for the whole development lifecycle and merges automatically', () => {
  const discipline = read(workflowRoot, 'references', 'core', 'worktree开发纪律.md')
  assert.match(discipline, /个人版和团队版.*强制执行/)
  assert.match(discipline, /任何文档或代码.*落盘前.*worktree/)
  assert.match(discipline, /Lean Change Spec.*不得跳过/)
  assert.match(discipline, /每个仓库.*独立.*worktree/)
  assert.match(discipline, /非 Git 仓库.*中止/)
  assert.match(discipline, /不得.*stash|不得.*reset/)
  assert.match(discipline, /无需再次询问用户.*自动合并/)
  assert.match(discipline, /不得绕过.*保护分支|保护分支.*不得绕过/)
  assert.match(discipline, /合并失败.*保留.*worktree/)

  const skill = read(workflowRoot, 'SKILL.md')
  assert.match(skill, /worktree开发纪律\.md/)
  assert.match(skill, /全程使用独立 worktree/)
  assert.match(skill, /完成后自动合并主分支/)

  const flow = read(workflowRoot, 'references', 'core', '00-流程总纲.md')
  assert.match(flow, /工作区隔离门/)
  assert.match(flow, /完成与自动合并门/)

  const personal = read(workflowRoot, 'references', 'personal', 'mode-personal.md')
  const team = read(workflowRoot, 'references', 'company', 'mode-team.md')
  assert.match(personal, /worktree.*不裁剪/)
  assert.match(team, /保护分支.*自动合并/)

  const personalSnippet = read(workflowRoot, 'assets', 'config-snippets', 'personal.md')
  const teamSnippet = read(workflowRoot, 'assets', 'config-snippets', 'team.md')
  assert.match(personalSnippet, /worktree/)
  assert.match(teamSnippet, /worktree/)

  const codingPlan = read(workflowRoot, 'assets', 'templates', 'coding-plan.md')
  assert.match(codingPlan, /Worktree/)
  assert.match(codingPlan, /目标主分支/)
  assert.match(codingPlan, /自动合并/)
})

test('ai-prd questions and deliverables use business language only', () => {
  const discipline = read(prdRoot, 'references', '业务语言纪律.md')
  assert.match(discipline, /对话、问题和 PRD 成稿.*业务语言/)
  assert.match(discipline, /不得要求用户理解.*程序实现/)

  const userFacingFiles = [
    path.join(prdRoot, 'assets', 'question-bank.md'),
    path.join(prdRoot, 'assets', 'templates', 'change-prd.md'),
    path.join(prdRoot, 'assets', 'templates', 'lite-issue-prd.md'),
    path.join(prdRoot, 'assets', 'templates', 'product-prd.md'),
  ]
  const forbidden = /模块\s*\/\s*服务|接口|数据结构|字段|状态机|行为\/调度|字段\/结构|埋点|Technical Success|Non-functional Requirements/
  for (const file of userFacingFiles) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), forbidden, file)
  }
})
