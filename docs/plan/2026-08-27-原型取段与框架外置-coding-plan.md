---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-08-27'
authority_refs:
  - 'preview.mjs 的 cmdExtract / composeTemplate / FRAMEWORK 装配表签名'
  - 'assets/templates/ui-prototype-framework/ 六个源文件的文件名与区名映射'
---

# 原型取段（extract）与框架源码外置 Coding Plan

> 把 `docs/spec/2026-08-27-原型取段与框架外置-eng-spec.md` 拆成"执行者对代码库零上下文"也能做的任务。
> **先读 spec**：本 plan 只写"改哪个文件、写什么代码"，判据与为什么在 spec 里。冲突时以 spec 为准。

**Goal:** 让下游读原型时只取界面内容（token 降约 85%），并把 74,628 字节埋在 HTML 注释块里的框架代码解放成独立 css/js 源文件，而原型产物一个字节都不变。
**Architecture:** 读侧加一个只读的 `extract` 子命令，复用既有 `markRange()` 按分区标记原样取段；写侧把容器的六个固定实现区外置成源文件，`init` 由 `copyFile` 改为 `composeTemplate()` 装配。两条线彼此独立。
**Tech Stack:** Node.js ESM（≥20），零第三方依赖，`node --test` 内置 test runner。
**Worktree:** `/Users/weidwonder/projects/ai_dev_system/.worktrees/proto-extract`
**Task Branch:** `worktree-proto-extract`
**目标主分支:** `main`

**全局约束（每个任务都适用）**

- **跨平台是硬约束**：一律 `node:path`、UTF-8、`os.tmpdir()`；MUST NOT 用 bash-only 语法，MUST NOT 引入任何第三方依赖。
- **终止用 `fail()` 抛 `Abort`，MUST NOT 用 `process.exit()`**——管道下 `process.exit()` 会截断已写出的 stdout 而退出码照常（`preview.mjs:129-138` 一带已把这条记成陷阱项）。
- 退出码沿用文件既有约定：**2 = 用法错误**（参数缺失、取值非法、目标不是原型文件），**其余失败一律 1**（`preview.mjs:140`）。
- 每个任务结束跑 `node --test test/*.test.mjs`（**通配符 MUST 写**：Node ≥22 下 `node --test test/` 会把目录当模块解析，报 MODULE_NOT_FOUND）。

---

### Task 1：`extract` 子命令

**Slice:** 对一份真实原型敲 `preview.mjs extract <文件>`，拿到 TITLE + NOTES + SCREENS 三段与末尾指引。 ｜ **依赖：** 无

**满足:** FR-001, FR-002, FR-003, FR-004, FR-005, FR-006

**Files:**
- Modify: `ai-dev-system/skills/ai-prd/scripts/preview.mjs`（新增 `cmdExtract` 与两个常量；改 `parseArgs`、`HELP`、`main` 的 `known` 数组与路由）
- Test: `test/prototype-preview.test.mjs`

**Interfaces:**
- Consumes: `markRange(html, mark) -> {from, to} | null`（`preview.mjs:86-94`）、`readTarget(file) -> Promise<string>`（`:141-149`，读不到时 `fail(…, 1)`）、`fail(msg, code)`（`:136-138`）
- Produces: `cmdExtract(file, opts) -> Promise<void>`；`opts['with-css']` 为布尔

