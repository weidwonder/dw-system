import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCards, loadRegistry } from '../src/cards.js';
import { loadProbes, classifyEntity, answerProbe, selfCheck, evaluateGate } from '../src/probe.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctxDir = path.join(here, '..', 'fixtures', 'engineering-context');
const cards = loadCards(ctxDir);
const registry = loadRegistry(ctxDir);

test('loadProbes 解析探针表与空基线', () => {
  const { probes, baseline } = loadProbes(ctxDir);
  assert.equal(probes.length, 3);
  assert.equal(probes[0].type, 'capability-mapping');
  assert.equal(baseline.size, 0, '（空）应解析为空基线');
});

test('classifyEntity 正确区分 canonical / deprecated / unknown', () => {
  assert.equal(classifyEntity(cards, registry, 'POST /v1/word/record'), 'deprecated');
  assert.equal(classifyEntity(cards, registry, 'POST /v2/word/record'), 'canonical');
  assert.equal(classifyEntity(cards, registry, 'POST /vX/nonexistent'), 'unknown');
});

test('answerProbe：正确 probe 通过，错误期望不通过（证明门禁真在比对）', () => {
  const ok = answerProbe(cards, registry, { type: 'capability-mapping', input: '背单词记录', expected: 'sample-service :: POST /v2/word/record' });
  assert.equal(ok.pass, true);
  const wrong = answerProbe(cards, registry, { type: 'capability-mapping', input: '背单词记录', expected: 'sample-service :: POST /v1/word/record' });
  assert.equal(wrong.pass, false, '把废弃 V1 当权威应判 FAIL');
});

test('selfCheck 在健康 context 上通过（植入的必错样本都被判 FAIL）', () => {
  const sc = selfCheck(cards, registry);
  assert.equal(sc.ok, true);
  assert.ok(sc.planted.every((p) => p.pass === false));
});

test('selfCheck 在空 context 上失败', () => {
  const sc = selfCheck([], []);
  assert.equal(sc.ok, false);
});

test('evaluateGate：健康 fixture → GREEN，passRate=1', () => {
  const { probes, baseline } = loadProbes(ctxDir);
  const ev = evaluateGate(cards, registry, probes, baseline);
  assert.equal(ev.verdict, 'GREEN');
  assert.equal(ev.passRate, 1);
  assert.equal(ev.selfCheck.ok, true);
});

test('evaluateGate 棘轮：新增失败=RED，落在基线内=AMBER', () => {
  const badProbe = { n: '9', type: 'capability-mapping', input: '背单词记录', expected: 'wrong-repo :: POST /vX' };
  const probes = [badProbe];
  const red = evaluateGate(cards, registry, probes, new Set());
  assert.equal(red.verdict, 'RED', '未登记基线的新失败应 RED');
  const amber = evaluateGate(cards, registry, probes, new Set(['9']));
  assert.equal(amber.verdict, 'AMBER', '基线内的失败应 AMBER（容忍债）');
});
