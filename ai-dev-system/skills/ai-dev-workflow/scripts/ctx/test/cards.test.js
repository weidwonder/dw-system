import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCards, loadRegistry, diagnoseRegistry, makeCite } from '../src/cards.js';

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

// ---- P0 回归：registry 表头首列的中英文别名 ----

test('loadRegistry 认得中文表头「能力」（首列判据 MUST 复用 capability 的模式表）', () => {
  // 三列最小形态的另两列列名本来就是中文，首列写「能力」是最自然的写法。
  // 只认 /capability/i 时整张表被忽略 → 权威位探测为假 → agent 静默退回直读。
  const table = ['| 能力 | 权威实现 | 陷阱项（废弃或中间产物） |', '|---|---|---|', '| 背单词记录 | svc :: POST /v2/word/record | POST /v1/word/record |'];
  withRegistry(`# r\n\n${table.join('\n')}\n`, (base) => {
    const rows = loadRegistry(base);
    assert.equal(rows.length, 1, '中文表头「能力」MUST 被识别为能力列');
    assert.equal(rows[0].capability, '背单词记录');
    assert.equal(rows[0].canonicalApi, 'svc :: POST /v2/word/record');
  });
});

test('diagnoseRegistry 把三种"解析不出数据行"的原因分开报', () => {
  // 三种原因的修复动作完全不同（建文件 / 改表头 / 填内容），报成同一句会把人引向错误方向。
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-diag-'));
  try {
    const base = path.join(tmp, 'engineering-context');
    fs.mkdirSync(base, { recursive: true });
    assert.equal(diagnoseRegistry(base), 'no-file');

    const write = (body) => fs.writeFileSync(path.join(base, 'capability-registry.md'), body, 'utf8');

    write('# r\n\n| 服务 | 说明 |\n|---|---|\n| a | b |\n');
    assert.equal(diagnoseRegistry(base), 'no-header', '有表格但没有能力列表头 → no-header');

    // 占位行首列是 `【能力】`，它同样命中 /能力/——MUST NOT 因此被当成表头排掉，
    // 否则"只有模板行"会被误报成"没有数据行"。
    write('# r\n\n| 能力 | 权威实现 | 陷阱项 |\n|---|---|---|\n| 【能力】 | 【仓】 :: 【接口】 | 【旧】 |\n');
    assert.equal(diagnoseRegistry(base), 'placeholder-only', '只有模板占位行 → placeholder-only');

    write('# r\n\n| 能力 | 权威实现 | 陷阱项 |\n|---|---|---|\n');
    assert.equal(diagnoseRegistry(base), 'no-row', '表头在但一行数据都没有 → no-row');

    write('# r\n\n| 能力 | 权威实现 | 陷阱项 |\n|---|---|---|\n| 背单词 | svc :: POST /v2/x | POST /v1/x |\n');
    assert.equal(diagnoseRegistry(base), 'ok');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
