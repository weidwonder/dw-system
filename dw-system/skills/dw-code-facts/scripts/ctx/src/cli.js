#!/usr/bin/env node
// cli.js — ctx 命令行入口。跨平台：全程用 path，输出 UTF-8。
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  discover,
  getCard,
  findScenes,
  listServices,
  initScaffold,
  originTag,
} from './commands.js';
import { loadAllCards, loadRegistry, diagnoseRegistry, unreadableCards, UNDECLARED_FRESHNESS } from './cards.js';
import { searchSemantic } from './semantic.js';
import { loadProbes, evaluateGate, readHistory, writeHistory } from './probe.js';
import { BASELINE_FILE, BaselineError, compareWithBaseline, formatReport, readBaseline, splitSuggestions, writeBaseline } from './lint.js';

// registry 解析不出数据行时的提示：每种原因对应一个完全不同的修复动作，MUST 分开报。
const REGISTRY_EMPTY_HINT = {
  'no-dir': null,   // 由 ctxDirMissingHint 生成（要把解析后的绝对路径写进提示里）
  'no-file': '（没有 capability-registry.md；跑 `ctx init` 建骨架，卡片层的内容按任务渐进补齐）',
  unreadable: '（capability-registry.md 读不出来；按无已登记条目处理，请检查文件权限与编码）',
  'no-header':
    '（registry 里有表格，但没有一张表的首列被识别为能力列 → 整张表被忽略；首列表头请写 Capability 或「能力」）',
  'no-separator':
    '（registry 的表头认出来了，但它下一行不是分隔行 → 整张表被忽略；表头下面补一行 |---|---|（每格至少一个 -））',
  'placeholder-only': '（registry 只有模板占位行（含【】）；这是正常起步态，补一行真实数据即被登记）',
  'no-row': '（无已登记服务/能力；registry 尚无真实数据行，这是正常起步态，不是这层不可用）',
};

/**
 * engineering-context 目录本身不存在时的提示。**MUST 与"registry 还没填过"分开报**：
 * 实测 `--dir <打错字的路径>` 与"这个项目的 registry 还没填过"的输出一字不差、退出码都是 0，
 * 于是使用者（尤其是 agent）据此判定"本项目没有卡片层"并退回裸 grep——而真相只是路径写错了。
 * 提示里 MUST 写**解析后的绝对路径**：相对路径看不出 ctx 到底去哪儿找了。
 */
function ctxDirMissingHint(ctxDir) {
  return `（${ctxDir} 不存在：确认 --dir，或确认是否在项目根运行（ctx 默认读 \`<cwd>/engineering-context\`））`;
}

/**
 * "为什么是空的"——诊断码 + 人读提示。结果非空时不诊断（`ok` / 无提示）。
 * **MUST 同时进 --json**：人读那一路精心区分了目录不存在 / 表头写错 / 只有占位行，
 * CI 那一路却一律拿到 `[]`——`cli.js` 自己为 probe 的 `skipped` 写过同一条理由：
 * "一道题都没跑"长得和"全部通过"一模一样，静默的空结果就是假绿。
 */
function emptyDiagnosis(ctxDir) {
  const code = diagnoseRegistry(ctxDir);
  const hint = code === 'no-dir'
    ? ctxDirMissingHint(ctxDir)
    : REGISTRY_EMPTY_HINT[code] || REGISTRY_EMPTY_HINT['no-row'];
  return { diagnosis: code, hint };
}

/** 用法错误：由 main 捕获 → 打到 stderr 并退出 2。 */
class UsageError extends Error {}

/**
 * 取带值选项的值。缺值或误吞下一个选项 MUST 报错，MUST NOT 静默兜底：
 * `ctx list-services --dir`（--dir 在末尾）旧实现拿到 undefined 后回落到
 * `<cwd>/engineering-context` 并 exit 0——用户以为查的是自己指定的目录，实际查的是别处。
 */
function takeValue(argv, i, name) {
  const v = argv[i];
  if (v === undefined) throw new UsageError(`${name} 需要一个值`);
  if (v.startsWith('--')) throw new UsageError(`${name} 需要一个值，却读到选项 ${v}`);
  return v;
}

