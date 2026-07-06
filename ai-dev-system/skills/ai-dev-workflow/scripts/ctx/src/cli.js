#!/usr/bin/env node
// cli.js — ctx 命令行入口。跨平台：全程用 path，输出 UTF-8。
import path from 'node:path';
import process from 'node:process';
import {
  discover,
  getCard,
  findScenes,
  listServices,
  initScaffold,
} from './commands.js';

/** 从 argv 解析 --dir 选项与位置参数。 */
function parseArgs(argv) {
  const positional = [];
  let dir = null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') {
      dir = argv[++i];
    } else if (a === '--json') {
      json = true;
    } else {
      positional.push(a);
    }
  }
  return { positional, dir, json };
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
  ctx search-semantic "<q>"                  ⏳ 未实现（见 README 设计章节）
  ctx probe                                  ⏳ 未实现（见 README 设计章节）

选项：--dir 指定 engineering-context 目录（默认 <cwd>/engineering-context）；--json 输出 JSON。
每条来自 card 的事实带 cite（path#anchor @确认时间）。`;

function main() {
  const { positional, dir, json } = parseArgs(process.argv.slice(2));
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
      const human = r.length ? r.map((s) => `• ${s.scene} (score ${s.score}) — ${s.path}`).join('\n') : '（无匹配场景，或无 scenes/ 目录）';
      out(json, human, r);
      return 0;
    }
    case 'list-services': {
      const r = listServices(ctxDir);
      const human = r.length ? r.map((s) => `• ${s.service}${s.capabilities.length ? '  能力：' + s.capabilities.join('、') : ''}`).join('\n') : '（无已登记服务）';
      out(json, human, r);
      return 0;
    }
    case 'search-semantic':
    case 'probe': {
      console.log(`⏳ 未实现：\`${cmd}\`。设计见 scripts/ctx/README.md 与 references/company/context-engineering.md。`);
      return 0;
    }
    default:
      console.error(`未知命令：${cmd}\n\n${HELP}`);
      return 2;
  }
}

process.exit(main());
