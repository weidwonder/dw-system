// 模板 / 文档 ↔ 解析器 的往返契约。
//
// 为什么需要它：assets/ 下的模板是使用者**照抄**的东西，README 是他们照着写 CI 脚本的东西，
// 而 ctx 会去解析抄出来的结果。两者各自看都"正常"，合起来才出问题——模板里一个示例日期
// 让全新的 card 输出一条看起来完全可信的 cite；模板里几行给人看的说明变成 out-of-scope 里的
// "废弃项"；模板注释里一对引号让空 spec 骗过门禁。这类问题读多少遍模板都读不出来，
// 只有把模板真喂给解析器才现形。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discover, initScaffold } from '../dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js';
import { diagnoseRegistry } from '../dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js';
import { lintCards } from '../dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js';
import { loadProbes, answerProbe } from '../dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = path.join(repo, 'dw-system', 'skills', 'dw-workflow');
const codeFacts = path.join(repo, 'dw-system', 'skills', 'dw-code-facts');
const layer = path.join(codeFacts, 'assets', 'context-layer');
const templates = path.join(skill, 'assets', 'templates');
const ctxReadme = path.join(codeFacts, 'scripts', 'ctx', 'README.md');

/** 造一个临时目录，回调结束后清掉。 */
function withTmp(prefix, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** 一份 markdown 里的表格数据行（跳过表头与分隔行）。 */
function tableDataRows(raw) {
  const lines = raw.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith('|')) continue;
    if (/^\|[\s:|-]+\|$/.test(t)) continue;                       // 分隔行
    if (/^\|[\s:|-]+\|$/.test((lines[i + 1] || '').trim())) continue; // 下一行是分隔行 → 本行是表头
    out.push(t);
  }
  return out;
}

