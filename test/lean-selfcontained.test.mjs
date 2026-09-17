// Lean 自足册覆盖率检查（spec §6 Invariant 4 / FR-008 / AC-009）
//
// 这条闸拦的失败模式只有一个：**自足册漏抄纪律**。
// Lean 路径按设计不读常驻篇、不读总纲，判据全靠 `路径-lean.md` 这一册自带；
// 漏抄一条 MUST，Lean 就会在没有判据的情况下把改动做完，而且不会有任何报错。
//
// 判定方式（三句话）：
//   1. 从「来源清单」十个文件里，按**小节粒度**抽出「适用于 Lean 的 MUST 小节」；
//   2. 每个这样的小节，都要求「被检查方」（自足册 + 入口）里存在一条**标注了该来源的要点**；
//   3. 匹配靠**来源锚点**（`来源：<文件> §<小节>`），不靠文本相似度——
//      自足册要点是改写过的浓缩表述，与原文逐字比对必然假阴性。
//
// 两条设计红线：
//   - `references/core/路径-lean.md` **MUST NOT 进来源清单**，它只作被检查方。
//     自己抄自己永远绿，那样这条闸就恒真了。
//   - 「不适用于 Lean」**MUST 显式枚举 + 逐条写理由**（见 EXCLUDED），MUST NOT 用启发式猜。
//     猜错就是静默漏覆盖，而这条闸的全部价值就在于不漏。

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_ROOT = path.join(REPO_ROOT, 'dw-system', 'skills', 'dw-workflow');

/** 仓库内路径统一写正斜杠，落到文件系统时再按平台拼接。 */
const toAbs = (rel) => path.join(SKILL_ROOT, ...rel.split('/'));
const baseName = (rel) => rel.slice(rel.lastIndexOf('/') + 1);

// ---------------------------------------------------------------------------
// 来源清单：十个文件，相对 dw-system/skills/dw-workflow/
// solo 与 team **取并集**——自足册要同时服务两种协作面，装了本体系的项目只会加载其中一份，
// 但自足册这一册两边都要用，所以两边直管 Lean 的 MUST 都得在里面。
// ---------------------------------------------------------------------------
const SOURCES = [
  'references/core/00-流程总纲.md',
  'references/core/代码事实纪律.md',
  'references/core/用户沟通纪律.md',
  'references/core/上下文卫生.md',
  'references/core/worktree开发纪律.md',
  'references/core/代码评审纪律.md',
  'references/core/文档治理.md',
  'references/core/spec写作纪律.md',
  'references/collab/solo.md',
  'references/collab/team.md',
];

/** 自足册本体，只作被检查方；进来源清单即自指。 */
const SELF_CONTAINED_BOOKLET = 'references/core/路径-lean.md';

/**
 * 被检查方 = 自足册 + 入口。
 * 入口也是被检查方：工作区隔离门在 Triage 之前，那一刻手里只有 SKILL.md，
 * 所以落在入口的要点同样算覆盖（spec §4.1 判据分配算法第 1 步）。
 */
const CHECKED = [SELF_CONTAINED_BOOKLET, 'SKILL.md'];

