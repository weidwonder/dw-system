// commands.js — ctx 的命令层。基于 cards.js 的读取层做路由与匹配。
import fs from 'node:fs';
import path from 'node:path';
import { loadCards, loadRegistry, makeCite } from './cards.js';

/** 粗分词：按空白与常见标点切，去掉过短 token。 */
function tokenize(text) {
  return (text || '')
    .split(/[\s,，。、;；:：/()（）\[\]【】"'`]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** 统计 tokens 在 haystack 中命中的个数。 */
function scoreHits(haystack, tokens) {
  const h = haystack.toLowerCase();
  let s = 0;
  for (const t of tokens) if (h.includes(t.toLowerCase())) s += 1;
  return s;
}

/** 是否为模板占位内容（含【】的行视为未填，跳过）。 */
function isPlaceholder(line) {
  return /[【】]/.test(line);
}

/** 取 card 中"废弃/中间产物标记 ★防误用"段落的真实条目（跳过占位）。 */
function deprecationMarkers(card) {
  const key = Object.keys(card.sections).find((k) => /废弃|防误用|中间产物/.test(k));
  if (!key) return [];
  return card.sections[key]
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*]\s*/, '').trim())
    .filter((l) => l.length > 0 && !isPlaceholder(l));
}

/**
 * discover：意图 → 应加载的 card 清单（带 cite）+ out-of-scope 警告。
 * 匹配 card 全文与 registry 行，按命中分排序。
 * out-of-scope 警告（"哪些是陷阱、别当权威用"）来自：命中 card 的废弃/中间产物标记段，
 * 与 registry 中命中能力的"废弃/中间产物替代"列——这是本层的立身之本，不能只在零命中时给。
 */
