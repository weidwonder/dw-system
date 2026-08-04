#!/usr/bin/env node
// ai-dev-workflow 项目安装器（跨平台，需要 Node.js 与 Git）
//
// 作用：
//   1) 从 GitHub 获取指定版本，把所有 skill 复制进
//      <目标项目>/.claude/skills/ 和 <目标项目>/.agents/skills/
//      分别完成 Claude Code 与 Codex 的项目级安装
//   2) 在【本项目】级配置里禁用与本流程冲突的 Claude Code 插件（覆盖用户级启用，
//      只影响本项目；其他项目照常启用）。
//   3) 为 Codex 写入项目级 AGENTS.md 覆盖指令，或按用户选择通过 Codex CLI 全局卸载冲突插件。
//   4) 在目标项目 .gitignore 幂等追加所有已安装 skill 目录与版本 stamp，
//      避免本体系随目标仓库提交。
//
// 用法：
//   node install.mjs [目标目录] [选项]   （或 ./install.mjs [目标目录]）
//
// 选项：
//   --yes, -y          跳过交互确认
//   --shared           写入 .claude/settings.json（提交进 git，全仓协作者共享）
//                      默认写 .claude/settings.local.json（gitignored，仅影响你）
//   --keep=<key>       保留插件，并撤销安装器此前写入的禁用/约束；可多次
//   --no-plugins       只装 skill，不改任何冲突插件/技能设置
//   --repo=<url>        安装源 Git 仓库（默认官方 GitHub 仓库）
//   --ref=<name>        安装版本：分支或标签（默认 main）
//   --source-dir=<dir>  使用本地仓库源码（仅用于开发和测试）
//   --dry-run          只打印将做什么，不落盘
//   -h, --help         显示帮助
//
// 依据：
//   Claude Code 官方 settings 文档：
//   settings 优先级 Managed > Local(.claude/settings.local.json) > Project(.claude/settings.json) > User(~/.claude/settings.json)
//   enabledPlugins 在所有 scope 均可设 → 项目级 false 覆盖用户级 true = 仅本项目禁用。
//   Codex CLI：
//   默认不修改用户级全局插件配置，改用项目 AGENTS.md 约束自动触发；
//   用户显式选择全局卸载时，通过 Codex CLI 的 plugin list/remove 操作，影响所有项目。

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';

const DEFAULT_REPO = 'https://github.com/weidwonder/ai-dev-system.git';
const DEFAULT_REF = 'main';

// 伴生 skill：本体系不收录其内容，只负责"装上并保持新"。
// 装到【用户级】目录（跨项目共享一份），不进目标项目、不写目标项目 .gitignore。
// 版本取自其 SKILL.md frontmatter 的 metadata.version。
const COMPANION_SKILLS = [
  {
    name: 'agentic-principle',
    repo: 'https://github.com/weidwonder/agentic_principle.git',
    ref: 'main',
    subdir: 'agentic-principle', // skill 本体在仓库的这个子目录里
    why: 'ai-dev-workflow 判定需求为 Agentic 应用时必须加载：架构选型 / 系统提示词 / 注意力负载 / 步骤级测试与评测',
  },
];

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
const CODEX_PLUGIN_NAME = 'superpowers';
const CODEX_PLUGIN_IDS = new Set([
  'superpowers@openai-api-curated',
  'superpowers@openai-curated',
]);

// 版本 stamp 文件名：安装时写入目标项目的两个 skills 目录，升级时据此判断是否需要迁移提示。
const VERSION_STAMP = 'ai-dev-system.version';
// 显式版本化之前的旧安装（有 skill 无 stamp）一律按该版本处理。
const LEGACY_VERSION = '1.0.0';

const CODEX_GUARD_START = '<!-- ai-dev-system:codex-conflicts:start -->';
const CODEX_GUARD_END = '<!-- ai-dev-system:codex-conflicts:end -->';
// .gitignore 标记块：# 开头对 git 是注释行，机器可精确定位、可幂等替换。
const GITIGNORE_START = '# ai-dev-system:gitignore:start';
const GITIGNORE_END = '# ai-dev-system:gitignore:end';
const WORKFLOW_MODE_START = '<!-- ai-dev-workflow:start -->';
const WORKFLOW_MODE_END = '<!-- ai-dev-workflow:end -->';

