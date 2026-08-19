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
//   5) 把 skill 自带的 ctx CLI 全局链接成 `ctx` 命令（失败降级为 node 兜底调用提示）。
//   6) 检查 codegraph（外部代码知识图谱 CLI）是否为最新，缺失则装、更旧则升，
//      接线到 agent 并对目标项目建立索引。
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
//   --no-ctx-link       跳过把 skill 自带的 ctx CLI 链接成全局命令
//   --no-codegraph      跳过 codegraph 的检查、安装、接线与建索引
//   --codegraph-location=<local|global>
//                      codegraph 接线范围（默认 local，只影响本项目）
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

// ctx：本体系自带的 Engineering Context 查询 CLI，随 ai-dev-workflow skill 一起复制进目标项目。
// 它是零依赖 Node 脚本，复制完就能用——但只有 `node <路径>/src/cli.js` 一种调用方式。
// 而 skill 的文档（references/core/代码事实纪律.md、engineering-context设计.md / SKILL.md / config-snippet）
// 通篇写 `ctx <命令>`：命令不在 PATH 上时，使用者（尤其是 AI agent）极易把"which ctx 为空"
// 误判成"Engineering Context 不可用"，退化成裸 grep 旧代码——任何项目里都明令禁止这么干。
// 所以安装器把它 npm link 成全局命令。
// 链接失败绝不能让安装失败：ctx 本体已经随 skill 落盘，降级为打印 node 兜底调用方式即可。
const CTX = {
  bin: 'ctx',
  skill: 'ai-dev-workflow',          // ctx 属于这个 skill；只装 ai-prd 的场景下没有它
  subdir: path.join('scripts', 'ctx'),
  // `ctx --help` 首行的固定串。`ctx` 是很常见的命令名，必须据此确认 PATH 上那个确实是本体系的，
  // 既避免 npm link 悄悄顶掉用户自己的同名命令，也避免把别人的 ctx 当成"验证通过"谎报成功。
  signature: 'Engineering Context CLI',
  why: '查 Engineering Context 代码事实层（任何项目都必备）的入口：find-scenes / discover / get-card，替代 grep 旧代码',
};
const CTX_CMD_TIMEOUT_MS = 5 * 60 * 1000;

// codegraph：外部代码知识图谱 CLI（github.com/colbymchenry/codegraph）。
// 本体系不收录其内容，只负责三件事——保持最新、接线到 agent、给目标项目建索引。
// 它给 AI 的是可查询的代码事实（explore / impact / callers），装成索引即启用**代码图谱**。
// 与 Engineering Context 卡片层不冲突也不同级：代码图谱答"找得到吗"（符号、调用链、影响面），
// 是探测到索引才启用的可选加速面；卡片层答"信哪个"（card + cite 仍是权威口径），无条件必备。
// codegraph 只是找现状代码的通道，MUST NOT 拿它替代卡片。
const CODEGRAPH = {
  bin: 'codegraph',
  npmPackage: '@colbymchenry/codegraph',
  repo: 'https://github.com/colbymchenry/codegraph',
  indexDir: '.codegraph',   // 索引落在目标项目这个目录里
  dbFile: 'codegraph.db',   // 索引本体是本机 SQLite 库，据它判断索引是否真的建成
  why: '给 AI 一层可查询的代码事实：explore / impact / callers，替代 grep 式盲找',
};
// 子进程超时：装包与接线是分钟级；建索引在大仓库上更久，给足一小时。
const CODEGRAPH_CMD_TIMEOUT_MS = 15 * 60 * 1000;
const CODEGRAPH_INDEX_TIMEOUT_MS = 60 * 60 * 1000;

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
// CLAUDE.md / AGENTS.md 软链接的解析跳数上限，用来在成环时给出明确报错而不是死循环。
const MAX_LINK_HOPS = 32;

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
    noCtxLink: false,
    noCodegraph: false,
    codegraphLocation: 'local',
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
    else if (a === '--no-ctx-link') opt.noCtxLink = true;
    else if (a === '--no-codegraph') opt.noCodegraph = true;
    else if (a.startsWith('--codegraph-location=')) {
      const value = a.slice('--codegraph-location='.length);
      if (value !== 'local' && value !== 'global') {
        throw new Error('--codegraph-location 只能是 local 或 global');
      }
      opt.codegraphLocation = value;
    }
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
  --no-ctx-link    跳过把 skill 自带的 ctx CLI 链接成全局命令
  --no-codegraph   跳过 codegraph 的检查、安装、接线与建索引
  --codegraph-location=<local|global>
                   codegraph 接线范围（默认 local，只影响本项目）
  --dry-run        预演，不落盘
  -h, --help       本帮助

安装源：
  默认从 ${DEFAULT_REPO} 的 ${DEFAULT_REF} 分支获取。
  下载或源校验失败时，不会修改目标项目。

伴生 skill（用户级，跨项目共享一份，不进目标项目）：
${COMPANION_SKILLS.map(c => `  - ${c.name}：${c.repo}\n      ${c.why}`).join('\n')}
  每次安装都会检查远端版本，本地更旧才更新；本地是 symlink 或 git 工作区时
  只报告版本差异、不覆盖；拉取失败降级为警告，不影响主安装。用 --no-agentic 跳过。

