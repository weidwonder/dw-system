import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { searchSemantic, expandQuery } from '../src/semantic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctxDir = path.join(here, '..', 'fixtures', 'engineering-context');

test('searchSemantic 对相关 query 返回排序结果，带 cite/freshness/权威标记', () => {
  const r = searchSemantic(ctxDir, '背单词 记录 接口');
  assert.ok(r.results.length >= 1, '应有命中');
  const top = r.results[0];
  assert.equal(top.service, 'sample-service');
  assert.ok(top.score > 0, 'score 应为正');
  assert.match(top.cite, /@2026-07-06/, 'cite 应含 freshness');
  assert.ok(['canonical', 'deprecated'].includes(top.authority), '应带权威标记');
  assert.ok(r.note.some((n) => n.includes('不是第一入口')), '应输出红线提醒');
});

test('searchSemantic 把废弃/中间产物段落标为 authority=deprecated', () => {
  const r = searchSemantic(ctxDir, '中间产物 v1 废弃 不可用');
  const dep = r.results.find((x) => x.authority === 'deprecated');
  assert.ok(dep, '命中废弃段应标 deprecated');
});

test('searchSemantic 传 --as-of 时对过期块降权并标 stale', () => {
  const fresh = searchSemantic(ctxDir, '背单词 记录', { asOf: '2026-07-10', staleDays: 90 });
  const stale = searchSemantic(ctxDir, '背单词 记录', { asOf: '2027-01-01', staleDays: 90 });
  assert.equal(fresh.results[0].stale, false, '4 天内不算过期');
  assert.equal(stale.results[0].stale, true, '半年后应过期');
  assert.ok(stale.results[0].score < fresh.results[0].score, '过期块 score 应被降权');
});

test('searchSemantic 对未声明 freshness 的 card 不假定新鲜', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sem-'));
  try {
    const cardsDir = path.join(tmp, 'cards');
    fs.mkdirSync(cardsDir, { recursive: true });
    fs.writeFileSync(path.join(cardsDir, 'nodate.md'), '# nodate\n\n## 对外接口\nPOST /v2/word/record 记录背单词进度\n', 'utf8');
    const r = searchSemantic(tmp, '背单词 记录', { asOf: '2026-07-10', staleDays: 90 });
    assert.ok(r.results.length >= 1);
    assert.equal(r.results[0].freshness, '未声明新鲜度');
    assert.equal(r.results[0].stale, true, '未声明新鲜度 MUST NOT 被当作新鲜');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('searchSemantic 无关 query 返回空结果', () => {
  const r = searchSemantic(ctxDir, 'zzz无关qqq');
  assert.equal(r.results.length, 0);
});

test('expandQuery 用 synonyms 扩展命中词', () => {
  const syn = new Map([['背单词', ['记单词', '单词记忆']]]);
  const q = expandQuery('背单词进度', syn);
  assert.match(q, /记单词/);
});
