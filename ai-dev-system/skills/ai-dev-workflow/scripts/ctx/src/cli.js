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
} from './commands.js';
import { loadCards, loadRegistry } from './cards.js';
import { searchSemantic } from './semantic.js';
import { loadProbes, evaluateGate, readHistory, writeHistory } from './probe.js';

/** 从 argv 解析选项与位置参数。 */
function parseArgs(argv) {
  const positional = [];
  const opts = { dir: null, json: false, asOf: null, staleDays: 90, top: 5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') opts.dir = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--as-of') opts.asOf = argv[++i];
    else if (a === '--stale-days') opts.staleDays = Number(argv[++i]);
    else if (a === '--top') opts.top = Number(argv[++i]);
    else positional.push(a);
  }
  return { positional, ...opts };
}

function resolveCtxDir(dir) {
  if (dir) return path.resolve(dir);
  return path.join(process.cwd(), 'engineering-context');
}

function out(json, human, data) {
  if (json) console.log(JSON.stringify(data, null, 2));
  else console.log(human);
}

const HELP = `ctx — Engineering Context CLI

用法：
  ctx init [--dir <目标目录>]                在目标下生成 engineering-context/ 骨架
  ctx discover "<意图>" [--dir <ctx目录>]    意图 → 应加载的 card 清单 + out-of-scope
  ctx get-card <repo> [域] [--dir <ctx目录>]  取某仓 card（可指定段落）
  ctx find-scenes <关键词...> [--dir <ctx目录>]  端到端业务场景
  ctx list-services [--dir <ctx目录>]         列出已登记服务/能力
  ctx search-semantic "<q>" [--top N]        discover 未命中时的语义兜底（本地向量相似）
                          [--as-of YYYY-MM-DD] [--stale-days N]
  ctx probe [--json]                         跑 Frozen Probe Set 防腐门禁（含自检+棘轮）

选项：--dir 指定 engineering-context 目录（默认 <cwd>/engineering-context）；--json 输出 JSON。
search-semantic：--as-of 启用 freshness 降权（过期块标 stale 并 ×0.5）。
probe 退出码：RED / GATE-BROKEN → 1（供 CI 门禁），GREEN / AMBER → 0。
每条来自 card 的事实带 cite（path#anchor @确认时间）。`;

function main() {
  const { positional, dir, json, asOf, staleDays, top } = parseArgs(process.argv.slice(2));
  const cmd = positional[0];

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return 0;
  }

  // init 用目标目录（不是 ctx 目录）
  if (cmd === 'init') {
    const target = dir ? path.resolve(dir) : process.cwd();
    const base = initScaffold(target);
    out(json, `✅ 已生成 Engineering Context 骨架：${base}\n下一步：按 context-engineering.md 填 capability-registry 与 cards/。`, { base });
    return 0;
  }

  const ctxDir = resolveCtxDir(dir);

  switch (cmd) {
    case 'discover': {
      const r = discover(ctxDir, positional.slice(1).join(' '));
      const human = r.cards.length
        ? r.cards.map((c) => `• ${c.service}  (score ${c.score}) — ${c.why}\n    ${c.cite}`).join('\n')
        : `（无命中）\n${r.outOfScope.join('\n')}`;
      out(json, human, r);
      return 0;
    }
    case 'get-card': {
      const [, service, domain] = positional;
      if (!service) { console.error('用法：ctx get-card <repo> [域]'); return 2; }
      const c = getCard(ctxDir, service, domain);
      if (!c) { console.error(`未找到服务 card：${service}`); return 1; }
      out(json, `${c.content}\n\n${c.cite}`, c);
      return 0;
    }
    case 'find-scenes': {
      const r = findScenes(ctxDir, positional.slice(1));
      let human;
      if (r.length) {
        human = r.map((s) => `• ${s.scene} (score ${s.score}) — ${s.path}`).join('\n');
      } else if (!fs.existsSync(path.join(ctxDir, 'scenes'))) {
        human = '（scenes/ 目录不存在：场景层尚未建立。按 scene-blueprint 模板生产蓝图落入 engineering-context/scenes/ 后方可检索）';
      } else {
        human = '（无匹配场景：换关键词重试，或该场景尚未有蓝图）';
      }
      out(json, human, r);
      return 0;
    }
    case 'list-services': {
      const r = listServices(ctxDir);
      const human = r.length ? r.map((s) => `• ${s.service}${s.capabilities.length ? '  能力：' + s.capabilities.join('、') : ''}`).join('\n') : '（无已登记服务）';
      out(json, human, r);
      return 0;
    }
    case 'search-semantic': {
      const q = positional.slice(1).join(' ');
      if (!q) { console.error('用法：ctx search-semantic "<query>" [--top N] [--as-of YYYY-MM-DD] [--stale-days N]'); return 2; }
      const r = searchSemantic(ctxDir, q, { top, asOf, staleDays });
      const human = r.results.length
        ? r.results.map((x) => {
            const flags = [x.authority === 'deprecated' ? '⚠已废弃' : 'canonical', x.stale ? '⏳过期' : ''].filter(Boolean).join(' ');
            return `• ${x.service} › ${x.section}  (${x.score}) [${flags}]\n    ${x.cite}`;
          }).join('\n')
        : '（无语义命中）';
      out(json, `${human}\n\n提示：\n- ${r.note.join('\n- ')}`, r);
      return 0;
    }
    case 'probe': {
      const cards = loadCards(ctxDir);
      const registry = loadRegistry(ctxDir);
      const { probes, baseline } = loadProbes(ctxDir);
      const ev = evaluateGate(cards, registry, probes, baseline, { floor: 0.9 });
      const prev = readHistory(ctxDir);
      const delta = prev && ev.passRate != null ? Number((ev.passRate - prev.passRate).toFixed(4)) : null;
      const report = { ...ev, prevPassRate: prev ? prev.passRate : null, passRateDelta: delta };

      const icon = { GREEN: '✅', AMBER: '🟡', RED: '🛑', 'GATE-BROKEN': '🛑' }[ev.verdict] || '?';
      const lines = [];
      lines.push(`门禁自检：${ev.selfCheck.ok ? '✅ 有效' : '🛑 失效'} — ${ev.selfCheck.reason}`);
      if (ev.verdict === 'GATE-BROKEN') {
        lines.push('🛑 GATE-BROKEN：门禁自检未通过，拒绝出具结论（流水线应红）。');
      } else {
        for (const r of ev.results) {
          const inBase = baseline.has(String(r.n));
          lines.push(`  ${r.pass ? '✅' : (inBase ? '🟡' : '🛑')} #${r.n} [${r.type}] ${r.input}` + (r.pass ? '' : `\n       期望：${r.expected}\n       实得：${r.actual}` + (inBase ? '（基线容忍）' : '（新增失败）')));
        }
        lines.push(`\n判级：${icon} ${ev.verdict}  加权通过率 ${(ev.passRate * 100).toFixed(0)}%` + (delta != null ? `（较上周期 ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}%）` : ''));
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
      return ev.verdict === 'RED' || ev.verdict === 'GATE-BROKEN' ? 1 : 0;
    }
    default:
      console.error(`未知命令：${cmd}\n\n${HELP}`);
      return 2;
  }
}

process.exit(main());
