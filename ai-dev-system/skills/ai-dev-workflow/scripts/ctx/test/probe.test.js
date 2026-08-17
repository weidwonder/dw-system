import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCards, loadRegistry } from '../src/cards.js';
import { loadProbes, classifyEntity, answerProbe, selfCheck, evaluateGate, handoffKind } from '../src/probe.js';
import { initScaffold } from '../src/commands.js';

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

test('loadProbes 跳过模板占位行，避免 ctx init 后的骨架污染棘轮基线', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-placeholder-'));
  try {
    fs.writeFileSync(path.join(tmp, 'probe-set.md'),
      '## 探针\n' +
      '| # | 类型 | 输入 | 期望 |\n' +
      '|---|---|---|---|\n' +
      '| 1 | capability-mapping | 【能力名，如 背单词记录】 | 【repo :: POST /v2/xxx】 |\n' +
      '| 2 | deprecated-trap | 【废弃接口】 | deprecated |\n' +
      '| 3 | requirement-reachable | 【需求真相源】 | ≤2 跳 |\n' +
      '| 4 | deprecated-trap | POST /v1/real | deprecated |\n' +
      '\n## 基线（棘轮）\n（空）\n');
    const { probes, skipped } = loadProbes(tmp);
    // 只有第 4 行是真题；1-3 的输入或期望仍是 `【…】` 占位。
    assert.equal(probes.length, 1);
    assert.equal(probes[0].n, '4');
    assert.deepEqual(skipped, ['1', '2', '3'], '跳过的编号要能报给用户，否则"4 道题只跑 1 道"像解析坏了');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ctx init 的脚手架骨架不产生任何可跑探针（开箱不会有假红可塞进基线）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-probe-fresh-'));
  try {
    initScaffold(tmp);
    const { probes, skipped } = loadProbes(path.join(tmp, 'engineering-context'));
    assert.equal(probes.length, 0, '脚手架里全是占位题，一道都不该被当真题跑');
    assert.ok(skipped.length >= 2, '占位题应被记入 skipped 供 CLI 提示');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
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

// ───────────────────────── 最小 schema 下的 capability-mapping ─────────────────────────
// 最小合法 registry 只有三列（Capability / 权威实现 / 陷阱项），没有"权威仓库"列。
// 期望串若按 `repo :: api` 写，旧实现会恒失败（actual = " :: api"）→ 污染棘轮基线。

const MINIMAL_REGISTRY = '# Capability Registry\n\n' +
  '| Capability | 权威实现 | 陷阱项（废弃或中间产物） |\n' +
  '|---|---|---|\n' +
  '| 背单词记录 | POST /v2/word/record | POST /v1/word/record |\n';

function withCtxDir(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxdir-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, ...rel.split('/'));
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    }
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('capability-mapping：最小 schema（无权威仓库列）下 `repo :: api` 期望不得恒失败', () => {
  withCtxDir({ 'capability-registry.md': MINIMAL_REGISTRY }, (dir) => {
    const reg = loadRegistry(dir);
    assert.equal(reg.length, 1);
    assert.equal(reg[0].canonicalRepo, '', '最小 schema 没有仓库列');
    const withRepo = answerProbe([], reg, { type: 'capability-mapping', input: '背单词记录', expected: 'any-repo :: POST /v2/word/record' });
    assert.equal(withRepo.pass, true, 'registry 未声明仓库维度时，仓库部分无从比对，MUST NOT 判错');
    const apiOnly = answerProbe([], reg, { type: 'capability-mapping', input: '背单词记录', expected: 'POST /v2/word/record' });
    assert.equal(apiOnly.pass, true, '期望串可以只写权威实现');
    const wrong = answerProbe([], reg, { type: 'capability-mapping', input: '背单词记录', expected: 'POST /v1/word/record' });
    assert.equal(wrong.pass, false, '把废弃 V1 当权威仍 MUST 判 FAIL（不得因容忍空 repo 而放水）');
  });
});

test('capability-mapping：完整 schema 下仓库仍参与比对（容忍不得外溢）', () => {
  const wrongRepo = answerProbe(cards, registry, { type: 'capability-mapping', input: '背单词记录', expected: 'wrong-repo :: POST /v2/word/record' });
  assert.equal(wrongRepo.pass, false, 'registry 声明了仓库，写错仓库 MUST 判 FAIL');
});

test('selfCheck：最小 schema registry 上门禁自检仍有效（植入样本被判 FAIL）', () => {
  withCtxDir({ 'capability-registry.md': MINIMAL_REGISTRY }, (dir) => {
    const sc = selfCheck([], loadRegistry(dir));
    assert.equal(sc.ok, true);
    assert.ok(sc.planted.length > 0);
    assert.ok(sc.planted.every((p) => p.pass === false), '植入的必错样本在最小 schema 下也必须全部 FAIL');
  });
});

// ───────────────────── 零上下文交接：四项可达性检查（eng-spec §3.6） ─────────────────────

function withProject(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(root, ...rel.split('/'));
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    }
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const hp = (type, input, expected = 'reachable', extra = {}) =>
  ({ n: 'h1', type, input, expected, severity: 'scored', weight: 1, status: '', ...extra });

test('需求真相源可达：README 一跳到达 → PASS；目标不存在 → FAIL', () => {
  withProject({
    'README.md': '# P\n\n- [需求](./docs/REQUIREMENTS.md)\n',
    'docs/REQUIREMENTS.md': '# 需求\n',
  }, (root) => {
    const ok = answerProbe([], [], hp('requirement-reachable', 'docs/REQUIREMENTS.md'), { root });
    assert.equal(ok.pass, true, '一跳可达应通过');
    assert.match(ok.actual, /hops=1/);
    const bad = answerProbe([], [], hp('requirement-reachable', 'docs/NOPE.md'), { root });
    assert.equal(bad.pass, false, '不存在的真相源必须判 FAIL');
    assert.match(bad.actual, /MISSING/);
  });
});

test('需求真相源可达：2 跳通过、3 跳判 FAIL（≤2 跳标准）', () => {
  withProject({
    'README.md': '# P\n\n- [索引](./docs/index.md)\n',
    'docs/index.md': '# 索引\n\n- [一层](./a.md)\n',
    'docs/a.md': '# A\n\n- [二层](./b.md)\n',
    'docs/b.md': '# B\n\n- [三层](./c.md)\n',
    'docs/c.md': '# C\n',
  }, (root) => {
    assert.equal(answerProbe([], [], hp('requirement-reachable', 'docs/b.md'), { root }).pass, true, 'README→a→b 共 2 跳');
    const far = answerProbe([], [], hp('requirement-reachable', 'docs/c.md'), { root });
    assert.equal(far.pass, false, '3 跳超出 ≤2 跳标准');
    assert.match(far.actual, /UNREACHABLE/);
  });
});

test('架构真相源可达：README 内小节锚点 0 跳通过；锚点不存在判 FAIL', () => {
  withProject({ 'README.md': '# P\n\n## 架构与边界\n\n模块划分见下。\n' }, (root) => {
    const ok = answerProbe([], [], hp('architecture-reachable', 'README.md#架构与边界'), { root });
    assert.equal(ok.pass, true);
    assert.match(ok.actual, /hops=0/);
    const bad = answerProbe([], [], hp('architecture-reachable', 'README.md#不存在的小节'), { root });
    assert.equal(bad.pass, false);
    assert.match(bad.actual, /ANCHOR-MISSING/);
  });
});

test('架构真相源可达：项目没有 README / docs/index.md → FAIL（无入口即无从交接）', () => {
  withProject({ 'docs/ARCHITECTURE.md': '# 架构\n' }, (root) => {
    const r = answerProbe([], [], hp('architecture-reachable', 'docs/ARCHITECTURE.md'), { root });
    assert.equal(r.pass, false);
    assert.match(r.actual, /NO-ENTRY-DOC/);
  });
});

test('evaluateGate 的 ctxDir 与 root 分离：registry 不在 cwd 下时，交接题型仍认得出权威位', () => {
  // 回归测试：cli.js 曾漏传 ctxDir，导致 B 类交接题型退回 <root>/engineering-context 兜底，
  // 而 A 类题型读 --dir 指定的目录——同一次 probe 里两类题看两份不同的 registry，
  // 于是 --dir 下 list-services 认得出权威位、implementation-usable 却判"直读"报 RED。
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-ctxdir-root-'));
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-ctxdir-ctx-'));
  try {
    // 项目根**故意不放** engineering-context/，只有一个架构节（其列出的模块路径不存在）。
    // 若 ctxDir 未生效而退回 root 兜底，会走"直读"分支并因模块缺失判 FAIL。
    fs.writeFileSync(path.join(root, 'README.md'), '# P\n\n## 架构与边界\n\n- `src/nope.js` 不存在\n', 'utf8');
    fs.writeFileSync(path.join(elsewhere, 'capability-registry.md'),
      '| Capability | 权威实现 | 陷阱项（废弃或中间产物） |\n|---|---|---|\n| 下单 | POST /v2/orders | POST /v1/order |\n', 'utf8');

    const probe = hp('implementation-usable', 'README.md#架构与边界', 'usable');
    const ev = evaluateGate([], [], [probe], new Set(), { root, ctxDir: elsewhere });
    const r = ev.results[0];
    assert.equal(r.pass, true, `应走权威位分支而非直读，实得：${r.actual}`);
    assert.match(r.actual, /权威位/, 'actual 须表明命中的是权威位分支');
    assert.doesNotMatch(r.actual, /直读/, 'ctxDir 生效时不应退回直读分支');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
});

test('实现真相源可用（无能力位）：架构节列出的模块路径均存在 → PASS，缺一个 → FAIL', () => {
  const arch = '# P\n\n## 架构与边界\n\n- `src/word/record.js` 负责记录\n- `src/tutor/chat.js` 负责会话\n';
  withProject({ 'README.md': arch, 'src/word/record.js': '', 'src/tutor/chat.js': '' }, (root) => {
    const r = answerProbe([], [], hp('implementation-usable', 'README.md#架构与边界', 'usable'), { root });
    assert.equal(r.pass, true, r.actual);
    assert.match(r.actual, /直读/);
  });
  withProject({ 'README.md': arch, 'src/word/record.js': '' }, (root) => {
    const r = answerProbe([], [], hp('implementation-usable', 'README.md#架构与边界', 'usable'), { root });
    assert.equal(r.pass, false, '架构节列出的模块路径缺失 → 实现真相源不可用');
    assert.match(r.actual, /src\/tutor\/chat\.js/);
  });
});

test('实现真相源可用（无能力位）：架构节没列任何模块路径 → FAIL（不得静默全绿）', () => {
  withProject({ 'README.md': '# P\n\n## 架构与边界\n\n这个项目分成几块，各司其职。\n' }, (root) => {
    const r = answerProbe([], [], hp('implementation-usable', 'README.md#架构与边界', 'usable'), { root });
    assert.equal(r.pass, false);
  });
});

test('实现真相源可用（图谱位）：codegraph.db 非空 → PASS；0 字节 → FAIL', () => {
  withProject({
    'README.md': '# P\n\n## 架构与边界\n\n- `src/missing.js`\n',
    '.codegraph/codegraph.db': 'SQLite format 3\u0000binary',
  }, (root) => {
    const r = answerProbe([], [], hp('implementation-usable', 'README.md#架构与边界', 'usable'), { root });
    assert.equal(r.pass, true, '探测到图谱位就走索引分支，不再要求架构节列路径');
    assert.match(r.actual, /图谱位/);
  });
  withProject({ 'README.md': '# P\n', '.codegraph/codegraph.db': '' }, (root) => {
    const r = answerProbe([], [], hp('implementation-usable', 'README.md', 'usable'), { root });
    assert.equal(r.pass, false, '空索引不可查询');
  });
});

test('实现真相源可用（权威位）：list-services 非空 → PASS；只剩模板行 → 退回直读分支', () => {
  withProject({
    'README.md': '# P\n',
    'engineering-context/capability-registry.md': MINIMAL_REGISTRY,
  }, (root) => {
    const r = answerProbe([], [], hp('implementation-usable', 'README.md', 'usable'), { root });
    assert.equal(r.pass, true, r.actual);
    assert.match(r.actual, /权威位/);
  });
  withProject({
    'README.md': '# P\n\n## 架构与边界\n\n- `src/missing.js`\n',
    'engineering-context/capability-registry.md':
      '# Capability Registry\n\n| Capability | 权威实现 | 陷阱项 |\n|---|---|---|\n| 【能力】 | 【权威实现】 | 【陷阱项】 |\n',
  }, (root) => {
    const r = answerProbe([], [], hp('implementation-usable', 'README.md#架构与边界', 'usable'), { root });
    assert.equal(r.pass, false, '只有模板占位行 = 未启用权威位 → 走直读分支，模块路径缺失即 FAIL');
    assert.match(r.actual, /直读/);
  });
});

const SPEC_WITH_REFS = "---\nlifecycle: active\nauthority_refs:\n  - 'POST /v2/word/record 请求体契约'\n---\n\n# S\n";
const SPEC_EMPTY_REFS = '---\nlifecycle: active\nauthority_refs:\n---\n\n# S\n';
const SPEC_PLACEHOLDER_REFS = "---\nlifecycle: active\nauthority_refs:\n  - '【如：POST /api/v2/orders 请求体契约】'\n---\n\n# S\n";

test('设计理由可追：现行区各 spec 的 authority_refs 非空 → PASS', () => {
  withProject({
    'docs/index.md': '# 索引\n\n## 现行设计与规范\n\n- [A](./spec/a.md)\n- [B](./spec/b.md)\n',
    'docs/spec/a.md': SPEC_WITH_REFS,
    'docs/spec/b.md': "---\nlifecycle: active\nauthority_refs: ['无']\n---\n\n# B\n",
  }, (root) => {
    const r = answerProbe([], [], hp('rationale-traceable', 'docs/index.md', 'traceable'), { root });
    assert.equal(r.pass, true, r.actual);
  });
});

test('设计理由可追：任一现行 spec 的 authority_refs 为空或仍是模板占位 → FAIL', () => {
  withProject({
    'docs/index.md': '# 索引\n\n## 现行设计与规范\n\n- [A](./spec/a.md)\n- [B](./spec/b.md)\n',
    'docs/spec/a.md': SPEC_WITH_REFS,
    'docs/spec/b.md': SPEC_EMPTY_REFS,
  }, (root) => {
    const r = answerProbe([], [], hp('rationale-traceable', 'docs/index.md', 'traceable'), { root });
    assert.equal(r.pass, false);
    assert.match(r.actual, /b\.md/);
  });
  withProject({
    'docs/index.md': '# 索引\n\n## 现行设计与规范\n\n- [A](./spec/a.md)\n',
    'docs/spec/a.md': SPEC_PLACEHOLDER_REFS,
  }, (root) => {
    const r = answerProbe([], [], hp('rationale-traceable', 'docs/index.md', 'traceable'), { root });
    assert.equal(r.pass, false, '模板占位【】不算已填');
  });
});

test('设计理由可追：归档区的 spec 不参与判定；现行区一篇都没有 → FAIL', () => {
  withProject({
    'docs/index.md': '# 索引\n\n## 现行设计与规范\n\n- [A](./spec/a.md)\n\n## 归档\n\n- [老的](./spec/old.md)\n',
    'docs/spec/a.md': SPEC_WITH_REFS,
    'docs/spec/old.md': SPEC_EMPTY_REFS,
  }, (root) => {
    assert.equal(answerProbe([], [], hp('rationale-traceable', 'docs/index.md', 'traceable'), { root }).pass, true);
  });
  withProject({ 'docs/index.md': '# 索引\n\n## 现行设计与规范\n\n（暂无）\n' }, (root) => {
    const r = answerProbe([], [], hp('rationale-traceable', 'docs/index.md', 'traceable'), { root });
    assert.equal(r.pass, false, '零条目不得算通过——那正是"永远全绿"的假门禁');
  });
});

test('门禁自检：有交接题型时，即便 context 层为空也能自检（植入样本被判 FAIL）', () => {
  withProject({ 'README.md': '# P\n\n- [需求](./docs/REQUIREMENTS.md)\n', 'docs/REQUIREMENTS.md': '# 需求\n' }, (root) => {
    const probes = [hp('requirement-reachable', 'docs/REQUIREMENTS.md')];
    const ev = evaluateGate([], [], probes, new Set(), { root });
    assert.equal(ev.selfCheck.ok, true, '交接题型的植入样本不依赖 cards/registry');
    assert.ok(ev.selfCheck.planted.some((p) => p.type === 'requirement-reachable'));
    assert.ok(ev.selfCheck.planted.every((p) => p.pass === false), '植入的必错样本仍 MUST 被判错');
    assert.equal(ev.verdict, 'GREEN');
  });
});

test('门禁自检不得被削弱：无交接题型且 context 层为空仍 GATE-BROKEN', () => {
  const ev = evaluateGate([], [], [passProbe(1)], new Set(), { root: os.tmpdir() });
  assert.equal(ev.verdict, 'GATE-BROKEN');
});

test('交接题型共用棘轮与 authority_refs 自防腐机制', () => {
  withProject({ 'README.md': '# P\n' }, (root) => {
    const bad = hp('requirement-reachable', 'docs/NOPE.md', 'reachable', { n: '7' });
    assert.equal(evaluateGate([], [], [bad], new Set(), { root }).verdict, 'RED', '新增失败 = RED');
    assert.equal(evaluateGate([], [], [bad], new Set(['7']), { root }).verdict, 'AMBER', '基线内 = AMBER');
    const paused = { ...bad, status: 'needs-reconfirm' };
    const ev = evaluateGate([], [], [paused], new Set(), { root });
    assert.equal(ev.needsReconfirm.length, 1, '交接题型同样支持 needs-reconfirm 暂不计分');
    assert.equal(ev.verdict, 'GREEN');
  });
});

test('loadProbes 解析交接题型的探针行（含 authority_refs 列）', () => {
  withProject({
    'probe-set.md':
      '## 探针\n' +
      '| # | 类型 | 输入 | 期望 | severity | weight | status | authority_refs |\n' +
      '|---|---|---|---|---|---|---|---|\n' +
      '| 1 | requirement-reachable | docs/REQUIREMENTS.md | ≤2 跳 | blocking | 1 | | README.md#需求 |\n' +
      '| 2 | rationale-traceable | docs/index.md | 全部非空 | scored | 2 | | docs/index.md 现行区 |\n' +
      '\n## 基线（棘轮）\n（空）\n',
  }, (root) => {
    const { probes } = loadProbes(root);
    assert.equal(probes.length, 2);
    assert.equal(probes[0].type, 'requirement-reachable');
    assert.equal(probes[0].severity, 'blocking');
    assert.equal(probes[1].authorityRefs, 'docs/index.md 现行区');
  });
});

test('ctx init 生成的 probe-set 骨架含全部六个机器可判题型（防 stub 漂移）', () => {
  // 根 CLAUDE.md 的硬约定：assets/context-layer/probe-set.md 与 commands.js 的 PROBE_STUB 必须同步。
  // 骨架里若漏了交接题型，用户按脚手架起步就永远拿不到零上下文交接门禁。
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-probe-stub-'));
  try {
    initScaffold(tmp);
    const base = path.join(tmp, 'engineering-context');
    const raw = fs.readFileSync(path.join(base, 'probe-set.md'), 'utf8');
    // 注意：不能用 loadProbes 取类型——骨架的输入/期望都是 `【…】` 占位，
    // loadProbes 会（正确地）整表跳过以免污染棘轮基线。防漂移要查的是**模板文本**本身。
    const types = raw.split('\n')
      .map((l) => l.trim())
      .filter((l) => /^\|\s*\d+\s*\|/.test(l))
      .map((l) => l.split('|')[2].trim().toLowerCase());
    assert.deepEqual(types, [
      'capability-mapping',
      'deprecated-trap',
      'requirement-reachable',
      'architecture-reachable',
      'implementation-usable',
      'rationale-traceable',
    ]);
    for (const t of types.slice(2)) assert.ok(handoffKind(t), `${t} 应被 handoffKind 认出`);
    const { probes, baseline } = loadProbes(base);
    assert.equal(baseline.size, 0, '骨架的棘轮基线应为空');
    assert.equal(probes.length, 0, '骨架的占位题一道都不该被当真题跑（见占位行跳过那条测试）');
    assert.match(raw, /最小 schema/, '须说明三列最小 schema 下期望串只写权威实现');
    assert.match(raw, /NO-ENTRY-DOC/, '须列出交接题型的失败原因串');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- P0 回归：废弃行里的替代物 MUST NOT 被判成废弃 ----

test('classifyEntity 不把废弃行里指向的替代接口判成 deprecated', () => {
  // card 最标准的废弃写法就是把新旧写在同一行（assets/context-layer/card.md 的模板正是这么诱导的）。
  // 只判"这一行含废弃关键词且含 entity"会把新接口也判成 deprecated——权威位的核心承诺
  // "信哪个"当场反过来：问 canonical 接口，ctx 告诉你它已废弃。
  const cards = [
    {
      service: 'svc',
      raw: [
        '# svc',
        '## 对外接口',
        '- `POST /v2/word/record` — 记录背单词结果',
        '## 废弃与中间产物',
        '- `POST /v1/word/record`（已废弃，请改用 `POST /v2/word/record`）',
        '- 已废弃：`POST /v0/word/record`',
      ].join('\n'),
      sections: {
        对外接口: '- `POST /v2/word/record` — 记录背单词结果',
        废弃与中间产物: '- `POST /v1/word/record`（已废弃，请改用 `POST /v2/word/record`）\n- 已废弃：`POST /v0/word/record`',
      },
    },
  ];
  assert.equal(classifyEntity(cards, [], 'POST /v2/word/record'), 'canonical', '替代指向词之后的实体是替代物，MUST NOT 判 deprecated');
  assert.equal(classifyEntity(cards, [], 'POST /v1/word/record'), 'deprecated', '被废弃的那个照旧判 deprecated');
  // 关键词在前的写法（「已废弃：X」）同样常见，MUST NOT 因为修前一个 bug 把它漏掉。
  assert.equal(classifyEntity(cards, [], 'POST /v0/word/record'), 'deprecated', '行内无替代指向词时照旧判 deprecated');
});