// ---------------------------------------------------------------------------
// 排除清单：显式枚举「含 MUST 但不适用于 Lean」的小节，逐条写明理由。
// 每条的 file / section 必须与源文件里的小节标题**逐字一致**——
// 小节改名后排除项会静默失效，那等于偷偷放宽了检查面，所以下面有一条护栏断言盯着它。
// ---------------------------------------------------------------------------
const EXCLUDED = [
  {
    file: 'references/core/00-流程总纲.md',
    section: '按边界拆 spec',
    reason:
      'Lean 恒为单边界：分流默认倾向判据①「本次要改的能力在 registry 里跨 ≥2 个权威仓库」一律升级到完整流程，'
      + '走到自足册就说明本次没跨边界。本节规定的「按边界划分 spec、每份写进对应仓库、Overview 先于它们定稿」'
      + '在 Lean 上没有适用对象，且 Lean 从不产出 Overview。',
  },
  {
    file: 'references/core/00-流程总纲.md',
    section: '大 PRD 先做垂直切片，再按边界拆',
    reason:
      '本节处理的是「一份 PRD 含多个可独立交付的能力」，拆完每个切片再各自走 Overview → 按边界出 spec，'
      + '发生在完整流程里。Lean 的输入是单个已收窄的小改动，不承接大 PRD，也不产出 feature Issue 组。',
  },
  {
    file: 'references/core/00-流程总纲.md',
    section: '多边界的合并顺序',
    reason:
      '同「按边界拆 spec」：Lean 恒单边界，不存在「多边界改动全部过门后按依赖顺序合并」这件事。'
      + 'Lean 的合并由 §完成与自动合并门 一条覆盖，该节已在必覆盖集内。',
  },
  {
    file: 'references/collab/team.md',
    section: '2. 评审会',
    reason:
      '本节两条 MUST 的前件在 Lean 上都不可能成立：①「跨 ≥3 仓的需求，Step 2 出 Overview 后 MUST 开评审会」'
      + '——Lean 不跨仓（跨 ≥2 权威仓库一律升级）也不产出 Overview（`路径-lean.md` §与用户沟通 明写「Lean 从不产出 Overview」）；'
      + '②「评审结论 MUST 回写进 Overview 的已定决策表」——没有 Overview 可回写。'
      + '注意这条排除**不豁免结论落盘**：已定决策照样要落进 Lean Change Spec，判据在 `collab/solo.md` §1，该节在必覆盖集内。',
  },
  {
    file: 'references/collab/team.md',
    section: '5. 多仓合并顺序协商',
    reason:
      '前件是「多仓需求全部就绪后」。Lean 恒单仓（判据同上），不存在要与各仓 owner 协商的合并顺序。'
      + 'team 协作面下 Lean 仍需做的合并动作在 §4 PR 平台动作 里，该节在必覆盖集内。',
  },
];

// ---------------------------------------------------------------------------
// markdown 小节解析
// ---------------------------------------------------------------------------

/** 围栏代码块里的 `##` 是 prompt 模板的段落标题，不是小节标题（`代码评审纪律.md` 的 :42-140 就是一整块）。 */
function splitSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = null;
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      if (current) current.body.push(line);
      continue;
    }
    if (!inFence) {
      const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
      if (m) {
        current = { level: m[1].length, title: m[2], body: [] };
        sections.push(current);
        continue;
      }
    }
    if (current) current.body.push(line);
  }
  // 三级标题自成一节：父节的正文只算到第一个子标题为止，
  // 这样 `文档治理.md §5 账本的读取纪律` 这类被 spec 点名的小节才有自己的锚点。
  return sections.map((s) => ({ level: s.level, title: s.title, body: s.body.join('\n') }));
}

/** 一节里的 MUST 条目（MUST / MUST NOT 都算，`\b` 前后是中文时同样成立）。 */
function mustLines(body) {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /\bMUST\b/.test(l));
}

/**
 * 锚点键：小节标题截到第一个 `（ ( ： : ， , 、` 为止。
 * 为什么截：完整标题（`Step 0：需求体量与风险分流（Triage）`）写进要点里既长又易抄错，
 * 而截出来的头部（`Step 0`）在同一文件内已足够唯一（下面有护栏断言逐文件验唯一性）。
 */