- [ ] **Step 1: 写失败测试** —— 追加到 `test/prototype-preview.test.mjs` 末尾。它用 `init` + `screen` 真建一份原型再取段，不 mock。

  ```js
  test('extract 只给界面内容，且远小于全文', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'proto-extract-'))
    const file = path.join(dir, 'p.html')
    await run(['init', file, '--title', '取段测试'])
    await run(['screen', file, '--name', '列表页'])

    const r = await run(['extract', file])
    assert.equal(r.code, 0, r.stderr)
    for (const mark of ['TITLE', 'NOTES', 'SCREENS']) {
      assert.match(r.stdout, new RegExp(`=====\\s${mark.replace(/[-:]/g, '\\$&')}\\s`), `缺 ${mark} 段头`)
    }
    assert.match(r.stdout, /源文件第 \d+ 行起/, '段头必须给出源文件行号')
    assert.match(r.stdout, /preview\.mjs annotations/, '末尾必须指引去 annotations 取批注')

    // 固定实现区一个字节都不该出现在输出里
    assert.doesNotMatch(r.stdout, /ANNO-FRAMEWORK/, 'extract 不得输出批注框架区')
    assert.doesNotMatch(r.stdout, /<symbol id="i-/, 'extract 不得输出图标 sprite')
    assert.doesNotMatch(r.stdout, /--radius-sm/, 'extract 不得输出设计系统样式')

    const full = await readFile(file, 'utf8')
    assert.ok(
      Buffer.byteLength(r.stdout, 'utf8') < Buffer.byteLength(full, 'utf8') * 0.2,
      `extract 输出应远小于全文，实测 ${Buffer.byteLength(r.stdout, 'utf8')} / ${Buffer.byteLength(full, 'utf8')}`,
    )

    const withCss = await run(['extract', file, '--with-css'])
    assert.equal(withCss.code, 0, withCss.stderr)
    assert.match(withCss.stdout, /=====\sPROJECT-THEME\s/, '--with-css 必须补 PROJECT-THEME 段')
    assert.match(withCss.stdout, /=====\sCUSTOM-CSS\s/, '--with-css 必须补 CUSTOM-CSS 段')

    await rm(dir, { recursive: true, force: true })
  })

  test('extract 拒绝非原型文件，且 --with-css 不吞掉文件名', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'proto-extract-bad-'))
    const bad = path.join(dir, 'not-a-prototype.html')
    await writeFile(bad, '<!doctype html><html><body>hi</body></html>', 'utf8')

    const r = await run(['extract', bad])
    assert.equal(r.code, 2, '不是原型文件必须以退出码 2 终止')
    assert.match(r.stderr, /SCREENS/, '错误文案必须指出缺的是 SCREENS 分区标记')
    assert.doesNotMatch(r.stdout, /=====/, '拒绝时不得输出任何区段')

    // parseArgs 对未登记的 --flag 会吞掉下一个 argv：--with-css 必须是布尔白名单成员
    const file = path.join(dir, 'p.html')
    await run(['init', file, '--title', '顺序测试'])
    const flagFirst = await run(['extract', '--with-css', file])
    assert.equal(flagFirst.code, 0, '--with-css 放在文件名之前时不得吞掉文件名：' + flagFirst.stderr)

    await rm(dir, { recursive: true, force: true })
  })
  ```

  > **动手前先确认这份测试文件已有的辅助**：`run(args)`、`mkdtemp` / `rm` / `writeFile` / `readFile` 的 import、`os`、`path`。缺哪个就在文件顶部补哪个，**MUST NOT 另起一套 helper**。`run()` 若不返回 `{code, stdout, stderr}` 三元组，按它的实际返回改写断言，MUST NOT 改 `run()` 本身（其它测试在用）。

- [ ] **Step 2: 跑测试确认失败** — Run: `node --test test/prototype-preview.test.mjs` Expected: FAIL（`extract` 尚未注册，命令回落到 `serve` 或报参数错）

- [ ] **Step 3: 写最小实现**

  3a. 在 `preview.mjs` 的 `cmdAnnotations` 之前插入 `extract` 实现段：

  ```js
  /* ────────────────── extract ────────────────── */

  // 读侧取段。一份真实原型 85KB 里约 72% 是固定实现区（批注框架 / 设计系统 / 图标 sprite），
  // 对"这个界面长什么样、写了什么字"零价值——通读一次白付约 15k token，而下游 Step 1/4/8
  // 每次都被要求打开它。
  // MUST NOT 在这里做摘要、剥 class 或压缩嵌套：原型是**用户可见行为的权威描述**，
  // 有损提取会让下游拿不到原始 DOM，而它恰恰要照着原型写 spec 与用例。
  const EXTRACT_BASE = ['TITLE', 'NOTES', 'SCREENS']
  const EXTRACT_CSS = ['PROJECT-THEME', 'CUSTOM-CSS']

  // 行号取 BEGIN 那一行。MUST NOT 改用 markRange 的 `from` 起算——`from` 落在 BEGIN 注释的
  // `-->` 之后，而该注释可能跨多行（THEME 的就占两行），用它算出的行号会偏大。
  function lineOfMark(html, mark) {
    const i = html.indexOf(`<!-- ${mark}:BEGIN`)
    return i < 0 ? null : html.slice(0, i).split('\n').length
  }

  // 判空 MUST 在去注释之后：出厂容器的 `<!-- SCREENS -->` 占位注释否则会被当成已有内容。
  function isBlankRegion(body) {
    return body.replace(/<!--[\s\S]*?-->/g, '').trim() === ''
  }

  async function cmdExtract(file, opts) {
    const html = await readTarget(file)
    if (!markRange(html, 'SCREENS')) {
      fail(`不是本体系的原型文件（缺 SCREENS 分区标记）：${file}`, 2)
    }
    const marks = opts['with-css'] ? [...EXTRACT_BASE, ...EXTRACT_CSS] : [...EXTRACT_BASE]
    const out = []
    for (const mark of marks) {
      const range = markRange(html, mark)
      if (!range) {
        out.push(`===== ${mark} （本区不存在于该文件）=====`, '')
        continue
      }
      out.push(`===== ${mark} （源文件第 ${lineOfMark(html, mark)} 行起）=====`)
      const body = html.slice(range.from, range.to)
      out.push(isBlankRegion(body) ? '（本区为空）' : body)
      out.push('')
    }
    out.push('----- 本命令只给界面内容。用户批注、全局反馈、AI 侧 data-anno 说明与回复请跑：')
    out.push('      preview.mjs annotations <原型文件>')
    console.log(out.join('\n'))
  }
  ```

  3b. `parseArgs` 里，紧挨 `else if (a === '--json') out.json = true` 之后加一行：

  ```js
      else if (a === '--with-css') out['with-css'] = true
  ```

  > **这一行 MUST NOT 省**。`parseArgs` 末尾的 `else if (a.startsWith('--'))` 分支对没有 `=` 的未知 flag 走 `out[key] = argv[++i]`——`extract --with-css <文件>` 会让 `--with-css` **吞掉文件名**，命令随后报"需要一个原型文件路径"，而 `extract <文件> --with-css` 却正常。这种"换个参数顺序就坏"的失效最难查。

  3c. `HELP` 常量里，在 `annotations` 那行**之前**插入（读侧两条命令相邻）：

  ```
    extract <文件> [--with-css]                           取界面内容（结构+文案；批注用 annotations）
  ```

  3d. `main()` 里 `known` 数组加 `'extract'`：

  ```js
    const known = ['init', 'screen', 'slot', 'extract', 'annotations', 'check', 'serve']
  ```

  3e. `main()` 的路由里，在 `if (cmd === 'annotations')` 之前加：

  ```js
    if (cmd === 'extract') return cmdExtract(target, opts)
  ```

