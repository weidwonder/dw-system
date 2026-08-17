// commands.js — ctx 的命令层。基于 cards.js 的读取层做路由与匹配。
import fs from 'node:fs';
import path from 'node:path';
import {
  loadCards,
  loadRegistry,
  makeCite,
  confirmedAtOf,
  UNDECLARED_FRESHNESS,
} from './cards.js';

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
 * discover：意图 → 应加载的 card 清单 + 命中的能力条目（均带 cite）+ out-of-scope 警告。
 * 匹配 card 全文与 registry 行，按命中分排序。
 * **registry 单独出结果**：最小合法 schema 只有三列、常常一张 card 都没有（"三行 registry 即可起步"），
 * 若只在 card 命中时才返回，registry-only 的项目会永远收到"未命中任何 card"。
 * out-of-scope 警告（"哪些是陷阱、别当权威用"）来自：命中 card 的废弃/中间产物标记段，
 * 与 registry 中命中能力的"陷阱项（废弃或中间产物）"列——这是本层的立身之本，不能只在零命中时给。
 * @returns {{cards:Array, capabilities:Array, outOfScope:string[]}}
 */
export function discover(ctxDir, intent) {
  const tokens = tokenize(intent);
  const cards = loadCards(ctxDir);
  const registry = loadRegistry(ctxDir);
  const scored = [];
  const outOfScope = [];
  const capabilities = matchCapabilities(registry, tokens, outOfScope);
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
      const confirmedAt = freshnessDate(card);
      scored.push({
        service: card.service,
        score,
        why,
        freshness: confirmedAt,
        freshnessDeclared: confirmedAt !== UNDECLARED_FRESHNESS,
        cite: makeCite(card.path, bestSection(card, tokens) || '职责', confirmedAt),
      });
      // 命中 card 的废弃标记 → 逐条变成"别碰"警告
      for (const marker of deprecationMarkers(card)) {
        outOfScope.push(`${card.service}: ${marker}（废弃/中间产物，别当权威用）`);
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0 && capabilities.length === 0) {
    outOfScope.push('未命中任何 card / 能力。请确认关键词，或该能力尚未登记（考虑补 capability-registry 一行 / 补 card）。');
  }
  return { cards: scored, capabilities, outOfScope };
}

/**
 * 匹配 registry 行：意图 → 能力条目（权威实现 + cite）。缺列一律跳过，不报错。
 * 命中行的"陷阱项"列直接进 outOfScope——这是最小 schema 里唯一的防误用装置。
 */
