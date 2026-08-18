// 模板 ↔ 解析器 的往返契约。
//
// 为什么需要它：assets/ 下的模板是使用者**照抄**的东西，而 ctx 会去解析抄出来的结果。
// 两者各自看都"正常"，合起来才出问题——模板里一个示例日期让全新的 card 输出一条
// 看起来完全可信的 cite；模板里几行给人看的说明变成 out-of-scope 里的"废弃项"。
// 这类问题读多少遍模板都读不出来，只有把模板真喂给解析器才现形。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discover } from '../ai-dev-system/skills/ai-dev-workflow/scripts/ctx/src/commands.js';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const layer = path.join(repo, 'ai-dev-system', 'skills', 'ai-dev-workflow', 'assets', 'context-layer');

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

const cardTemplate = () => fs.readFileSync(path.join(layer, 'card.md'), 'utf8');

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