- [ ] **Step 4: 跑测试确认通过** — Run: `node --test test/prototype-preview.test.mjs` Expected: PASS
- [ ] **Step 5: 实跑一次真实原型对照** — Run: `node ai-dev-system/skills/ai-prd/scripts/preview.mjs extract docs/spec/2026-08-26-原型注解分层-prototype.html | wc -c` Expected: 输出字节数在 10,000–20,000 之间（全文 85,236）。**这一步 MUST 真跑**：测试用的是刚建的空原型，只有真实原型才验得到"降载"这件事本身。
- [ ] **Step 6: commit** — `git commit -m "feat(ai-prd): preview.mjs 新增 extract，读原型不再通读整份 HTML"`

---

### Task 2：框架源码外置（**原子重构，不可再分**）

**Slice:** 六个固定实现区搬进 `ui-prototype-framework/`，`init` 由复制改为装配，产出的原型与改造前逐字节相同。 ｜ **依赖：** 无（与 Task 1 独立）

**满足:** FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-015

> **为什么这个任务不拆**：拆开必然留下一个坏的中间态——只切分不清空会让同一份 CSS 在仓库里有两处副本（装配后静默重复），只清空不接线会让 `init` 产出残页。切分、清空、接线、改测试取值 MUST 在同一个 commit 里完成。

**Files:**
- Create: `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype-framework/{theme.css,design-system.css,anno.css,icons.svg,screen.js,anno.js}`
- Create: `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype-framework/README.md`
- Modify: `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html`（六个固定区区间清空）
- Modify: `ai-dev-system/skills/ai-prd/scripts/preview.mjs`（加 `FRAMEWORK` 表与 `composeTemplate()`；改 `cmdInit`；删 `copyFile` import）
- Modify: `test/prototype-annotations.test.mjs:27`、`test/prototype-preview.test.mjs:23`
- Test: 一次性对拍（Step 5），不入库

**Interfaces:**
- Produces: `composeTemplate() -> Promise<string>`（**MUST 从模块导出**，测试要直接调）；`FRAMEWORK` 表；`FRAMEWORK_DIR`

- [ ] **Step 1: 取基准** — Run:
  ```
  git show HEAD:ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html > "$TMPDIR/ui-prototype.baseline.html"
  ```
  基准 MUST 落在 worktree 之外，MUST NOT 提交进仓库。