function matchCapabilities(registry, tokens, outOfScope) {
  const hits = [];
  for (const row of registry) {
    const haystack = [row.capability, row.businessMeaning, row.canonicalApi, row.canonicalRepo]
      .filter(Boolean)
      .join(' ');
    const score = scoreHits(haystack, tokens);
    if (score <= 0) continue;
    const confirmedAt = confirmedAtOf(row.freshness);
    hits.push({
      capability: row.capability,
      canonical: [row.canonicalRepo, row.canonicalApi].filter(Boolean).join(' :: '),
      service: row.canonicalRepo || null,
      score,
      freshness: confirmedAt,
      freshnessDeclared: confirmedAt !== UNDECLARED_FRESHNESS,
      cite: makeCite('capability-registry.md', row.capability, confirmedAt),
    });
    if (row.deprecated && !isPlaceholder(row.deprecated) && !/^(无|none|n\/a|-)$/i.test(row.deprecated)) {
      outOfScope.push(`能力「${row.capability}」的陷阱项（废弃或中间产物，别当权威用）：${row.deprecated}`);
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

/** cite 锚点指向命中最多的段落；无段落命中时由调用方退回"职责"。 */
function bestSection(card, tokens) {
  let bestKey = null;
  let bestScore = 0;
  for (const [key, content] of Object.entries(card.sections)) {
    const s = scoreHits(`${key}\n${content}`, tokens);
    if (s > bestScore) {
      bestScore = s;
      bestKey = key;
    }
  }
  return bestKey;
}

/** 从 card 的 Freshness 段落抽一个日期，用于 cite；没写日期就如实标"未声明新鲜度"。 */
function freshnessDate(card) {
  const sec = card.sections['Freshness / Provenance'] || card.raw;
  return confirmedAtOf(sec);
}

/**
 * getCard：取某仓 card。domain 传入时只返回该段落，否则返回全文。
 * @returns {{service, content, cite}|null}
 */
export function getCard(ctxDir, service, domain) {
  const card = loadCards(ctxDir).find((c) => c.service === service);
  if (!card) return null;
  const confirmedAt = freshnessDate(card);
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
    // README.md 是给人看的场景索引，不是场景本身；它汇集各场景关键词，几乎必命中，须排除。
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      return { scene: path.basename(f, '.md'), score: scoreHits(raw, tokens), path: path.join('scenes', f) };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * listServices：列出已登记的服务（来自 cards）与能力（来自 registry）。
 * **没有 card 的 registry 能力也要列出**：最小 schema 常常一张 card 都没有，
 * 若只按 card 列，registry-only 项目的 list-services 会空，看上去像"权威位不可用"。
 * @returns {Array<{service:string|null, hasCard:boolean, capabilities:string[]}>}
 */
export function listServices(ctxDir) {
  const registry = loadRegistry(ctxDir);
  const cards = loadCards(ctxDir);
  const out = cards.map((c) => ({
    service: c.service,
    hasCard: true,
    capabilities: registry.filter((r) => r.canonicalRepo === c.service).map((r) => r.capability),
  }));
  const covered = new Set(cards.map((c) => c.service));
  const rest = new Map(); // service(或 null) -> 能力名数组
  for (const r of registry) {
    const svc = r.canonicalRepo || '';
    if (covered.has(svc)) continue;
    if (!rest.has(svc)) rest.set(svc, []);
    rest.get(svc).push(r.capability);
  }
  for (const [svc, capabilities] of rest) {
    out.push({ service: svc || null, hasCard: false, capabilities });
  }
  return out;
}

/**
 * initScaffold：在 targetDir 下生成 engineering-context/ 骨架。
 * `{ minimal: true }` 只生成 `capability-registry.md`——权威位的起步成本是"三行 registry"，
 * 一次性铺开五个待填文件会把人劝退，反而退回裸 grep。
 * @param {string} targetDir
 * @param {{minimal?:boolean}} [opts]
 * @returns {{base:string, files:string[]}} base=engineering-context 绝对路径，files=本次确保存在的相对文件名
 */
export function initScaffold(targetDir, opts = {}) {
  const base = path.join(targetDir, 'engineering-context');
  if (opts.minimal) {
    fs.mkdirSync(base, { recursive: true });
    writeIfAbsent(path.join(base, 'capability-registry.md'), MINIMAL_REGISTRY_STUB);
    return { base, files: ['capability-registry.md'] };
  }
  fs.mkdirSync(path.join(base, 'cards'), { recursive: true });
  writeIfAbsent(path.join(base, 'cards', '.gitkeep'), '');
  fs.mkdirSync(path.join(base, 'scenes'), { recursive: true });
  writeIfAbsent(path.join(base, 'scenes', 'README.md'), SCENES_README_STUB);
  writeIfAbsent(path.join(base, 'capability-registry.md'), REGISTRY_STUB);
  writeIfAbsent(path.join(base, 'probe-set.md'), PROBE_STUB);
  writeIfAbsent(path.join(base, 'glossary.md'), GLOSSARY_STUB);
  writeIfAbsent(path.join(base, 'README.md'), CTX_README_STUB);
  writeIfAbsent(path.join(base, '.gitignore'), GITIGNORE_STUB);
  return {
    base,
    files: [
      'capability-registry.md',
      'cards/',
      'scenes/README.md',
      'probe-set.md',
      'glossary.md',
      'README.md',
      '.gitignore',
    ],
  };
}

function writeIfAbsent(file, content) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, content, 'utf8');
}

const SCENES_README_STUB = `# 场景索引

> 场景蓝图按 ai-dev-workflow skill 的 assets/context-layer/scene-blueprint.md 生产，
> 落 \`scenes/<场景名>.md\` 即可被 \`ctx find-scenes\` 检索（本索引文件不参与检索）。
> 每收一张蓝图，在下面登记一行：场景名 + 一句话业务口径 + 文件路径。
`;

// 注意：以下四个 stub 是 assets/context-layer/ 同名模板的精简副本（init 脚手架用）。
// 改 assets 模板须同步这里，反之亦然——两处漂移会让脚手架与文档教的模板不一致。

// `ctx init --minimal` 用：权威位的最小起步形态，只有三列。
const MINIMAL_REGISTRY_STUB = `# Capability Registry — 能力到权威实现的映射（最小形态）

> 权威位的起步形态：**三列即可用，三行即可起步**。事实以**合入后的源码**为准，别从 PRD 生成。
> 其余列（业务含义 / 权威仓库 / 兼容窗口 / owner / 测试入口 / freshness / 理由链）按需再加：
> \`ctx discover\` 对缺列**跳过而非报错**；没有 freshness 列时输出标注「未声明新鲜度」，不假定新鲜。
> 完整字段说明见 ai-dev-workflow skill 的 assets/context-layer/capability-registry.md。
> 只剩下面这行模板占位时视为**未启用**权威位（\`ctx list-services\` 为空）。

| Capability | 权威实现 | 陷阱项（废弃或中间产物） |
|---|---|---|
| 【能力，如 背单词记录】 | 【现在该改/该调的那一个，如 POST /v2/word/record 或 src/word/record.ts】 | 【相似但不该用的旧实现，如 POST /v1/word/record；确实没有就写 无】 |
`;

const REGISTRY_STUB = `# Capability Registry — 产品能力到权威代码实体的映射

> 精简骨架；完整字段说明与填写指南见 ai-dev-workflow skill 的 assets/context-layer/capability-registry.md。
> 人工确认。事实以源码为准，PRD 仅作 scope。每条带 freshness 与理由链。
> 下面两张表**填哪张都算，解析器会合并**（表头首列命中 Capability/能力的表全部解析）：
> 三列是 MUST，十列表里的其余列是 MAY——缺列跳过不报错，没有 freshness 列的条目输出标注「未声明新鲜度」。

## 最小合法 schema（起步用这个）

| Capability | 权威实现 | 陷阱项（废弃或中间产物） |
|---|---|---|
| 【能力，如 背单词记录】 | 【现在该改/该调的那一个，如 POST /v2/word/record 或 src/word/record.ts】 | 【相似但不该用的旧实现，如 POST /v1/word/record；确实没有就写 无】 |

## 能力表（完整形态）

| Capability | 业务含义 | 权威仓库 | 权威接口(含版本) | 废弃/中间产物替代 | 兼容窗口 | owner | 测试入口 | freshness | 理由链 |
|---|---|---|---|---|---|---|---|---|---|
| 【能力】 | 【含义】 | 【repo】 | 【POST /v2/xxx】 | 【旧接口不可用】 | 【切点】 | 【owner】 | 【测试入口】 | 【YYYY-MM-DD / PR】 | 【诞生压力】 |
`;

// engineering-context/.gitignore：`ctx probe` 会把通过率历史写进 .index/probe-history.json——
// 那是机器状态，随每次跑门禁变动，入库只会制造 diff 噪音与合并冲突。
// 写在 engineering-context/ 内部而不是项目根的 .gitignore：脚手架不该去改用户项目根的文件。
const GITIGNORE_STUB = `# ctx 的机器状态（ctx probe 的通过率历史等），随每次运行变动，不入库。
.index/
`;

const PROBE_STUB = `# Frozen Probe Set — 上下文层防腐检测题集

> 精简骨架；完整题型示例与 authority_refs 自防腐机制见 ai-dev-workflow skill 的 assets/context-layer/probe-set.md。
> 冻结、可打分、每发布周期重跑（\`ctx probe\`）。种子题取自真实歧义案例，有已知正确答案。
> 机器可判题型分两类：
> **A. context 层题型**（读 cards/registry）
>   capability-mapping —— 输入=能力名，期望=\`权威仓库 :: 权威实现\`（门禁按 registry 求解并比对）。
>     registry 是**三列最小 schema**（没有"权威仓库"列）时，期望串**只写权威实现**即可：
>     仓库维度不存在、无从比对，门禁只判权威实现；此时写成 \`repo :: api\` 反而恒失败，污染棘轮基线。
>   deprecated-trap    —— 输入=接口/实体，期望=\`deprecated\`（门禁须从 cards/registry 判其为废弃；被当 canonical 即失败）。
> **B. 零上下文交接题型**（读项目自身文件；项目根取 \`ctx probe\` 的运行目录，\`--dir\` 只改 engineering-context 的位置）
>   requirement-reachable  —— 输入=需求真相源 \`路径\` 或 \`路径#小节\`，期望=\`≤2 跳\`（写数字即改上限）。
>                             入口文档=仓库根 README*.md 与 docs/index.md，从入口沿链接 BFS。
>   architecture-reachable —— 同上，指向架构真相源。
>   implementation-usable  —— 输入=架构节 \`路径#小节\`，期望=\`usable\`。按探测到的能力位分支，各位都要成立：
>                             无能力位=架构节里列出的模块路径（反引号代码片段或相对链接）均存在；
>                             图谱位=\`.codegraph/codegraph.db\` 非空可查询；权威位=\`ctx list-services\` 非空。
>   rationale-traceable    —— 输入=索引路径（默认 docs/index.md），期望=\`全部非空\`：
>                             索引**现行区**（非"归档"标题下）链到的各 spec，frontmatter \`authority_refs\` 均非空。
>   类型名可写中文题名：需求真相源可达 / 架构真相源可达 / 实现真相源可用 / 设计理由可追。
>   常见失败串：\`NO-ENTRY-DOC\` / \`MISSING:<路径>\` / \`ANCHOR-MISSING:<路径>#<锚点>\` / \`UNREACHABLE(>N 跳)\` / \`NO-SPEC-LINK\`。
>   零条目不算通过：架构节抽不到模块路径、索引现行区一篇 spec 都没链到，一律判 FAIL——那是假门禁。

## 探针
> 列 severity（blocking=零容忍 / scored=计入加权通过率）、weight（scored 权重，默认 1）、status（正常留空；权威面变更待重认填 needs-reconfirm、退役填 quarantined，均暂不计分）可选。
| # | 类型 | 输入 | 期望 | severity | weight | status |
|---|---|---|---|---|---|---|
| 1 | capability-mapping | 【能力名，如 背单词记录】 | 【repo :: POST /v2/xxx；最小 schema 只写 POST /v2/xxx】 | scored | 1 | |
| 2 | deprecated-trap | 【废弃接口，如 POST /v1/xxx】 | deprecated | blocking | 1 | |
| 3 | requirement-reachable | 【需求真相源，如 docs/index.md 或 README.md#需求】 | ≤2 跳 | blocking | 1 | |
| 4 | architecture-reachable | 【架构真相源，如 README.md#架构与边界】 | ≤2 跳 | blocking | 1 | |
| 5 | implementation-usable | 【架构节，如 README.md#架构与边界】 | usable | scored | 2 | |
| 6 | rationale-traceable | 【索引路径，默认 docs/index.md】 | 全部非空 | scored | 2 | |

## 基线（棘轮）
> 已知、暂时容忍的失败项（按 # 列）。规则：**只许变短**——基线外新增失败即 RED；基线内已修复也 RED（强制删除该条）。
（空）
`;

const GLOSSARY_STUB = `# Glossary — 领域词汇表

> 精简骨架；完整维护说明见 ai-dev-workflow skill 的 assets/context-layer/glossary.md。
> 纯词汇表，禁实现细节：glossary 管说法一致，card 管事实权威，registry 管能力落点。
> 条目里出现表/接口/类名即为越界，移去 card。同义词列供 synonyms.md 参考。

| 术语 | 定义（一句话，业务语言） | 同义词/曾用名（标明弃用） | 易混淆项（差异一句话） | 备注 |
|---|---|---|---|---|
| 【术语】 | 【业务定义】 | 【曾用名（弃用）】 | 【≠ 某相近概念】 | 【】 |
`;

const CTX_README_STUB = `# engineering-context

权威位的代码事实语义层（"信哪个"）。用 \`ctx\` 查询：discover / get-card / find-scenes / list-services。
每条事实带 cite；没写 freshness 的会标「未声明新鲜度」，不当作新鲜用。
填写指南见 ai-dev-workflow 的 references/capability/context-engineering.md。
`;