/** 把一份 card 正文落成临时 engineering-context，回调里拿到 ctx 目录。 */
function withCard(body, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-'));
  try {
    const cards = path.join(tmp, 'engineering-context', 'cards');
    fs.mkdirSync(cards, { recursive: true });
    fs.writeFileSync(path.join(cards, 'order-service.md'), body, 'utf8');
    return fn(path.join(tmp, 'engineering-context'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 废弃项、新鲜度这两条契约落在域卡模板上：陷阱与确认日期都写在域卡里。
const cardTemplate = () => fs.readFileSync(path.join(layer, 'card-domain.md'), 'utf8');

test('card 模板：原样新建的 card MUST NOT 输出看起来可信的新鲜度', () => {
  withCard(cardTemplate(), (dir) => {
    const r = discover(dir, '职责');
    assert.ok(r.cards.length > 0, '这条测试必须真的命中 card，否则它什么都没测');
    const cites = JSON.stringify(r);
    assert.doesNotMatch(
      cites, /@\d{4}-\d{2}-\d{2}/,
      'card 模板里出现了真日期形态的示例，会让没填过 Freshness 的 card 冒充新鲜事实；占位 MUST 写成【YYYY-MM-DD】',
    );
  });
});

test('card 模板：给人看的说明 MUST NOT 变成 out-of-scope 里的废弃项', () => {
  withCard(cardTemplate(), (dir) => {
    const r = discover(dir, '职责');
    assert.ok(r.cards.length > 0, '这条测试必须真的命中 card，否则它什么都没测');
    const noise = (r.outOfScope || []).filter((l) => !/未命中/.test(l));
    assert.deepEqual(noise, [], `空模板不该产出任何废弃项，实得：\n${noise.join('\n')}`);
  });
});

test('card 模板：填进真实废弃项后，两种形态都要被抽出来且不夹带噪音', () => {
  const filled = cardTemplate()
    .replace('- 【旧接口/旧类/中间产物】 — 【为什么不能用】，改用 【新接口】',
      '- `POST /v1/order/create` — 上次重构的中间产物，改用 `POST /v2/order/create`')
    .replace('| 【旧接口】 | 【新接口】 | 【上次重构的中间产物 / 已下线 / …】 |',
      '| `OrderLegacyService` | `OrderService` | 已下线 |');
  withCard(filled, (dir) => {
    const r = discover(dir, 'OrderLegacyService');
    assert.ok(r.cards.length > 0, '这条测试必须真的命中 card，否则它什么都没测');
    const items = (r.outOfScope || []).filter((l) => !/未命中/.test(l));
    assert.equal(items.length, 2, `期望恰好两条真实废弃项，实得 ${items.length} 条：\n${items.join('\n')}`);
    assert.ok(items.some((l) => l.includes('POST /v1/order/create')));
    assert.ok(items.some((l) => l.includes('OrderLegacyService')));
  });
});

// ---- spec 模板 ↔ ctx probe 的 rationale-traceable ----

test('spec 模板未填时 MUST 一律被判「authority_refs 未填」', () => {
  // 判据是"行内出现引号就不剥离注释"（避免误伤带 # 的引号值）。于是 frontmatter 注释里
  // 写 `没有则写 ['无']` 会让整条注释被当成 authority_refs 的一个条目 → 一篇只有【】占位的
  // spec 判绿。而 eng-spec / lean-change-spec 恰恰是唯一落在 docs/spec/、会被这道题统计的两份。
  const specTemplates = ['eng-spec.md', 'lean-change-spec.md', 'overview.md', 'test-spec.md', 'coding-plan.md'];
  withTmp('tpl-rationale-', (root) => {
    const specDir = path.join(root, 'docs', 'spec');
    fs.mkdirSync(specDir, { recursive: true });
    const links = [];
    for (const name of specTemplates) {
      fs.copyFileSync(path.join(templates, name), path.join(specDir, name));
      links.push(`- [${name}](spec/${name})`);
    }
    fs.writeFileSync(path.join(root, 'docs', 'index.md'), `# 索引\n\n## 现行\n${links.join('\n')}\n`, 'utf8');

    const r = answerProbe([], [], { type: 'rationale-traceable', input: 'docs/index.md', expected: '全部非空' }, { root });
    assert.equal(r.pass, false, '五份模板都没填 authority_refs，MUST NOT 判通过');
    for (const name of specTemplates) {
      assert.ok(r.actual.includes(name), `${name} 未填却没被点名，实得：${r.actual}`);
    }
  });
});

test('spec 模板填了真条目后 MUST 判通过（证明上一条不是恒 FAIL）', () => {
  withTmp('tpl-rationale-ok-', (root) => {
    const specDir = path.join(root, 'docs', 'spec');
    fs.mkdirSync(specDir, { recursive: true });
    const filled = fs.readFileSync(path.join(templates, 'eng-spec.md'), 'utf8')
      .replace("  - '【如：POST /api/v2/orders 请求体契约】'", "  - 'POST /api/v2/orders 请求体契约'")
      .replace("  - '【如：order 表唯一键 (tenant_id, order_no)】'", '');
    fs.writeFileSync(path.join(specDir, 'eng-spec.md'), filled, 'utf8');
    fs.writeFileSync(path.join(root, 'docs', 'index.md'), '# 索引\n\n## 现行\n- [s](spec/eng-spec.md)\n', 'utf8');
    const r = answerProbe([], [], { type: 'rationale-traceable', input: 'docs/index.md', expected: '全部非空' }, { root });
    assert.equal(r.pass, true, `填了就该判通过，实得：${r.actual}`);
  });
});

// ---- probe-set 模板 ↔ loadProbes ----

test('probe-set 模板 MUST 自带一张可解析的探针表', () => {
  // 判据是"首列 `#` 且次列含 类型/type"。模板里那张 `| # | 题型 | 示例 | 期望答案 |`
  // 不满足次列条件，整张表不会被解析——整份模板于是没有任何一行 context 层题型的可填骨架。
  withTmp('tpl-probe-', (tmp) => {
    fs.copyFileSync(path.join(layer, 'probe-set.md'), path.join(tmp, 'probe-set.md'));
    const { skipped } = loadProbes(tmp);
    assert.ok(skipped.length >= 6, `模板的探针表 MUST 被解析出占位行（实得 ${skipped.length} 条）`);

    // 把占位换成真题 → 六个题型都要被解析出来，证明骨架真的可填
    const filled = fs.readFileSync(path.join(layer, 'probe-set.md'), 'utf8')
      .replace(/【[^】]*】/g, 'X');
    fs.writeFileSync(path.join(tmp, 'probe-set.md'), filled, 'utf8');
    const types = loadProbes(tmp).probes.map((p) => p.type);
    for (const t of ['capability-mapping', 'deprecated-trap', 'requirement-reachable',
      'architecture-reachable', 'implementation-usable', 'rationale-traceable']) {
      assert.ok(types.includes(t), `填完后 MUST 解析出 ${t} 这道题，实得：${types.join(', ')}`);
    }
  });
});

test('probe-set 模板的探针表头 MUST 与 ctx init 脚手架同构', () => {
  // 两处漂移会让脚手架与文档教的模板不一致——照模板填的人拿到一张不被解析的表。
  const headerOf = (raw) => raw.split(/\r?\n/).find((l) => /^\|\s*#\s*\|/.test(l));
  withTmp('tpl-stub-', (tmp) => {
    const { base } = initScaffold(tmp);
    const stub = headerOf(fs.readFileSync(path.join(base, 'probe-set.md'), 'utf8'));
    const tpl = headerOf(fs.readFileSync(path.join(layer, 'probe-set.md'), 'utf8'));
    assert.ok(stub && tpl, '两边都必须有探针表头');
    const cols = (h) => h.split('|').map((c) => c.trim()).filter(Boolean);
    assert.deepEqual(cols(stub), cols(tpl).slice(0, cols(stub).length),
      '脚手架的列 MUST 是模板列的前缀（模板可多一列 authority_refs，但不得改名或换序）');
  });
});

// ---- registry 模板 ↔ cards.js ----

test('registry 模板的完整表表头 MUST 与 ctx init 脚手架逐字一致', () => {
  const fullHeader = (raw) => raw.split(/\r?\n/).find((l) => /freshness/i.test(l) && l.trim().startsWith('|'));
  withTmp('tpl-reg-', (tmp) => {
    const { base } = initScaffold(tmp);
    assert.equal(
      fullHeader(fs.readFileSync(path.join(base, 'capability-registry.md'), 'utf8')),
      fullHeader(fs.readFileSync(path.join(layer, 'capability-registry.md'), 'utf8')),
      '模板与 init stub 的完整表表头不得漂移',
    );
  });
});

test('registry 模板 MUST 写明存放路径、文件名契约与分隔行硬要求', () => {
  const raw = fs.readFileSync(path.join(layer, 'capability-registry.md'), 'utf8');
  assert.match(raw, /engineering-context\/capability-registry\.md/, '解析器只读这一个路径，模板 MUST 说出来');
  assert.match(raw, /cards\/<repo>\.md/, '「权威仓库」列要与 card 文件名逐字一致，模板 MUST 说出来');
  assert.match(raw, /分隔行/, '缺分隔行整张表被忽略，模板 MUST 说出来');
});

test('缺分隔行的 registry 真的整张表被忽略（上一条文档要求的由来）', () => {
  withTmp('tpl-sep-', (tmp) => {
    const base = path.join(tmp, 'engineering-context');
    fs.mkdirSync(base, { recursive: true });
    fs.writeFileSync(path.join(base, 'capability-registry.md'),
      '# R\n\n| Capability | 权威实现 |\n| 登录 | src/auth/login.ts |\n', 'utf8');
    assert.equal(diagnoseRegistry(base), 'no-separator');
  });
});

// ---- card 模板 ↔ cards.js ----

test('两份卡片模板 MUST 写明存放路径与名字契约', () => {
  const map = fs.readFileSync(path.join(layer, 'card-map.md'), 'utf8');
  assert.match(map, /engineering-context\/cards\/<repo>\.md/, 'loadCards 只扫这个目录，地图卡模板 MUST 说出来');
  assert.match(map, /文件名即 service 名/, 'ctx get-card <repo> 的 <repo> 就是文件名，模板 MUST 说出来');
  const domain = fs.readFileSync(path.join(layer, 'card-domain.md'), 'utf8');
  assert.match(domain, /engineering-context\/cards\/<repo>\/<域>\.md/, 'loadDomainCards 只扫这个目录，域卡模板 MUST 说出来');
  assert.match(domain, /业务域地图/, '域名 MUST 先登记在地图卡里，模板 MUST 说出来');
});

test('两份卡片模板原样落盘后，lint-cards 只报不出任何小节类违规', () => {
  withTmp('tpl-lint-', (tmp) => {
    const base = path.join(tmp, 'engineering-context');
    fs.mkdirSync(path.join(base, 'cards', 'svc'), { recursive: true });
    fs.copyFileSync(path.join(layer, 'card-map.md'), path.join(base, 'cards', 'svc.md'));
    fs.copyFileSync(path.join(layer, 'card-domain.md'), path.join(base, 'cards', 'svc', '订单导出.md'));
    const { violations } = lintCards(base);
    assert.deepEqual(violations, [], `模板自己就违规，照模板写的卡永远过不了体检：\n${violations.join('\n')}`);
  });
});

test('registry 的「权威仓库」写得与 card 文件名不一致时静默失去加权（上一条文档要求的由来）', () => {
  const card = '# svc\n\n## 职责\n负责登录。\n\n## Freshness / Provenance\n- 最近确认：2026-08-01\n';
  const registry = (repoName) =>
    '# R\n\n| Capability | 权威仓库 | 权威实现 |\n|---|---|---|\n'
    + `| 登录 | ${repoName} | src/auth/login.ts |\n`;
  const scoreWith = (repoName) => withTmp('tpl-name-', (tmp) => {
    const base = path.join(tmp, 'engineering-context');
    fs.mkdirSync(path.join(base, 'cards'), { recursive: true });
    fs.writeFileSync(path.join(base, 'cards', 'order-service.md'), card, 'utf8');
    fs.writeFileSync(path.join(base, 'capability-registry.md'), registry(repoName), 'utf8');
    return discover(base, '登录').cards[0];
  });
  const matched = scoreWith('order-service');
  const mismatched = scoreWith('orders');
  assert.ok(matched.score > mismatched.score, '文件名对上才有 card 加权');
  assert.match(matched.why, /命中能力/);
  assert.equal(mismatched.why, '文本命中', '对不上时既不报错也不提示——正因为静默，模板必须写清这条契约');
});

// ---- test-coverage 模板：虚构示例行不得混进真实台账 ----

test('test-coverage 模板的每一行 MUST 要么是空骨架、要么标着示例', () => {
  // 这份模板产出的是**固定文件名的真实台账**（docs/report/测试场景覆盖度.md）。
  // 完全具体的虚构行（订单流水、tests/e2e/*.py）留在台账里会制造假覆盖率与假缺口，
  // 「待向用户索要的素材」表还会让 agent 去向用户索要一份根本不存在的快照。
  const raw = fs.readFileSync(path.join(templates, 'test-coverage.md'), 'utf8');
  const bad = tableDataRows(raw).filter((l) => !/[【】]/.test(l) && !/示例/.test(l));
  assert.deepEqual(bad, [], `这些行既不是空骨架也没标示例：\n${bad.join('\n')}`);
});

test('test-coverage 的场景清单 MUST 有一行【】空骨架可直接填', () => {
  const raw = fs.readFileSync(path.join(templates, 'test-coverage.md'), 'utf8');
  const section = raw.split('## 场景清单')[1].split('\n## ')[0];
  assert.ok(tableDataRows(section).some((l) => /[【】]/.test(l)), '场景清单缺空模板行，填表的人只能照抄虚构示例');
});

// ---- ctx README ↔ 实现 ----

test('README 教的失败串 MUST 是实现真会输出的那些', () => {
  // 照 README 在 CI 里 grep 失败串的人，匹配不到就等于门禁静默失效。
  const readme = fs.readFileSync(ctxReadme, 'utf8');
  assert.doesNotMatch(readme, /直读：/, '`直读：` 前缀在实现里已不存在（模块路径校验现在无条件执行）');
  assert.match(readme, /模块路径：缺失/, 'README MUST 写实现真会输出的前缀');
  withTmp('readme-str-', (root) => {
    fs.writeFileSync(path.join(root, 'README.md'), '# P\n\n## 架构与边界\n\n- `src/none.js` 是入口\n', 'utf8');
    const r = answerProbe([], [], { type: 'implementation-usable', input: 'README.md#架构与边界', expected: 'usable' }, { root });
    assert.equal(r.pass, false);
    assert.match(r.actual, /模块路径：缺失/, '实现输出的前缀 MUST 与 README 一致');
  });
});

test('README MUST NOT 再写"禁止 | jq 直连"（管道截断已修，且同页示例正是管道直连）', () => {
  const readme = fs.readFileSync(ctxReadme, 'utf8');
  assert.doesNotMatch(readme, /MUST NOT\*{0,2} 用 `\| jq` 直连/, '这条禁令与同一节的示例自相矛盾');
  assert.match(readme, /别把判级规则|抄第二遍/, '"别在 CI 里抄第二遍判级规则"这半句仍然成立，MUST 保留');
});

test('README 判级表 MUST 写全 GATE-BROKEN 的三种成因，并写明自检先于 NO-PROBE', () => {
  const readme = fs.readFileSync(ctxReadme, 'utf8');
  const row = readme.split(/\r?\n/).find((l) => l.startsWith('| `GATE-BROKEN`'));
  assert.ok(row, '判级表里应有 GATE-BROKEN 行');
  assert.match(row, /必错样本/, '成因①：样本竟被判通过');
  assert.match(row, /context 层为空/, '成因②：无 registry 也无 cards');
  assert.match(row, /构造不出|无法构造/, '成因③：registry 缺权威条目且 cards 抽不出废弃实体');
  assert.match(readme, /自检先于 NO-PROBE/, 'init 之后直接 probe 得到的是 GATE-BROKEN，判级表 MUST 说清顺序');
});

test('README 关于 --minimal 产物的说法 MUST 与 initScaffold 一致', () => {
  const readme = fs.readFileSync(ctxReadme, 'utf8');
  withTmp('readme-min-', (tmp) => {
    const { base, files } = initScaffold(tmp, { minimal: true });
    assert.deepEqual(fs.readdirSync(base).sort(), ['.gitignore', 'capability-registry.md']);
    for (const f of files) {
      assert.ok(readme.includes(f), `README 没提到 --minimal 会生成 ${f}`);
    }
    assert.doesNotMatch(readme, /\*\*只\*\*生成 `capability-registry\.md`/, '"只生成 registry"与实际产物不符');
  });
});
