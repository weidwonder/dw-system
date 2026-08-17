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
  assert.deepEqual(manifest.files, ['install.mjs'])
  assert.match(manifest.repository.url, /github\.com\/weidwonder\/ai-dev-system/)
  assert.match(readme, /npx --yes github:weidwonder\/ai-dev-system \./)
  assert.match(readme, /npx --yes github:weidwonder\/ai-dev-system --help/)
  assert.match(readme, /npx --yes github:weidwonder\/ai-dev-system \. --yes/)
  assert.doesNotMatch(readme, /github:weidwonder\/ai-dev-system -- --help/)
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