ctx CLI（本体系自带，随 ai-dev-workflow skill 一起安装）：
  ${CTX.why}
  安装后在 ${path.join('.claude', 'skills', CTX.skill, CTX.subdir)} 下执行 npm link，
  把它变成全局 ctx 命令，并用 ctx --help 验证真的可用。链接失败（权限、npm 全局 bin
  不在 PATH、已有同名 ctx 命令）只降级为警告，并打印 node <路径>/src/cli.js 兜底
  调用方式——ctx 本体已随 skill 落盘，任何时候都能用兜底方式调用。
  用 --no-ctx-link 跳过。

codegraph（外部代码知识图谱 CLI，${CODEGRAPH.repo}）：
  ${CODEGRAPH.why}
  未安装则 npm install -g ${CODEGRAPH.npmPackage}；已安装则用它自己的
  codegraph upgrade 检测并升级（已是最新就跳过），随后接线到 agent 并对目标项目
  建立索引（${CODEGRAPH.indexDir}/ 已存在时跳过建索引）。任何一步失败只降级为警告，
  不影响已完成的 skill 安装。用 --no-codegraph 整段跳过。

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

// CLAUDE.md / AGENTS.md 常被软链接到同一份指导文件（Claude Code 与 Codex 共用）。
// 写入必须落到链接指向的实体文件上：链接本身要原样保留，且两个入口指向同一实体时只写一次。
// 逐层解析（链可能套链），返回实体路径；解析不动 link 之外的任何路径。
function resolveLinkTarget(file) {
  let current = file;
  for (let hops = 0; hops <= MAX_LINK_HOPS; hops++) {
    let st;
    try { st = fs.lstatSync(current); } catch { return current; } // 不存在：按普通新建文件处理
    if (!st.isSymbolicLink()) return current;
    current = path.resolve(path.dirname(current), fs.readlinkSync(current));
  }
  throw new Error(`无法解析 ${file}：软链接层级过深或成环（超过 ${MAX_LINK_HOPS} 跳）`);
}

// 落盘前的可写性校验：断链（链接目标所在目录不存在）会在写入时才抛 ENOENT，
// 那时 skill 已复制、目标项目已被改了一半。必须在覆盖任何东西之前先失败。
function assertWritableEntry(file, target) {
  const resolved = resolveLinkTarget(file);
  if (resolved === file) return resolved;
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    throw new Error(
      `无法写入 ${path.relative(target, file) || file}：它是软链接，指向 ${resolved}，` +
      `但该路径所在目录不存在。\n  请修复或删除这个断开的软链接后重试（安装未修改目标项目）。`,
    );
  }
  return resolved;
}