function anchorKey(title) {
  const cut = title.search(/[（(：:，,、]/);
  return (cut === -1 ? title : title.slice(0, cut)).trim();
}

/** 归一化：抹掉反引号 / 加粗号 / 全角空格 / 弯引号，让锚点匹配不受排版影响。 */
function normalize(s) {
  return s
    .replace(/[`*]/g, '')
    .replace(/[　 ]/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// 必覆盖集：来源清单各文件里「含 MUST 且适用于 Lean」的小节
// ---------------------------------------------------------------------------
function isExcluded(file, title) {
  return EXCLUDED.some((e) => e.file === file && e.section === title);
}

function buildRequired() {
  const required = [];
  for (const rel of SOURCES) {
    const text = fs.readFileSync(toAbs(rel), 'utf8');
    for (const sec of splitSections(text)) {
      const musts = mustLines(sec.body);
      if (musts.length === 0) continue;          // 不含 MUST 的小节不是本闸的对象
      if (isExcluded(rel, sec.title)) continue;  // 显式排除，理由见 EXCLUDED
      required.push({
        file: rel,
        base: baseName(rel),
        title: sec.title,
        key: anchorKey(sec.title),
        mustCount: musts.length,
        musts,
      });
    }
  }
  return required;
}

// ---------------------------------------------------------------------------
// 来源锚点解析
//
// 约定形态（Task 9 按此标注）：  来源：`<文件>` §<小节>
// 一行里可以标多个来源，用 `；` 分组，每组一个文件；同一文件的多个小节可在同组内并列：
//   > 来源：`文档治理.md` §硬规则、§5 账本的读取纪律；`spec写作纪律.md` §2 RFC 2119 规范性措辞
// 文件名允许带路径前缀（`references/core/…` / `core/…`），按 basename 匹配。
// ---------------------------------------------------------------------------
function collectAnchorGroups(files) {
  const groups = [];
  for (const rel of files) {
    const abs = toAbs(rel);
    if (!fs.existsSync(abs)) continue;
    const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    lines.forEach((raw, i) => {
      const line = normalize(raw);
      const at = line.search(/来源\s*[：:]/);
      if (at === -1) return;
      const segment = line.slice(at).replace(/来源\s*[：:]/, '');
      for (const group of segment.split(/[；;]/)) {
        const names = [...group.matchAll(/([\w一-龥㐀-䶿.\-/]+\.md)/g)].map((m) =>
          baseName(m[1].replace(/\\/g, '/')),
        );
        if (names.length === 0) continue;
        groups.push({ from: rel, line: i + 1, names, text: group });
      }
    });
  }
  return groups;
}

function isCovered(item, groups) {
  const needle = '§' + normalize(item.key);
  return groups.some((g) => g.names.includes(item.base) && g.text.includes(needle));
}

// ---------------------------------------------------------------------------
// 护栏断言：防这条闸自己退化
// ---------------------------------------------------------------------------

test('护栏：来源清单与被检查方的文件都存在，且自足册不在来源清单里', () => {
  assert.ok(
    !SOURCES.includes(SELF_CONTAINED_BOOKLET),
    `自足册 ${SELF_CONTAINED_BOOKLET} MUST NOT 进来源清单——自己抄自己会让本闸恒真。`,
  );

  const missing = [...SOURCES, ...CHECKED].filter((rel) => !fs.existsSync(toAbs(rel)));
  assert.deepEqual(
    missing,
    [],
    `下列文件不存在（改名或移动后，本闸会静默少检一整个文件）：\n  - ${missing.join('\n  - ')}`,
  );
});

test('护栏：排除清单里的每个小节都真实存在、确实含 MUST、且写了理由', () => {
  const problems = [];
  for (const e of EXCLUDED) {
    if (!e.reason || e.reason.trim().length < 10) {
      problems.push(`【无理由】${e.file} §${e.section} —— 排除项 MUST 逐条写明为什么不适用于 Lean。`);
      continue;
    }
    const abs = toAbs(e.file);
    if (!fs.existsSync(abs)) {
      problems.push(`【文件不存在】${e.file}（排除项指向一个已经没有的文件）`);
      continue;
    }
    const titles = splitSections(fs.readFileSync(abs, 'utf8'));
    const hit = titles.find((s) => s.title === e.section);
    if (!hit) {
      problems.push(
        `【小节不存在】${e.file} §${e.section}\n`
        + `    小节改名后这条排除会静默失效，等于偷偷放宽检查面。\n`
        + `    该文件现有小节：${titles.map((s) => s.title).join(' / ')}`,
      );
      continue;
    }
    if (mustLines(hit.body).length === 0) {
      problems.push(
        `【排除项已失效】${e.file} §${e.section} 现在一条 MUST 都没有，本就不会进必覆盖集。\n`
        + `    这条排除项 MUST 删掉，留着只会掩盖「这一节的 MUST 是什么时候没的」。`,
      );
    }
  }
  assert.deepEqual(problems, [], `排除清单自身有问题：\n  ${problems.join('\n  ')}`);
});

test('护栏：每个来源文件至少贡献一个必覆盖小节，且锚点键在文件内唯一', () => {
  const required = buildRequired();

  const emptyFiles = SOURCES.filter((rel) => !required.some((r) => r.file === rel));
  assert.deepEqual(
    emptyFiles,
    [],
    `下列来源文件一个必覆盖小节都没抽出来，多半是小节结构变了或被整篇排除：\n  - ${emptyFiles.join('\n  - ')}`,
  );

  const collisions = [];
  for (const rel of SOURCES) {
    const seen = new Map();
    for (const item of required.filter((r) => r.file === rel)) {
      if (seen.has(item.key)) {
        collisions.push(`${rel}：§${seen.get(item.key)} 与 §${item.title} 的锚点键都是「${item.key}」`);
      }
      seen.set(item.key, item.title);
    }
  }
  assert.deepEqual(
    collisions,
    [],
    `同一文件内出现重复的锚点键，标了来源也分不清指哪一节：\n  - ${collisions.join('\n  - ')}`,
  );
});

// ---------------------------------------------------------------------------
// 主断言：Invariant 4
// ---------------------------------------------------------------------------

test('Invariant 4：来源清单里每个适用于 Lean 的 MUST 小节，都能在自足册或入口里找到标注了该来源的要点', () => {
  const required = buildRequired();
  const groups = collectAnchorGroups(CHECKED);
  const missing = required.filter((item) => !isCovered(item, groups));

  if (missing.length > 0) {
    const byFile = new Map();
    for (const item of missing) {
      if (!byFile.has(item.file)) byFile.set(item.file, []);
      byFile.get(item.file).push(item);
    }

    const report = [];
    report.push(
      `自足册覆盖率不达标：必覆盖 ${required.length} 个小节，缺 ${missing.length} 个。`,
    );
    report.push(
      `被检查方：${CHECKED.join('、')}（当前共解析到 ${groups.length} 组来源锚点）。`,
    );
    report.push(
      '每条要点在自足册里 MUST 显式标注来源，形如：  来源：`<文件>` §<小节>',
    );
    report.push('');
    for (const [file, items] of byFile) {
      report.push(`■ ${file}（缺 ${items.length} 节）`);
      for (const item of items) {
        report.push(`  ✗ §${item.title}`);
        report.push(`    期望锚点：来源：\`${item.base}\` §${item.key}`);
        report.push(`    该小节的 MUST 条目共 ${item.mustCount} 条，摘要：`);
        for (const line of item.musts.slice(0, 4)) {
          const brief = line.length > 110 ? line.slice(0, 110) + '…' : line;
          report.push(`      · ${brief}`);
        }
        if (item.musts.length > 4) {
          report.push(`      · （其余 ${item.musts.length - 4} 条见 ${item.file} §${item.title}）`);
        }
      }
      report.push('');
    }
    report.push(
      '处置：把缺的判据要点补进 `references/core/路径-lean.md`（Task 9），'
      + 'MUST NOT 靠删来源清单或放宽排除清单转绿——那样 Lean 会在没有判据的情况下把改动做完。',
    );
    assert.fail(report.join('\n'));
  }
});