- [ ] **Step 2: 用脚本切分** — 写一次性脚本到 scratchpad（**不入库**）并执行。**MUST 用脚本，MUST NOT 手工复制粘贴**：六个区合计 74,628 字节，手工必然引入不可见的空白差异，而那正是第 5 步对拍要判的东西。

  ```js
  // scratchpad/split-framework.mjs —— 一次性，跑完即弃
  import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
  import path from 'node:path'

  const T = 'ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html'
  const DIR = 'ai-dev-system/skills/ai-prd/assets/templates/ui-prototype-framework'
  const FRAMEWORK = [
    { mark: 'THEME',              file: 'theme.css',         open: '<style>',                                       close: '</style>' },
    { mark: 'DESIGN-SYSTEM',      file: 'design-system.css', open: '<style>',                                       close: '</style>' },
    { mark: 'ANNO-FRAMEWORK:CSS', file: 'anno.css',          open: '<style>',                                       close: '</style>' },
    { mark: 'ICONS',              file: 'icons.svg',         open: '<svg style="display:none" aria-hidden="true">', close: '</svg>' },
    { mark: 'SCREEN-SCRIPT',      file: 'screen.js',         open: '<script>',                                      close: '</script>' },
    { mark: 'ANNO-FRAMEWORK:JS',  file: 'anno.js',           open: '<script>',                                      close: '</script>' },
  ]
  function markRange(h, m) {
    const b = h.indexOf(`<!-- ${m}:BEGIN`); if (b < 0) return null
    const be = h.indexOf('-->', b);          if (be < 0) return null
    const e = h.indexOf(`<!-- ${m}:END`, be); if (e < 0) return null
    return { from: be + 3, to: e }
  }

  let html = readFileSync(T, 'utf8')
  mkdirSync(DIR, { recursive: true })
  // 从后往前替换，前面区间的下标才不会被前一次替换推移。
  for (const it of [...FRAMEWORK].reverse()) {
    const r = markRange(html, it.mark)
    if (!r) throw new Error(`容器缺固定区标记：${it.mark}`)
    const seg = html.slice(r.from, r.to)
    const o = seg.indexOf(it.open)
    const c = seg.lastIndexOf(it.close)
    if (o < 0 || c < 0) throw new Error(`区 ${it.mark} 里找不到包裹标签 ${it.open}`)
    // 前后缀实测六个区统一都是 "\n  "；这里断言而不是假设，不符就当场停。
    const pre = seg.slice(0, o)
    const post = seg.slice(c + it.close.length)
    if (pre !== '\n  ' || post !== '\n  ') throw new Error(`区 ${it.mark} 的前后缀不是 "\\n  "：${JSON.stringify([pre, post])}`)
    writeFileSync(path.join(DIR, it.file), seg.slice(o + it.open.length, c), 'utf8')
    html = html.slice(0, r.from) + html.slice(r.to)   // 区间清空，BEGIN/END 注释保留
  }
  writeFileSync(T, html, 'utf8')
  console.log('切分完成')
  ```

  > **写进源文件的内容 MUST 原样**（含其首尾的换行与缩进），**MUST NOT trim、MUST NOT 格式化**——那会当场打破逐字节相等。`.css` / `.js` 文件首行是空行不影响任何编辑器或 linter。

- [ ] **Step 3: 写框架目录 README** — `ui-prototype-framework/README.md`，一屏内，MUST 讲清三件事：这六个文件是 `ui-prototype.html` 六个固定实现区的正文、由 `preview.mjs` 的 `composeTemplate()` 在 `init` 时装配回单文件产物（**产物仍是单文件零外链，这里不是运行时外链**）、`icons.svg` 是 `<symbol>` 序列而不是可独立渲染的 SVG 文档（根标签由装配提供，且 **MUST NOT 加 `xmlns`**——`test/prototype-annotations.test.mjs` 断言容器全文不得出现它）。再加一句：**改这些文件不需要动 `ui-prototype.html`**。

