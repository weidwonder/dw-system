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

test('installer writes the Codex guard and backfills the workflow mode', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-install-'))
  try {
    writeFileSync(
      path.join(target, 'CLAUDE.md'),
      '# Fixture\n\n<!-- ai-dev-workflow:start -->\nmode="personal"\n<!-- ai-dev-workflow:end -->\n',
    )

    const result = spawnSync(process.execPath, [installer, target, '--yes'], {
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

    const rerun = spawnSync(process.execPath, [installer, target, '--yes'], {
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

test('--keep=superpowers removes a guard and Claude disable left by a previous install', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-keep-'))
  try {
    const first = spawnSync(process.execPath, [installer, target, '--yes'], { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(first.status, 0, first.stderr || first.stdout)

    const second = spawnSync(process.execPath, [installer, target, '--yes', '--keep=superpowers'], {
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

    const result = spawnSync(process.execPath, [installer, target, '--yes'], { cwd: repoRoot, encoding: 'utf8' })
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

    const result = spawnSync(process.execPath, [installer, target, '--yes'], { cwd: repoRoot, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(read(target, 'CLAUDE.md'), /mode="personal"/)
    assert.match(read(target, 'AGENTS.md'), /mode="personal"/)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
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
