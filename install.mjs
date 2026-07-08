#!/usr/bin/env node
// ai-dev-workflow 项目安装器（跨平台，零依赖）
//
// 作用：
//   1) 把 skills/ 下所有 skill 复制进 <目标项目>/.claude/skills/
//   2) 在【本项目】级配置里禁用与本流程冲突的 Claude Code 插件（覆盖用户级启用，
//      只影响本项目；其他项目照常启用）。
//   3) 为 Codex 写入项目级 AGENTS.md 覆盖指令，避免自动触发冲突技能。
//
// 用法：
//   node install.mjs [目标目录] [选项]   （或 ./install.mjs [目标目录]）
//
// 选项：
//   --yes, -y          跳过交互确认
//   --shared           写入 .claude/settings.json（提交进 git，全仓协作者共享）
//                      默认写 .claude/settings.local.json（gitignored，仅影响你）
//   --keep=<key>       保留某个插件不禁用，可多次；key 用完整 name@marketplace 或短名
//   --no-plugins       只装 skill，不改任何冲突插件/技能设置
//   --dry-run          只打印将做什么，不落盘
//   -h, --help         显示帮助
//
// 依据：
//   Claude Code 官方 settings 文档：
//   settings 优先级 Managed > Local(.claude/settings.local.json) > Project(.claude/settings.json) > User(~/.claude/settings.json)
//   enabledPlugins 在所有 scope 均可设 → 项目级 false 覆盖用户级 true = 仅本项目禁用。
//   Codex CLI 0.142.5：
//   插件配置只从用户级 [plugins] 读取，项目级 [projects."<path>"] 当前只支持 trust_level。
//   因此不能安全实现“仅本项目 enabled=false”，这里改用项目 AGENTS.md 覆盖自动触发规则。

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 与本流程冲突的插件：会抢流程、强制前置、或注入干扰 hook。
// key 是 enabledPlugins 里的完整标识 name@marketplace（按默认安装源）。
const CLAUDE_CONFLICTS = [
  { key: 'superpowers@claude-plugins-official',            short: 'superpowers',            reason: 'brainstorming HARD-GATE 与 using-superpowers 强制前置，会截胡本流程的 Triage/直接实现' },
  { key: 'everything-claude-code@everything-claude-code',  short: 'everything-claude-code',  reason: 'plan/tdd/coding-standards 与本流程重叠 + SessionStart hook 注入' },
  { key: 'oh-my-claudecode@omc',                           short: 'oh-my-claudecode',       reason: 'autopilot/ralph/ultrawork 等端到端引擎替代本流程 + agents-overlay hook' },
  { key: 'general-task@local-plugins',                     short: 'general-task',           reason: 'SessionStart 注入 clarify→plan→execute + using-general-task 强制前置（未在你点名清单里，如需保留用 --keep=general-task）' },
];

const CODEX_CONFLICTS = [
  { key: 'superpowers@openai-api-curated', short: 'superpowers', skillPrefix: 'superpowers:', reason: 'Codex 插件版 superpowers 会通过 skill 规则强制前置，和本流程分流/执行规则冲突' },
];

const CODEX_GUARD_START = '<!-- ai-dev-system:codex-conflicts:start -->';
const CODEX_GUARD_END = '<!-- ai-dev-system:codex-conflicts:end -->';

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
  node install.mjs [目标目录] [选项]   （或 ./install.mjs [目标目录]）

选项：
  --yes, -y        跳过交互确认
  --shared         写 .claude/settings.json（提交进 git，全仓共享禁用）
                   默认写 .claude/settings.local.json（gitignored，仅影响你）
  --keep=<key>     保留某插件不禁用（短名或 name@marketplace），可多次
  --no-plugins     只装 skill，不动冲突插件/技能设置
  --dry-run        预演，不落盘
  -h, --help       本帮助

默认在目标项目里处理这些与本流程冲突的插件/技能（仅本项目，不影响全局）：
${[
  ...CLAUDE_CONFLICTS.map(c => '  - Claude Code: ' + c.key),
  ...CODEX_CONFLICTS.map(c => '  - Codex AGENTS.md 覆盖: ' + c.key),
].join('\n')}`;
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

function readTextIfExists(file) {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function codexGuardBlock(conflicts) {
  const names = conflicts.map(c => c.skillPrefix || c.short || c.key).join('、');
  return `${CODEX_GUARD_START}
## ai-dev-system: Codex 冲突技能约束

本项目使用 ai-dev-workflow。不要自动加载或主动触发 ${names} 等与本流程冲突的技能；仅当用户在当前对话中明确要求使用对应技能时才可加载。

