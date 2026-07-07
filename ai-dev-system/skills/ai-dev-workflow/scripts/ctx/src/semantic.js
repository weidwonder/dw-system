// semantic.js — ctx search-semantic 的本地实现（零依赖、离线、跨平台）
//
// 定位：discover 用精确子串命中；本命令是 discover **未命中时的兜底**，用局部
// 向量相似度（字符 bigram 余弦）+ 可选同义词扩展，抓近义/形近说法。
//
// 防腐红线（与 references/company/context-engineering.md 一致，务必保留）：
//   1. 每个结果带 freshness；给了 --as-of 时对过期块降权并标 stale。
//   2. 结果附权威指针（canonical / deprecated），而非单纯相似度——避免重蹈会过期的 RAG。
//   3. 语义检索不是第一入口：权威 registry + discover 才是；本命令输出会明示这点。
//
// 说明：这是零依赖的离线后端（字符 n-gram 相似度，非神经 embedding）。未来可把
// 打分器换成 embedding 索引，只要保持"结果带 freshness + 权威标记"的契约不变。

import fs from 'node:fs';
import path from 'node:path';
import { loadCards, makeCite } from './cards.js';

/** 归一化：小写 + 去除空白与标点，得到用于 n-gram 的紧凑串。 */
function normTight(s) {
  return (s || '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

/** 字符 bigram 的词频向量（Map<gram, count>）。单字符时退化为 unigram。 */
function bigramTf(s) {
  const t = normTight(s);
  const m = new Map();
  if (t.length === 0) return m;
  if (t.length === 1) { m.set(t, 1); return m; }
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

/** 两个 tf 向量的余弦相似度（0~1）。 */
function cosine(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, v] of small) { const w = large.get(k); if (w) dot += v * w; }
  let na = 0; for (const v of a.values()) na += v * v;
  let nb = 0; for (const v of b.values()) nb += v * v;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * 读可选的 synonyms 文件（engineering-context/synonyms.md）。
 * 格式：每行 `- 词: 近义1, 近义2`（或用中文冒号）。缺文件 → 空 Map。
 * @returns {Map<string,string[]>}
 */
export function loadSynonyms(ctxDir) {
  const file = path.join(ctxDir, 'synonyms.md');
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*[-*]?\s*(.+?)\s*[:：]\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1].trim();
    const vals = m[2].split(/[,，、]/).map((x) => x.trim()).filter(Boolean);
    if (key && vals.length) map.set(key, vals);
  }
  return map;
}

/** 用 synonyms 扩展 query：命中的键把其近义词拼接进查询串。 */
export function expandQuery(query, syn) {
  if (!syn || syn.size === 0) return query;
  const extra = [];
  for (const [key, vals] of syn) {
    if (query.includes(key)) extra.push(...vals);
    else if (vals.some((v) => query.includes(v))) extra.push(key);
  }
  return extra.length ? `${query} ${extra.join(' ')}` : query;
}

/** 段落是否描述"废弃/中间产物"。 */
function isDeprecatedSection(title, body) {
  return /废弃|中间产物|deprecat/i.test(title) || /不可用|已废弃|deprecated/i.test(body);
}

/** 从 card 抽 freshness 日期（YYYY-MM-DD），无则 'unknown'。 */
function freshnessOf(card) {
  const sec = card.sections['Freshness / Provenance'] || card.raw;
  const m = /(\d{4}-\d{2}-\d{2})/.exec(sec);
  return m ? m[1] : 'unknown';
}

/** 计算两个 YYYY-MM-DD 之间的天数（asOf - date）；不可解析返回 null。 */
function ageDays(dateStr, asOf) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return null;
  const a = Date.parse(dateStr + 'T00:00:00Z');
  const b = Date.parse(asOf + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * searchSemantic：对 query 做 chunk 级（card 段落）相似度检索。
 * @param {string} ctxDir
 * @param {string} query
 * @param {{top?:number, asOf?:string|null, staleDays?:number}} [opts]
 * @returns {{query, expandedQuery, backend, note:string[], results:Array}}
 */
export function searchSemantic(ctxDir, query, opts = {}) {
  const top = opts.top ?? 5;
  const staleDays = opts.staleDays ?? 90;
  const asOf = opts.asOf ?? null;

  const syn = loadSynonyms(ctxDir);
  const expandedQuery = expandQuery(query, syn);
  const qv = bigramTf(expandedQuery);

  const cards = loadCards(ctxDir);
  const scored = [];
  for (const card of cards) {
    const fresh = freshnessOf(card);
    const entries = Object.entries(card.sections);
    // 若 card 无 ## 段落，退化为整卡一个 chunk
    const chunks = entries.length ? entries : [['全文', card.raw]];
    for (const [section, body] of chunks) {
      let score = cosine(qv, bigramTf(`${section} ${body}`));
      if (score <= 0) continue;
      const authority = isDeprecatedSection(section, body) ? 'deprecated' : 'canonical';
      let stale = null;
      if (asOf) {
        const age = ageDays(fresh, asOf);
        stale = age !== null && age > staleDays;
        if (stale) score *= 0.5; // 过期块降权（红线 1）
      }
      scored.push({
        service: card.service,
        section,
        score: Number(score.toFixed(4)),
        authority,
        freshness: fresh,
        stale,
        cite: makeCite(card.path, section, fresh),
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, top);

  const note = [
    '语义检索是 discover 未命中时的兜底，不是第一入口；权威 registry + discover 优先。',
    '结果可能包含【已废弃/中间产物】(authority=deprecated)——勿当 canonical 使用。',
  ];
  if (asOf) note.push(`已按 --as-of=${asOf} 对超过 ${staleDays} 天未确认的块降权并标 stale。`);
  else note.push('未给 --as-of，无法判定过期；生产/CI 建议传 --as-of 以启用 freshness 降权。');

  return { query, expandedQuery, backend: 'local-bigram-cosine', note, results };
}
