// 分发面契约：skill 目录里只放使用方需要的东西。
// install.mjs 是整目录复制 skill 的，任何塞进 skill 里的开发期资产都会装进每个目标项目。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctxRoot = path.join(repo, 'dw-system', 'skills', 'dw-code-facts', 'scripts', 'ctx');

test('ctx 的测试与 fixtures MUST NOT 住在 skill 目录里（否则随安装装进每个目标项目）', () => {
  for (const leaked of ['test', 'tests', 'fixtures', '__tests__']) {
    assert.equal(
      fs.existsSync(path.join(ctxRoot, leaked)), false,
      `scripts/ctx/${leaked}/ 又出现了：测试与 fixtures 的位置是仓库根 test/（见 CLAUDE.md §改动时注意）`,
    );
  }
  const stray = fs.readdirSync(ctxRoot, { recursive: true })
    .filter(f => typeof f === 'string' && /\.test\.(js|mjs)$/.test(f));
  assert.deepEqual(stray, [], `skill 目录里混进了测试文件：${stray.join(', ')}`);
});

test('ctx 测试确实在仓库根 test/ 下，且 fixtures 跟着它们', () => {
  const names = fs.readdirSync(path.join(repo, 'test')).filter(f => f.startsWith('ctx-') && f.endsWith('.test.mjs'));
  assert.ok(names.length >= 4, `仓库根 test/ 下应有 ctx-*.test.mjs，实得：${names.join(', ') || '无'}`);
  assert.ok(fs.existsSync(path.join(repo, 'test', 'fixtures', 'ctx-engineering-context', 'capability-registry.md')));
});