// 日志里始终显示用户认识的入口名；经软链接改写时把真正落盘的文件一并说清楚。
function entryLabel(file, resolved, target) {
  const name = path.relative(target, file) || file;
  if (resolved === file) return name;
  return `${name} → ${path.relative(target, resolved) || resolved}（软链接目标）`;
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
  // codegraph 的索引是本机 SQLite 库（体量大、与写它的操作系统绑定），必须留在本地。
  // 无条件写入：--no-codegraph 与默认安装产出同一个标记块，避免两种跑法来回改写 .gitignore。
  lines.push(`/${CODEGRAPH.indexDir}/`);
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

// ── ai-dev-workflow 标记块的字段模型 ───────────────────────────────────────────
// 契约来源：docs/spec/2026-08-16-项目真相源与context-tier重构-eng-spec.md §5 / §6.1 / §8.3
//（该 spec 已于 2.1.0 转归档，但字段模型这部分未被取代；现行口径见 CLAUDE.md §安装器的关键设计）。
// 代码事实层不设字段——它是每个项目的必备资产，与声明无关；代码图谱也不设字段——
// 由 skill 每次运行探测 .codegraph/codegraph.db 得出。因此这里解析出来的东西
// 只有协作维度与 worktree 目录。
const WORKFLOW_FIELDS = [
  { key: 'collaboration', values: ['solo', 'team'] },
  { key: 'merge-gate', values: ['direct', 'pr'] },
  { key: 'worktree-dir', values: null },
];
const WORKFLOW_DEFAULT_WORKTREE_DIR = './.worktrees/';
// 新字段格式要求的最低 skill 版本；比它旧的 skill 读不懂协作字段。
const WORKFLOW_FIELD_MIN_VERSION = '2.0.0';

function readWorkflowField(block, key) {
  return block?.match(new RegExp(`${key}="([^"]*)"`))?.[1] ?? null;
}

// 旧块识别 + 墓碑字段。保留至 3.0.0（spec §8.2 替换清单）：
// 没有它就读不到旧 mode，§8.1 第 4 条拍板的 merge-gate 推断也就无从谈起。
// 值非法（如 mode="invalid"）时返回 null——沿用旧行为：让另一个入口的有效块接管。
function getWorkflowMode(block) {
  const match = block?.match(/mode="(personal|team)"/);
  return match?.[1] || null;
}

// 读出标记块里的已知字段。读不出任何已知字段返回 null；
// 已知字段值非法则报错中止，MUST NOT 猜测（spec §9）。
function parseWorkflowBlock(block, label) {
  if (!block) return null;
  const parsed = { mode: getWorkflowMode(block) };
  let known = parsed.mode ? 1 : 0;
  for (const field of WORKFLOW_FIELDS) {
    const raw = readWorkflowField(block, field.key);
    if (raw === null) continue;
    if (field.values && !field.values.includes(raw)) {
      throw new Error(
        `安装校验失败：${label} 的 ai-dev-workflow 标记块 ${field.key}="${raw}" 不是合法值`
        + `（合法值：${field.values.map(v => `"${v}"`).join(' | ')}）`);
    }
    if (!field.values && !raw.trim()) {
      throw new Error(`安装校验失败：${label} 的 ai-dev-workflow 标记块 ${field.key} 不能为空`);
    }
    parsed[field.key] = raw;
    known++;
  }
  return known ? parsed : null;
}

// 旧值映射（spec §8.3）。三条边界，缺一条即偏离用户拍板：
//   1. 只映射协作维度——旧 mode="team" MUST NOT 推出别的任何东西（§8.1 第 2、3 条拍板"不兼容"）；
//   2. 推断结果必须告知且可当场改（由调用方打印前后对照）；
//   3. 告知文案不得使用 2.0.0 已废弃的旧项目类型说法（§8.1 第 1 条，无过渡期）。
function resolveWorkflowSettings(parsed) {
  if (!parsed) return null;
  const declared = parsed.collaboration ?? null;
  const collaboration = declared ?? (parsed.mode === 'team' ? 'team' : 'solo');
  const mergeGate = parsed['merge-gate'] ?? (collaboration === 'team' ? 'pr' : 'direct');
  const worktreeDir = parsed['worktree-dir'] ?? WORKFLOW_DEFAULT_WORKTREE_DIR;
  return {
    collaboration,
    mergeGate,
    worktreeDir,
    isNewFormat: declared !== null,
    // 任一字段是补出来的就要走迁移改写（并打印前后对照）
    migrated: declared === null || parsed['merge-gate'] == null || parsed['worktree-dir'] == null,
  };
}

function workflowFieldLine(settings) {
  // mode="team" 是墓碑：新 skill 完全忽略，留着只是让尚未升级的旧 skill 不硬失败。
  return `mode="team" collaboration="${settings.collaboration}"`
    + ` merge-gate="${settings.mergeGate}" worktree-dir="${settings.worktreeDir}"`;
}

function workflowFieldSummary(block) {
  const found = ['mode', ...WORKFLOW_FIELDS.map(f => f.key)]
    .map(key => { const v = readWorkflowField(block, key); return v === null ? null : `${key}="${v}"`; })
    .filter(Boolean);
  return found.join(' ') || '(无已知字段)';
}

function workflowHeaderBody(settings) {
  return `> **本项目采用 ai-dev-workflow**\n> (${workflowFieldLine(settings)})`;
}

function blockInner(block) {
  if (!block) return '';
  return block.slice(WORKFLOW_MODE_START.length, block.length - WORKFLOW_MODE_END.length).trim();
}

function applyWorkflowFields(body, settings) {
  let out = body
    .replace(/mode="[^"]*"/g, 'mode="team"')
    .replace(/collaboration="[^"]*"/g, `collaboration="${settings.collaboration}"`)
    .replace(/merge-gate="[^"]*"/g, `merge-gate="${settings.mergeGate}"`)
    .replace(/worktree-dir="[^"]*"/g, `worktree-dir="${settings.worktreeDir}"`);
  if (!/collaboration="/.test(out)) out = `${workflowHeaderBody(settings)}\n${out}`;
  return out.trim();
}

// 组装要写进 CLAUDE.md / AGENTS.md 的标记块：base.md（公共正文）+ collab-<协作面>.md。
function buildWorkflowBlock(skillsRoot, settings, existingBlock) {
  const dir = path.join(skillsRoot, 'ai-dev-workflow', 'assets', 'config-snippets');
  const parts = ['base.md', `collab-${settings.collaboration}.md`]
    .map(name => readTextIfExists(path.join(dir, name)))
    .map(text => blockInner(getMarkedBlock(text, WORKFLOW_MODE_START, WORKFLOW_MODE_END)) || text.trim())
    .filter(Boolean);
  let body = parts.join('\n');
  if (!body.trim()) {
    // 安装源里没有新片段（裁剪过的源）：新块原样保留正文以保证幂等；
    // 旧块只写规范化字段行——旧外壳正文含已废止的说法，MUST NOT 顺手留下。
    body = settings.isNewFormat ? blockInner(existingBlock) : '';
  }
  const withFields = applyWorkflowFields(body.trim() || workflowHeaderBody(settings), settings);
  return `${WORKFLOW_MODE_START}\n${withFields}\n${WORKFLOW_MODE_END}`;
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
    if (process.platform === 'win32') {
      const probe = spawnSync('where.exe', [command], { encoding: 'utf8', windowsHide: true });
      if (probe.status !== 0) continue;
    }
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      // Windows 的 npm 全局命令通常是 .cmd shim，Node 需要通过 shell 调用它。
      shell: process.platform === 'win32',
    });
    if (!result.error || result.error.code !== 'ENOENT') return result;
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

// 跨平台调用外部 CLI（codegraph / npm）：Windows 上全局命令多是 .cmd shim，Node 必须经 shell 调用。
// stdin 一律 'ignore'：codegraph 按 process.stdin.isTTY 决定要不要发问，关掉 stdin 就锁定它的
// 非交互分支——安装器不会被子进程的提示挂住，也不会替用户回答。
// quiet=false 时把子进程输出直接透传，让用户看到装包与索引进度。
function runTool(command, args, { cwd, quiet = false, timeout } = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    windowsHide: true,
    timeout,
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
  });
}