/**
 * 取带数值选项的值。非数字 MUST 报错，MUST NOT 变成 NaN：
 * `--top abc` 旧实现走到 `slice(0, NaN)` → 输出"（无语义命中）"，一个**错误结论**——
 * 用户会以为 context 层里真没有这条，而不是自己参数写错了。
 */
function takeNumber(argv, i, name, { min = 0, integer = false } = {}) {
  const raw = takeValue(argv, i, name);
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new UsageError(`${name} 需要一个数字，实得「${raw}」`);
  if (integer && !Number.isInteger(n)) throw new UsageError(`${name} 需要整数，实得「${raw}」`);
  if (n < min) throw new UsageError(`${name} 需要 ≥${min} 的数字，实得「${raw}」`);
  return n;
}

/** 从 argv 解析选项与位置参数。 */
function parseArgs(argv) {
  const positional = [];
  const opts = { dir: null, json: false, asOf: null, staleDays: 90, top: 5, minimal: false, initBaseline: false, pruneBaseline: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') opts.dir = takeValue(argv, ++i, '--dir');
    else if (a === '--json') opts.json = true;
    else if (a === '--minimal') opts.minimal = true;
    else if (a === '--init-baseline') opts.initBaseline = true;
    else if (a === '--prune-baseline') opts.pruneBaseline = true;
    else if (a === '--as-of') opts.asOf = takeValue(argv, ++i, '--as-of');
    else if (a === '--stale-days') opts.staleDays = takeNumber(argv, ++i, '--stale-days', { min: 0 });
    else if (a === '--top') opts.top = takeNumber(argv, ++i, '--top', { min: 1, integer: true });
    else positional.push(a);
  }
  return { positional, ...opts };
}

function resolveCtxDir(dir) {
  if (dir) return path.resolve(dir);
  return path.join(process.cwd(), 'engineering-context');
}

/** 未声明 freshness 的条目在人读输出里必须显式标注——不假定新鲜。 */
function freshnessNote(item) {
  return item.freshnessDeclared === false
    ? '\n    ⚠ 未声明新鲜度：该条未登记确认时间，用前 MUST 回源码确认，勿当作新鲜事实。'
    : '';
}

function out(json, human, data) {
  if (json) console.log(JSON.stringify(data, null, 2));
  else console.log(human);
}

