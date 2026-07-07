#!/usr/bin/env node
// ai-dev-workflow 项目安装器（跨平台，零依赖）
//
// 作用：
//   1) 把 skills/ai-dev-workflow/ 复制进 <目标项目>/.claude/skills/ai-dev-workflow/
//   2) 在【本项目】级 settings 里禁用与本流程冲突的插件（覆盖用户级的 true，
//      只影响本项目；其他项目照常启用）
//
// 用法：
//   node ai-dev-system/install.mjs [目标目录] [选项]
//
// 选项：
//   --yes, -y          跳过交互确认
//   --shared           写入 .claude/settings.json（提交进 git，全仓协作者共享）
//                      默认写 .claude/settings.local.json（gitignored，仅影响你）
//   --keep=<key>       保留某个插件不禁用，可多次；key 用完整 name@marketplace 或短名
//   --no-plugins       只装 skill，不改任何 settings
//   --dry-run          只打印将做什么，不落盘
//   -h, --help         显示帮助
//
// 依据（Claude Code 官方 settings 文档）：
//   settings 优先级 Managed > Local(.claude/settings.local.json) > Project(.claude/settings.json) > User(~/.claude/settings.json)
//   enabledPlugins 在所有 scope 均可设 → 项目级 false 覆盖用户级 true = 仅本项目禁用。

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 与本流程冲突的插件：会抢流程、强制前置、或注入干扰 hook。
// key 是 enabledPlugins 里的完整标识 name@marketplace（按默认安装源）。
const CONFLICTS = [
  { key: 'superpowers@claude-plugins-official',            reason: 'brainstorming HARD-GATE 与 using-superpowers 强制前置，会截胡本流程的 Triage/直接实现' },
  { key: 'everything-claude-code@everything-claude-code',  reason: 'plan/tdd/coding-standards 与本流程重叠 + SessionStart hook 注入' },
  { key: 'oh-my-claudecode@omc',                           reason: 'autopilot/ralph/ultrawork 等端到端引擎替代本流程 + agents-overlay hook' },
  { key: 'general-task@local-plugins',                     reason: 'SessionStart 注入 clarify→plan→execute + using-general-task 强制前置（未在你点名清单里，如需保留用 --keep=general-task）' },
];

function parseArgs(argv) {
  const opt = { yes: false, shared: false, keep: [], noPlugins: false, dryRun: false, help: false, target: null };
  for (const a of argv) {
    if (a === '--yes' || a === '-y') opt.yes = true;
    else if (a === '--shared') opt.shared = true;
    else if (a === '--no-plugins') opt.noPlugins = true;
    else if (a === '--dry-run') opt.dryRun = true;
    else if (a === '-h' || a === '--help') opt.help = true;
    else if (a.startsWith('--keep=')) opt.keep.push(a.slice('--keep='.length));
    else if (a.startsWith('-')) { console.error(`未知选项: ${a}`); process.exit(2); }
    else opt.target = a;
  }
  return opt;
}

function helpText() {
  return `ai-dev-workflow 项目安装器

用法：
  node ai-dev-system/install.mjs [目标目录] [选项]

选项：
  --yes, -y        跳过交互确认
  --shared         写 .claude/settings.json（提交进 git，全仓共享禁用）
                   默认写 .claude/settings.local.json（gitignored，仅影响你）
  --keep=<key>     保留某插件不禁用（短名或 name@marketplace），可多次
  --no-plugins     只装 skill，不动 settings
  --dry-run        预演，不落盘
  -h, --help       本帮助

默认在目标项目里禁用这些与本流程冲突的插件（仅本项目，不影响全局）：
${CONFLICTS.map(c => '  - ' + c.key).join('\n')}`;
}

// key 匹配：允许用短名（@ 前半段）命中
function isKept(key, keepList) {
  const short = key.split('@')[0];
  return keepList.some(k => k === key || k === short);
}