function toolFailed(result) {
  return Boolean(result.error) || result.status !== 0;
}

// ctx 的包目录（含 package.json 的 bin 声明）与脚本入口，都在刚复制好的 Claude Code 侧 skill 里。
// 只用 .claude/ 这一份：.agents/ 里是逐字节相同的副本，两份都 link 只会互相覆盖同一个全局命令。
function ctxPackageDir(target) {
  return path.join(target, '.claude', 'skills', CTX.skill, CTX.subdir);
}

// 兜底调用方式：全局命令没弄成时照样能用。必须打全路径，使用者（含 AI agent）才不会
// 把"ctx 命令不存在"误当成"Engineering Context 不可用"。
function ctxFallbackHint(target) {
  console.log('     ctx 本体已随 skill 落盘，仍可用兜底方式调用（功能完全相同）：');
  console.log(`     node ${path.join(ctxPackageDir(target), 'src', 'cli.js')} <命令>`);
}

// 探测 PATH 上的 ctx：present=命令跑得通，mine=确实是本体系这一个。
// 跨平台：经 runTool 调用（Windows 走 shell，认得 npm link 生成的 ctx.cmd shim），
// 不假设 unix 的可执行位或 which/command -v 的存在。
function detectCtx() {
  const r = runTool(CTX.bin, ['--help'], { quiet: true, timeout: CTX_CMD_TIMEOUT_MS });
  if (toolFailed(r)) return { present: false, mine: false };
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { present: true, mine: out.includes(CTX.signature) };
}

// npm link：在包目录里执行，npm 依据 package.json 的 bin 生成全局 shim
// （unix 是符号链接并自动补上可执行位，Windows 是 ctx.cmd）。
function linkCtxCli(dir) {
  console.log(`  → npm link（在 ${dir}）`);
  return !toolFailed(runTool('npm', ['link'], { cwd: dir, timeout: CTX_CMD_TIMEOUT_MS }));
}

function printCtxPlan(target, before) {
  if (before.present && !before.mine) {
    console.log('  · PATH 上已有另一个同名 ctx 命令 → [--dry-run] 将跳过链接，只打印兜底调用方式');
    return;
  }
  console.log(before.present
    ? '  · 本机已有本体系的 ctx → [--dry-run] 仍会重新链接，指向本次安装的这份'
    : '  · 本机没有 ctx 命令');
  console.log(`  · [--dry-run] 将在 ${ctxPackageDir(target)} 执行 npm link，并用 ctx --help 验证`);
}

// 主安装完成后执行（依赖 skill 已复制到位）。任何失败都只降级为警告：
// ctx 本体已经随 skill 落盘，用兜底方式一样能跑，不该把整个安装拖成失败。
function syncCtx(opt, target) {
  if (opt.noCtxLink) {
    console.log('\n· 跳过 ctx 全局链接（--no-ctx-link）');
    ctxFallbackHint(target);
    return;
  }
  console.log(`\nctx CLI（${CTX.why}）`);
  try {
    const dir = ctxPackageDir(target);
    const before = detectCtx();
    if (opt.dryRun) {
      printCtxPlan(target, before);
      return;
    }
    if (!fs.existsSync(path.join(dir, 'package.json'))) {
      console.log(`  · 本次未安装 ${CTX.skill} skill（其中才有 ctx），跳过全局链接`);
      return;
    }
    // `ctx` 是很常见的命令名。PATH 上已有一个不是我们的同名命令时，宁可不 link
    // 也不能悄悄顶掉用户自己的工具——直接给兜底调用方式。
    if (before.present && !before.mine) {
      console.log('  ⚠ PATH 上已有另一个同名 ctx 命令（不是本体系的），不做全局链接以免顶掉它。');
      ctxFallbackHint(target);
      return;
    }
    if (!linkCtxCli(dir)) {
      console.log('  ⚠ npm link 失败（常见原因：npm 全局目录没有写权限）。');
      console.log(`     可手动重试：cd ${dir} && npm link`);
      ctxFallbackHint(target);
      return;
    }
    // 装完必须真跑一次才算数：npm link 退出码为 0 只说明 shim 写出去了，
    // 不代表它落在 PATH 上、也不代表跑起来是我们这一个。不实测就报成功等于谎报。
    const after = detectCtx();
    if (!after.present) {
      console.log('  ⚠ npm link 跑通了，但 PATH 上仍找不到 ctx：多半是 npm 全局 bin 不在 PATH 上。');
      console.log('     把 `npm prefix -g` 目录下的 bin 加进 PATH 后重开终端，再重跑本安装器。');
      ctxFallbackHint(target);
      return;
    }
    if (!after.mine) {
      console.log('  ⚠ PATH 上的 ctx 不是本体系这一个（有同名命令排在前面），本次链接未生效。');
      ctxFallbackHint(target);
      return;
    }
    console.log(`  ✓ ctx 已全局可用（已实跑 ctx --help 验证）｜来源：${dir}`);
    console.log('     · ctx 按当前工作目录找 engineering-context/，在哪个项目里跑就查哪个项目。');
    console.log('     · 该目录被删除（如删掉本项目）后全局命令会失效，重跑安装器即可恢复。');
  } catch (e) {
    console.log(`  ⚠ ctx 全局链接中断（${e.message}），已跳过；skill 安装不受影响。`);
    ctxFallbackHint(target);
  }
}