- [ ] **Step 4: 接线 `preview.mjs`**

  4a. 在 `const TEMPLATE = …`（`:29`）之后加装配表与常量：

  ```js
  // 容器的六个固定实现区不住在 ui-prototype.html 里，住在下面这个目录，init 时装配回去。
  // 产物仍是**单文件零外链**——外置的是**源码组织方式**，不是运行时依赖。
  const FRAMEWORK_DIR = path.join(HERE, '..', 'assets', 'templates', 'ui-prototype-framework')
  const FRAMEWORK_PRE = '\n  '
  const FRAMEWORK_POST = '\n  '
  const FRAMEWORK = [
    { mark: 'THEME',              file: 'theme.css',         open: '<style>',                                       close: '</style>' },
    { mark: 'DESIGN-SYSTEM',      file: 'design-system.css', open: '<style>',                                       close: '</style>' },
    { mark: 'ANNO-FRAMEWORK:CSS', file: 'anno.css',          open: '<style>',                                       close: '</style>' },
    { mark: 'ICONS',              file: 'icons.svg',         open: '<svg style="display:none" aria-hidden="true">', close: '</svg>' },
    { mark: 'SCREEN-SCRIPT',      file: 'screen.js',         open: '<script>',                                      close: '</script>' },
    { mark: 'ANNO-FRAMEWORK:JS',  file: 'anno.js',           open: '<script>',                                      close: '</script>' },
  ]
  ```

  4b. 加装配函数（放在 `markRange` 之后，`cmdInit` 之前），并 `export` 它：

  ```js
  // 容器模板 + 六份框架源码 → 完整容器 HTML。纯函数：不写盘、不依赖任何命令参数，
  // cmdInit 与测试共用同一个它（测试若各自拼一遍，装配逻辑就有了第二份实现）。
  export async function composeTemplate() {
    let html = await readFile(TEMPLATE, 'utf8')
    // 从后往前填，前面区间的下标才不会被前一次填充推移。
    for (const it of [...FRAMEWORK].reverse()) {
      const r = markRange(html, it.mark)
      if (!r) fail(`容器缺固定区标记：${it.mark}（${TEMPLATE}）`, 1)
      const p = path.join(FRAMEWORK_DIR, it.file)
      let body
      try {
        body = await readFile(p, 'utf8')
      } catch {
        fail(`框架源文件读不到：${it.mark} → ${p}`, 2)
      }
      html = html.slice(0, r.from) + FRAMEWORK_PRE + it.open + body + it.close + FRAMEWORK_POST + html.slice(r.to)
    }
    return html
  }
  ```

  > `export` 之后本文件仍是可执行入口（ESM 模块导出与顶层 `main()` 并存，`node preview.mjs …` 照常工作）。若 `preview.mjs` 此前无任何 `export`，加这一个不改变它被 `node` 直接执行的行为。

  4c. 改 `cmdInit`（`:196-211`）：把

  ```js
    await copyFile(TEMPLATE, file)
    let html = await readFile(file, 'utf8')
  ```

  换成

  ```js
    let html = await composeTemplate()
  ```

  「目标已存在则不覆盖」的检查 MUST 留在装配**之前**——否则为一个必然被拒的调用白读七个文件。

  4d. 删 `copyFile` 的 import（`:22`）——先 `grep -n "copyFile" ai-dev-system/skills/ai-prd/scripts/preview.mjs` 确认引用数为 0 再删。

- [ ] **Step 5: 对拍（一次性验收 AC-007）** — Run:
  ```
  node -e "import('./ai-dev-system/skills/ai-prd/scripts/preview.mjs').then(async m => { const { writeFileSync } = await import('node:fs'); writeFileSync(process.env.TMPDIR + '/composed.html', await m.composeTemplate()) })"
  diff "$TMPDIR/composed.html" "$TMPDIR/ui-prototype.baseline.html" && echo "逐字节相等 ✅"
  ```
  Expected: `diff` 无输出、打印 ✅。**不等时 MUST 回到 Step 2/4 修装配串，MUST NOT 改基准让对拍通过。** 对拍是一次性动作，通过后基准即丢弃，**MUST NOT 把它固化成常驻测试**——那会让日后每次改框架源文件都判红（判据见 spec §6 Invariant 1）。

- [ ] **Step 6: 改两份测试的取值来源**

  - `test/prototype-annotations.test.mjs:27`：`const template = read(prdRoot, 'assets', 'templates', 'ui-prototype.html')` → 改为 `const template = await composeTemplate()`（从 `preview.mjs` import；该文件顶层若不是 async 上下文，用 `await` 顶层 import 即可——测试文件是 ESM）。**MUST NOT 逐条改断言**：这份文件有三十余条断言（零外链、图标 id 双向一致、class 清单、`explainOnce`、`data-anno-rt` 剥离…），它们要验的一直是"容器完整体"，换取值来源即全部照旧成立。
  - `test/prototype-preview.test.mjs:23`：`templatePath` 若只用于读取内容，同样改为调 `composeTemplate()`；若用于把模板复制成临时文件，改为把装配结果 `writeFile` 到临时路径。

- [ ] **Step 7: 跑全部测试** — Run: `node --test test/*.test.mjs` Expected: PASS（全绿）
- [ ] **Step 8: commit** — `git commit -m "refactor(ai-prd): 容器六个固定实现区外置为独立 css/js 源文件，init 改为装配"`

---

### Checkpoint：Task 1–2 之后
- [ ] `node --test test/*.test.mjs` 全绿
- [ ] `preview.mjs extract` 对真实原型可用，输出 < 全文 20%
- [ ] `preview.mjs init` 产出的原型与改造前逐字节一致（Step 5 已验）
- [ ] `git status` 干净，scratchpad 里的一次性脚本与基准文件**未**被 `git add`

---

### Task 3：装配契约的机器闸

**Slice:** 有人删掉框架源文件、清空其内容、或往容器空区里塞东西时，测试当场判红。 ｜ **依赖：** Task 2

**满足:** FR-016

**Files:**
- Create: `test/prototype-framework.test.mjs`