const HELP = `ctx — Engineering Context CLI

用法：
  ctx init [--minimal] [--dir <目标目录>]    在目标下生成 engineering-context/ 骨架
                                             --minimal 只生成 capability-registry.md + .gitignore（手工先落几行 registry 时用；初始化一律跑完整形态）
  ctx discover "<意图>" [--dir <ctx目录>]    意图 → 应加载的 card 清单 + out-of-scope
  ctx get-card <repo> [域] [--dir <ctx目录>]  取某仓地图卡；给了域先读域卡 cards/<repo>/<域>.md，没有才读地图卡里的同名段落
  ctx find-scenes <关键词...> [--dir <ctx目录>]  端到端业务场景
  ctx list-services [--dir <ctx目录>]         列出已登记服务/能力
  ctx search-semantic "<q>" [--top N]        discover 未命中时的语义兜底（本地向量相似）
                          [--as-of YYYY-MM-DD] [--stale-days N]
  ctx lint-cards [--init-baseline | --prune-baseline]
                                             卡片体检：固定小节、体积、带日期的小节名、cite 能否解析、
                                             域名近似重复、registry 指针、陷阱项噪音。新增违规退出 1
  ctx probe [--json]                         跑 Frozen Probe Set 防腐门禁（含自检+棘轮）
                                             题型：capability-mapping / deprecated-trap（读 context 层）、
                                             requirement-reachable / architecture-reachable /
                                             implementation-usable / rationale-traceable / authority-unique（读项目自身文件）

选项：--dir 指定 engineering-context 目录（默认 <cwd>/engineering-context）；--json 输出 JSON。
--dir 只改 engineering-context 的位置，不改项目根：probe 的交接题型按**运行目录（cwd）**当项目根。
（例外：ctx init 的 --dir 指的是目标项目目录，在它下面生成 engineering-context/。）
registry 最小合法 schema：Capability / 权威实现 / 陷阱项（废弃或中间产物）三列；其余列可缺，缺列跳过不报错。
没写 freshness 的条目输出标注「未声明新鲜度」——不假定新鲜，用前回源码确认。
search-semantic：--as-of 启用 freshness 降权（过期块标 stale 并 ×0.5）。
probe 退出码：GREEN / AMBER → 0；RED / GATE-BROKEN / NO-PROBE → 1（供 CI 门禁）。
NO-PROBE = 一道未暂停的探针都没跑（题集空 / 全占位 / 全暂停）——"没有题目所以全绿"是假门禁，判不通过。
每条来自 card 的事实带 cite（path#anchor @确认时间）。`;

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    console.error(`用法错误：${e.message}\n\n${HELP}`);
    return 2;
  }
  const { positional, dir, json, asOf, staleDays, top, minimal, initBaseline, pruneBaseline } = parsed;
  const cmd = positional[0];

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return 0;
  }

  // init 用目标目录（不是 ctx 目录）
  if (cmd === 'init') {
    const target = dir ? path.resolve(dir) : process.cwd();
    const { base, files } = initScaffold(target, { minimal });
    const human = minimal
      ? [
          `✅ 已生成最小 registry 骨架：${path.join(base, 'capability-registry.md')}`,
          `   同时生成 ${path.join(base, '.gitignore')}（忽略 .index/ 机器状态，不入库）。`,
          '下一步：填三列（Capability / 权威实现 / 陷阱项），一行一条权威事实——三行即可起步。',
          '缺列不影响 ctx discover；没写 freshness 的条目会被标注「未声明新鲜度」。',
          '只剩模板行是正常起步态。cards/ 与 probe-set 等按需再用 `ctx init` 补齐。',
        ].join('\n')
      : `✅ 已生成 Engineering Context 骨架：${base}\n下一步：不用一次填满——要用哪个模块的事实就补哪个模块的 card 与 registry 行（见 references/代码事实纪律.md §4）。\n（只想先落一份 registry？用 \`ctx init --minimal\`。）`;
    out(json, human, { base, files, minimal });
    return 0;
  }

  const ctxDir = resolveCtxDir(dir);

  switch (cmd) {
    case 'discover': {
      const r = discover(ctxDir, positional.slice(1).join(' '));
      const blocks = [];
      if (r.capabilities.length) {
        blocks.push(r.capabilities.map((c) => {
          const canonical = c.canonical || '（未填权威实现）';
          return `• 能力「${c.capability}」→ 权威实现：${canonical}  (score ${c.score})\n    ${c.cite}${freshnessNote(c)}`;
        }).join('\n'));
      }
      if (r.cards.length) {
        blocks.push(r.cards.map((c) => `• ${originTag(c.origin)}${c.domain ? `${c.service} › ${c.domain}` : c.service}  (score ${c.score}) — ${c.why}\n    ${c.cite}${freshnessNote(c)}`).join('\n'));
      }
      if (r.outOfScope.length) blocks.push(`out-of-scope：\n- ${r.outOfScope.join('\n- ')}`);
      const hit = r.capabilities.length || r.cards.length;
      const d = hit ? { diagnosis: 'ok', hint: null } : emptyDiagnosis(ctxDir);
      if (d.hint) blocks.push(d.hint);
      out(json, blocks.length ? blocks.join('\n\n') : '（无命中）', { ...r, ...d });
      return 0;
    }
    case 'get-card': {
      const [, service, domain] = positional;
      if (!service) { console.error('用法：ctx get-card <repo> [域]'); return 2; }
      const c = getCard(ctxDir, service, domain);
      if (!c) {
        console.error(`未找到服务 card：${service}`);
        if (!fs.existsSync(ctxDir)) console.error(ctxDirMissingHint(ctxDir));
        return 1;
      }
      // 段落不存在 → **不发 cite**，退出 1。发一条锚点不存在的 cite 等于给幻觉发通行证
      // （体系铁律：无 cite 视为幻觉，那么假 cite 比无 cite 更糟）；退出 0 则让脚本与 agent
      // 把"这个段落不存在"读成"取到了"。
      if (c.missing) {
        out(json, `${c.content}\n\n（该段落不存在，因此不发 cite；换用上面列出的段落名重试）`,
          { ...c, diagnosis: 'section-not-found' });
        return 1;
      }
      // 名字同时命中产品仓与依赖侧时产品仓优先，但另一侧 MUST NOT 被静默吞掉：
      // 不提示的话，调用方拿到的"这个名字的全部事实"其实只有一半，而它无从知道。
      const alsoDep = c.alsoDependency ? `\n（另有同名依赖声明：dependencies/${service}.md）` : '';
      out(json, `${c.content}\n\n${c.cite}${alsoDep}`, { ...c, diagnosis: 'ok' });
      return 0;
    }
    case 'find-scenes': {
      const r = findScenes(ctxDir, positional.slice(1));
      let human;
      let diagnosis = 'ok';
      if (r.length) {
        human = r.map((s) => `• ${s.scene} (score ${s.score}) — ${s.path}`).join('\n');
      } else if (!fs.existsSync(ctxDir)) {
        diagnosis = 'no-dir';
        human = ctxDirMissingHint(ctxDir);
      } else if (!fs.existsSync(path.join(ctxDir, 'scenes'))) {
        // 文案 MUST 保持中性、MUST NOT 在这里催用户建资产：scenes/ 为空是正常起步态，
        // 补场景蓝图的建议有自己的时机（代码事实纪律.md §3：确实跨服务时顺手补）。
        // 同样 MUST NOT 替调用方决定下一步（"本次改用 …"）：这行同时说给 agent 和直接敲命令的
        // 人看，后者没有"本次"这个上下文，被 CLI 通知自己刚做了个没做过的决定只会让人困惑。
        // 只陈述事实，把去向写成**可选项**，选不选由调用方定。
        diagnosis = 'no-scenes-dir';
        human = '（scenes/ 目录不存在：本项目尚未建场景层；需要收窄范围时用 `ctx discover "<意图>"`）';
      } else {
        diagnosis = 'no-match';
        human = '（无匹配场景：换关键词重试，或该场景尚未有蓝图）';
      }
      // --json 同样 MUST 带诊断：`[]` 无法区分"没建场景层"与"建了但没匹配上"。
      out(json, human, { scenes: r, diagnosis, hint: diagnosis === 'ok' ? null : human });
      return 0;
    }
    case 'list-services': {
      const r = listServices(ctxDir);
      const d = r.length ? { diagnosis: 'ok', hint: null } : emptyDiagnosis(ctxDir);
      const lines = r.map((s) => {
        const name = s.service || '（未登记权威仓库的能力）';
        const caps = s.capabilities.length ? `  能力：${s.capabilities.join('、')}` : '';
        const domains = s.domains && s.domains.length ? `  域：${s.domains.join('、')}` : '';
        return `• ${name}${domains}${caps}${s.hasCard ? '' : '  [无 card，仅 registry 登记]'}`;
      });
      if (!lines.length) lines.push(d.hint);
      // 读不出来的 card MUST 报出来：loadCards 静默跳过它们，不报的话使用者会把
      // "这张卡读不出来"读成"这个仓没登记"，照着后者永远修不好。
      // 它与 registry 的诊断是**两件事**，MUST 都打印：只打印其中一条时，另一条的修复动作就丢了。
      const bad = unreadableCards(ctxDir);
      if (bad.length) lines.push(`⚠ ${bad.length} 张 card 读不出来（已跳过）：${bad.join('、')}——请检查文件权限与编码。`);
      out(json, lines.join('\n'), { services: r, unreadableCards: bad, ...d });
      return 0;
    }
    case 'search-semantic': {
      const q = positional.slice(1).join(' ');
      if (!q) { console.error('用法：ctx search-semantic "<query>" [--top N] [--as-of YYYY-MM-DD] [--stale-days N]'); return 2; }
      const r = searchSemantic(ctxDir, q, { top, asOf, staleDays });
      const human = r.results.length
        ? r.results.map((x) => {
            const staleFlag = x.stale ? (x.freshness === UNDECLARED_FRESHNESS ? `⏳${UNDECLARED_FRESHNESS}` : '⏳过期') : '';
            const flags = [x.authority === 'deprecated' ? '⚠已废弃' : 'canonical', staleFlag].filter(Boolean).join(' ');
            return `• ${originTag(x.origin)}${x.domain ? `${x.service}/${x.domain}` : x.service} › ${x.section}  (${x.score}) [${flags}]\n    ${x.cite}`;
          }).join('\n')
        : '（无语义命中）';
      out(json, `${human}\n\n提示：\n- ${r.note.join('\n- ')}`, r);
      return 0;
    }
    case 'probe': {
      const cards = loadAllCards(ctxDir);
      const registry = loadRegistry(ctxDir);
      const { probes, baseline, skipped, baselineUnparsed } = loadProbes(ctxDir);
      // MUST 把已解析的 ctxDir 传下去：不传的话 B 类交接题型会退回 <cwd>/engineering-context 兜底，
      // 而 A 类题型读的是 --dir 指定的目录——同一次 probe 里两类题看两份不同的 registry，
      // 于是 --dir 下 list-services 认得出已登记条目、implementation-usable 却看不到它。
      const ev = evaluateGate(cards, registry, probes, baseline, { floor: 0.9, ctxDir });
      const prev = readHistory(ctxDir);
      const delta = prev && ev.passRate != null ? Number((ev.passRate - prev.passRate).toFixed(4)) : null;
      // `skipped` MUST 进 --json：人读输出早就提示"跳过 N 条占位行"，CI 读的那一路却看不到，
      // 于是"一道题都没跑"在流水线里长得和"全部通过"一模一样。
      const report = { ...ev, skipped, baselineUnparsed, prevPassRate: prev ? prev.passRate : null, passRateDelta: delta };

      const icon = { GREEN: '✅', AMBER: '🟡', RED: '🛑', 'GATE-BROKEN': '🛑', 'NO-PROBE': '🛑' }[ev.verdict] || '?';
      const lines = [];
      lines.push(`门禁自检：${ev.selfCheck.ok ? '✅ 有效' : '🛑 失效'} — ${ev.selfCheck.reason}`);
      if (skipped.length) {
        lines.push(`ℹ️  跳过 ${skipped.length} 条模板占位行（#${skipped.join(' #')}）：把 【…】 换成真实题目才会计入门禁。`);
      }
      // 没解析出来的基线行 MUST 显式报出：否则它表现为"新增失败 #N"，
      // 人会去查探针为什么失败，而真正的原因是这条基线压根没被读进来（假 RED）。
      if (baselineUnparsed.length) {
        lines.push(
          `⚠️  基线段有 ${baselineUnparsed.length} 行像编号却没被解析（编号 MUST 独立成行，不能夹在句子里）：\n` +
            baselineUnparsed.map((l) => `     ${l}`).join('\n'),
        );
      }
      if (ev.verdict === 'GATE-BROKEN') {
        lines.push('🛑 GATE-BROKEN：门禁自检未通过，拒绝出具结论（流水线应红）。');
      } else if (ev.verdict === 'NO-PROBE') {
        lines.push(
          '🛑 NO-PROBE：一道未暂停的探针都没跑（题集为空 / 全是 【…】 占位行 / 全被 needs-reconfirm 暂停）。'
          + '\n"没有题目所以全绿"正是假门禁，因此判不通过（退出 1）。'
          + '\n下一步：把 probe-set.md 的占位行换成真实题目——三道就够起步。',
        );
      } else {
        for (const r of ev.results) {
          const inBase = baseline.has(String(r.n));
          lines.push(`  ${r.pass ? '✅' : (inBase ? '🟡' : '🛑')} #${r.n} [${r.type}] ${r.input}` + (r.pass ? '' : `\n       期望：${r.expected}\n       实得：${r.actual}` + (inBase ? '（基线容忍）' : '（新增失败）')));
        }
        // passRate 为 null = 本轮没有 scored 题（可以全是 blocking 且全过）。
        // MUST NOT 让 null 参与算术：`null * 100` 是 0，会打出"GREEN 加权通过率 0%"这种自相矛盾的行。
        const rate = ev.passRate == null
          ? '—（本轮无计分题，仅 blocking）'
          : `${(ev.passRate * 100).toFixed(0)}%` + (delta != null ? `（较上周期 ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}%）` : '');
        lines.push(`\n判级：${icon} ${ev.verdict}  加权通过率 ${rate}`);
        if (ev.newFailures.length) lines.push(`RED 原因：新增失败 #${ev.newFailures.map((r) => r.n).join(', #')}`);
        if (ev.blockingFailures.length) lines.push(`RED 原因：blocking 探针失败（零容忍）#${ev.blockingFailures.map((r) => r.n).join(', #')}`);
        if (ev.staleBaseline.length) lines.push(`RED 原因：基线 #${ev.staleBaseline.join(', #')} 已不再失败，必须从基线删除（棘轮只许变短）。`);
        if (ev.belowFloor) lines.push(`RED 原因：加权通过率 ${(ev.passRate * 100).toFixed(0)}% 低于地板 ${(ev.floor * 100).toFixed(0)}%。`);
        if (ev.needsReconfirm.length) lines.push(`⚠ ${ev.needsReconfirm.length} 道探针 needs-reconfirm/quarantined（权威面已变，暂不计分，待重认）。`);
        if (ev.verdict === 'AMBER' && ev.canTightenBaseline) lines.push('棘轮：当前失败数少于基线，可收紧基线（只许变短）。');
      }
      out(json, lines.join('\n'), report);

      // 写本周期通过率供下次算衰减（时间戳由此处注入，核心逻辑不依赖时钟）
      if (ev.passRate != null) writeHistory(ctxDir, ev.passRate, new Date().toISOString());
      return ev.verdict === 'GREEN' || ev.verdict === 'AMBER' ? 0 : 1;
    }
    case 'lint-cards': {
      if (initBaseline && pruneBaseline) { console.error('用法错误：--init-baseline 与 --prune-baseline 不能同时给'); return 2; }
      let r;
      try {
        r = compareWithBaseline(ctxDir);
      } catch (err) {
        if (!(err instanceof BaselineError)) throw err;
        console.error(`基线损坏：${err.message}。MUST NOT 删掉重建——从版本库恢复它，或修好 JSON 后重跑。`);
        return 2;
      }
      if (initBaseline) {
        // 已有基线时拒绝：重写基线等于把新违规一笔勾销。
        if (r.hasBaseline) { console.error(`${BASELINE_FILE} 已存在，拒绝覆盖。基线只许变短：用 --prune-baseline。`); return 2; }
        writeBaseline(ctxDir, r.violations);
        const split = splitSuggestions(ctxDir);
        const lines = [`已写出基线 ${BASELINE_FILE}：${r.violations.length} 条存量违规。之后只许减不许增。`];
        if (split.length) {
          lines.push('', '按业务域拆分的建议（每个小节搬成 cards/<repo>/<域>.md，原文件留〈职责〉与〈业务域地图〉）：');
          for (const s of split) lines.push(`  ${s.card}：${s.sections.join('、')}`);
        }
        out(json, lines.join('\n'), { baseline: r.violations, split });
        return 0;
      }
      if (pruneBaseline) {
        const base = readBaseline(ctxDir) ?? [];
        const kept = base.filter((v) => !r.fixed.includes(v));
        if (r.hasBaseline) writeBaseline(ctxDir, kept);
        out(json, `已从基线移除 ${base.length - kept.length} 条已修掉的条目，剩 ${kept.length} 条。`, { removed: r.fixed, baseline: kept });
        return 0;
      }
      out(json, formatReport(r), r);
      return r.fresh.length ? 1 : 0;
    }
    default:
      console.error(`未知命令：${cmd}\n\n${HELP}`);
      return 2;
  }
}