// 未装 / 装了但版本判不出 / 正常，三种状态都要能区分：
// 未装决定"用 npm 装"，装了决定"用它自己的 upgrade 升"。
function detectCodegraph() {
  const r = runTool(CODEGRAPH.bin, ['--version'], { quiet: true, timeout: CODEGRAPH_CMD_TIMEOUT_MS });
  if (toolFailed(r)) return { present: false, version: null };
  const m = `${r.stdout || ''}`.match(/(\d+\.\d+\.\d+)/);
  return { present: true, version: m ? m[1] : null };
}

// 新版本检测交给 codegraph 自己的 `upgrade --check`（输出形如
// "CodeGraph  current v1.5.0  latest v1.5.0"）：它知道自己是 bundle / npm / npx 哪种装法，
// 我们不自己查 registry，也就不必跟着它的发布渠道变化走。
// 太旧的版本没有 upgrade 子命令、或输出改版时返回 null，由调用方走"直接尝试升级"的兜底。
function checkCodegraphUpdate() {
  const r = runTool(CODEGRAPH.bin, ['upgrade', '--check'], { quiet: true, timeout: CODEGRAPH_CMD_TIMEOUT_MS });
  if (toolFailed(r)) return null;
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const m = out.match(/current\s+v?(\d+\.\d+\.\d+)[\s\S]*?latest\s+v?(\d+\.\d+\.\d+)/);
  return m ? { current: m[1], latest: m[2] } : null;
}

// npm 是唯一跨平台可依赖的装法（Node 本来就是本安装器的前提）；
// 官方独立包要 curl|sh 或 PowerShell，分平台两套脚本，只作为失败后的手动提示。
function installCodegraphViaNpm(pin) {
  const spec = pin ? `${CODEGRAPH.npmPackage}@${pin}` : CODEGRAPH.npmPackage;
  console.log(`  → npm install -g ${spec}`);
  return !toolFailed(runTool('npm', ['install', '-g', spec], { timeout: CODEGRAPH_CMD_TIMEOUT_MS }));
}

function codegraphManualHint() {
  console.log(`     手动安装：npm install -g ${CODEGRAPH.npmPackage}`);
  console.log(`     或用官方独立包（不需要 Node）：${CODEGRAPH.repo}`);
}

// 返回可用的 CLI 状态；返回 null 表示本机没有可用的 codegraph，接线与建索引都不再进行。
function ensureCodegraphCli(local, update) {
  if (!local.present) {
    console.log('  · 本机未安装 codegraph');
    if (!installCodegraphViaNpm()) {
      console.log('  ⚠ 安装失败，本次跳过接线与建索引。');
      codegraphManualHint();
      return null;
    }
    const after = detectCodegraph();
    if (!after.present) {
      console.log('  ⚠ 装完仍找不到 codegraph 命令：多半是 npm 全局 bin 不在 PATH 上。');
      console.log('     把 `npm bin -g` 的目录加进 PATH 后重开终端，再重跑本安装器。');
      return null;
    }
    console.log(`  ✓ 已安装 v${after.version || '未知'}`);
    return after;
  }

  const localVersion = local.version || update?.current || null;
  const latest = update?.latest || null;
  console.log(`  · 本机 v${localVersion || '未知'}｜远端 ${latest ? `v${latest}` : '未知（版本检测失败，下面直接尝试升级）'}`);
  if (latest && localVersion && cmpVersion(latest, localVersion) <= 0) {
    console.log('  · 已是最新，跳过升级');
    return local;
  }

  // 升级优先用 codegraph 自己的 upgrade：它认得 bundle / npm / npx 三种装法并原地更新，
  // 我们盲目 npm 装会在独立包安装的机器上留下一个抢 PATH 的第二份副本。
  console.log('  → codegraph upgrade');
  let upgraded = !toolFailed(runTool(CODEGRAPH.bin, ['upgrade'], { timeout: CODEGRAPH_CMD_TIMEOUT_MS }));
  if (!upgraded) {
    console.log('  · codegraph upgrade 未成功（旧版本没有该子命令）→ 退回 npm 安装最新版');
    upgraded = installCodegraphViaNpm('latest');
  }
  const after = detectCodegraph();
  if (!after.present) {
    console.log('  ⚠ 升级后找不到 codegraph 命令，本次跳过接线与建索引。');
    codegraphManualHint();
    return null;
  }
  // 版本检测失败时我们是"盲升"：upgrade 退出码为 0 只说明命令跑通了，不代表真换了版本
  // （它自己会打印 Already up to date）。以升级前后的版本号为准报告，别把空转说成升级。
  if (!upgraded) console.log(`  ⚠ 升级失败，继续用本机 v${after.version || '未知'}`);
  else if (localVersion && after.version === localVersion) console.log(`  · 已是最新（v${after.version}），版本未变`);
  else console.log(`  ✓ 已升级到 v${after.version || '未知'}`);
  return after;
}