function readJSON(file) {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch (e) {
    console.error(`\n✗ 无法解析已存在的 ${file}：${e.message}`);
    console.error('  为避免破坏你的配置，安装已中止。请修复该文件的 JSON 后重试。');
    process.exit(1);
  }
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (opt.help) { console.log(helpText()); return; }

  const srcSkill = path.join(__dirname, 'skills', 'ai-dev-workflow');
  if (!fs.existsSync(path.join(srcSkill, 'SKILL.md'))) {
    console.error(`✗ 找不到源 skill：${srcSkill}\n  请在 ai-dev-system 仓库内运行本脚本。`);
    process.exit(1);
  }

  const target = path.resolve(opt.target || process.cwd());
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.error(`✗ 目标目录不存在：${target}`);
    process.exit(1);
  }

  const destSkill = path.join(target, '.claude', 'skills', 'ai-dev-workflow');
  const settingsFile = path.join(target, '.claude', opt.shared ? 'settings.json' : 'settings.local.json');
  const toDisable = opt.noPlugins ? [] : CONFLICTS.filter(c => !isKept(c.key, opt.keep));

  // 计划
  console.log('\nai-dev-workflow 安装器');
  console.log('目标项目：' + target);
  console.log('\n将执行：');
  console.log(`  1) 复制 skill → ${path.relative(target, destSkill) || destSkill}` +
              (fs.existsSync(destSkill) ? '  (已存在，将覆盖)' : ''));
  if (toDisable.length) {
    const scopeNote = opt.shared ? '提交进 git，全仓协作者共享' : 'gitignored，仅影响你本机';
    console.log(`  2) 在本项目禁用以下冲突插件 → ${path.relative(target, settingsFile)}  (${scopeNote})：`);
    for (const c of toDisable) console.log(`       - ${c.key}\n           ↳ ${c.reason}`);
  } else {
    console.log('  2) 不修改任何插件设置' + (opt.noPlugins ? '（--no-plugins）' : '（全部 --keep）'));
  }
  console.log('\n  ⚠ 提示：');
  console.log('     · 项目级 .claude/settings.json 首次打开会弹 workspace trust 对话框，信任后才生效。');
  console.log('     · settings 改动在【下次启动 Claude Code】时生效，非当前会话。');
  console.log('     · 全局（其他项目）不受影响。撤销：删掉本项目 settings 里对应的 false 条目即可。');
  if (opt.dryRun) { console.log('\n[--dry-run] 未做任何改动。'); return; }

  if (!opt.yes) {
    const ans = (await ask('\n继续？[y/N] ')).trim().toLowerCase();
    if (ans !== 'y' && ans !== 'yes') { console.log('已取消。'); return; }
  }

  // 1) 复制 skill
  fs.mkdirSync(path.dirname(destSkill), { recursive: true });
  fs.rmSync(destSkill, { recursive: true, force: true });
  fs.cpSync(srcSkill, destSkill, { recursive: true });
  console.log(`\n✓ skill 已复制 → ${destSkill}`);

  // 2) 合并 enabledPlugins（不覆盖其他键）
  if (toDisable.length) {
    const settings = readJSON(settingsFile);
    if (settings.enabledPlugins == null) settings.enabledPlugins = {};
    if (Array.isArray(settings.enabledPlugins)) {
      // 数组形态：Claude Code 也接受 map 形态；转成 map 以便写 false
      const asMap = {};
      for (const k of settings.enabledPlugins) asMap[k] = true;
      settings.enabledPlugins = asMap;
    }
    for (const c of toDisable) settings.enabledPlugins[c.key] = false;
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
    console.log(`✓ 已在 ${path.relative(target, settingsFile)} 禁用 ${toDisable.length} 个冲突插件（仅本项目）`);
  }

  console.log('\n完成。下一步：');
  console.log('  · 重启 Claude Code（或在本项目重新打开），信任 workspace 后生效。');
  console.log('  · 在项目里唤起 skill（提到"AI 辅助开发 / 生成 spec / coding plan / 需求澄清"即可），');
  console.log('    首次会询问本项目用个人版还是团队版，并写入 CLAUDE.md 与 AGENTS.md。');
}

main().catch(e => { console.error(e); process.exit(1); });
