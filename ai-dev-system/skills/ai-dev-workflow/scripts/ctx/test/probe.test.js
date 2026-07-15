import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCards, loadRegistry } from '../src/cards.js';
import { loadProbes, classifyEntity, answerProbe, selfCheck, evaluateGate } from '../src/probe.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctxDir = path.join(here, '..', 'fixtures', 'engineering-context');
const cards = loadCards(ctxDir);
const registry = loadRegistry(ctxDir);

// 构造通过/失败的探针（针对 fixture registry 的 capability-mapping）
const passProbe = (n, extra = {}) => ({ n: String(n), type: 'capability-mapping', input: '背单词记录', expected: 'sample-service :: POST /v2/word/record', severity: 'scored', weight: 1, status: '', ...extra });
const failProbe = (n, extra = {}) => ({ n: String(n), type: 'capability-mapping', input: '背单词记录', expected: 'wrong-repo :: POST /vX', severity: 'scored', weight: 1, status: '', ...extra });

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

test('loadProbes 解析可选的 severity/weight/status 列', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-'));
  try {
    fs.writeFileSync(path.join(tmp, 'probe-set.md'),
      '## 探针\n' +
      '| # | 类型 | 输入 | 期望 | severity | weight | status |\n' +
      '|---|---|---|---|---|---|---|\n' +
      '| 1 | deprecated-trap | POST /v1/x | deprecated | blocking | 1 | |\n' +
      '| 2 | capability-mapping | 背单词记录 | a :: b | scored | 3 | needs-reconfirm |\n' +
      '\n## 基线（棘轮）\n（空）\n');
    const { probes } = loadProbes(tmp);
    assert.equal(probes.length, 2);
    assert.equal(probes[0].severity, 'blocking');
    assert.equal(probes[1].weight, 3);
    assert.equal(probes[1].status, 'needs-reconfirm');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('evaluateGate blocking 探针失败即 RED（基线不可豁免）', () => {
  const p = failProbe(1, { severity: 'blocking' });
  const ev = evaluateGate(cards, registry, [p], new Set(['1'])); // 即便在基线内
  assert.equal(ev.verdict, 'RED');
  assert.equal(ev.blockingFailures.length, 1);
});

test('evaluateGate 加权通过率：weight 影响 passRate', () => {
  const ev = evaluateGate(cards, registry, [passProbe(1, { weight: 3 }), failProbe(2, { weight: 1 })], new Set(['2']));
  assert.equal(ev.passRate, 0.75, '通过权重 3 / 总权重 4 = 0.75');
});

test('evaluateGate floor：加权通过率低于地板即 RED', () => {
  const probes = [passProbe(1, { weight: 3 }), failProbe(2, { weight: 1 })]; // passRate 0.75
  assert.equal(evaluateGate(cards, registry, probes, new Set(['2']), { floor: 0.9 }).verdict, 'RED');
  assert.equal(evaluateGate(cards, registry, probes, new Set(['2']), { floor: 0.5 }).verdict, 'AMBER');
});

test('evaluateGate 双向棘轮：基线内已不再失败 → staleBaseline → RED', () => {
  const ev = evaluateGate(cards, registry, [passProbe(1)], new Set(['1'])); // 探针 1 现在通过，但仍在基线
  assert.deepEqual(ev.staleBaseline, ['1']);
  assert.equal(ev.verdict, 'RED', '基线只许变短：已修复的条目必须删除');
});

test('evaluateGate needs-reconfirm 探针不计入打分', () => {
  const ev = evaluateGate(cards, registry, [passProbe(1), failProbe(2, { status: 'needs-reconfirm' })], new Set());
  assert.equal(ev.needsReconfirm.length, 1);
  assert.equal(ev.verdict, 'GREEN', 'needs-reconfirm 的失败暂不计分，其余全过 → GREEN');
  assert.equal(ev.passRate, 1);
});

test('evaluateGate 基线内探针置 needs-reconfirm 时不算 staleBaseline（暂停≠修复）', () => {
  const ev = evaluateGate(cards, registry, [failProbe(2, { status: 'needs-reconfirm' })], new Set(['2']));
  assert.deepEqual(ev.staleBaseline, [], '待重认的基线条目不得被判为"已修复须删除"');
  assert.equal(ev.verdict, 'GREEN');
  assert.equal(ev.needsReconfirm.length, 1);
});
