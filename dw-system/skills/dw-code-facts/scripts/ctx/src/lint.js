// lint.js — `ctx lint-cards`：卡片体检（零依赖，跨平台）
//
// 违规的稳定标识是 `<规则>|<相对路径>|<键>`，相对路径以 engineering-context/ 为根、统一正斜杠。
// 基线 `cards-lint-baseline.json` 记存量违规：只经 --init-baseline 从无到有、经 --prune-baseline 变短，
// 没有任何入口能往既有基线里加条目——否则"新违规判红"可以靠改基线绕过。
import fs from 'node:fs';
import path from 'node:path';
import { loadCards, loadDomainCards, loadDependencies, loadDependencyCards, unreadableCards } from './cards.js';

export const BASELINE_FILE = 'cards-lint-baseline.json';

const MAP_REQUIRED = ['职责', '业务域地图'];
const MAP_OPTIONAL = ['对外入口总览', '跨域陷阱', '上下游', '测试入口', '日志与排障', '确认'];
const DOMAIN_REQUIRED = ['职责', '权威实现与对外接口', '陷阱项', '确认'];
const DOMAIN_OPTIONAL = ['测试入口', '日志与排障', '端侧补充'];

export const BUDGET = Object.freeze({ map: 8000, domain: 16000, registryCell: 300 });

const posix = (p) => p.split(path.sep).join('/');
const bytes = (s) => Buffer.byteLength(s, 'utf8');
/** 键里不能有 `|`：它是违规标识的分隔符。 */
const keyOf = (s) => String(s).replace(/\|/g, '/').trim();
const violation = (rule, file, key = '') => `${rule}|${posix(file)}|${keyOf(key)}`;

/** 去掉代码围栏后的行（保留行号对应关系无意义，体检只看内容）。 */
function proseLines(raw) {
  const out = [];
  let fenced = false;
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
    if (!fenced) out.push(line);
  }
  return out;
}

function checkSections(card, required, optional) {
  const found = [];
  const have = Object.keys(card.sections);
  for (const name of required) if (!have.includes(name)) found.push(violation('sections', card.path, `缺:${name}`));
  const allowed = new Set([...required, ...optional]);
  for (const name of have) if (!allowed.has(name)) found.push(violation('sections', card.path, `多:${name}`));
  return found;
}

