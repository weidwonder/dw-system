import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function runNpm(args, options) {
  if (process.platform === 'win32') {
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm', ...args], options)
  }
  return spawnSync('npm', args, options)
}

test('root package exposes the GitHub npx installer command', () => {
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8')

  assert.equal(manifest.name, 'ai-dev-system')
  assert.equal(manifest.private, true)
  assert.equal(manifest.bin['ai-dev-system'], './install.mjs')
  // VERSION 必须随包分发：安装器据它推出默认 --ref，让 npx 包版本与技能源版本绑定。
  assert.deepEqual(manifest.files, ['install.mjs', 'ai-dev-system/VERSION'])
  assert.match(manifest.repository.url, /github\.com\/weidwonder\/ai-dev-system/)
  // 推荐命令必须是 git+https:// 形式：github: 简写走 codeload tarball，
  // 部分环境（已知 Windows + npm 12）会 404。
  assert.match(readme, /npx --yes git\+https:\/\/github\.com\/weidwonder\/ai-dev-system\.git \./)
  assert.match(readme, /npx --yes git\+https:\/\/github\.com\/weidwonder\/ai-dev-system\.git --help/)
  assert.match(readme, /npx --yes git\+https:\/\/github\.com\/weidwonder\/ai-dev-system\.git \. --yes/)
  assert.doesNotMatch(readme, /npx --yes github:weidwonder\/ai-dev-system/)
})

test('the default install ref is bound to the installer own VERSION', () => {
  const version = readFileSync(path.join(repoRoot, 'ai-dev-system', 'VERSION'), 'utf8').trim()
  const help = spawnSync(process.execPath, [path.join(repoRoot, 'install.mjs'), '--help'], {
    encoding: 'utf8',
  })

  assert.equal(help.status, 0, help.stderr || help.stdout)
  assert.match(help.stdout, new RegExp(`默认 v${version.replace(/\./g, '\\.')}`))
  assert.doesNotMatch(help.stdout, /安装版本：分支或标签（默认 main）/)
})

test('an explicitly requested ref never falls back to another version', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-ref-'))
  try {
    // 源仓库存在但里面没有这个 ref：显式 --ref 必须硬失败（非零退出码），
    // 绝不能悄悄退回 main 把别的版本装进目标项目。
    const missingRepo = path.join(target, 'no-such-repository')
    const result = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, 'install.mjs'), target, '--yes', '--no-plugins', '--no-agentic',
        '--no-codegraph', '--no-ctx-link', '--repo=' + missingRepo, '--ref=v0.0.0-does-not-exist',
      ],
      { encoding: 'utf8' },
    )

    assert.notEqual(result.status, 0)
    assert.match(result.stderr + result.stdout, /v0\.0\.0-does-not-exist/)
    assert.doesNotMatch(result.stdout, /回退到 main/)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

test('packed npm command launches the installer help', () => {
  const outputDir = mkdtempSync(path.join(tmpdir(), 'ai-dev-system-npm-pack-'))
  try {
    const packed = runNpm(['pack', '--json', '--pack-destination', outputDir], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    assert.equal(packed.status, 0, packed.stderr || packed.stdout)
    const [{ filename }] = JSON.parse(packed.stdout)
    const tarball = path.join(outputDir, filename)

    const executed = runNpm(
      ['exec', '--yes', '--package', tarball, '--', 'ai-dev-system', '--help'],
      { cwd: outputDir, encoding: 'utf8' },
    )

    assert.equal(executed.status, 0, executed.stderr || executed.stdout)
    assert.match(executed.stdout, /ai-dev-workflow 项目安装器/)
    assert.match(executed.stdout, /github\.com\/weidwonder\/ai-dev-system\.git/)

    const dryRun = runNpm(
      [
        'exec', '--yes', '--package', tarball, '--', 'ai-dev-system', '.',
        // --no-codegraph：这里只验证命令入口能跑起来，不该去探测/升级本机全局 codegraph。
        // --no-ctx-link：同理，不该在这里改动本机的全局 ctx 命令。
        '--dry-run', '--no-plugins', '--no-codegraph', '--no-ctx-link', '--source-dir=' + repoRoot,
      ],
      { cwd: outputDir, encoding: 'utf8' },
    )
    assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout)
    assert.match(dryRun.stdout, /目标项目：/)
    assert.match(dryRun.stdout, /本地开发源/)
    assert.match(dryRun.stdout, /\[--dry-run\] 未做任何改动/)
  } finally {
    rmSync(outputDir, { recursive: true, force: true })
  }
})
