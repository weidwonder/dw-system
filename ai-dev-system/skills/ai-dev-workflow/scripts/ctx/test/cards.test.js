import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCards, loadRegistry, makeCite } from '../src/cards.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctxDir = path.join(here, '..', 'fixtures', 'engineering-context');

/** 在临时目录里造一份 engineering-context/capability-registry.md，返回 ctx 目录。 */
function withRegistry(content, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-reg-'));
  try {
    const base = path.join(tmp, 'engineering-context');
    fs.mkdirSync(base, { recursive: true });
    fs.writeFileSync(path.join(base, 'capability-registry.md'), content, 'utf8');
    return fn(base);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test('loadCards 读出 sample-service 及其段落', () => {
  const cards = loadCards(ctxDir);
  const c = cards.find((x) => x.service === 'sample-service');
  assert.ok(c, '应找到 sample-service');
  assert.ok(c.sections['对外接口'], '应解析出 对外接口 段落');
});

test('loadRegistry 解析出至少一条能力', () => {
  const rows = loadRegistry(ctxDir);
  assert.ok(rows.length >= 1);
  assert.ok(rows[0].capability);
  assert.ok(rows[0].canonicalRepo);
});

test('loadRegistry 按表头名取列，完整模板的每一列都落到对应字段', () => {
  const rows = loadRegistry(ctxDir);
  const r = rows.find((x) => x.capability === '背单词记录');
  assert.ok(r, '应解析出 背单词记录');
  assert.equal(r.canonicalRepo, 'sample-service');
  assert.equal(r.canonicalApi, 'POST /v2/word/record');
  assert.match(r.deprecated, /V1/);
  assert.equal(r.owner, 'alice');
  assert.match(r.freshness, /2026-07-06/);
});

test('loadRegistry 解析最小三列 registry：缺的列留空而不报错', () => {
  const minimal = `# Capability Registry

| Capability | 权威实现 | 陷阱项（废弃或中间产物） |
|---|---|---|
| 登录 | src/auth/login.ts::login() | src/auth/legacy_login.ts（旧实现，勿改） |
`;
  withRegistry(minimal, (base) => {
    const rows = loadRegistry(base);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].capability, '登录');
    assert.equal(rows[0].canonicalApi, 'src/auth/login.ts::login()', '权威实现 应落到 canonicalApi');
    assert.match(rows[0].deprecated, /legacy_login/, '陷阱项 应落到 deprecated');
    assert.equal(rows[0].canonicalRepo, '', '缺列留空');
    assert.equal(rows[0].freshness, '', '缺列留空');
    assert.equal(rows[0].owner, '');
  });
});

test('loadRegistry 跳过模板占位行（只有模板行 = 未启用权威位）', () => {
  const stub = `# Capability Registry

| Capability | 权威实现 | 陷阱项（废弃或中间产物） |
|---|---|---|
| 【能力，如 背单词记录】 | 【当前该改的那一个】 | 【相似但不该用的】 |
`;
  withRegistry(stub, (base) => {
    assert.deepEqual(loadRegistry(base), [], '模板占位行不得算作已登记能力');
  });
});

test('makeCite 拼出 path + anchor + 时间', () => {
  const cite = makeCite('cards/x.md', '对外接口', '2026-07-06');
  assert.match(cite, /cards\/x\.md/);
  assert.match(cite, /对外接口/);
  assert.match(cite, /2026-07-06/);
});