function checkDatedHeadings(card) {
  return proseLines(card.raw)
    .map((line) => /^#{2,3}\s+(.+?)\s*$/.exec(line))
    .filter((m) => m && /20\d{2}-\d{2}-\d{2}/.test(m[1]))
    .map((m) => violation('dated-heading', card.path, m[1]));
}

function checkTrapNoise(card) {
  const found = [];
  for (const [title, body] of Object.entries(card.sections)) {
    if (!/陷阱/.test(title)) continue;
    for (const line of body.split(/\r?\n/)) {
      if (line.trim().startsWith('>')) continue; // 引用块是写给人的引导语，ctx 抽警告时同样跳过
      if (/非废弃|仍在维护|持续维护/.test(line)) found.push(violation('trap-noise', card.path, line.trim().slice(0, 80)));
    }
  }
  return found;
}

/** 地图卡〈职责〉里的 `> 根目录：<相对项目根的路径 | 外部>` 声明；没声明返回 null。 */
function declaredRoot(mapCard) {
  const m = /^>\s*根目录[:：]\s*(.+?)\s*$/m.exec(mapCard?.sections['职责'] || '');
  return m ? m[1].replace(/`/g, '') : null;
}

const CITE_RE = /`([^`\s【】]+?\.[A-Za-z0-9]+)(?:#([^`\s]+)|:(\d+)(?:-(\d+))?)`/g;

function checkCites(card, roots) {
  const found = [];
  for (const line of proseLines(card.raw)) {
    if (/[【】]/.test(line)) continue; // 模板占位行还没填，不是 cite
    for (const m of line.matchAll(CITE_RE)) {
      const [whole, rel, symbol, from, to] = m;
      const file = roots.map((r) => path.join(r, ...rel.split('/'))).find((abs) => fs.existsSync(abs) && fs.statSync(abs).isFile());
      const key = whole.slice(1, -1);
      if (!file) { found.push(violation('cite', card.path, key)); continue; }
      let text;
      try {
        text = fs.readFileSync(file, 'utf8');
      } catch {
        found.push(violation('cite', card.path, key));
        continue;
      }
      if (symbol !== undefined && !text.includes(symbol)) found.push(violation('cite', card.path, key));
      if (from !== undefined) {
        const last = Number(to ?? from);
        if (last > text.split(/\r?\n/).length) found.push(violation('cite', card.path, key));
      }
    }
  }
  return found;
}

const normName = (s) => s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');

/**
 * 同一个归属下的域名近似重复。`owner` 是违规标识里的相对路径：
 * 产品仓 `cards/<repo>`（或单文件卡的 `cards/<repo>.md`），依赖仓 `dependencies/<上游名>`。
 * 比较只在同一个 owner 内进行——两个上游各有一张同名卡不是重复。
 */
function checkDomainDup(owner, domainNames) {
  const found = [];
  const names = [...domainNames].sort();
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const [a, b] = [normName(names[i]), normName(names[j])];
      const [short, long] = a.length <= b.length ? [a, b] : [b, a];
      if (a === b || ([...short].length >= 4 && long.startsWith(short))) {
        found.push(violation('domain-dup', owner, `${names[i]}~${names[j]}`));
      }
    }
  }
  return found;
}

function checkRegistry(ctxDir) {
  const file = path.join(ctxDir, 'capability-registry.md');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const found = [];
  for (const line of proseLines(raw)) {
    const t = line.trim();
    if (!t.startsWith('|') || /[【】]/.test(t)) continue;
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    cells.forEach((cell, i) => {
      if (bytes(cell) > BUDGET.registryCell) found.push(violation('budget', 'capability-registry.md', `${cells[0].slice(0, 40)}#${i + 1}`));
    });
    for (const m of t.matchAll(/cards\/[^\s`|)）]+?\.md/g)) {
      if (!fs.existsSync(path.join(ctxDir, ...m[0].split('/')))) found.push(violation('registry-pointer', 'capability-registry.md', m[0]));
    }
  }
  return found;
}

/**
 * 跑全部规则。
 * @param {string} ctxDir engineering-context 目录
 * @returns {{cards:number, violations:string[]}} violations 已排序去重
 */
export function lintCards(ctxDir) {
  const maps = loadCards(ctxDir);
  const domains = loadDomainCards(ctxDir);
  const deps = loadDependencyCards(ctxDir);
  const projectRoot = path.dirname(path.resolve(ctxDir));
  // 读不出的卡不会出现在 maps / domains / deps 里；不单独报，它就从体检里无声消失。
  // unreadableCards 给的路径已经以 cards/ 或 dependencies/ 开头，这里 MUST NOT 再拼一次前缀。
  const found = unreadableCards(ctxDir).map((rel) => violation('unreadable', rel));
  /**
   * 这张卡的源码该去哪儿找；`null` = 找不到根目录 → `checkCites` 整卡不跑。
   *
   * "源码不在本项目里"在本文件里只有这一个表达。地图卡的 `> 根目录：外部` 是把它**显式声明**
   * 出来的写法；依赖仓事实卡则由它所在的目录契约直接蕴含同一状态（`dependencies/` 按定义
   * 装的就是外部上游）。两者在这里汇合成同一个 `null`，下游只有一条豁免路径。
   * 若改成在 `checkCites` 里另加一个按 origin 的提前返回，就有了两处各自可能漂移的豁免判据，
   * 而漂移的方向是"本该校验的被放过"。
   */
  const rootsOf = (card) => {
    if (card.origin === 'dependency') return null;
    const declared = declaredRoot(maps.find((m) => m.service === card.service));
    if (declared === '外部') return null;
    return declared ? [projectRoot, path.join(projectRoot, ...declared.split('/'))] : [projectRoot];
  };
  for (const card of maps) {
    found.push(...checkSections(card, MAP_REQUIRED, MAP_OPTIONAL));
    if (bytes(card.raw) > BUDGET.map) found.push(violation('budget', card.path));
  }
  // 依赖仓事实卡与产品域卡同一套固定小节、同一个体积上限（MUST NOT 新增第五张小节表或第二个体积常量）。
  for (const card of [...domains, ...deps]) {
    found.push(...checkSections(card, DOMAIN_REQUIRED, DOMAIN_OPTIONAL));
    if (bytes(card.raw) > BUDGET.domain) found.push(violation('budget', card.path));
  }
  for (const card of [...maps, ...domains, ...deps]) {
    found.push(...checkDatedHeadings(card), ...checkTrapNoise(card));
    const roots = rootsOf(card);
    if (roots) found.push(...checkCites(card, roots));
  }
  const services = new Set(domains.map((d) => d.service));
  for (const service of services) {
    if (!maps.some((m) => m.service === service)) found.push(violation('sections', path.join('cards', service), '缺地图卡'));
    found.push(...checkDomainDup(path.join('cards', service), domains.filter((d) => d.service === service).map((d) => d.domain)));
  }
  // 依赖侧与产品侧对称：有事实卡而没有同名依赖声明就判一条，规则名同样是 sections。
  // 触发条件是"有事实卡"而不是"有目录"——空目录是常见的 git 残留，判红是噪音。
  const declared = new Set(loadDependencies(ctxDir).map((d) => d.upstream));
  for (const upstream of new Set(deps.map((d) => d.service))) {
    const owner = path.join('dependencies', upstream);
    if (!declared.has(upstream)) found.push(violation('sections', owner, '缺依赖声明'));
    found.push(...checkDomainDup(owner, deps.filter((d) => d.service === upstream).map((d) => d.domain)));
  }
  // 还没拆成域卡的单文件卡：它的业务域就是那些固定小节之外的 `## ` 小节，同样查近似重复。
  for (const card of maps) {
    if (services.has(card.service)) continue;
    const extra = Object.keys(card.sections).filter((n) => !MAP_REQUIRED.includes(n) && !MAP_OPTIONAL.includes(n));
    found.push(...checkDomainDup(path.join('cards', `${card.service}.md`), extra));
  }
  found.push(...checkRegistry(ctxDir));
  return { cards: maps.length + domains.length + deps.length, violations: [...new Set(found)].sort() };
}

/** 基线文件在、但读不出或格式不对。MUST NOT 当成空基线继续：那等于把存量违规全判成新增，或把新增全放过。 */
export class BaselineError extends Error {}

/** @returns {string[]|null} 基线里的违规；文件不存在返回 null；读不出抛 BaselineError */
export function readBaseline(ctxDir) {
  const file = path.join(ctxDir, BASELINE_FILE);
  if (!fs.existsSync(file)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new BaselineError(`${file} 读不出来（${err.message}）`);
  }
  if (!data || !Array.isArray(data.violations)) throw new BaselineError(`${file} 格式不对：缺 violations 数组`);
  return data.violations.map(String);
}

export function writeBaseline(ctxDir, violations) {
  const body = { version: 1, violations: [...new Set(violations)].sort() };
  fs.writeFileSync(path.join(ctxDir, BASELINE_FILE), `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}

/**
 * 与基线比对。
 * @returns {{cards:number, violations:string[], fresh:string[], fixed:string[], hasBaseline:boolean}}
 *   fresh = 不在基线里的违规（判红）；fixed = 基线里已不再出现的条目（可 --prune-baseline 移除）
 */
export function compareWithBaseline(ctxDir) {
  const { cards, violations } = lintCards(ctxDir);
  const base = readBaseline(ctxDir);
  const baseSet = new Set(base ?? []);
  const nowSet = new Set(violations);
  return {
    cards,
    violations,
    fresh: violations.filter((v) => !baseSet.has(v)),
    fixed: [...baseSet].filter((v) => !nowSet.has(v)).sort(),
    hasBaseline: base !== null,
  };
}

const RULE_HINT = {
  sections: '小节名固定：域卡与依赖仓事实卡 = 职责 / 权威实现与对外接口 / 陷阱项 / 确认（可加 测试入口、日志与排障、端侧补充）；地图卡 = 职责 / 业务域地图（可加 对外入口总览、跨域陷阱、上下游、测试入口、日志与排障、确认）。有 cards/<repo>/ 就要有同名地图卡，有 dependencies/<上游名>/ 就要有同名依赖声明',
  budget: `体积上限：地图卡 ${BUDGET.map}、域卡 ${BUDGET.domain}、registry 单格 ${BUDGET.registryCell} 字节。先把来历搬走，再按业务域拆`,
  'dated-heading': '卡片只写现状：带日期的小节是变更流水，搬去变更日志、bug 修复历史或决策记录；〈确认〉只留一行',
  unreadable: '卡片文件读不出来（权限或编码）：修好再检，读不出的卡不参与其余规则',
  cite: 'cite 解析不到：路径不存在、`#符号` 在该文件里检索不到，或 `:行` 超过文件行数',
  'domain-dup': '同一仓库里两个域名近似重复：合并，或在地图卡里把边界写清后改名',
  'registry-pointer': 'registry 里的 cards/…​.md 指针指向不存在的文件',
  'trap-noise': '〈陷阱项〉只放陷阱：`ctx` 把本节逐行当成误用警告，"仍在维护"一类的话会变成假警告',
};

/**
 * 首次体检时给的拆分建议：超限、或带着固定小节之外的 `## ` 小节的单文件卡，这些小节各自搬成一张域卡。
 * @returns {{card:string, sections:string[]}[]}
 */
export function splitSuggestions(ctxDir) {
  const withDomains = new Set(loadDomainCards(ctxDir).map((d) => d.service));
  return loadCards(ctxDir)
    .filter((card) => !withDomains.has(card.service))
    .map((card) => ({
      card: posix(card.path),
      sections: Object.keys(card.sections).filter((n) => !MAP_REQUIRED.includes(n) && !MAP_OPTIONAL.includes(n)),
    }))
    .filter((s) => s.sections.length);
}

/** 人读输出。 */
export function formatReport(r) {
  // 一张卡都没有、registry 却有违规（起步态只填了 registry 的项目）：照常往下打印，不能只说"没有卡片可检"却退出 1。
  if (r.cards === 0 && r.violations.length === 0) return '没有卡片可检（engineering-context/cards/ 不存在或为空）。';
  const lines = [`已检 ${r.cards} 张卡：违规 ${r.violations.length} 条，其中基线内 ${r.violations.length - r.fresh.length} 条、新增 ${r.fresh.length} 条。`];
  if (r.fresh.length) {
    lines.push('', '🛑 新增违规（MUST 修掉；基线不接受新增）：');
    const byRule = new Map();
    for (const v of r.fresh) {
      const rule = v.split('|', 1)[0];
      if (!byRule.has(rule)) byRule.set(rule, []);
      byRule.get(rule).push(v);
    }
    for (const [rule, items] of byRule) {
      lines.push(`  [${rule}] ${RULE_HINT[rule] || ''}`);
      for (const v of items) {
        const [, file, key] = v.split('|');
        lines.push(`    - ${file}${key ? `  ← ${key}` : ''}`);
      }
    }
  }
  if (r.fixed.length) {
    lines.push('', `✅ 基线里有 ${r.fixed.length} 条已修掉，跑 \`ctx lint-cards --prune-baseline\` 把它们移出基线：`);
    for (const v of r.fixed) lines.push(`    - ${v}`);
  }
  if (!r.hasBaseline && r.fresh.length) {
    lines.push('', '存量卡片第一次体检？跑 `ctx lint-cards --init-baseline` 把现有违规记为基线，之后只许减不许增。');
  }
  if (!r.fresh.length && !r.fixed.length) lines.push('✅ 没有新增违规。');
  return lines.join('\n');
}