- [ ] **Step 1: 写测试**（本任务的产物就是测试本身，无需先失败后实现；写完直接跑，MUST 全绿）

  ```js
  // 为什么要有这份测试：六个固定实现区搬出 ui-prototype.html 之后，容器与框架源文件之间
  // 多了一条谁都看不见的约定——区标记在容器里、正文在别的文件里。这条约定断掉时页面照常
  // 生成、命令照常退出 0，只是产出的原型缺一整块样式或整个批注框架。
  //
  // 本闸 MUST NOT 断言"装配结果等于某个历史字节"：那条等值只在外置落地的那一次成立，
  // 固化成常驻闸之后，日后每改一次 anno.css 都会判红——而让改框架变容易正是外置的目的。
  import test from 'node:test'
  import assert from 'node:assert/strict'
  import { readFileSync, existsSync } from 'node:fs'
  import path from 'node:path'
  import { fileURLToPath } from 'node:url'
  import { composeTemplate, FRAMEWORK, FRAMEWORK_DIR } from '../ai-dev-system/skills/ai-prd/scripts/preview.mjs'

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const container = path.join(repoRoot, 'ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html')

  function markRange(h, m) {
    const b = h.indexOf(`<!-- ${m}:BEGIN`); if (b < 0) return null
    const be = h.indexOf('-->', b);          if (be < 0) return null
    const e = h.indexOf(`<!-- ${m}:END`, be); if (e < 0) return null
    return { from: be + 3, to: e }
  }

  test('容器的六个固定区区间为空——正文只有一处，在框架源文件里', () => {
    const html = readFileSync(container, 'utf8')
    for (const it of FRAMEWORK) {
      const r = markRange(html, it.mark)
      assert.ok(r, `容器缺固定区标记：${it.mark}`)
      assert.equal(
        html.slice(r.from, r.to).trim(), '',
        `容器的 ${it.mark} 区间不为空。正文 MUST 只住在 ${it.file} 里；容器里再留一份会让装配后同一段内容出现两次，而页面照常打开。`,
      )
    }
  })

  test('装配表每项都对应一个存在且非空的框架源文件', () => {
    for (const it of FRAMEWORK) {
      const p = path.join(FRAMEWORK_DIR, it.file)
      assert.ok(existsSync(p), `装配表指向的框架源文件不存在：${it.mark} → ${p}`)
      assert.ok(readFileSync(p, 'utf8').trim().length > 0, `框架源文件是空的：${p}`)
    }
  })

  test('装配结果里六个区都被填上，包裹标签成对', async () => {
    const html = await composeTemplate()
    for (const it of FRAMEWORK) {
      const r = markRange(html, it.mark)
      assert.ok(r, `装配结果缺固定区标记：${it.mark}`)
      const seg = html.slice(r.from, r.to)
      assert.ok(seg.trim().length > 0, `装配结果的 ${it.mark} 区仍是空的`)
      assert.ok(seg.includes(it.open) && seg.includes(it.close), `${it.mark} 的包裹标签没有成对出现`)
    }
  })

  test('icons.svg 不得含 xmlns——它是 sprite 片段，不是独立 SVG 文档', () => {
    const svg = readFileSync(path.join(FRAMEWORK_DIR, 'icons.svg'), 'utf8')
    assert.doesNotMatch(svg, /xmlns/, 'xmlns 会带进 http:// 串，当场挂掉容器的零外链自检')
  })
  ```

  > `FRAMEWORK` 与 `FRAMEWORK_DIR` MUST 一并 `export`（Task 2 的 4a 里加 `export` 前缀）——测试遍历装配表本身，才能在**新增第七个区**时自动覆盖到它。

- [ ] **Step 2: 跑** — Run: `node --test test/prototype-framework.test.mjs` Expected: PASS
- [ ] **Step 3: 验闸真的会红** — 临时把 `theme.css` 内容清空，重跑，Expected: FAIL；恢复后 Expected: PASS。**这一步 MUST 真做**：一条从没红过的闸和没有闸是一回事。
- [ ] **Step 4: commit** — `git commit -m "test(ai-prd): 容器与框架源文件的装配契约加机器闸"`

---

### Task 4：五个读原型落点改用 `extract`

**Slice:** 下游任何一个执行点要读原型，看到的规定动作都是"先跑 extract + annotations"，而不是"打开该文件"。 ｜ **依赖：** Task 1

**满足:** FR-014

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/步骤-1-7-设计与实现.md:21`（Step 1）、`:139`（Step 4）
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/步骤-8-10-测试.md:10`（Step 8）
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/路径-lean.md:273`（Lean）
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/00-流程总纲.md`（§完整流程步骤索引 的表注）
- Modify: `ai-dev-system/skills/ai-prd/references/UI原型纪律.md` §8.1 命令表（补 `extract` 一行）
- Modify: `ai-dev-system/skills/ai-prd/scripts/ctx` 无关；`ai-dev-system/skills/ai-prd/SKILL.md` 的目录树若列了子命令，同补