// 接线 = 把 codegraph 的 MCP server 写进 agent 配置。项目级只影响本项目
// （Claude Code 写项目根 .mcp.json 与 .claude/CLAUDE.md）；Codex CLI 没有项目级 MCP 配置，
// 项目级模式下它必然被跳过——必须明说，否则用户会以为 Codex 那侧也接上了。
function wireCodegraphAgents(location, target) {
  const scope = location === 'local' ? '项目级' : '全局';
  console.log(`  → codegraph install --target=auto --location=${location} --yes（${scope}）`);
  const r = runTool(
    CODEGRAPH.bin,
    ['install', '--target=auto', `--location=${location}`, '--yes'],
    { cwd: target, timeout: CODEGRAPH_CMD_TIMEOUT_MS },
  );
  if (toolFailed(r)) {
    console.log('  ⚠ agent 接线失败；索引仍可用命令行查询。稍后可在项目目录手动执行：');
    console.log(`     codegraph install --target=auto --location=${location} --yes`);
    return;
  }
  console.log(`  ✓ 已接线（${scope}）`);
  console.log('     · Claude Code：重启后加载 codegraph MCP server；项目级配置首次使用需批准。');
  if (location === 'local') {
    console.log('     · Codex CLI 没有项目级 MCP 配置，本次未接线；需要时执行（影响你所有项目）：');
    console.log('       codegraph install --target=codex --location=global --yes');
  }
}

function buildCodegraphIndex(target, indexed) {
  if (indexed) {
    console.log(`  · ${CODEGRAPH.indexDir}/ 已存在 → 跳过建索引（auto-sync 保持新鲜；重建用 codegraph index --force）`);
    return;
  }
  console.log('  → codegraph init（建立本仓库索引，大仓库需要几分钟）');
  const r = runTool(CODEGRAPH.bin, ['init'], { cwd: target, timeout: CODEGRAPH_INDEX_TIMEOUT_MS });
  const db = path.join(target, CODEGRAPH.indexDir, CODEGRAPH.dbFile);
  // 新版 init 一步完成"初始化 + 全量索引"，旧版只初始化。以磁盘上的索引文件为准，缺了就补跑。
  if (!toolFailed(r) && !fs.existsSync(db)) {
    console.log('  → codegraph index（init 未产出索引文件，补跑一次全量索引）');
    runTool(CODEGRAPH.bin, ['index'], { cwd: target, timeout: CODEGRAPH_INDEX_TIMEOUT_MS });
  }
  if (fs.existsSync(db)) {
    console.log(`  ✓ 索引已建立：${CODEGRAPH.indexDir}/${CODEGRAPH.dbFile}`);
  } else {
    console.log('  ⚠ 索引未建成，稍后可在项目目录手动执行：codegraph init');
  }
}

function printCodegraphPlan(opt, local, update, indexed) {
  if (!local.present) {
    console.log(`  · 本机未安装 → [--dry-run] 将执行 npm install -g ${CODEGRAPH.npmPackage}`);
  } else {
    const latest = update?.latest || null;
    const localVersion = local.version || update?.current || null;
    const verdict = latest && localVersion && cmpVersion(latest, localVersion) <= 0
      ? '已是最新，将跳过升级'
      : '将执行 codegraph upgrade';
    console.log(`  · 本机 v${localVersion || '未知'}｜远端 ${latest ? `v${latest}` : '未知（版本检测失败）'} → [--dry-run] ${verdict}`);
  }
  console.log(`  · [--dry-run] 将执行 codegraph install --target=auto --location=${opt.codegraphLocation} --yes`);
  console.log(indexed
    ? `  · ${CODEGRAPH.indexDir}/ 已存在 → [--dry-run] 将跳过建索引`
    : '  · [--dry-run] 将执行 codegraph init 建立本仓库索引');
}

