import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  discover,
  getCard,
  findScenes,
  listServices,
  initScaffold,
} from '../src/commands.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctxDir = path.join(here, '..', 'fixtures', 'engineering-context');
const cliPath = path.join(here, '..', 'src', 'cli.js');

/** 三列最小 registry（无 cards/），返回 ctx 目录供命令层直接读。 */
function withMinimalCtx(rows, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-min-'));
  try {
    const base = path.join(tmp, 'engineering-context');
    fs.mkdirSync(base, { recursive: true });
    const table = ['| Capability | 权威实现 | 陷阱项（废弃或中间产物） |', '|---|---|---|', ...rows].join('\n');
    fs.writeFileSync(path.join(base, 'capability-registry.md'), `# Capability Registry\n\n${table}\n`, 'utf8');
    return fn(base, tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function runCli(args, cwd) {
  return execFileSync(process.execPath, [cliPath, ...args], { cwd, encoding: 'utf8' });
}

test('discover 命中关键词返回相关 card 与 cite', () => {
  const r = discover(ctxDir, '背单词 记录 接口');
  assert.ok(r.cards.length >= 1, '应返回至少一个 card');
  assert.ok(r.cards[0].cite, '每条结果需带 cite');
  assert.match(r.cards[0].cite, /@/, 'cite 应含确认时间');
});

test('discover 命中含废弃标记的 card 时给出 out-of-scope 警告', () => {
  const r = discover(ctxDir, '背单词 记录 接口');
  assert.ok(r.cards.length >= 1);
  assert.ok(r.outOfScope.length >= 1, '命中含废弃标记的 card 应产生 out-of-scope 警告');
  assert.ok(
    r.outOfScope.some((w) => /v1\/word\/record/.test(w)),
    'out-of-scope 应点名废弃的 v1 接口',
  );
});

test('discover 的 cite 锚点指向命中段落而非固定值', () => {
  const r = discover(ctxDir, '背单词 记录 接口');
  const anchor = /#([^@\]]+?) @/.exec(r.cards[0].cite)?.[1];
  assert.ok(anchor && anchor.trim().length > 0, 'cite 应含非空锚点');
});

test('discover 对无关意图返回空或 out-of-scope 提示', () => {
  const r = discover(ctxDir, 'zzz-完全无关的东西-qqq');
  assert.equal(r.cards.length, 0);
  assert.ok(r.outOfScope.length >= 1, '零命中时应给出提示');
});

test('getCard 返回指定服务的段落', () => {
  const c = getCard(ctxDir, 'sample-service', '对外接口');
  assert.ok(c, '应找到 card');
  assert.match(c.content, /v2\/word\/record/);
  assert.ok(c.cite);
});

test('listServices 返回已登记服务', () => {
  const names = listServices(ctxDir).map((s) => s.service);
  assert.ok(names.includes('sample-service'));
});

test('findScenes 无 scenes 目录时返回空数组', () => {
  const r = findScenes(ctxDir, '背单词');
  assert.ok(Array.isArray(r));
});

test('findScenes 排除 scenes/README.md 索引文件', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scenes-'));
  try {
    const scenesDir = path.join(tmp, 'scenes');
    fs.mkdirSync(scenesDir, { recursive: true });
    fs.writeFileSync(path.join(scenesDir, 'README.md'), '# 场景索引\n- 背单词提交链路\n');
    fs.writeFileSync(path.join(scenesDir, '背单词提交链路.md'), '# 背单词提交链路\n覆盖背单词记录提交。\n');
    const r = findScenes(tmp, '背单词 提交');
    assert.ok(r.length >= 1, '真实场景文件应命中');
    assert.ok(!r.some((s) => s.scene.toLowerCase() === 'readme'), 'README 索引不得作为场景返回');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('discover 在只有三列 registry、没有 cards 时仍给出能力命中（不报错）', () => {
  withMinimalCtx(['| 登录 | src/auth/login.ts::login() | src/auth/legacy_login.ts（旧实现，勿改） |'], (base) => {
    const r = discover(base, '登录');
    assert.equal(r.cards.length, 0, '没有 card 时 cards 为空');
    assert.ok(r.capabilities.length >= 1, '三列 registry 的能力命中 MUST 进结果');
    assert.equal(r.capabilities[0].capability, '登录');
    assert.match(r.capabilities[0].canonical, /login\.ts/);
    assert.match(r.capabilities[0].cite, /capability-registry\.md#登录/);
    assert.ok(
      r.outOfScope.some((w) => /legacy_login/.test(w)),
      '陷阱项列 MUST 变成 out-of-scope 警告',
    );
    assert.ok(!r.outOfScope.some((w) => /未命中任何 card/.test(w)), '有能力命中就不该报"未命中"');
  });
});

test('discover 对 freshness 空列标注「未声明新鲜度」，不假定新鲜', () => {
  withMinimalCtx(['| 登录 | src/auth/login.ts::login() | 无 |'], (base) => {
    const r = discover(base, '登录');
    const hit = r.capabilities[0];
    assert.equal(hit.freshness, '未声明新鲜度');
    assert.equal(hit.freshnessDeclared, false);
    assert.match(hit.cite, /@未声明新鲜度/, 'cite MUST 显式写明未声明，不得伪装成已确认');
  });
});

test('listServices 列出没有 card 的 registry 能力（三行 registry 即可起步）', () => {
  withMinimalCtx(['| 登录 | src/auth/login.ts::login() | 无 |'], (base) => {
    const r = listServices(base);
    assert.ok(r.length >= 1, 'registry-only 项目的 list-services MUST 非空');
    assert.ok(r.some((s) => s.capabilities.includes('登录')));
  });
});

test('initScaffold --minimal 只生成 capability-registry.md', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-'));
  try {
    const { base, files } = initScaffold(tmp, { minimal: true });
    assert.ok(fs.existsSync(path.join(base, 'capability-registry.md')));
    assert.deepEqual(fs.readdirSync(base), ['capability-registry.md'], '最小骨架只有 registry 一个文件');
    assert.deepEqual(files, ['capability-registry.md']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('--minimal 生成的 registry 含三列最小 schema，且只有模板行时视为未启用', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-'));
  try {
    const { base } = initScaffold(tmp, { minimal: true });
    const raw = fs.readFileSync(path.join(base, 'capability-registry.md'), 'utf8');
    assert.match(raw, /\|\s*Capability\s*\|\s*权威实现\s*\|\s*陷阱项（废弃或中间产物）\s*\|/);
    assert.equal(listServices(base).length, 0, '只有模板行 → 未启用权威位');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI init --minimal 在目标目录只落一个 registry 文件', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-cli-'));
  try {
    const stdout = runCli(['init', '--minimal', '--dir', tmp], tmp);
    assert.deepEqual(fs.readdirSync(path.join(tmp, 'engineering-context')), ['capability-registry.md']);
    assert.match(stdout, /capability-registry\.md/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI discover 人读输出标注未声明新鲜度', () => {
  withMinimalCtx(['| 登录 | src/auth/login.ts::login() | 无 |'], (base, tmp) => {
    const stdout = runCli(['discover', '登录', '--dir', base], tmp);
    assert.match(stdout, /未声明新鲜度/);
  });
});

test('CLI --help 首行签名串固定为 "ctx — Engineering Context CLI"', () => {
  // install.mjs 靠这一行判定 PATH 上的 ctx 是不是我们这一个；改动会静默打断该判定。
  const stdout = runCli(['--help'], here);
  assert.equal(stdout.split(/\r?\n/)[0], 'ctx — Engineering Context CLI');
});

test('initScaffold 生成 engineering-context 骨架', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-'));
  try {
    initScaffold(tmp);
    const base = path.join(tmp, 'engineering-context');
    assert.ok(fs.existsSync(path.join(base, 'capability-registry.md')));
    assert.ok(fs.existsSync(path.join(base, 'cards')));
    assert.ok(fs.existsSync(path.join(base, 'probe-set.md')));
    assert.ok(fs.existsSync(path.join(base, 'glossary.md')));
    assert.ok(fs.existsSync(path.join(base, 'scenes', 'README.md')), 'scenes/ 目录与索引 README 应被脚手架创建');
    assert.equal(findScenes(base, '任意关键词').length, 0, 'scenes 索引 README 不得被当作场景命中');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
