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

test('initScaffold --minimal 只生成 registry 与 .gitignore', () => {
  // .gitignore 必须一起生成：--minimal 之后手写 probe-set 再跑 ctx probe，
  // .index/probe-history.json 会变成未忽略的脏文件。除这两个之外 MUST NOT 多生成
  // 任何东西——cards/ scenes/ probe-set/ glossary 那一整套正是 --minimal 要省掉的。
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-'));
  try {
    const { base, files } = initScaffold(tmp, { minimal: true });
    assert.ok(fs.existsSync(path.join(base, 'capability-registry.md')));
    assert.deepEqual(fs.readdirSync(base).sort(), ['.gitignore', 'capability-registry.md']);
    assert.deepEqual(files, ['capability-registry.md', '.gitignore']);
    assert.match(fs.readFileSync(path.join(base, '.gitignore'), 'utf8'), /\.index\//);
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

test('CLI init --minimal 在目标目录只落 registry 与 .gitignore', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-cli-'));
  try {
    const stdout = runCli(['init', '--minimal', '--dir', tmp], tmp);
    assert.deepEqual(fs.readdirSync(path.join(tmp, 'engineering-context')).sort(), ['.gitignore', 'capability-registry.md']);
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

test('probe --dir：A 类与 B 类题型 MUST 读同一份 registry（回归：cli 曾漏传 ctxDir）', () => {
  // cli.js 若不把已解析的 ctxDir 传给 evaluateGate，B 类交接题型会退回
  // <cwd>/engineering-context 兜底，而 A 类题型读 --dir 指定的目录——同一次运行里
  // 两类题看两份不同的 registry：--dir 下 list-services 认得出权威位，
  // implementation-usable 却判"直读"并因模块缺失报 RED。这条测试跑真实 CLI 覆盖那一层。
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-probe-root-'));
  const ctxElsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-probe-ctx-'));
  try {
    // 项目根故意不放 engineering-context/。模块路径校验是无条件的（能力位只叠加、不豁免），
    // 所以架构节列的路径要真实存在——这条测试考的是 ctxDir 有没有被 cli 传下去：
    // 没传的话 detectCapabilityBits 读不到那份 registry，actual 里就不会出现"权威位"。
    fs.writeFileSync(path.join(root, 'README.md'),
      '# P\n\n## 架构与边界\n\n- `src/app.js` 是入口\n', 'utf8');
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app.js'), '', 'utf8');
    fs.writeFileSync(path.join(ctxElsewhere, 'capability-registry.md'),
      '| Capability | 权威实现 | 陷阱项（废弃或中间产物） |\n|---|---|---|\n'
      + '| 下单 | POST /v2/orders | POST /v1/order |\n', 'utf8');
    fs.writeFileSync(path.join(ctxElsewhere, 'probe-set.md'),
      '## 探针\n| # | 类型 | 输入 | 期望 |\n|---|---|---|---|\n'
      + '| 1 | implementation-usable | README.md#架构与边界 | usable |\n'
      + '\n## 基线（棘轮）\n（空）\n', 'utf8');

    // 用 --json 断言：人读输出在**通过**时不打印 actual，只有失败才打印"实得："，
    // 拿 stdout 匹配关键词会在真通过时也查不到，得出相反结论。
    const report = JSON.parse(runCli(['probe', '--dir', ctxElsewhere, '--json'], root));
    const r = report.results[0];
    assert.equal(r.pass, true, `应走权威位分支，实得：${r.actual}`);
    assert.match(r.actual, /权威位/, 'actual 须表明命中的是权威位分支——registry 在 --dir 指定的目录里');
    assert.doesNotMatch(r.actual, /直读/, 'ctxDir 生效时不应退回直读分支');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(ctxElsewhere, { recursive: true, force: true });
  }
});

// ---- P0 回归：大输出经管道不得被截断 ----

test('--json 大输出经管道仍是完整合法 JSON（MUST NOT 用 process.exit 收尾）', () => {
  // console.log 写管道是异步的，process.exit() 会立刻终止进程并丢掉未 flush 的部分：
  // 重定向到文件是完整的，经管道只剩 64KB 且退出码仍为 0——README 教的
  // `ctx probe --json | jq` 这类 CI 用法会静默拿到"截断后的合法前缀"。
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-pipe-'));
  try {
    const base = path.join(tmp, 'engineering-context');
    fs.mkdirSync(path.join(base, 'cards'), { recursive: true });
    const big = 'x'.repeat(400_000); // 必须远大于 64KB 管道缓冲
    fs.writeFileSync(path.join(base, 'cards', 'big.md'), `# big\n\n## 职责\n${big}\n`, 'utf8');

    // execFileSync 的 stdio 是管道，正是会触发截断的那条路径
    const outText = runCli(['get-card', 'big', '职责', '--json'], tmp);
    assert.ok(outText.length > 200_000, `管道输出被截断了，实得 ${outText.length} 字节`);
    const parsed = JSON.parse(outText); // 截断时这里会抛 Unterminated string
    assert.ok(parsed.content.includes(big), '段落正文 MUST 完整送出');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