// 主安装完成后执行。codegraph 是外部工具，任何一步失败都只降级为警告：
// skill、冲突设置与 .gitignore 此时已经落盘，不能被它拖成整体失败。
function syncCodegraph(opt, target) {
  if (opt.noCodegraph) {
    console.log('\n· 跳过 codegraph 检查与建索引（--no-codegraph）');
    return;
  }
  console.log(`\ncodegraph（${CODEGRAPH.why}）`);
  try {
    const local = detectCodegraph();
    const update = local.present ? checkCodegraphUpdate() : null;
    const indexed = fs.existsSync(path.join(target, CODEGRAPH.indexDir));
    if (opt.dryRun) {
      printCodegraphPlan(opt, local, update, indexed);
      return;
    }
    if (!ensureCodegraphCli(local, update)) return;
    wireCodegraphAgents(opt.codegraphLocation, target);
    buildCodegraphIndex(target, indexed);
  } catch (e) {
    console.log(`  ⚠ codegraph 步骤中断（${e.message}），已跳过；skill 安装不受影响。`);
    codegraphManualHint();
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
  // 入口可能是软链接（两个工具共用一份指导文件是常见做法）：写入落到链接目标，
  // 链接本身保持不变；断链在这里就失败，不留下改了一半的目标项目。
  const claudeEntry = assertWritableEntry(claudeFile, target);
  const agentsEntry = assertWritableEntry(codexAgentsFile, target);
  const sharedEntry = claudeEntry === agentsEntry;
  const initialClaudeRaw = readTextIfExists(claudeEntry);
  const initialAgentsRaw = readTextIfExists(agentsEntry);
  const claudeModeBlock = getMarkedBlock(initialClaudeRaw, WORKFLOW_MODE_START, WORKFLOW_MODE_END);
  const agentsModeBlock = getMarkedBlock(initialAgentsRaw, WORKFLOW_MODE_START, WORKFLOW_MODE_END);
  // 混合状态（spec §8.3）：两个入口各自解析，一律以 CLAUDE.md 为准；
  // CLAUDE.md 是旧块而 AGENTS.md 是新块时同样以 CLAUDE.md 为准，随即被下面的迁移改写补回新字段。
  const claudeParsed = parseWorkflowBlock(claudeModeBlock, entryLabel(claudeFile, claudeEntry, target));
  const agentsParsed = parseWorkflowBlock(agentsModeBlock, entryLabel(codexAgentsFile, agentsEntry, target));
  if ((claudeModeBlock || agentsModeBlock) && !claudeParsed && !agentsParsed) {
    throw new Error('安装校验失败：CLAUDE.md / AGENTS.md 的 ai-dev-workflow 标记块读不出任何已知字段'
      + `（已知字段：mode / ${WORKFLOW_FIELDS.map(f => f.key).join(' / ')}）`);
  }
  const existingModeBlock = claudeParsed ? claudeModeBlock : agentsModeBlock;
  const workflowSettings = resolveWorkflowSettings(claudeParsed || agentsParsed);
  const workflowModeBlock = workflowSettings
    ? buildWorkflowBlock(skillsRoot, workflowSettings, existingModeBlock)
    : null;
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
        console.log(`       Codex → ${entryLabel(codexAgentsFile, agentsEntry, target)}  (自动触发约束，仅影响本项目)`);
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
  if (opt.noCtxLink) {
    console.log('  6) 跳过 ctx 全局链接（--no-ctx-link）；ctx 仍可用 node <skill>/scripts/ctx/src/cli.js 调用');
  } else {
    console.log('  6) 把 skill 自带的 ctx CLI 链接成全局命令，并实跑 ctx --help 验证');
    console.log(`       npm link（在 ${path.join('.claude', 'skills', CTX.skill, CTX.subdir)}）`);
    console.log('       失败只降级为警告，并打印 node <skill>/scripts/ctx/src/cli.js 兜底调用方式');
  }
  if (opt.noCodegraph) {
    console.log('  7) 跳过 codegraph 检查与建索引（--no-codegraph）');
  } else {
    console.log('  7) 保持 codegraph 为最新，接线到 agent，并对本项目建立索引');
    console.log(`       未安装 → npm install -g ${CODEGRAPH.npmPackage}；已安装 → codegraph upgrade（已最新则跳过）`);
    console.log(`       codegraph install --target=auto --location=${opt.codegraphLocation} --yes`
      + (opt.codegraphLocation === 'local' ? '（仅本项目；Codex CLI 无项目级配置会被跳过）' : '（影响你所有项目）'));
    console.log(`       ${CODEGRAPH.indexDir}/ 不存在时 codegraph init 建索引（大仓库需要几分钟）；已存在则跳过`);
    console.log('       任何一步失败只降级为警告，不影响上面的 skill 安装');
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

  // 标记块迁移：改写前打印前后对照（spec §8.3 边界 2）。dry-run 同样展示。
  if (workflowSettings?.migrated) {
    console.log(`\n${HL}  ⚠ ai-dev-workflow 配置标记块将改写为新字段（改写前后对照）：${HL_END}`);
    console.log(`       旧：${workflowFieldSummary(existingModeBlock)}`);
    console.log(`       新：${workflowFieldLine(workflowSettings)}`);
    console.log(`       · 协作面沿用推断结果：${workflowSettings.collaboration === 'team'
      ? '存在其他人类协作方（collaboration="team"）'
      : '没有其他人类协作方（collaboration="solo"）'}。`);
    console.log(`       · 合并方式沿用推断结果：${workflowSettings.mergeGate === 'pr'
      ? '推送 + PR + 平台自动合并（merge-gate="pr"）'
      : '本地非快进合并（merge-gate="direct"）'}；如需改为另一种，改这一行即可。`);
    console.log('       · 代码事实一律走 engineering-context 卡片层，与这份声明无关；'
      + '有没有代码图谱索引则由每次唤起时探测得出。');
  }
  // 已装 skill 早于新字段格式而配置已是新格式：显式报告，不静默继续（spec §8.3）。
  if (workflowSettings?.isNewFormat && installedVersion
      && cmpVersion(installedVersion, WORKFLOW_FIELD_MIN_VERSION) < 0) {
    console.log(`\n${HL}  ⚠ skill 版本落后于配置：本项目标记块已是新字段格式（需 skill ≥ v${WORKFLOW_FIELD_MIN_VERSION}），`
      + `而已装 skill 为 v${installedVersion}。请重跑安装器升级 skill（本次运行即在做这件事；`
      + '其他协作者也需各自重跑一次，skill 目录不入库）。' + HL_END);
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
    syncCtx(opt, target);
    syncCodegraph(opt, target);
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
    const raw = readTextIfExists(agentsEntry);
    const merged = mergeMarkedBlock(
      raw,
      codexGuardBlock(codexToDisable),
      CODEX_GUARD_START,
      CODEX_GUARD_END,
    );
    fs.writeFileSync(agentsEntry, merged);
    assertCodexGuard(readTextIfExists(agentsEntry), codexToDisable, agentsEntry);
    console.log(`✓ 已在 ${entryLabel(codexAgentsFile, agentsEntry, target)} 写入并校验 Codex 自动触发约束（仅本项目）`);
  } else if (codexToKeep.length) {
    const raw = readTextIfExists(agentsEntry);
    const withoutGuard = removeMarkedBlock(raw, CODEX_GUARD_START, CODEX_GUARD_END);
    if (withoutGuard !== raw) {
      fs.writeFileSync(agentsEntry, withoutGuard);
      console.log(`✓ 已从 ${entryLabel(codexAgentsFile, agentsEntry, target)} 移除 Codex 自动触发约束`);
    }
  }

  // 2c) 若任一入口已有 mode，幂等同步到两个入口，修复旧安装只写一个文件的状态。
  // 两个入口指向同一实体文件（一方是另一方的软链接）时只写一次，避免二次写入
  // 用过期内容盖掉刚写好的结果。
  if (workflowModeBlock) {
    const entries = sharedEntry ? [claudeEntry] : [claudeEntry, agentsEntry];
    for (const entry of entries) {
      const raw = readTextIfExists(entry);
      fs.writeFileSync(entry, mergeMarkedBlock(raw, workflowModeBlock, WORKFLOW_MODE_START, WORKFLOW_MODE_END));
      assertMarkedBlock(readTextIfExists(entry), WORKFLOW_MODE_START, WORKFLOW_MODE_END, entry);
    }
    console.log(sharedEntry
      ? `✓ 已同步并校验 ${path.relative(target, claudeEntry) || claudeEntry} 的 ai-dev-workflow 配置标记块（CLAUDE.md 与 AGENTS.md 共用此文件）`
      : '✓ 已同步并校验 CLAUDE.md / AGENTS.md 的 ai-dev-workflow 配置标记块');
  }

  if (codexMode === 'uninstall' && codexToDisable.length) {
    const raw = readTextIfExists(agentsEntry);
    const withoutGuard = removeMarkedBlock(raw, CODEX_GUARD_START, CODEX_GUARD_END);
    if (withoutGuard !== raw) {
      // 只删安装器自己创建出来的空 AGENTS.md；入口是软链接时既不删链接也不删它
      // 指向的共用文件，改为写回去掉约束块后的内容。
      const isPlainOwnFile = agentsEntry === codexAgentsFile;
      if (!withoutGuard.trim() && !initialAgentsRaw.trim() && !workflowModeBlock && isPlainOwnFile) {
        fs.rmSync(agentsEntry, { force: true });
      } else {
        fs.writeFileSync(agentsEntry, withoutGuard);
      }
      console.log(`✓ 已移除 ${entryLabel(codexAgentsFile, agentsEntry, target)} 的 Codex 自动触发约束（已改为全局卸载）`);
    }
  }

  // 3) 伴生 skill：装到用户级目录，失败只警告，不影响上面已完成的项目安装
  syncCompanions(opt, homedir());

  // 4) ctx：把随 skill 落盘的 CLI 链接成全局命令；失败只警告并给出兜底调用方式
  syncCtx(opt, target);

  // 5) codegraph：保持最新 + 接线 + 建索引；同样失败只警告
  syncCodegraph(opt, target);

  console.log('\n完成。下一步：');
  console.log('  · 重启 Claude Code / Codex（或在本项目重新打开），项目级配置/指令才会进入新会话。');
  console.log('  · 在项目里唤起 skill（提到"AI 辅助开发 / 生成 spec / coding plan / 需求澄清"即可），');
  console.log('    首次会询问本项目是否有其他人类协作方与合并方式，并写入 CLAUDE.md 与 AGENTS.md；');
  console.log('    代码事实一律走 engineering-context 卡片层，无需回答；有没有代码图谱索引由每次唤起时探测得出。');
  } finally {
    source?.cleanup();
  }
}

main().catch(e => { console.error(`✗ ${e.message}`); process.exit(1); });