// MUST 用 process.exitCode 而不是 process.exit()：console.log 写**管道**是异步的，
// process.exit() 会立刻终止进程并丢掉未 flush 的部分。实测 400KB 的 `get-card --json`
// 重定向到文件是完整的 400101 字节，经管道只剩 65536 字节且退出码仍为 0——
// README 教的 `ctx probe --json | jq` 这类 CI 用法会拿到"截断后的合法前缀"，静默出错。
// 设 exitCode 后让 Node 自然退出，stdout 会被 flush 完；退出码语义不变。
/**
 * 兜底：任何没被上面各层接住的异常 MUST NOT 以 Node 栈的形式出现。
 * 栈对使用者（尤其是 agent）只有一个含义——"ctx 坏了"，于是退回裸 grep，
 * 而这正是本层要消灭的行为。转成一句可行动的中文提示 + 固定退出码 1。
 */
function run() {
  try {
    return main();
  } catch (e) {
    console.error(
      `ctx 运行失败：${e && e.message ? e.message : e}\n`
      + '这不是"卡片层不可用"，MUST NOT 据此退回裸 grep。'
      + '先检查 engineering-context/ 下文件的权限与编码，再用 `--dir <绝对路径>` 重试；'
      + '仍失败就带上这行报错反馈给 skill 维护者。',
    );
    return 1;
  }
}

process.exitCode = run();