${CODEX_GUARD_END}`;
}

function mergeMarkedBlock(raw, block, startMarker, endMarker) {
  const normalized = raw.trimEnd();
  const start = normalized.indexOf(startMarker);
  const end = normalized.indexOf(endMarker);
  if (start !== -1 && end !== -1 && end > start) {
    const before = normalized.slice(0, start).trimEnd();
    const after = normalized.slice(end + endMarker.length).trimStart();
    return [before, block, after].filter(Boolean).join('\n\n') + '\n';
  }
  return [normalized, block].filter(Boolean).join('\n\n') + '\n';
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (opt.help) { console.log(helpText()); return; }

  // 发现所有源 skill：ai-dev-system/skills/ 下含 SKILL.md 的子目录
  const skillsRoot = path.join(__dirname, 'ai-dev-system', 'skills');
  const skills = fs.existsSync(skillsRoot)
    ? fs.readdirSync(skillsRoot)
        .filter(n => fs.existsSync(path.join(skillsRoot, n, 'SKILL.md')))
        .sort()
    : [];
  if (skills.length === 0) {
    console.error(`✗ 找不到任何源 skill（${skillsRoot} 下无含 SKILL.md 的目录）\n  请在 ai-dev-system 仓库根目录内运行本脚本。`);
    process.exit(1);
  }

  const target = path.resolve(opt.target || process.cwd());
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.error(`✗ 目标目录不存在：${target}`);
    process.exit(1);
  }

  const skillsDestDir = path.join(target, '.claude', 'skills');
  const claudeSettingsFile = path.join(target, '.claude', opt.shared ? 'settings.json' : 'settings.local.json');
  const codexAgentsFile = path.join(target, 'AGENTS.md');
  const claudeToDisable = opt.noPlugins ? [] : CLAUDE_CONFLICTS.filter(c => !isKept(c.key, opt.keep));
  const codexToDisable = opt.noPlugins ? [] : CODEX_CONFLICTS.filter(c => !isKept(c.key, opt.keep));

  // 计划
  console.log('\nai-dev-workflow 安装器');
  console.log('目标项目：' + target);
  console.log('\n将执行：');
  console.log(`  1) 复制 ${skills.length} 个 skill → ${path.relative(target, skillsDestDir) || skillsDestDir}/`);
  for (const name of skills) {
    const exists = fs.existsSync(path.join(skillsDestDir, name));
    console.log(`       - ${name}${exists ? '  (已存在，将覆盖)' : ''}`);
  }
  if (claudeToDisable.length || codexToDisable.length) {
    const scopeNote = opt.shared ? '提交进 git，全仓协作者共享' : 'gitignored，仅影响你本机';
    console.log(`  2) 在本项目禁用以下冲突插件/技能开关：`);
    if (claudeToDisable.length) {
      console.log(`       Claude Code → ${path.relative(target, claudeSettingsFile)}  (${scopeNote})`);
      for (const c of claudeToDisable) console.log(`       - ${c.key}\n           ↳ ${c.reason}`);
    }
    if (codexToDisable.length) {
      console.log(`       Codex → ${path.relative(target, codexAgentsFile)}  (项目级指令覆盖，仅影响本项目)`);
      for (const c of codexToDisable) console.log(`       - ${c.key}\n           ↳ ${c.reason}`);
    }
  } else {
    console.log('  2) 不修改任何冲突插件/技能设置' + (opt.noPlugins ? '（--no-plugins）' : '（全部 --keep）'));
  }
  console.log('\n  ⚠ 提示：');
  console.log('     · 项目级 .claude/settings.json 首次打开会弹 workspace trust 对话框，信任后才生效。');
  console.log('     · Claude Code settings 改动在【下次启动 Claude Code】时生效，非当前会话。');
  console.log('     · Codex 0.142.5 尚无可验证的项目级插件 enabled=false；安装器改写 AGENTS.md 项目指令，不动全局插件。');
  console.log('     · 全局（其他项目）不受影响。撤销：删掉本项目配置/AGENTS.md 里对应的标记块即可。');
  if (opt.dryRun) { console.log('\n[--dry-run] 未做任何改动。'); return; }

  if (!opt.yes) {
    const ans = (await ask('\n继续？[y/N] ')).trim().toLowerCase();
    if (ans !== 'y' && ans !== 'yes') { console.log('已取消。'); return; }
  }

  // 1) 复制所有 skill
  fs.mkdirSync(skillsDestDir, { recursive: true });
  for (const name of skills) {
    const dest = path.join(skillsDestDir, name);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(path.join(skillsRoot, name), dest, { recursive: true });
  }
  console.log(`\n✓ ${skills.length} 个 skill 已复制 → ${skillsDestDir}（${skills.join('、')}）`);

  // 2a) 合并 Claude Code enabledPlugins（不覆盖其他键）
  if (claudeToDisable.length) {
    const settings = readJSON(claudeSettingsFile);
    if (settings.enabledPlugins == null) settings.enabledPlugins = {};
    if (Array.isArray(settings.enabledPlugins)) {
      // 数组形态：Claude Code 也接受 map 形态；转成 map 以便写 false
      const asMap = {};
      for (const k of settings.enabledPlugins) asMap[k] = true;
      settings.enabledPlugins = asMap;
    }
    for (const c of claudeToDisable) settings.enabledPlugins[c.key] = false;
    fs.mkdirSync(path.dirname(claudeSettingsFile), { recursive: true });
    fs.writeFileSync(claudeSettingsFile, JSON.stringify(settings, null, 2) + '\n');
    console.log(`✓ 已在 ${path.relative(target, claudeSettingsFile)} 禁用 ${claudeToDisable.length} 个 Claude Code 冲突插件（仅本项目）`);
  }

  // 2b) Codex 当前无项目级插件开关；写 AGENTS.md 覆盖自动触发规则
  if (codexToDisable.length) {
    const raw = readTextIfExists(codexAgentsFile);
    const merged = mergeMarkedBlock(
      raw,
      codexGuardBlock(codexToDisable),
      CODEX_GUARD_START,
      CODEX_GUARD_END,
    );
    fs.writeFileSync(codexAgentsFile, merged);
    console.log(`✓ 已在 ${path.relative(target, codexAgentsFile)} 写入 Codex 冲突技能约束（仅本项目）`);
  }

  console.log('\n完成。下一步：');
  console.log('  · 重启 Claude Code / Codex（或在本项目重新打开），项目级配置/指令才会进入新会话。');
  console.log('  · 在项目里唤起 skill（提到"AI 辅助开发 / 生成 spec / coding plan / 需求澄清"即可），');
  console.log('    首次会询问本项目用个人版还是团队版，并写入 CLAUDE.md 与 AGENTS.md。');
}

main().catch(e => { console.error(e); process.exit(1); });