- [ ] **Step 1: 逐处改写**。每处 MUST **就地**给出完整命令，MUST NOT 只写"见总纲"——写在总纲里等于写给一个当时不在场的读者（这条判据 `CLAUDE.md` 已就 `annotations` 立过一次）。落笔模式：

  > 原型的**界面内容**用 `node <skills 根>/ai-prd/scripts/preview.mjs extract <原型文件>` 取（结构、文案、状态层原样给出，约为全文的一成半）；**批注**用同目录的 `annotations <原型文件>` 取。两条都跑完才算读过原型。**MUST NOT 通读整份 HTML**——一份真实原型 85KB 里约七成是批注框架与设计系统的固定实现，对"界面长什么样"零价值。两条命令都跑不起来时才降级为直读文件，且 MUST 在问题清单里记一笔。

  `<skills 根>` 的写法 MUST 沿用各文件既有那句（"= 你加载的这份 `SKILL.md` 所在目录的**父目录**——Claude Code 下是 `.claude/skills/`、Codex 下是 `.agents/skills/`……**MUST NOT 写死其中一侧**"），**MUST NOT 另起一种写法**。

- [ ] **Step 2: 删掉被取代的旧措辞** — `步骤-1-7-设计与实现.md:21` 的「**MUST 打开该文件**」MUST 改写，MUST NOT 与新句并存（并存等于给读者两条冲突的规定动作）。

- [ ] **Step 3: 措辞红线自查** — Run: `node --test test/wording-redline.test.mjs` Expected: PASS。该闸盯的是"每个被改文件的 MUST / MUST NOT / SHOULD / MAY 条数只准增不准减"。**改写不得净减规范条款**：把「MUST 打开该文件」换成「MUST 先跑 extract」是一换一，若顺手删了别的 MUST 会当场判红。

- [ ] **Step 4: Lean 自足册覆盖率自查** — Run: `node --test test/lean-selfcontained.test.mjs` Expected: PASS。`路径-lean.md` 的那条要点 MUST 带来源锚点（`来源：<文件> §<小节>`），忘标来源即判红。

- [ ] **Step 5: 跑全部测试并 commit** — Run: `node --test test/*.test.mjs`；`git commit -m "docs(ai-dev-workflow): 五个读原型落点改为先跑 extract 取界面内容"`

---

### Task 5：刷新代码事实卡片

**Slice:** 下一个零上下文 agent 查"原型容器长什么样"时，拿到的行号与结构是本次改造之后的。 ｜ **依赖：** Task 1–4

**满足:** 无 —— 卡片刷新是 `代码事实纪律.md` §4 的无条件义务（本次触碰了 Authority Surface），不直接满足某条 FR

**Files:**
- Modify: `engineering-context/cards/ai-dev-system.md`
- Modify: `engineering-context/capability-registry.md`（若新增能力条目）

- [ ] **Step 1: 刷 `#原型容器（ui-prototype.html）` 域** — 分区标记那条的行号全部失效（容器已从 1,825 行降到约 90 行）。**行号 MUST 重新实测**，MUST NOT 顺手保留旧值。批注框架的实现细节（`serialize()` / `write()` / `openNote()` / `bar.innerHTML` / `paint()` / `attach()` 的行号）MUST 改指 `ui-prototype-framework/anno.js:<行>`，样式类改指 `anno.css` / `design-system.css`。**这是本次改造的一项真实收益**：这些行号从此不再因为改了另一个区而整体推移。
- [ ] **Step 2: 刷 `#原型工具（preview.mjs）` 域** — 补 `cmdExtract` 与 `--with-css` 的布尔白名单陷阱、`FRAMEWORK` 装配表与 `composeTemplate()`、`cmdInit` 不再 `copyFile`。陷阱项补一条：**框架源文件的首尾空白是装配的一部分，MUST NOT trim**。
- [ ] **Step 3: 新增 `#原型读取契约（ai-dev-workflow）` 域** — 职责：定义下游五个落点怎么读原型；对外接口：五个落点各自的 `文件:行`，两条命令的分工（`extract` 给界面、`annotations` 给批注）；陷阱项：只跑其中一条等于没读全，界面上看不见的 `data-anno` 说明同属用户可见行为契约。
- [ ] **Step 4: 确认时间统一填 `2026-08-27`**，跑 `node ai-dev-system/skills/ai-dev-workflow/scripts/ctx/src/cli.js discover "原型 extract 装配"` 确认能查到
- [ ] **Step 5: commit** — `git commit -m "docs(context): 刷新原型容器/工具卡片，新增原型读取契约域"`

---

### Task 6：版本与文档收尾

**Slice:** 装了本体系的项目重装一次就能拿到 `extract`；本仓库文档不再有指向旧口径的记载。 ｜ **依赖：** Task 1–5

**满足:** 无 —— 收尾任务

**Files:**
- Modify: `ai-dev-system/VERSION`、`CLAUDE.md`、`docs/index.md`、`docs/TODO.md`