function parseArgs(argv) {
  const opt = {
    yes: false,
    shared: false,
    keep: [],
    noPlugins: false,
    codexConflicts: null,
    dryRun: false,
    help: false,
    repo: DEFAULT_REPO,
    ref: DEFAULT_REF,
    sourceDir: null,
    noCompanions: false,
    companionRepos: {},
    target: null,
  };
  for (const a of argv) {
    if (a === '--yes' || a === '-y') opt.yes = true;
    else if (a === '--shared') opt.shared = true;
    else if (a === '--no-plugins') opt.noPlugins = true;
    else if (a.startsWith('--codex-conflicts=')) {
      const value = a.slice('--codex-conflicts='.length);
      if (value !== 'guard' && value !== 'uninstall') {
        throw new Error('--codex-conflicts 只能是 guard 或 uninstall');
      }
      opt.codexConflicts = value;
    }
    else if (a === '--dry-run') opt.dryRun = true;
    else if (a === '-h' || a === '--help') opt.help = true;
    else if (a === '--no-agentic' || a === '--no-companions') opt.noCompanions = true;
    else if (a.startsWith('--agentic-repo=')) opt.companionRepos['agentic-principle'] = a.slice('--agentic-repo='.length);
    else if (a.startsWith('--keep=')) opt.keep.push(a.slice('--keep='.length));
    else if (a.startsWith('--repo=')) opt.repo = a.slice('--repo='.length);
    else if (a.startsWith('--ref=')) opt.ref = a.slice('--ref='.length);
    else if (a.startsWith('--source-dir=')) opt.sourceDir = a.slice('--source-dir='.length);
    else if (a.startsWith('-')) { console.error(`未知选项: ${a}`); process.exit(2); }
    else opt.target = a;
  }
  if (!opt.repo) throw new Error('--repo 不能为空');
  if (!opt.ref) throw new Error('--ref 不能为空');
  if (opt.sourceDir === '') throw new Error('--source-dir 不能为空');
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
  --keep=<key>     保留插件并撤销旧禁用/约束（短名或 name@marketplace），可多次
  --no-plugins     只装 skill，不动冲突插件/技能设置
  --codex-conflicts=<mode>
                   Codex 冲突处理：guard（项目级 AGENTS.md，默认）或 uninstall（全局卸载）
  --repo=<url>     安装源 Git 仓库（默认 ${DEFAULT_REPO}）
  --ref=<name>     安装版本：分支或标签（默认 ${DEFAULT_REF}）
  --source-dir=<dir>
                   使用本地仓库源码，不从 GitHub 下载（仅开发和测试）
  --no-agentic     跳过伴生 skill 的检查与安装（同义：--no-companions）
  --agentic-repo=<url>
                   覆盖 agentic-principle 的来源仓库（默认 ${COMPANION_SKILLS[0].repo}）
  --dry-run        预演，不落盘
  -h, --help       本帮助

安装源：
  默认从 ${DEFAULT_REPO} 的 ${DEFAULT_REF} 分支获取。
  下载或源校验失败时，不会修改目标项目。

伴生 skill（用户级，跨项目共享一份，不进目标项目）：
${COMPANION_SKILLS.map(c => `  - ${c.name}：${c.repo}\n      ${c.why}`).join('\n')}
  每次安装都会检查远端版本，本地更旧才更新；本地是 symlink 或 git 工作区时
  只报告版本差异、不覆盖；拉取失败降级为警告，不影响主安装。用 --no-agentic 跳过。

默认项目级安装到两个目录：
  - .claude/skills/  Claude Code 使用
  - .agents/skills/  Codex 使用
  安装后会在目标项目 .gitignore 幂等追加已安装 skill 目录与版本 stamp 的
  忽略规则（标记块，重复安装不重复追加），避免本体系随目标仓库提交。

默认在目标项目里处理这些与本流程冲突的插件/技能（Codex 默认仅本项目，不影响全局）：
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
    throw new Error(`无法解析已存在的 ${file}：${e.message}\n  为避免破坏你的配置，安装已中止。请修复该文件的 JSON 后重试。`);
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

// 只忽略本体系安装的具体 skill 目录与版本 stamp，不整目录忽略，
// 避免误伤用户自己放在 .claude/skills/ 或 .agents/skills/ 下的 skill。
function gitignoreBlock(skills) {
  const lines = [];
  for (const dir of ['.claude/skills', '.agents/skills']) {
    for (const name of skills) lines.push(`/${dir}/${name}/`);
    lines.push(`/${dir}/${VERSION_STAMP}`);
  }
  return [GITIGNORE_START, ...lines, GITIGNORE_END].join('\n');
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

function removeMarkedBlock(raw, startMarker, endMarker) {
  const start = raw.indexOf(startMarker);
  if (start === -1) return raw;
  const end = raw.indexOf(endMarker, start + startMarker.length);
  if (end === -1) return raw;
  const before = raw.slice(0, start).trimEnd();
  const after = raw.slice(end + endMarker.length).trimStart();
  const merged = [before, after].filter(Boolean).join('\n\n');
  return merged ? merged + '\n' : '';
}

function getMarkedBlock(raw, startMarker, endMarker) {
  const start = raw.indexOf(startMarker);
  if (start === -1) return null;
  const end = raw.indexOf(endMarker, start + startMarker.length);
  if (end === -1) return null;
  return raw.slice(start, end + endMarker.length);
}

function assertMarkedBlock(raw, startMarker, endMarker, file) {
  if (!getMarkedBlock(raw, startMarker, endMarker)) {
    throw new Error(`安装校验失败：${file} 缺少 ${startMarker} 标记块`);
  }
}

function assertCodexGuard(raw, conflicts, file) {
  const block = getMarkedBlock(raw, CODEX_GUARD_START, CODEX_GUARD_END);
  if (!block) throw new Error(`安装校验失败：${file} 缺少 ${CODEX_GUARD_START} 标记块`);
  for (const conflict of conflicts) {
    const required = conflict.skillPrefix || conflict.short || conflict.key;
    if (!block.includes(required)) {
      throw new Error(`安装校验失败：${file} 的 Codex 保护块缺少 ${required}`);
    }
  }
}

function getWorkflowMode(block) {
  const match = block?.match(/mode="(personal|team)"/);
  return match?.[1] || null;
}

function readVersionFile(file) {
  if (!fs.existsSync(file)) return null;
  const v = fs.readFileSync(file, 'utf8').trim();
  return /^\d+\.\d+\.\d+$/.test(v) ? v : null;
}

function cmpVersion(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

// migrations/ 下每个 <version>.md 是"升级到该版本"的迁移指南；
// 取 (installed, source] 区间内的全部指南，按版本升序。
function collectMigrations(migrationsDir, fromVersion, toVersion) {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir)
    .filter(f => /^\d+\.\d+\.\d+\.md$/.test(f))
    .map(f => ({ version: f.slice(0, -3), file: path.join(migrationsDir, f) }))
    .filter(m => cmpVersion(m.version, fromVersion) > 0 && cmpVersion(m.version, toVersion) <= 0)
    .sort((x, y) => cmpVersion(x.version, y.version));
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

function runCodex(args) {
  const commands = process.platform === 'win32' ? ['codex.cmd', 'codex.exe', 'codex'] : ['codex'];
  let lastError = null;
  for (const command of commands) {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      // Windows 的 npm 全局命令通常是 .cmd shim，Node 需要通过 shell 调用它。
      shell: process.platform === 'win32',
    });
    const notFound = result.error?.code === 'ENOENT'
      || (process.platform === 'win32' && result.status === 1
        && /not recognized|cannot find/i.test(result.stderr || ''));
    if (!notFound) return result;
    lastError = result.error;
  }
  throw new Error(`找不到 Codex CLI，无法执行全局卸载：${lastError?.message || 'codex'}`);
}

function codexPluginId(plugin) {
  if (typeof plugin?.pluginId === 'string') return plugin.pluginId;
  if (plugin?.name === CODEX_PLUGIN_NAME && typeof plugin?.marketplaceName === 'string') {
    return `${plugin.name}@${plugin.marketplaceName}`;
  }
  return null;
}

function findInstalledCodexConflicts() {
  const result = runCodex(['plugin', 'list', '--json']);
  if (result.status !== 0) {
    throw new Error(`Codex 插件列表读取失败：${(result.stderr || result.stdout || '').trim()}`);
  }
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Codex 插件列表不是有效 JSON：${error.message}`);
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.installed)) {
    throw new Error('Codex 插件列表缺少有效的 installed 数组');
  }
  const installed = payload.installed;
  return [...new Set(installed
    .filter(plugin => CODEX_PLUGIN_IDS.has(codexPluginId(plugin)))
    .map(codexPluginId)
    .filter(Boolean))];
}

function uninstallCodexConflicts(pluginIds) {
  for (const pluginId of pluginIds) {
    const result = runCodex(['plugin', 'remove', pluginId]);
    if (result.status !== 0) {
      throw new Error(`Codex 插件卸载失败（${pluginId}）：${(result.stderr || result.stdout || '').trim()}`);
    }
    console.log(`✓ 已全局卸载 Codex 冲突插件：${pluginId}`);
  }
  if (!pluginIds.length) console.log('· 未发现已安装的 Codex superpowers 插件，全局卸载无需操作');
}

async function chooseCodexConflictMode(opt, hasConflict) {
  if (!hasConflict || opt.noPlugins) return 'none';
  if (opt.codexConflicts) return opt.codexConflicts;
  if (opt.yes || opt.dryRun) return 'guard';
  const answer = (await ask(
    '\nCodex 冲突技能处理方式：\n' +
    '  1) 项目级 AGENTS.md 约束（默认，不影响其他项目）\n' +
    '  2) 全局卸载 Codex superpowers（影响所有项目）\n' +
    '请选择 [1/2，默认 1]：',
  )).trim().toLowerCase();
  return answer === '2' || answer === 'uninstall' ? 'uninstall' : 'guard';
}

function copySkills(skillsRoot, skills, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of skills) {
    const dest = path.join(destDir, name);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(path.join(skillsRoot, name), dest, { recursive: true });
  }
}

function discoverSkills(skillsRoot) {
  const skills = fs.existsSync(skillsRoot)
    ? fs.readdirSync(skillsRoot)
        .filter(name => fs.existsSync(path.join(skillsRoot, name, 'SKILL.md')))
        .sort()
    : [];
  if (skills.length === 0) {
    throw new Error(`找不到任何源 skill（${skillsRoot} 下无含 SKILL.md 的目录）`);
  }
  return skills;
}

function acquireSource(opt) {
  if (opt.sourceDir) {
    const repoRoot = path.resolve(opt.sourceDir);
    const pkgRoot = path.join(repoRoot, 'ai-dev-system');
    const skillsRoot = path.join(pkgRoot, 'skills');
    const skills = discoverSkills(skillsRoot);
    return {
      skillsRoot,
      skills,
      pkgRoot,
      label: `本地开发源 ${repoRoot}`,
      cleanup() {},
    };
  }

  const tempRoot = fs.mkdtempSync(path.join(tmpdir(), 'ai-dev-system-download-'));
  const checkout = path.join(tempRoot, 'repo');
  const result = spawnSync(
    'git',
    ['clone', '--depth=1', '--single-branch', '--branch', opt.ref, '--', opt.repo, checkout],
    { encoding: 'utf8' },
  );

  if (result.error || result.status !== 0) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (result.error?.code === 'ENOENT') {
      throw new Error('无法运行 Git。请先安装 Git 并确保 git 命令可用。');
    }
    const detail = (result.stderr || result.stdout || result.error?.message || '未知错误').trim();
    throw new Error(`无法从安装源获取 ${opt.ref}：${detail}`);
  }

  try {
    const pkgRoot = path.join(checkout, 'ai-dev-system');
    const skillsRoot = path.join(pkgRoot, 'skills');
    const skills = discoverSkills(skillsRoot);
    return {
      skillsRoot,
      skills,
      pkgRoot,
      label: `${opt.repo} @ ${opt.ref}`,
      cleanup() { fs.rmSync(tempRoot, { recursive: true, force: true }); },
    };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

// 伴生 skill 的版本写在 SKILL.md frontmatter 的 metadata.version，
// 与本体系用 VERSION 文件不同；非三段式版本一律按"未知"处理，不做比较。
function readSkillMetaVersion(skillDir) {
  const file = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(file)) return null;
  const front = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!front) return null;
  const m = front[1].match(/^[ \t]+version:[ \t]*['"]?(\d+\.\d+\.\d+)['"]?[ \t]*$/m);
  return m ? m[1] : null;
}

// 用户级安装位置：Claude Code 与 Codex 各一个入口，跨项目共享同一份。
// 注意两侧不对称：Claude Code 用户级是 ~/.claude/，Codex 用户级是 ~/.codex/；
// `.agents/` 只是 Codex 的【项目级】目录，不存在用户级形态。
function companionDestDirs(home) {
  return [path.join(home, '.claude', 'skills'), path.join(home, '.codex', 'skills')];
}

// v1.6.0 曾把 Codex 侧的伴生 skill 误装到 ~/.agents/skills/。那不是 Codex 的用户级入口，
// 留在那里只会成为永不更新的陈旧副本 —— 检出后只报告并给出删除命令，不自动删用户家目录里的东西。
function legacyCompanionDirs(home, name) {
  return [path.join(home, '.agents', 'skills', name)].filter(dir => fs.existsSync(dir));
}

// 开发态保护：目标是 symlink（指向本地开发目录）或本身是 git 工作区时，
// 覆盖会写进用户自己的仓库——一律只报告版本差异，不动它。
function companionGuardReason(dir) {
  let st;
  try { st = fs.lstatSync(dir); } catch { return null; }
  if (st.isSymbolicLink()) return 'symlink（指向本地开发目录）';
  if (fs.existsSync(path.join(dir, '.git'))) return 'git 工作区';
  return null;
}

function fetchCompanion(spec, repo) {
  const tempRoot = fs.mkdtempSync(path.join(tmpdir(), `companion-${spec.name}-`));
  const checkout = path.join(tempRoot, 'repo');
  const result = spawnSync(
    'git',
    ['clone', '--depth=1', '--single-branch', '--branch', spec.ref, '--', repo, checkout],
    { encoding: 'utf8' },
  );
  if (result.error || result.status !== 0) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    const detail = (result.stderr || result.stdout || result.error?.message || '未知错误').trim();
    throw new Error(detail.split('\n').slice(-1)[0]);
  }
  const srcDir = spec.subdir ? path.join(checkout, spec.subdir) : checkout;
  if (!fs.existsSync(path.join(srcDir, 'SKILL.md'))) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(`仓库里找不到 ${spec.subdir || '.'}/SKILL.md`);
  }
  return {
    srcDir,
    version: readSkillMetaVersion(srcDir),
    cleanup() { fs.rmSync(tempRoot, { recursive: true, force: true }); },
  };
}

// 返回 true 表示需要写入（本地缺失，或本地版本更旧，或两侧版本都判不出）。
function companionNeedsUpdate(localVersion, remoteVersion) {
  if (localVersion == null) return true;
  if (remoteVersion == null) return false; // 远端版本判不出时不覆盖已有安装
  return cmpVersion(remoteVersion, localVersion) > 0;
}

// 主安装完成后执行；任何失败都只降级为警告，不影响已完成的项目安装。
function syncCompanions(opt, home) {
  if (opt.noCompanions) {
    console.log('\n· 跳过伴生 skill 检查（--no-agentic）');
    return;
  }
  for (const spec of COMPANION_SKILLS) {
    const repo = opt.companionRepos[spec.name] || spec.repo;
    const dests = companionDestDirs(home).map(root => path.join(root, spec.name));
    const locals = dests.map(dir => ({
      dir,
      exists: fs.existsSync(dir),
      guard: companionGuardReason(dir),
      version: fs.existsSync(dir) ? readSkillMetaVersion(dir) : null,
    }));

    // 陈旧副本的提示与联网无关，放在拉取之前，拉取失败时也能看到。
    for (const stale of legacyCompanionDirs(home, spec.name)) {
      console.log(`\n⚠ 伴生 skill ${spec.name}：发现旧版安装器(≤v1.6.0)误装的副本 ${stale}`);
      console.log('   那不是 Codex 的用户级入口（Codex 用户级是 ~/.codex/，.agents/ 只用于项目级），');
      console.log(`   留着只会是永不更新的陈旧副本。确认无用后手动删除：rm -rf "${stale}"`);
    }

    let fetched;
    try {
      fetched = fetchCompanion(spec, repo);
    } catch (e) {
      const known = locals.filter(l => l.exists);
      console.log(`\n⚠ 伴生 skill ${spec.name}：无法访问 ${repo}（${e.message}）`);
      console.log(known.length
        ? `   本地已装 v${known[0].version || '未知'}，继续使用；联网后重跑安装器即可检查更新。`
        : `   本地未安装。它是 Agentic 需求的必需依赖，请稍后重跑安装器，或手动 clone 到 ${dests[0]}。`);
      continue;
    }

    try {
      const remote = fetched.version;
      console.log(`\n伴生 skill ${spec.name}（${spec.why}）`);
      console.log(`  远端版本：v${remote || '未知'}（${repo}）`);
      for (const local of locals) {
        const shown = local.exists ? `v${local.version || '未知'}` : '未安装';
        if (local.guard) {
          const verdict = companionNeedsUpdate(local.version, remote)
            ? '有更新可用，但不自动覆盖，请自行在该仓库拉取'
            : '已是最新';
          console.log(`  · ${local.dir}：${shown}（${local.guard}）→ 保持不动；${verdict}`);
          continue;
        }
        if (!companionNeedsUpdate(local.version, remote)) {
          console.log(`  · ${local.dir}：${shown} → 已是最新，跳过`);
          continue;
        }
        if (opt.dryRun) {
          console.log(`  · ${local.dir}：${shown} → [--dry-run] 将安装/更新为 v${remote || '未知'}`);
          continue;
        }
        fs.mkdirSync(path.dirname(local.dir), { recursive: true });
        fs.rmSync(local.dir, { recursive: true, force: true });
        fs.cpSync(fetched.srcDir, local.dir, { recursive: true });
        console.log(`  · ${local.dir}：${shown} → 已${local.exists ? '更新' : '安装'}为 v${remote || '未知'}`);
      }
    } finally {
      fetched.cleanup();
    }
  }
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (opt.help) { console.log(helpText()); return; }

  const target = path.resolve(opt.target || process.cwd());
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new Error(`目标目录不存在：${target}`);
  }

  let source;
  try {
    source = acquireSource(opt);
    const { skillsRoot, skills, pkgRoot } = source;

  const claudeSkillsDestDir = path.join(target, '.claude', 'skills');
  const codexSkillsDestDir = path.join(target, '.agents', 'skills');

  // 版本与迁移：源版本来自 ai-dev-system/VERSION；已装版本来自目标 stamp，
  // 无 stamp 但已存在源同名 skill 的旧安装按 LEGACY_VERSION 处理；全新安装无需迁移。
  const sourceVersion = readVersionFile(path.join(pkgRoot, 'VERSION'));
  const stampFiles = [path.join(claudeSkillsDestDir, VERSION_STAMP), path.join(codexSkillsDestDir, VERSION_STAMP)];
  let installedVersion = readVersionFile(stampFiles[0]) || readVersionFile(stampFiles[1]);
  if (!installedVersion) {
    const hasLegacyInstall = skills.some(name =>
      fs.existsSync(path.join(claudeSkillsDestDir, name)) || fs.existsSync(path.join(codexSkillsDestDir, name)));
    if (hasLegacyInstall) installedVersion = LEGACY_VERSION;
  }
  const isUpgrade = sourceVersion && installedVersion && cmpVersion(sourceVersion, installedVersion) > 0;
  const isDowngrade = sourceVersion && installedVersion && cmpVersion(sourceVersion, installedVersion) < 0;
  const migrations = isUpgrade
    ? collectMigrations(path.join(pkgRoot, 'migrations'), installedVersion, sourceVersion)
    : [];
  const claudeSettingsFile = path.join(target, '.claude', opt.shared ? 'settings.json' : 'settings.local.json');
  const codexAgentsFile = path.join(target, 'AGENTS.md');
  const claudeToDisable = opt.noPlugins ? [] : CLAUDE_CONFLICTS.filter(c => !isKept(c.key, opt.keep));
  const codexToDisable = opt.noPlugins ? [] : CODEX_CONFLICTS.filter(c => !isKept(c.key, opt.keep));
  const claudeToKeep = opt.noPlugins ? [] : CLAUDE_CONFLICTS.filter(c => isKept(c.key, opt.keep));
  const codexToKeep = opt.noPlugins ? [] : CODEX_CONFLICTS.filter(c => isKept(c.key, opt.keep));

  // 所有可能中止安装的解析必须发生在覆盖现有 skill 之前。
  const claudeSettings = (claudeToDisable.length || claudeToKeep.length)
    ? readJSON(claudeSettingsFile)
    : null;
  const claudeFile = path.join(target, 'CLAUDE.md');
  const initialClaudeRaw = readTextIfExists(claudeFile);
  const initialAgentsRaw = readTextIfExists(codexAgentsFile);
  const claudeModeBlock = getMarkedBlock(initialClaudeRaw, WORKFLOW_MODE_START, WORKFLOW_MODE_END);
  const agentsModeBlock = getMarkedBlock(initialAgentsRaw, WORKFLOW_MODE_START, WORKFLOW_MODE_END);
  const claudeMode = getWorkflowMode(claudeModeBlock);
  const agentsMode = getWorkflowMode(agentsModeBlock);
  const workflowMode = claudeMode || agentsMode;
  if ((claudeModeBlock || agentsModeBlock) && !workflowMode) {
    throw new Error('安装校验失败：CLAUDE.md / AGENTS.md 的 ai-dev-workflow mode 标记无效');
  }
  const existingModeBlock = claudeMode ? claudeModeBlock : agentsModeBlock;
  const canonicalSnippet = workflowMode
    ? readTextIfExists(path.join(skillsRoot, 'ai-dev-workflow', 'assets', 'config-snippets', `${workflowMode}.md`))
    : '';
  const workflowModeBlock = getMarkedBlock(canonicalSnippet, WORKFLOW_MODE_START, WORKFLOW_MODE_END)
    || existingModeBlock;
  const codexMode = await chooseCodexConflictMode(opt, codexToDisable.length > 0);
  // 先只读取并校验全局插件清单；真正卸载在用户确认后、目标项目落盘前执行。
  const codexUninstallIds = codexMode === 'uninstall' && !opt.dryRun
    ? findInstalledCodexConflicts()
    : [];

  // 计划
  console.log('\nai-dev-workflow 安装器');
  console.log('目标项目：' + target);
  console.log('安装源：' + source.label + (sourceVersion ? `（v${sourceVersion}）` : ''));
  if (installedVersion) console.log('已安装版本：v' + installedVersion + (installedVersion === LEGACY_VERSION && !readVersionFile(stampFiles[0]) && !readVersionFile(stampFiles[1]) ? '（旧安装无版本 stamp，按此版本处理）' : ''));
  console.log('\n将执行：');
  console.log(`  1) 复制 ${skills.length} 个 skill → ${path.relative(target, claudeSkillsDestDir) || claudeSkillsDestDir}/  (Claude Code 项目级)`);
  console.log(`  2) 复制 ${skills.length} 个 skill → ${path.relative(target, codexSkillsDestDir) || codexSkillsDestDir}/  (Codex 项目级)`);
  for (const name of skills) {
    const existsInClaude = fs.existsSync(path.join(claudeSkillsDestDir, name));
    const existsInCodex = fs.existsSync(path.join(codexSkillsDestDir, name));
    const existsNote = existsInClaude || existsInCodex ? '  (已存在，将覆盖)' : '';
    console.log(`       - ${name}${existsNote}`);
  }
  if (claudeToDisable.length || codexToDisable.length || claudeToKeep.length || codexToKeep.length) {
    const scopeNote = opt.shared ? '提交进 git，全仓协作者共享' : 'gitignored，仅影响你本机';
    console.log(`  3) 在本项目处理以下冲突插件/技能：`);
    if (claudeToDisable.length) {
      console.log(`       Claude Code → ${path.relative(target, claudeSettingsFile)}  (${scopeNote})`);
      for (const c of claudeToDisable) console.log(`       - ${c.key}\n           ↳ ${c.reason}`);
    }
    if (codexToDisable.length) {
      if (codexMode === 'uninstall') {
        console.log(`       Codex → 全局卸载（影响所有项目）${codexUninstallIds.length ? `：${codexUninstallIds.join('、')}` : ''}`);
      } else {
        console.log(`       Codex → ${path.relative(target, codexAgentsFile)}  (自动触发约束，仅影响本项目)`);
      }
      for (const c of codexToDisable) console.log(`       - ${c.key}\n           ↳ ${c.reason}`);
    }
    if (claudeToKeep.length || codexToKeep.length) {
      console.log(`       保留并撤销旧约束: ${[...claudeToKeep, ...codexToKeep].map(c => c.key).join('、')}`);
    }
  } else {
    console.log('  3) 不修改任何冲突插件/技能设置' + (opt.noPlugins ? '（--no-plugins）' : '（全部 --keep）'));
  }
  console.log('  4) 在 .gitignore 追加已安装 skill 目录与版本 stamp（幂等标记块，避免本体系随仓库提交）');
  if (opt.noCompanions) {
    console.log('  5) 跳过伴生 skill 检查（--no-agentic）');
  } else {
    console.log(`  5) 检查并更新【用户级】伴生 skill：${COMPANION_SKILLS.map(c => c.name).join('、')}`);
    console.log(`       装到 ${companionDestDirs(homedir()).join('、')}（跨项目共享，不进本项目、不写本项目 .gitignore）`);
    console.log('       本地已是最新则跳过；目标是 symlink 或 git 工作区时只报告版本、不覆盖；无网时降级为警告');
  }
  // 版本升级的迁移高亮提示（dry-run 同样展示）
  const [HL, HL_END] = process.stdout.isTTY ? ['\x1b[1;33m', '\x1b[0m'] : ['', ''];
  if (migrations.length) {
    console.log(`\n${HL}  ━━━━ ⚠ 版本升级 v${installedVersion} → v${sourceVersion}：检测到 ${migrations.length} 份迁移指南，继续前请阅读 ━━━━${HL_END}`);
    for (const m of migrations) {
      console.log(`${HL}  ▶ 升级到 v${m.version} 的迁移指南（源仓库 ai-dev-system/migrations/${m.version}.md）：${HL_END}`);
      const body = fs.readFileSync(m.file, 'utf8').trimEnd();
      console.log(body.split('\n').map(l => '    │ ' + l).join('\n'));
    }
    console.log(`${HL}  ━━━━ 迁移指南结束（安装完成后请按上述"需要的动作"逐项执行）━━━━${HL_END}`);
  } else if (isUpgrade) {
    console.log(`\n  版本升级 v${installedVersion} → v${sourceVersion}：本次升级无迁移指南，无需额外动作。`);
  } else if (isDowngrade) {
    console.log(`\n${HL}  ⚠ 降级安装：目标已装 v${installedVersion}，高于安装源 v${sourceVersion}。请自行确认兼容性。${HL_END}`);
  }

  console.log('\n  ⚠ 提示：');
  console.log('     · 项目级 .claude/settings.json 首次打开会弹 workspace trust 对话框，信任后才生效。');
  console.log('     · Claude Code settings 改动在【下次启动 Claude Code】时生效，非当前会话。');
  if (codexMode === 'uninstall') {
    console.log('     · Codex 已选择全局卸载；该选择会影响当前用户的其他项目。');
  } else {
    console.log('     · Codex 默认采用项目级 AGENTS.md 自动触发约束，不动全局插件。');
    console.log('     · 全局（其他项目）不受影响。撤销：删掉本项目配置/AGENTS.md 里对应的标记块即可。');
  }
  if (opt.dryRun) {
    syncCompanions(opt, homedir());
    console.log('\n[--dry-run] 未做任何改动。');
    return;
  }

  if (!opt.yes) {
    const ans = (await ask('\n继续？[y/N] ')).trim().toLowerCase();
    if (ans !== 'y' && ans !== 'yes') { console.log('已取消。'); return; }
  }

  // 全局卸载是不可逆的用户级副作用，必须在任何目标项目文件写入前完成。
  // 这样 CLI 不可用或卸载失败时，目标项目保持原样。
  if (codexMode === 'uninstall' && codexToDisable.length) {
    uninstallCodexConflicts(codexUninstallIds);
  }

  // 1) 复制所有 skill 到 Claude Code 与 Codex 的项目级目录
  copySkills(skillsRoot, skills, claudeSkillsDestDir);
  copySkills(skillsRoot, skills, codexSkillsDestDir);
  console.log(`\n✓ ${skills.length} 个 skill 已复制 → ${claudeSkillsDestDir}（${skills.join('、')}）`);
  console.log(`✓ ${skills.length} 个 skill 已复制 → ${codexSkillsDestDir}（${skills.join('、')}）`);
  if (sourceVersion) {
    for (const f of stampFiles) fs.writeFileSync(f, sourceVersion + '\n');
    console.log(`✓ 已写入版本 stamp v${sourceVersion}（${VERSION_STAMP}）`);
  }
  if (migrations.length) {
    console.log(`${HL}⚠ 别忘了执行上方 v${installedVersion} → v${sourceVersion} 迁移指南中"需要的动作"。${HL_END}`);
  }

  // 1b) 幂等追加 .gitignore 标记块，避免安装的 skill 随目标仓库提交
  const gitignoreFile = path.join(target, '.gitignore');
  const gitignoreRaw = readTextIfExists(gitignoreFile);
  const gitignoreMerged = mergeMarkedBlock(gitignoreRaw, gitignoreBlock(skills), GITIGNORE_START, GITIGNORE_END);
  if (gitignoreMerged !== gitignoreRaw) {
    fs.writeFileSync(gitignoreFile, gitignoreMerged);
    assertMarkedBlock(readTextIfExists(gitignoreFile), GITIGNORE_START, GITIGNORE_END, gitignoreFile);
    console.log(`✓ 已在 ${path.relative(target, gitignoreFile)} 追加已安装 skill 的忽略规则（幂等标记块）`);
  }

  // 2a) 合并 Claude Code enabledPlugins（不覆盖其他键）
  if (claudeSettings) {
    const settings = claudeSettings;
    if (settings.enabledPlugins == null) settings.enabledPlugins = {};
    if (Array.isArray(settings.enabledPlugins)) {
      // 数组形态：Claude Code 也接受 map 形态；转成 map 以便写 false
      const asMap = {};
      for (const k of settings.enabledPlugins) asMap[k] = true;
      settings.enabledPlugins = asMap;
    }
    const hadKeptEntry = claudeToKeep.some(c => Object.hasOwn(settings.enabledPlugins, c.key));
    for (const c of claudeToDisable) settings.enabledPlugins[c.key] = false;
    for (const c of claudeToKeep) delete settings.enabledPlugins[c.key];
    const shouldWriteSettings = claudeToDisable.length > 0 || hadKeptEntry;
    if (shouldWriteSettings) {
      fs.mkdirSync(path.dirname(claudeSettingsFile), { recursive: true });
      fs.writeFileSync(claudeSettingsFile, JSON.stringify(settings, null, 2) + '\n');
      console.log(`✓ 已更新 ${path.relative(target, claudeSettingsFile)} 的 Claude Code 冲突插件设置（仅本项目）`);
    }
  }

  // 2b) 写 Codex 项目级自动触发约束
  if (codexToDisable.length && codexMode === 'guard') {
    const raw = readTextIfExists(codexAgentsFile);
    const merged = mergeMarkedBlock(
      raw,
      codexGuardBlock(codexToDisable),
      CODEX_GUARD_START,
      CODEX_GUARD_END,
    );
    fs.writeFileSync(codexAgentsFile, merged);
    assertCodexGuard(readTextIfExists(codexAgentsFile), codexToDisable, codexAgentsFile);
    console.log(`✓ 已在 ${path.relative(target, codexAgentsFile)} 写入并校验 Codex 自动触发约束（仅本项目）`);
  } else if (codexToKeep.length) {
    const raw = readTextIfExists(codexAgentsFile);
    const withoutGuard = removeMarkedBlock(raw, CODEX_GUARD_START, CODEX_GUARD_END);
    if (withoutGuard !== raw) {
      fs.writeFileSync(codexAgentsFile, withoutGuard);
      console.log(`✓ 已从 ${path.relative(target, codexAgentsFile)} 移除 Codex 自动触发约束`);
    }
  }

  // 2c) 若任一入口已有 mode，幂等同步到两个入口，修复旧安装只写一个文件的状态。
  const claudeRaw = readTextIfExists(claudeFile);
  const agentsRaw = readTextIfExists(codexAgentsFile);
  if (workflowModeBlock) {
    fs.writeFileSync(claudeFile, mergeMarkedBlock(claudeRaw, workflowModeBlock, WORKFLOW_MODE_START, WORKFLOW_MODE_END));
    fs.writeFileSync(codexAgentsFile, mergeMarkedBlock(agentsRaw, workflowModeBlock, WORKFLOW_MODE_START, WORKFLOW_MODE_END));
    assertMarkedBlock(readTextIfExists(claudeFile), WORKFLOW_MODE_START, WORKFLOW_MODE_END, claudeFile);
    assertMarkedBlock(readTextIfExists(codexAgentsFile), WORKFLOW_MODE_START, WORKFLOW_MODE_END, codexAgentsFile);
    console.log('✓ 已同步并校验 CLAUDE.md / AGENTS.md 的 ai-dev-workflow mode 标记');
  }

  if (codexMode === 'uninstall' && codexToDisable.length) {
    const raw = readTextIfExists(codexAgentsFile);
    const withoutGuard = removeMarkedBlock(raw, CODEX_GUARD_START, CODEX_GUARD_END);
    if (withoutGuard !== raw) {
      if (!withoutGuard.trim() && !initialAgentsRaw.trim() && !workflowModeBlock) {
        fs.rmSync(codexAgentsFile, { force: true });
      } else {
        fs.writeFileSync(codexAgentsFile, withoutGuard);
      }
      console.log(`✓ 已移除 ${path.relative(target, codexAgentsFile)} 的 Codex 自动触发约束（已改为全局卸载）`);
    }
  }

  // 3) 伴生 skill：装到用户级目录，失败只警告，不影响上面已完成的项目安装
  syncCompanions(opt, homedir());

  console.log('\n完成。下一步：');
  console.log('  · 重启 Claude Code / Codex（或在本项目重新打开），项目级配置/指令才会进入新会话。');
  console.log('  · 在项目里唤起 skill（提到"AI 辅助开发 / 生成 spec / coding plan / 需求澄清"即可），');
  console.log('    首次会询问本项目用个人版还是团队版，并写入 CLAUDE.md 与 AGENTS.md。');
  } finally {
    source?.cleanup();
  }
}

main().catch(e => { console.error(`✗ ${e.message}`); process.exit(1); });