export function discover(ctxDir, intent) {
  const tokens = tokenize(intent);
  const cards = loadCards(ctxDir);
  const registry = loadRegistry(ctxDir);
  const scored = [];
  const outOfScope = [];
  for (const card of cards) {
    let score = scoreHits(card.raw, tokens);
    // registry 中指向该仓库的能力，若命中 intent，给 card 加权
    const relatedCaps = registry.filter((r) => r.canonicalRepo === card.service);
    const capHits = relatedCaps.filter((r) => scoreHits(`${r.capability} ${r.businessMeaning}`, tokens) > 0);
    score += capHits.length * 2;
    if (score > 0) {
      const why = capHits.length
        ? `命中能力：${capHits.map((c) => c.capability).join('、')}`
        : '文本命中';
      const confirmedAt = freshnessDate(card) || 'unknown';
      scored.push({
        service: card.service,
        score,
        why,
        cite: makeCite(card.path, '职责', confirmedAt),
      });
      // 命中 card 的废弃标记 → 逐条变成"别碰"警告
      for (const marker of deprecationMarkers(card)) {
        outOfScope.push(`${card.service}: ${marker}（废弃/中间产物，别当权威用）`);
      }
      // 命中能力若在 registry 标了废弃替代 → 同样提示
      for (const cap of capHits) {
        if (cap.deprecated && !isPlaceholder(cap.deprecated)) {
          outOfScope.push(`能力「${cap.capability}」的废弃替代：${cap.deprecated}`);
        }
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    outOfScope.push('未命中任何 card。请确认关键词，或该能力尚未登记（考虑补 card / registry）。');
  }
  return { cards: scored, outOfScope };
}

/** 从 card 的 Freshness 段落抽一个日期，用于 cite。 */
function freshnessDate(card) {
  const sec = card.sections['Freshness / Provenance'] || card.raw;
  const m = /(\d{4}-\d{2}-\d{2})/.exec(sec);
  return m ? m[1] : null;
}

/**
 * getCard：取某仓 card。domain 传入时只返回该段落，否则返回全文。
 * @returns {{service, content, cite}|null}
 */
export function getCard(ctxDir, service, domain) {
  const card = loadCards(ctxDir).find((c) => c.service === service);
  if (!card) return null;
  const confirmedAt = freshnessDate(card) || 'unknown';
  if (domain) {
    const content = card.sections[domain];
    if (content === undefined) {
      return {
        service,
        content: `（未找到段落 "${domain}"，可用段落：${Object.keys(card.sections).join(', ')}）`,
        cite: makeCite(card.path, domain, confirmedAt),
      };
    }
    return { service, content, cite: makeCite(card.path, domain, confirmedAt) };
  }
  return { service, content: card.raw, cite: makeCite(card.path, '全文', confirmedAt) };
}

/**
 * findScenes：从 engineering-context/scenes/*.md 匹配业务场景。目录不存在则返回 []。
 */
export function findScenes(ctxDir, keywords) {
  const dir = path.join(ctxDir, 'scenes');
  if (!fs.existsSync(dir)) return [];
  const tokens = tokenize(Array.isArray(keywords) ? keywords.join(' ') : keywords);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      return { scene: path.basename(f, '.md'), score: scoreHits(raw, tokens), path: path.join('scenes', f) };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** listServices：列出已登记的服务（来自 cards）与能力（来自 registry）。 */
export function listServices(ctxDir) {
  const registry = loadRegistry(ctxDir);
  return loadCards(ctxDir).map((c) => ({
    service: c.service,
    capabilities: registry.filter((r) => r.canonicalRepo === c.service).map((r) => r.capability),
  }));
}

/** initScaffold：在 targetDir 下生成 engineering-context/ 骨架。 */
export function initScaffold(targetDir) {
  const base = path.join(targetDir, 'engineering-context');
  fs.mkdirSync(path.join(base, 'cards'), { recursive: true });
  writeIfAbsent(path.join(base, 'cards', '.gitkeep'), '');
  writeIfAbsent(path.join(base, 'capability-registry.md'), REGISTRY_STUB);
  writeIfAbsent(path.join(base, 'probe-set.md'), PROBE_STUB);
  writeIfAbsent(path.join(base, 'README.md'), CTX_README_STUB);
  return base;
}

function writeIfAbsent(file, content) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, content, 'utf8');
}

const REGISTRY_STUB = `# Capability Registry — 产品能力到权威代码实体的映射

> 人工确认。事实以源码为准，PRD 仅作 scope。每条带 freshness 与理由链。

| Capability | 业务含义 | 权威仓库 | 权威接口(含版本) | 废弃/中间产物替代 | 兼容窗口 | owner | 测试入口 | freshness | 理由链 |
|---|---|---|---|---|---|---|---|---|---|
| 【能力】 | 【含义】 | 【repo】 | 【POST /v2/xxx】 | 【旧接口不可用】 | 【切点】 | 【owner】 | 【测试入口】 | 【YYYY-MM-DD / PR】 | 【诞生压力】 |
`;

const PROBE_STUB = `# Frozen Probe Set — 上下文层防腐检测题集

> 冻结、可打分、每发布周期重跑（\`ctx probe\`）。种子题取自真实歧义案例，有已知正确答案。
> 机器可判题型：
>   capability-mapping —— 输入=能力名，期望=\`权威仓库 :: 权威接口\`（门禁按 registry 求解并比对）。
>   deprecated-trap    —— 输入=接口/实体，期望=\`deprecated\`（门禁须从 cards/registry 判其为废弃；被当 canonical 即失败）。

## 探针
| # | 类型 | 输入 | 期望 |
|---|---|---|---|
| 1 | capability-mapping | 【能力名，如 背单词记录】 | 【repo :: POST /v2/xxx】 |
| 2 | deprecated-trap | 【废弃接口，如 POST /v1/xxx】 | deprecated |

## 基线（棘轮）
> 已知、暂时容忍的失败项（按 # 列）。规则：只许变短——新增失败即门禁 RED。
（空）
`;

const CTX_README_STUB = `# engineering-context

团队版的代码事实语义层。用 \`ctx\` 查询：discover / get-card / find-scenes / list-services。
填写指南见 ai-dev-workflow 的 references/company/context-engineering.md。
`;