- [ ] **Step 1: bump `VERSION`** — `2.9.1` → `2.10.0`（新增子命令 + 改变容器的物理组织方式，是行为契约变化）。**MUST NOT 建 `ai-dev-system/migrations/2.10.0.md`**：本次升级零手动动作（重装即可，不改标记块字段、不要求回填存量文档），补一份"需要的动作：无"的空指南正是 `CLAUDE.md` §版本管理 那条判据要挡的噪音。**也 MUST NOT 因为 bump 就去改 `test/installer-migration.test.mjs` 等四份测试**——它们自 2.5.0 起已是条件式，零动作 bump 不判红。
- [ ] **Step 2: 改 `CLAUDE.md`** — 目录速查里 `scripts/preview.mjs` 那行的子命令由六条改为七条并补 `extract`；`assets/templates/` 下补 `ui-prototype-framework/`；§改动时注意 的「原型批注框架是跨文件的契约」那条里，`preview.mjs` 六条子命令的表述同改，并补一句：**容器的六个固定实现区住在 `ui-prototype-framework/`，改框架改那里、不动 `ui-prototype.html`；改分区标记或装配表时两处同改并跑 `node --test test/prototype-framework.test.mjs`**。
- [ ] **Step 3: 收录进 `docs/index.md`** — spec 与 plan 各一行，写清现行口径。
- [ ] **Step 4: 从 `docs/TODO.md` 删掉那条** — 「2026-08-26 ｜ ai-prd ｜ 单个 HTML 原型文件变大后……」整行删除。TODO 是快照，做掉的当场删，**MUST NOT 保留"已完成"区**。
- [ ] **Step 5: 计数词与文档索引闸** — Run: `node --test test/counter-word.test.mjs test/doc-index.test.mjs` Expected: PASS。注意 `doc-index` 递归遍历三个目录逐份查 `YYYY-MM-DD-` 前缀与索引收录。
- [ ] **Step 6: 跑全部测试** — Run: `node --test test/*.test.mjs` Expected: 全绿
- [ ] **Step 7: commit** — `git commit -m "chore: 2.10.0 —— 原型取段与框架外置"`

---

### Checkpoint：Task 3–6 之后
- [ ] `node --test test/*.test.mjs` 全绿
- [ ] `preview.mjs --help` 里 `extract` 在 `annotations` 之前
- [ ] `git log --oneline` 每个 commit 对应一个任务，无"最后统一清理"式提交

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 切分时的空白差异让产物与改造前不等，且页面照常打开、测试照常绿 | H | Task 2 Step 5 的一次性对拍是硬门；切分脚本对前后缀 `"\n  "` 做断言而不是假设，不符当场停 |
| `--with-css` 未进布尔白名单，`extract --with-css <文件>` 吞掉文件名 | M | Task 1 的第二条测试专测参数顺序；plan 的 3b 把这条列为 MUST NOT 省 |
| 把「装配结果 ≡ 改造前字节」固化成常驻闸，日后每改一次框架都判红 | M | spec §6 Invariant 1 与 Task 3 的测试注释两处显式禁止；对拍只在 Task 2 Step 5 出现一次 |
| 容器里留下框架正文的第二份副本（切了没清空） | M | Task 3 第一条测试逐区断言容器空区 |
| 五个落点只改了其中几个，剩下的仍写着"打开该文件" | M | Task 4 逐处列出 `文件:行`；`wording-redline` 与 `lean-selfcontained` 两条闸兜底 |
| `icons.svg` 被误加 `xmlns` 以求"是个合法 SVG" | L | Task 3 专测一条；框架 README 就地说明 |

## 替换清单核销（来自 spec §8.2）

| 被取代物 | 删除任务 | 实测引用数 | 核销 |
|---|---|---|---|
| `cmdInit` 的 `copyFile(TEMPLATE, file)` + 随后的 `readFile(file,'utf8')` | Task 2 Step 4c | 待填 | ⏳ |
| `preview.mjs` 顶部 `copyFile` 的 import | Task 2 Step 4d | 待填 | ⏳ |
| `ui-prototype.html` 六个固定区的正文（74,628 字节） | Task 2 Step 2 | 待填 | ⏳ |
| `步骤-1-7-设计与实现.md:21` 的「MUST 打开该文件」 | Task 4 Step 2 | 待填 | ⏳ |
| `00-流程总纲.md` 步骤索引表注里「MUST NOT 通读整份 HTML」的降级条件 | Task 4 Step 1 | 待填 | ⏳ |

## 完成与自动合并

标记块 `merge-gate="direct"`：全部门禁通过后在本地对 `main` 做非快进合并（`git merge --no-ff`）并清理 worktree，不开 PR。合并失败 MUST 保留 worktree 待处理，MUST NOT 强推。
