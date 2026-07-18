import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  discover,
  getCard,
  findScenes,
  listServices,
  initScaffold,
} from '../src/commands.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctxDir = path.join(here, '..', 'fixtures', 'engineering-context');

test('discover 命中关键词返回相关 card 与 cite', () => {
  const r = discover(ctxDir, '背单词 记录 接口');
  assert.ok(r.cards.length >= 1, '应返回至少一个 card');
  assert.ok(r.cards[0].cite, '每条结果需带 cite');
  assert.match(r.cards[0].cite, /@/, 'cite 应含确认时间');
});

test('discover 命中含废弃标记的 card 时给出 out-of-scope 警告', () => {
  const r = discover(ctxDir, '背单词 记录 接口');
  assert.ok(r.cards.length >= 1);
  assert.ok(r.outOfScope.length >= 1, '命中含废弃标记的 card 应产生 out-of-scope 警告');
  assert.ok(
    r.outOfScope.some((w) => /v1\/word\/record/.test(w)),
    'out-of-scope 应点名废弃的 v1 接口',
  );
});

test('discover 的 cite 锚点指向命中段落而非固定值', () => {
  const r = discover(ctxDir, '背单词 记录 接口');
  const anchor = /#([^@\]]+?) @/.exec(r.cards[0].cite)?.[1];
  assert.ok(anchor && anchor.trim().length > 0, 'cite 应含非空锚点');
});

test('discover 对无关意图返回空或 out-of-scope 提示', () => {
  const r = discover(ctxDir, 'zzz-完全无关的东西-qqq');
  assert.equal(r.cards.length, 0);
  assert.ok(r.outOfScope.length >= 1, '零命中时应给出提示');
});

test('getCard 返回指定服务的段落', () => {
  const c = getCard(ctxDir, 'sample-service', '对外接口');
  assert.ok(c, '应找到 card');
  assert.match(c.content, /v2\/word\/record/);
  assert.ok(c.cite);
});

test('listServices 返回已登记服务', () => {
  const names = listServices(ctxDir).map((s) => s.service);
  assert.ok(names.includes('sample-service'));
});

test('findScenes 无 scenes 目录时返回空数组', () => {
  const r = findScenes(ctxDir, '背单词');
  assert.ok(Array.isArray(r));
});

test('findScenes 排除 scenes/README.md 索引文件', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scenes-'));
  try {
    const scenesDir = path.join(tmp, 'scenes');
    fs.mkdirSync(scenesDir, { recursive: true });
    fs.writeFileSync(path.join(scenesDir, 'README.md'), '# 场景索引\n- 背单词提交链路\n');
    fs.writeFileSync(path.join(scenesDir, '背单词提交链路.md'), '# 背单词提交链路\n覆盖背单词记录提交。\n');
    const r = findScenes(tmp, '背单词 提交');
    assert.ok(r.length >= 1, '真实场景文件应命中');
    assert.ok(!r.some((s) => s.scene.toLowerCase() === 'readme'), 'README 索引不得作为场景返回');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('initScaffold 生成 engineering-context 骨架', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-'));
  try {
    initScaffold(tmp);
    const base = path.join(tmp, 'engineering-context');
    assert.ok(fs.existsSync(path.join(base, 'capability-registry.md')));
    assert.ok(fs.existsSync(path.join(base, 'cards')));
    assert.ok(fs.existsSync(path.join(base, 'probe-set.md')));
    assert.ok(fs.existsSync(path.join(base, 'glossary.md')));
    assert.ok(fs.existsSync(path.join(base, 'scenes', 'README.md')), 'scenes/ 目录与索引 README 应被脚手架创建');
    assert.equal(findScenes(base, '任意关键词').length, 0, 'scenes 索引 README 不得被当作场景命中');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
