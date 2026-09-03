---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-08-27'
authority_refs:
  - 'window.setScreenState(screenEl, nextState) 的签名与语义：纯状态表达，不认识按钮'
  - 'preview.mjs slot 的 --agreed / --agreed-plan 参数契约'
  - 'preview.mjs serve 的 X-Proto-Version / If-Match 头契约'
  - '批注数据 replies[] 的字段集合'
  - '.screen-notes 的 DOM 契约与 CUSTOM-JS / SCREEN-SCRIPT 两个标记名'
---

# 原型注解分层与文档日期前缀 Coding Plan

> 上游 spec：`docs/spec/2026-08-27-原型注解分层与文档日期前缀-eng-spec.md`（本 plan 的 `满足:` 引用它的 `FR-###`）。
> 执行者按"加载→批判性 review→实现→跑验证→commit"逐任务走，每 2–3 个任务过一次 checkpoint。任务间信息只通过本 plan 的 **Interfaces** 传递。

**Goal:** 让原型上的每一句话有唯一归属位置、用户能就地答话、改稿不被静默覆盖或被批注堵死，并把文档日期前缀规则补回全仓。
**Architecture:** 容器（外观与框架）→ 工具（可判定的检查与写入契约）→ 纪律模板（描述前两层）→ 机器闸（守住前三层）。四层依次改，前三层每层都可独立验证。
**Tech Stack:** 纯 Node.js ESM（零第三方依赖）+ 单文件 HTML/CSS/ES5 风格 JS（容器内脚本 MUST 保持 ES5 兼容写法，与既有一致）。
**Worktree:** `/Users/weidwonder/projects/ai_dev_system/.worktrees/anno-layering`
**Task Branch:** `worktree-anno-layering`
**目标主分支:** `main`

**贯穿全程的三条硬规矩**（每个 Task 都适用）：

1. 容器内新增的 JS **MUST 与既有代码同风格**：变量用 `var`、函数用 `function` 表达式（既有框架区通篇如此），可以用 `closest()` / `NodeList.prototype.forEach` / `classList` 这些现代 DOM API。
   **MUST NOT 把这条写成"必须 ES5"**——容器本来就不是 ES5：`ui-prototype.html:877-932` 那段用了 `const` 与箭头函数，CSS 里用了 `:has()`、`color-mix()`、`backdrop-filter`，目标本就是现代浏览器。写成 ES5 会逼着把既有代码一并改写，那是本次范围外的重写。
   迁移 `:877-932` 进 `SCREEN-SCRIPT` 区时**照原样搬**，只改本 plan 明写要改的那两处（删总闸、主行动按钮收敛到本屏），MUST NOT 顺手改写它的语法风格。
2. 容器内新增的任何样式 **MUST 用 `var(--…)` token**，MUST NOT 写死颜色（`check` 第 11 条会判红）。
3. 每个 Task 结束 MUST 跑 `node --test test/*.test.mjs`；**判据不变的断言跑红时 MUST 修实现，MUST NOT 放宽断言**（spec FR-030）。

---

### Task 1：屏注解区（容器外观 + 加屏生成 + 自检）

**Slice:** 跑 `screen` 加一屏 → 该屏在设备壳外自带注解区 → `check` 能报出"这屏没写注解" ｜ **依赖：** 无

**满足:** FR-001, FR-002, FR-019（其中"某屏没写注解"这一类）

**Files:**
- Modify: `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html`（`DESIGN-SYSTEM` 区内，`.aside-stack` 规则附近 `:598`）
- Modify: `ai-dev-system/skills/ai-prd/scripts/preview.mjs`（`screenSkeleton` `:195-213`、`cmdScreen` `:215-241`、`cmdCheck` 屏结构段 `:499-530`、`parseArgs` `:738-756`）
- Test: `test/prototype-preview.test.mjs`

**Interfaces:**
- Produces: DOM 契约 `.device-wrap > .screen-notes > (.screen-notes__title + .screen-notes__body + .screen-notes__acts)`；挂右侧时 `.device-wrap.is-anno-right`；`screen --anno-right` 参数。

- [ ] **Step 1: 写失败测试** — 在 `test/prototype-preview.test.mjs` 追加：

  ```js
  test('screen 加屏时连注解区外壳一起给出，默认挂下方', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'proto-anno-'))
    const file = join(dir, 'p.html')
    await run(['init', file, '--title', 'T'])
    await run(['screen', file, '--name', '工单列表'])
    const html = await readFile(file, 'utf8')
    assert.match(html, /<div class="screen-notes">/)
    assert.match(html, /class="screen-notes__title">这一屏的注解 · 不属于用户界面</)
    assert.match(html, /<div class="screen-notes__body">/)
    assert.match(html, /<div class="screen-notes__acts">/)
    // 注解区 MUST 在 .device 之后、仍在 .device-wrap 内
    const wrap = html.match(/<section class="device-wrap[^"]*">[\s\S]*?<\/section>/)[0]
    assert.ok(wrap.indexOf('</div>\n        <div class="screen-notes">') > wrap.indexOf('<div class="device">'))
    assert.doesNotMatch(wrap, /class="device-wrap is-anno-right"/)
  })

  test('screen --anno-right 让注解区挂右侧', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'proto-anno-'))
    const file = join(dir, 'p.html')
    await run(['init', file, '--title', 'T'])
    await run(['screen', file, '--name', '详情', '--anno-right'])
    const html = await readFile(file, 'utf8')
    assert.match(html, /<section class="device-wrap is-anno-right">/)
  })

  test('屏注解区仍是画布内的元素，用户能在它上面写批注', () => {
    // PRD〈特殊场景〉：允许，按现行方式记录。拾取模式的作用域是 [data-anno-canvas]，
    // 而 .screen-notes 住在 .device-wrap 里、也就在画布内 —— 这条验的是它没被排除掉。
    const html = readFileSync(templatePath, 'utf8')
    const js = html.slice(html.indexOf('ANNO-FRAMEWORK:JS:BEGIN'), html.indexOf('ANNO-FRAMEWORK:JS:END'))
    assert.doesNotMatch(js, /screen-notes[^\n]*(return|continue)/, '拾取模式 MUST NOT 排除注解区')
    // 且 screenOf() 仍能认出它属于哪一屏（靠 .device-wrap 内的 .device-name）
    assert.match(js, /closest\(["']\.device-wrap["']\)/)
  })

  test('check 对没写注解的屏报 P2 提示且不拦交付', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'proto-anno-'))
    const file = join(dir, 'p.html')
    await run(['init', file, '--title', 'T'])
    await run(['screen', file, '--name', '工单列表'])
    const r = await run(['check', file, '--json'])
    const out = JSON.parse(r.stdout)
    const hit = out.problems.filter((p) => /没写注解/.test(p.msg))
    assert.equal(hit.length, 1)
    assert.equal(hit[0].level, 'P2')
  })
  ```

- [ ] **Step 2: 跑测试确认失败** — Run: `node --test test/prototype-preview.test.mjs` Expected: FAIL（`screen-notes` 不存在）
- [ ] **Step 3: 写最小实现**

  3a. `ui-prototype.html` 的 `DESIGN-SYSTEM` 区，在 `.aside-stack` 那行**之前**插入：

  ```css
    /* 屏注解区：挂在设备壳之外，装这一屏的整体注释与这一屏的切换按钮。
       它不属于用户界面——虚线框 + 浅底色，读者一眼能看出来。 */
    .device-wrap { display: flex; flex-direction: column; gap: 12px; }
    .device-wrap.is-anno-right { flex-direction: row; align-items: center; flex-wrap: wrap; }
    .device-wrap.is-anno-right > .device { flex: 0 0 auto; }
    .device-wrap.is-anno-right > .screen-notes { flex: 1 1 260px; min-width: 260px; }

    .screen-notes {
      align-self: center;
      width: 100%;
      max-width: 420px;
      padding: 10px 12px;
      border: 1px dashed var(--border);
      border-radius: var(--radius-md);
      background: var(--muted);
      color: var(--muted-foreground);
      font-size: 12px;
      line-height: 1.6;
    }

    .screen-notes__title {
      margin-bottom: 6px;
      color: var(--muted-foreground);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .screen-notes__body { color: var(--foreground); }
    .screen-notes__body:empty { display: none; }
    .screen-notes__acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .screen-notes__acts:empty { display: none; }
  ```

  > `.device-wrap` 原本只有 `width: 420px; max-width: 100%;`（`:562`）——**MUST 保留那两行**，本段只追加 `display/flex-direction/gap`。挂右侧时 `.device-wrap` 要放得下屏 + 注解区，宽度改由 `.is-anno-right` 单独放开：追加 `.device-wrap.is-anno-right { width: auto; max-width: 100%; }`。屏与注解区并排放不下时 `flex-wrap: wrap` 自动换行到屏下方（AC-003）。

  3b. `preview.mjs` 的 `screenSkeleton(name, states, desktop)` 增第四参 `annoRight`，返回值末尾在 `</div>`（`.device` 收尾）之后、`</section>` 之前插入注解区，并把 `device-wrap` 的 class 拼上：

  ```js
  function screenSkeleton(name, states, desktop, annoRight) {
    const layers = states
      .map((k) => {
        const cls = k === 'is-default' ? 'status is-default' : `status ${k}`
        return `          <div class="${cls}">\n            <!-- ${STATE_LABEL[k]} -->\n          </div>`
      })
      .join('\n')
    const wrapCls = `device-wrap${desktop ? ' is-desktop' : ''}${annoRight ? ' is-anno-right' : ''}`
    return `      <section class="${wrapCls}">
        <p class="device-name">${esc(name)}</p>
        <div class="device">
          <div class="app-bar">
            <span class="app-title">${esc(name)}</span>
          </div>
          <div class="screen">
${layers}
          </div>
        </div>
        <div class="screen-notes">
          <p class="screen-notes__title">这一屏的注解 · 不属于用户界面</p>
          <div class="screen-notes__body"></div>
          <div class="screen-notes__acts"></div>
        </div>
      </section>`
  }
  ```

  `cmdScreen` 里改调用：`const block = screenSkeleton(opts.name, states, !!opts.desktop, !!opts['anno-right'])`，并把成功提示补一句挂位：

  ```js
  console.log(`已加屏「${opts.name}」，状态层：${states.join(' / ')}，注解区挂${opts['anno-right'] ? '右侧' : '下方'}`)
  ```

  `parseArgs` 增一行：`else if (a === '--anno-right') out['anno-right'] = true`（放在 `--desktop` 那行之后）。

  3c. `cmdCheck` 的屏结构段（`wraps.forEach` 内）追加：

  ```js
      if (!/<div class="screen-notes">/.test(w)) {
        add('P1', `第 ${i + 1} 屏缺 .screen-notes 注解区`, '注解区由 screen 命令生成；手工拼屏才会缺它')
      } else {
        const body = (w.match(/<div class="screen-notes__body">([\s\S]*?)<\/div>/) || [])[1] || ''
        if (!body.replace(/<[^>]*>/g, '').trim()) {
          add('P2', `第 ${i + 1} 屏没写注解`, '有的屏确实没什么可说，这条只是提示')
        }
      }
  ```

- [ ] **Step 4: 跑测试确认通过** — Run: `node --test test/prototype-preview.test.mjs` Expected: PASS
- [ ] **Step 5: commit** — `git commit -m "feat(ai-prd): 屏注解区 —— 每屏在设备壳外自带注解位与切换按钮位"`

---

### Task 2：状态切换收敛到各屏 + 自定义脚本区

**Slice:** 删掉画布总闸 → 容器导出按屏切换入口 → `slot --set script` 写进按钮行为 → 点某屏按钮只改该屏 ｜ **依赖：** Task 1 的 `.screen-notes__acts`

**满足:** FR-003, FR-004, FR-005, FR-020, FR-019（其中"注解区按钮没有对应行为"这一类）

**Files:**
- Modify: `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html`（删 `:849-866`；改 `:877-932` 并包进 `SCREEN-SCRIPT` 标记；`CUSTOM-CSS:END` 之后加 `CUSTOM-JS` 区）
- Modify: `ai-dev-system/skills/ai-prd/scripts/preview.mjs`（`SLOTS` 增 `script`；`FIXED_REGIONS` 增 `SCREEN-SCRIPT`；`cmdCheck` 增按钮行为检查）
- Test: `test/prototype-preview.test.mjs`、`test/prototype-annotations.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `.screen-notes__acts [data-act]`
- Produces: `window.setScreenState(screenEl, nextState)`（纯状态表达函数，**不认识按钮**）；插槽名 `script` → 标记 `CUSTOM-JS`；固定区标记 `SCREEN-SCRIPT`

- [ ] **Step 1: 写失败测试**

  ```js
  test('画布上没有第二处能切状态的地方', async () => {
    const html = await readFile(TEMPLATE, 'utf8')
    assert.doesNotMatch(html, /aria-label="原型状态切换"/)
    assert.doesNotMatch(html, /class="state-buttons"/)
  })

  test('容器只导出状态表达函数，不导出任何认识按钮的函数', () => {
    const html = readFileSync(templatePath, 'utf8')
    assert.match(html, /window\.setScreenState\s*=/)
    // PRD 非目标 3：容器不定义任何点击语义。含按钮语义的导出一律不许有
    assert.doesNotMatch(html, /protoSetState/)
    assert.doesNotMatch(html, /window\.\w+\s*=\s*function\s*\([^)]*actName/)
    // 主行动按钮演示 MUST 收敛到 closest('.screen')
    const seg = html.slice(html.indexOf('data-submit'))
    assert.match(seg.slice(0, 400), /closest\(["']\.screen["']\)/)
  })

  test('SCREEN-SCRIPT 是固定实现区，CUSTOM-JS 是插槽', async () => {
    const html = await readFile(TEMPLATE, 'utf8')
    assert.match(html, /<!-- SCREEN-SCRIPT:BEGIN/)
    assert.match(html, /<!-- CUSTOM-JS:BEGIN/)
    const { FIXED_REGIONS_FOR_TEST } = await import('../ai-dev-system/skills/ai-prd/scripts/preview.mjs')
    // 若不导出常量，改为断言 check 对被改写的 SCREEN-SCRIPT 报 P0、对空 CUSTOM-JS 不报
  })

  test('slot --set script 写进 CUSTOM-JS 区', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'proto-anno-'))
    const file = join(dir, 'p.html')
    await run(['init', file, '--title', 'T'])
    await run(['screen', file, '--name', 'S'])
    const behavior = 'document.querySelector(\'[data-act="s1-empty"]\').addEventListener("click", function (e) {' +
      ' window.setScreenState(e.currentTarget.closest(".device-wrap").querySelector(".screen"), "state-empty"); });'
    await run(['slot', file, '--set', 'script', '--text', behavior])
    const html = await readFile(file, 'utf8')
    const from = html.indexOf('CUSTOM-JS:BEGIN')
    const to = html.indexOf('CUSTOM-JS:END')
    assert.ok(html.slice(from, to).includes('s1-empty'))
  })

  test('check 报出注解区里没有对应行为的按钮', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'proto-anno-'))
    const file = join(dir, 'p.html')
    await run(['init', file, '--title', 'T'])
    await run(['screen', file, '--name', 'S'])
    await run(['slot', file, '--set', 'screens', '--text',
      '<section class="device-wrap"><p class="device-name">S</p><div class="device"><div class="screen">' +
      '<div class="status is-default"></div></div></div><div class="screen-notes">' +
      '<p class="screen-notes__title">这一屏的注解 · 不属于用户界面</p><div class="screen-notes__body">x</div>' +
      '<div class="screen-notes__acts"><button type="button" class="btn btn-outline btn-sm" data-act="s1-empty">空态</button></div></div></section>'])
    const r = await run(['check', file, '--json'])
    const out = JSON.parse(r.stdout)
    const hit = out.problems.filter((p) => /s1-empty/.test(p.msg) && /没有对应/.test(p.msg))
    assert.equal(hit.length, 1)
    assert.equal(hit[0].level, 'P2')
    assert.equal(out.ok, true)   // 提示级，不拦交付
  })
  ```

- [ ] **Step 2: 跑测试确认失败** — Run: `node --test test/prototype-preview.test.mjs` Expected: FAIL
- [ ] **Step 3: 写最小实现**

  3a. **删** `ui-prototype.html:851-865` 整个 `<section class="card card-compact" aria-label="原型状态切换">` 块（`aside-stack` 的其余部分留到 Task 3 处理）。

  3b. 把 `:877-932` 那段裸 `<script>` 用标记包起来，并改写其中两处：

  ```html
  <!-- SCREEN-SCRIPT:BEGIN 原型级交互 · 固定实现 · 整段原样保留，MUST NOT 修改或删除
       注解区按钮的行为写进下方 CUSTOM-JS 插槽；改状态用这里导出的 window.setScreenState。 -->
  <script>
    // 状态切换按屏工作：每屏各切各的，画布上没有切全部屏的入口。
    function setScreenState(screenEl, nextState) {
      Array.prototype.slice.call(screenEl.classList)
        .filter(function (c) { return c.indexOf("state-") === 0; })
        .forEach(function (c) { screenEl.classList.remove(c); });
      if (nextState) screenEl.classList.add(nextState);
    }

    // 供 CUSTOM-JS 区调用的**状态表达函数**。它不认识按钮：绑哪个按钮、点了切到哪个
    // 状态、要不要设按下态，全部由产出方自己写（PRD 非目标 3：容器不定义任何点击语义）。
    // 导出它是因为容器写回文件时只还原得掉三种状态表达，产出方自己写 style/display
    // 那一类，写回时还原不掉、状态会被烘进文件，此后每次打开都停在错误状态且零报错。
    window.setScreenState = setScreenState;

    // 主行动按钮：演示"提交 → 处理中 → 成功"，只作用于它所在那一屏
    document.querySelectorAll("[data-submit]").forEach(function (submit) {
      submit.addEventListener("click", function () {
        var screenEl = submit.closest(".screen");
        if (!screenEl) return;
        setScreenState(screenEl, "state-loading");
        window.setTimeout(function () { setScreenState(screenEl, "state-success"); }, 650);
      });
    });

    // Tabs / 开关类控件的原型级交互：点谁谁选中（本段不变）
    …既有 tablist / switch / checkbox 两段原样保留…
  </script>
  <!-- SCREEN-SCRIPT:END -->
  ```

  > **`[data-state]` 的 `aria-pressed` 还原逻辑（`serialize()` `:1066-1068`）MUST 保留**：注解区按钮用的是 `data-act` 不是 `data-state`，但产出方仍可能用 `data-state`，那条还原是三种表达之一。

  3c. 在 `CUSTOM-CSS:END` 之后、`ANNO-FRAMEWORK:CSS:BEGIN` 之前**不能放脚本**（那里还在 `<head>`）。`CUSTOM-JS` 区 MUST 放在 `SCREEN-SCRIPT:END` **之后**——产出方才覆盖得掉容器的默认行为：

  ```html
  <!-- CUSTOM-JS:BEGIN 插槽：注解区按钮的点击行为写这里，用 slot --set script 写入。
       只用于本次原型自有的交互；固定实现区照旧不许改写。原型仍是单文件、零外链，
       MUST NOT 引入任何外部脚本。 -->
  <script id="proto-script"></script>
  <!-- CUSTOM-JS:END -->
  ```

  3d. `preview.mjs` 的 `SLOTS` 增一项（放在 `custom` 之后）：

  ```js
    script: {
      mark: 'CUSTOM-JS',
      shell: ['<script id="proto-script">', '</scr' + 'ipt>'],
      // 写入前把结束标签转义：脚本正文或注释里出现完整的 `</script` 会让 HTML 解析在那里
      // 提前闭合，浏览器执行一段残缺脚本，而 check 只会对被截断的片段报语法错——
      // 那时报错指向的位置与真正的原因隔着十万八千里。批注块的 persist() 早就在做同一件事。
      esc: (v) => v.replace(/<\/script/gi, '<\\/script'),
      wrap: (v) => `\n  <script id="proto-script">\n${v}\n  </scr` + `ipt>\n  `,
    },
  ```

  `cmdSlot` 在算 `body` 那一步应用它（**MUST 在 `stripShell` 之后、写入之前**）：

  ```js
    const body = key === 'title' ? esc(value.trim()) : value.replace(/\s+$/, '')
    const payload = slot.esc ? slot.esc(body) : body      // ← 新增这一行，其余不动
  ```

  随后所有用到 `body` 的分支改用 `payload`。

  > **`probe` 字段不要给它**：`cmdSlot` 只要看到 `slot.mark` 就走 `markRange` 分支（`preview.mjs:264-266`），`probe` 仅在既无 `apply` 又无 `mark` 时才作为回退匹配用（`:268-270`）。给一个永远不会被读的字段是死字段，下一个人会以为它参与校验。
  > 字面量里 MUST NOT 出现完整的脚本结束标签——`preview.mjs` 自身不是 HTML，但 `CLOSE_SCRIPT` 那条既有约定（`:113`）说明这里刻意拆开写；沿用同一写法保持一致。

  3e. `FIXED_REGIONS`（`:445`）增 `'SCREEN-SCRIPT'`：

  ```js
  const FIXED_REGIONS = ['THEME', 'DESIGN-SYSTEM', 'ICONS', 'SCREEN-SCRIPT', 'ANNO-FRAMEWORK:CSS', 'ANNO-FRAMEWORK:JS', 'ANNOTATIONS']
  ```

  **`CUSTOM-JS` MUST NOT 加进 `FIXED_REGIONS`**——它是插槽。

  3f. `cmdCheck` 增按钮行为检查（放在屏结构段之后）：

  ```js
    // 注解区里的按钮点了没反应属于静默失败：交付时看不出症状，只有用户点了才发现。
    // 匹配前 MUST 剥掉注释——把按钮名写在注释里（"// TODO: 给 s1-empty 加行为"）
    // 却没真绑，是最容易骗过这条检查的写法，而它恰好是这条检查要抓的那种人。
    const scriptRegion = sliceRegion(html, 'CUSTOM-JS')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    const actNames = [...screens.matchAll(/<button[^>]*data-act="([^"]+)"/g)].map((m) => m[1])
    actNames.forEach((name) => {
      if (!scriptRegion.includes(name)) {
        add('P2', `注解区按钮「${name}」没有对应的点击行为`,
          '外观由容器给，行为写进 script 插槽：preview.mjs slot --set script')
      }
    })
  ```

  3g. `cmdCheck` 第 12 条内联脚本语法检查（`:588-596`）**天然覆盖** `CUSTOM-JS`（它按 `<script` 切分全文）。**MUST 验证一次**：往 `script` 插槽写一段语法错的代码，`check` 应报 P0。

- [ ] **Step 4: 跑测试确认通过** — Run: `node --test test/prototype-preview.test.mjs test/prototype-annotations.test.mjs` Expected: PASS
- [ ] **Step 5: commit** — `git commit -m "feat(ai-prd): 状态切换收敛到各屏注解区 + 新增自定义脚本插槽"`

---

### Checkpoint：Task 1–2 之后

- [ ] `node --test test/*.test.mjs` 全绿
- [ ] 手工验证：`init` + `screen` ×2 + `slot --set script` 后用浏览器打开，点第二屏注解区的按钮，**只有第二屏变化**
- [ ] 运行时点过状态后触发一次写回，文件里**不残留** `state-*` 类（AC-007）

---

### Task 3：设计说明移入工具栏 + 工具栏两段重排

**Slice:** 打开原型 → 画布无右侧列、界面区满宽 → 点工具栏右段第一枚「设计说明」→ 下方展开面板 ｜ **依赖：** 无（与 Task 1/2 同文件，先后不限）

**满足:** FR-007, FR-008, FR-009

**Files:**
- Modify: `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html`（`.stage` `:548-556`、`.aside-stack` `:598`、`@media` `:619-622`、`aside` 整段 `:850-874`、`ANNO-FRAMEWORK:CSS` 追加、`bar.innerHTML` `:1187-1196`、`paint()` `:1212-1258`、工具栏点击分发 `:1283-1298`）
- Test: `test/prototype-preview.test.mjs`

**Interfaces:**
- Produces: `data-act="notes"` 入口按钮；`.anno-notes-panel` 面板；`NOTES` 标记与 `#proto-notes` 元素**位置变了但仍在**（`slot --set notes` 写入路径不变）

- [ ] **Step 1: 写失败测试**

  ```js
  test('画布右侧不再有常驻列，NOTES 插槽仍在', async () => {
    const html = await readFile(TEMPLATE, 'utf8')
    assert.doesNotMatch(html, /class="aside-stack"/)
    assert.doesNotMatch(html, /grid-template-columns:\s*minmax\(0, 1fr\) 340px/)
    assert.match(html, /<!-- NOTES:BEGIN/)
    assert.match(html, /id="proto-notes"/)
  })

  test('说明入口与展开的面板都不随页面滚动', () => {
    const html = readFileSync(templatePath, 'utf8')
    // 工具栏本身已是 sticky top:0；面板 MUST 也固定，不能跟着内容滚走（用户批注 g2）
    const css = html.slice(html.indexOf('ANNO-FRAMEWORK:CSS:BEGIN'), html.indexOf('ANNO-FRAMEWORK:CSS:END'))
    const panel = css.slice(css.indexOf('.anno-notes-panel'))
    assert.match(panel.slice(0, 400), /position:\s*(sticky|fixed)/)
  })

  test('设计说明入口在工具栏右段第一枚、写回按钮左侧，文字只有四个字', async () => {
    const html = await readFile(TEMPLATE, 'utf8')
    const bar = html.slice(html.indexOf('bar.innerHTML'), html.indexOf('document.body.insertBefore'))
    const iNotes = bar.indexOf('data-act="notes"')
    const iSave = bar.indexOf('data-act="save"')
    const iSpacer = bar.indexOf('anno-bar__spacer')
    const iCount = bar.indexOf('anno-count')
    assert.ok(iSpacer < iNotes && iNotes < iSave, '设计说明 MUST 在 spacer 之后、写回按钮之前')
    assert.ok(iCount < iSpacer, '批注计数 MUST 在左段')
    assert.match(bar, /data-act="notes"[^>]*>[^<]*<svg[\s\S]{0,200}?设计说明</)
    assert.doesNotMatch(bar, /设计说明（/)
  })

  test('slot --set notes 写入路径不变', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'proto-anno-'))
    const file = join(dir, 'p.html')
    await run(['init', file, '--title', 'T'])
    await run(['slot', file, '--set', 'notes', '--text', '<strong>样式依据</strong>沿用中性亮色基线'])
    const html = await readFile(file, 'utf8')
    assert.match(html, /样式依据/)
  })
  ```

- [ ] **Step 2: 跑测试确认失败** — Run: `node --test test/prototype-preview.test.mjs` Expected: FAIL
- [ ] **Step 3: 写最小实现**

  3a. `.stage` 改单列，删 `.aside-stack` 与 `.state-buttons` 两条规则，`@media` 里那两行删掉：

  ```css
    .stage {
      display: block;              /* 原为 grid + 两列 */
      max-width: 1560px;
      margin: 0 auto;
      padding: 20px 24px 48px;
    }
  ```

  `@media (max-width: 1080px)` 整块随之删除（它只管那两列的塌陷）。

  3b. `<main class="stage">` 里删掉整个 `<aside class="aside-stack">…</aside>`，但**把 `NOTES` 标记与 `#proto-notes` 连同外壳搬进 `<body>` 顶部的面板**（工具栏由框架 JS 动态插在 `body.firstChild`，面板 MUST 是静态 DOM 才能被 `slot` 写入）。搬到 `<main class="stage">` **之前**：

  ```html
  <div class="anno-notes-panel" id="proto-notes-panel" hidden>
    <div class="anno-notes-panel__inner">
      <!-- NOTES:BEGIN 插槽：用 slot --set notes 写入；外壳由本区提供，片段只写内容 -->
      <div class="card-content notes-body" id="proto-notes"></div>
      <!-- NOTES:END -->
    </div>
  </div>
  ```

  > `.notes-body` 与 `#proto-notes` 的 class/id **MUST 原样保留**——`SLOTS.notes.probe` 与 `check` 第 4 条都逐字认它们（`preview.mjs:58-63`、`:478-479`）。

  3c. `ANNO-FRAMEWORK:CSS` 区追加：

  ```css
    /* 设计说明面板：挂在工具栏下方，默认收起 */
    .anno-notes-panel {
      position: sticky;
      top: 46px;
      z-index: 890;
      border-bottom: 1px solid var(--border);
      background: color-mix(in oklab, var(--background) 96%, transparent);
      backdrop-filter: blur(14px);
    }

    .anno-notes-panel[hidden] { display: none !important; }

    .anno-notes-panel__inner {
      max-width: 1560px;
      margin: 0 auto;
      padding: 14px 24px 16px;
      font-family: var(--font-sans);
    }

    /* 右段第一枚：描边与文字用主色，在一排按钮里认得出来 */
    .anno-bar [data-act="notes"] { border-color: var(--primary); color: var(--primary); }
  ```

  3d. `bar.innerHTML` 改为两段（计数移到 `toggle` 之后、spacer 之前；`notes` 入口排在 `save` 之前）：

  ```js
    bar.innerHTML =
      '<span class="anno-bar__title">' + ico("i-message", "icon-sm") + "原型批注</span>" +
      '<button type="button" class="btn btn-outline btn-sm" data-act="pick" aria-pressed="false">' + ico("i-plus") + "加注释</button>" +
      '<button type="button" class="btn btn-outline btn-sm" data-act="global">' + ico("i-message") + "全局反馈</button>" +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="toggle" aria-pressed="false">' + ico("i-eye") + "隐藏批注</button>" +
      '<span class="anno-count"></span>' +
      '<span class="anno-bar__spacer"></span>' +
      '<button type="button" class="btn btn-outline btn-sm" data-act="notes" aria-pressed="false">' + ico("i-file") + "设计说明</button>" +
      '<button type="button" class="btn btn-sm" data-act="save"></button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="copy">' + ico("i-copy") + "复制 JSON</button>" +
      '<span class="anno-state"><span class="anno-state__dot"></span><span class="anno-state__text"></span></span>';
  ```

  > **图标 id MUST 先确认存在**：`check` 第 10 条会把引用了不存在的图标报成 P0。跑 `grep -o '<symbol id="i-[a-z-]*"' ui-prototype.html` 取现有清单，`i-file` 不在其中就换一个在的（如 `i-message`），**MUST NOT 新增 symbol**（`ICONS` 是固定实现区）。

  3e. 工具栏点击分发增一支：

  ```js
        } else if (act === "notes") {
          var panel = document.getElementById("proto-notes-panel");
          if (!panel) return;
          panel.hidden = !panel.hidden;
          btn.setAttribute("aria-pressed", String(!panel.hidden));
        }
  ```

  3f. `paint()` 增「复制 JSON」条件显示，并改「重试写回」样式。在 `var save = …` 那几行之后加：

  ```js
      var copy = bar.querySelector('[data-act="copy"]');
      // 写得进文件时就没有人工搬运的必要
      copy.hidden = SERVED && servedOk;
  ```

  `SERVED` 分支里那行 `save.innerHTML = ico("i-save") + "重试写回";` 之后加一行改样式；其余分支 MUST 恢复主色实心：

  ```js
      if (SERVED) {
        save.className = "btn btn-outline btn-sm";   // 辅助功能，不该比「加注释」抢眼
        …
      } else {
        save.className = "btn btn-sm";               // file:// 降级路径下这是唯一存盘入口，保持主色实心
        …
      }
  ```

- [ ] **Step 4: 跑测试确认通过** — Run: `node --test test/prototype-preview.test.mjs` Expected: PASS
- [ ] **Step 5: commit** — `git commit -m "feat(ai-prd): 设计说明移入工具栏折叠面板 + 工具栏分两段"`

---

### Task 4：预览写回的版本冲突处置

**Slice:** 预览服务开着 → 产出方改稿 → 页面旧版本写回被拒 → 页面取回最新并把批注补上 ｜ **依赖：** 无

**满足:** FR-010, FR-011

**Files:**
- Modify: `ai-dev-system/skills/ai-prd/scripts/preview.mjs`（`cmdServe` `:635-722`）
- Modify: `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html`（`write()` `:1092-1105`、`autosave()` `:1107-1121`、新增卸载期写回）
- Test: `test/prototype-preview.test.mjs`

**Interfaces:**
- Produces: `GET`/`HEAD /` 响应头 `X-Proto-Version`；`POST /save` 的 `If-Match` 头**或**等价的 `?v=` 查询参数；409 响应体 `{ok:false,error:"stale",html:"<最新全文>"}`

- [ ] **Step 1: 写失败测试** — **MUST 用本文件现有的 helper**：`mkdtempSync` / `path.join` / 同步 `run(...args)`（返回 `{code, out}`）/ `startServer(file)`（返回 `{child, base, port}`）/ `stopServer(child)`。**MUST NOT 自造 `spawnServe`、异步 `run`、`mkdtemp` 这类不存在的 helper**。

  ```js
  test('页面的旧版本写不掉磁盘上的新版本', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'proto-ver-'))
    const file = path.join(dir, 'p.html')
    assert.equal(run('init', file, '--title', 'T').code, 0)
    assert.equal(run('screen', file, '--name', 'S').code, 0)
    const { child, base } = await startServer(file)
    try {
      const got = await fetch(base)
      const ver = got.headers.get('x-proto-version')
      assert.ok(ver, 'GET MUST 下发 X-Proto-Version')
      const stale = await got.text()

      // 产出方在这期间改了稿
      assert.equal(run('slot', file, '--set', 'subtitle', '--text', '改过一轮').code, 0)

      // 页面拿旧版本写回 → MUST 被拒，且回最新全文
      const res = await fetch(base + 'save', {
        method: 'POST',
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'If-Match': ver },
        body: stale,
      })
      assert.equal(res.status, 409)
      const body = await res.json()
      assert.equal(body.error, 'stale')
      assert.match(body.html, /改过一轮/)
      assert.match(readFileSync(file, 'utf8'), /改过一轮/)   // 磁盘没被覆盖
    } finally {
      await stopServer(child)
    }
  })

  test('缺 If-Match 且缺 ?v= 时按冲突处理，不当强制覆盖', async () => {
    // …POST 既不带 If-Match 也不带 ?v= → 409，文件不变
  })

  test('sendBeacon 那条路：?v= 与 If-Match 等价', async () => {
    // …GET 取 ver → POST 到 `save?v=${ver}`、不带 If-Match → 200 且文件已更新
  })

  test('版本串是内容哈希：同毫秒内同大小的两次写入版本仍变', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'proto-hash-'))
    const file = path.join(dir, 'p.html')
    writeFileSync(file, 'A'.repeat(64), 'utf8')
    const { child, base } = await startServer(file)
    try {
      const v1 = (await fetch(base)).headers.get('x-proto-version')
      writeFileSync(file, 'B'.repeat(64), 'utf8')     // 同大小、可能同毫秒
      const v2 = (await fetch(base)).headers.get('x-proto-version')
      assert.notEqual(v1, v2, '内容变了版本就 MUST 变——mtime+size 在这里会给出同一个值')
    } finally {
      await stopServer(child)
    }
  })

  test('并发两个写回时后到的那个基于前一个的结果判定', async () => {
    // …同时发两个带同一 If-Match 的 POST：MUST 一个 200 一个 409，
    // MUST NOT 两个都 200（那说明比对与写入之间有 TOCTOU 窗口）
  })
  ```

- [ ] **Step 2: 跑测试确认失败** — Run: `node --test test/prototype-preview.test.mjs` Expected: FAIL（无版本头、无 409 分支）
- [ ] **Step 3: 写最小实现**

  3a. `preview.mjs` 顶部 `import { createHash } from 'node:crypto'`，`cmdServe` 内加：

  ```js
  // 版本串 MUST 是内容哈希。曾打算用 mtimeMs + size，但同一毫秒内两次写入且字节数
  // 相同时它不变 —— 旧页面就能覆盖新稿，而这正是本次要堵的那个失败本身。
  async function versionOf(file) {
    const buf = await readFile(file)
    return createHash('sha256').update(buf).digest('hex').slice(0, 16)
  }
  ```

  3b. `GET` / `HEAD /` 下发版本头（**HEAD 与 GET 走同一分支**，HEAD 不发 body）：

  ```js
      if ((req.method === 'GET' || req.method === 'HEAD') && (url === '/' || url === '/index.html')) {
        try {
          const html = await readFile(file, 'utf8')
          const head = {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'x-proto-version': await versionOf(file),
          }
          if (req.method === 'HEAD') { res.writeHead(200, head).end(); return }
          res.writeHead(200, head).end(html)
        } catch (e) {
          res.writeHead(500).end(String(e && e.message))
        }
        return
      }
  ```

  > 已核实这不削弱既有防护：Host 校验在路由分支**之前**执行（`preview.mjs:641-645`），跨站写校验只对 POST 执行（`:646-657`），HEAD 不写文件。

  3c. **写入串行化 + 版本校验**。`cmdServe` 内加一条 Promise 队列，把"读当前版本 → 比对 → 写入"整段串成临界区：

  ```js
  // 比对与写入之间存在 TOCTOU 窗口：另一个写者挤进来，它的改动会被这次写入吞掉，
  // 版本校验就形同虚设。用一条 Promise 链把每次 /save 串起来。
  let writeChain = Promise.resolve()
  function serialize(fn) {
    const next = writeChain.then(fn, fn)
    writeChain = next.catch(() => {})
    return next
  }
  ```

  `POST /save` 分支在既有的 payload 校验**之后**改成：

  ```js
          // 卸载期（beforeunload）发不出自定义请求头，所以 ?v= 与 If-Match 同义。
          // 两者都不给一律按冲突处理 —— 把"没带版本"当强制覆盖等于给静默覆盖留后门。
          const q = (req.url || '').split('?')[1] || ''
          const want = req.headers['if-match'] || new URLSearchParams(q).get('v') || ''
          const outcome = await serialize(async () => {
            const now = await versionOf(file)
            if (!want || want !== now) return { stale: true, now, latest: await readFile(file, 'utf8') }
            await writeAtomic(file, body)
            return { stale: false, version: await versionOf(file) }
          })
          if (outcome.stale) {
            res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' })
              .end(JSON.stringify({ ok: false, error: 'stale', html: outcome.latest }))
            process.stdout.write(`  ⚠ 拒绝一次过期写回（页面版本 ${want || '未带'}，磁盘 ${outcome.now}）——页面会取回最新稿后重写\n`)
            return
          }
          saves += 1
          process.stdout.write(`  ✓ 第 ${saves} 次写回 ${path.basename(file)}（${body.length} 字节）\n`)
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            .end(JSON.stringify({ ok: true, version: outcome.version }))
  ```

  3d. 容器 `write()` 带版本并处理 409：

  ```js
      var docVersion = null;   // 与 store 同级的模块变量，启动时用 HEAD 取

      function write() {
        if (SERVED) {
          return fetch("save", {
            method: "POST",
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "If-Match": docVersion || ""
            },
            body: serialize()
          }).then(function (r) {
            if (r.status === 409) {
              return r.json().then(function (d) { return adoptLatest(d.html); });
            }
            if (!r.ok) return false;
            return r.json().then(function (d) {
              docVersion = d.version || docVersion;
              return true;
            }, function () { return true; });
          }).catch(function () { return false; });
        }
        // …既有 File System Access 分支不变…
      }
  ```

  3e. `adoptLatest()` —— **这一段是本任务最容易写错的地方**：

  ```js
      // 磁盘上有更新的稿子：以它为基线，把本机还没写回的批注合并上去，再写一次。
      function adoptLatest(latestHtml) {
        var doc = new DOMParser().parseFromString(latestHtml, "text/html");
        var slot = doc.getElementById("anno-data");
        var disk = (slot && parse(slot.textContent)) || blank();

        // 三类各自按 id 合并，本机为准；MUST NOT 丢弃磁盘那版里已有而本机没有的条目
        // —— 那是别处（另一个标签页、另一次会话）写进去的用户意见。
        function mergeById(diskList, mineList) {
          var by = {};
          (diskList || []).forEach(function (x) { by[x.id] = x; });
          (mineList || []).forEach(function (x) { by[x.id] = x; });
          return Object.keys(by).map(function (k) { return by[k]; });
        }
        var merged = {
          schema: disk.schema || "prd-annotations@1",
          global: mergeById(disk.global, store.global),
          items: mergeById(disk.items, store.items),
          replies: mergeById(disk.replies, store.replies),
          // ⚠ MUST 用当前时间，MUST NOT 沿用磁盘那版的 updatedAt：
          // reload 之后 load() 按 updatedAt 择新，沿用磁盘值会让它判定"文件里那份更新"，
          // 于是刚合并进来的本机批注被整份丢掉 —— 症状是"用户写的意见默默消失、零报错"。
          updatedAt: new Date().toISOString()
        };
        try { window.localStorage.setItem(KEY, JSON.stringify(merged)); } catch (e) { /* 隐私模式 */ }

        // localStorage 不可用时不能只靠 reload —— 那样合并结果没有任何落点。
        // 先把合并结果直接写回文件（带磁盘那版的版本号，此刻它就是最新的），再重载。
        store = merged;
        var head = latestHtml.length;   // 占位：真实版本号由下面这次写回的响应给出
        return fetch("save", {
          method: "POST",
          headers: { "Content-Type": "text/html; charset=utf-8", "If-Match": diskVersionOf(latestHtml) },
          body: serializeWith(merged, latestHtml)
        }).then(function () {
          window.location.reload();
          return true;
        }, function () {
          window.location.reload();
          return true;
        });
      }
  ```

  > **版本号 MUST 用服务端在 409 体里给的 `version`，MUST NOT 在页面自己重算**：服务端算的是磁盘文件的字节，页面只拿得到 HTTP 返回的字符串，两者要逐字节一致才对得上——那是一条没有任何东西守着的隐性契约，而服务端明明已经算好了。少一处重复实现，也少一个对 `crypto.subtle` 的依赖（它在非安全上下文不可用）。
  > **`serializeWith` MUST 一并实现**：把 `merged` 写进 `latestHtml` 的批注块位置并返回完整文档（复用既有 `persist()` 里那段 `<\/` 转义）。
  > **不要图省事只 `reload()`**：那样合并结果只存在 `localStorage` 里，一旦 `localStorage` 不可用（隐私模式、站点数据被清），用户这一次写的批注就凭空消失。

  3f. 卸载期写回（FR-011 的"手动刷新"部分）——**MUST 真写，不能只依赖缓存**：

  ```js
      window.addEventListener("beforeunload", function () {
        if (!dirty || !SERVED) return;
        // 卸载期发不出自定义请求头，所以版本走查询参数 —— 服务端认它与 If-Match 同义。
        try {
          var blob = new Blob([serialize()], { type: "text/html; charset=utf-8" });
          navigator.sendBeacon("save?v=" + encodeURIComponent(docVersion || ""), blob);
        } catch (e) { /* 发不出去也没关系：批注还在 localStorage 里，下次打开取回 */ }
      });
  ```

  > **缓存是兜底不是主路径**：beacon 被浏览器丢弃、或撞上版本冲突（服务端返 409、beacon 收不到响应）时，批注仍在 `localStorage`，`load()` 按 `updatedAt` 择新会在下次打开时取回（`ui-prototype.html:991-1000`）。但 MUST NOT 因为有兜底就不发 beacon——那等于让用户每次刷新都丢一次写回机会。

  3g. 启动时取版本：`render()` 之后加

  ```js
      if (SERVED) {
        fetch("", { method: "HEAD" }).then(function (r) {
          docVersion = r.headers.get("x-proto-version");
        }).catch(function () { /* 忽略：首次写回会拿到 409 并自动纠正 */ });
      }
  ```

- [ ] **Step 4: 跑测试确认通过** — Run: `node --test test/prototype-preview.test.mjs` Expected: PASS
- [ ] **Step 5: commit** — `git commit -m "fix(ai-prd): 预览服务写回加内容哈希版本校验与串行写入"`

---

### Checkpoint：Task 3–4 之后

- [ ] `node --test test/*.test.mjs` 全绿
- [ ] 手工验证：起 `serve` → 浏览器打开 → 命令行 `slot --set subtitle` 改稿 → 页面里点一次批注 → 页面自动重载且显示新副标题、批注还在

---

### Task 5：AI 说明的稳定锚点 + 用户回复

**Slice:** 悬浮一条待拍板说明 → 点回复入口写一段话 → 回复挂在这条说明上、随写回落进文件 ｜ **依赖：** 无

**满足:** FR-012

**Files:**
- Modify: `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html`（`blank()` `:974-976`、`parse()` `:978-991`、`render()` `:1325-1347`、点击分发 `:1379-1391`、新增 `openNote()`、`ANNO-FRAMEWORK:CSS` 追加）
- Test: `test/prototype-annotations.test.mjs`

**Interfaces:**
- Produces: 元素属性 `data-anno-id="a<N>"`；批注数据顶层 `replies[]`（字段见 spec §2.1）；气泡属性 `data-anno-note-id`

- [ ] **Step 1: 写失败测试**

  ```js
  test('批注数据结构容纳 replies 且 schema 不升版本', async () => {
    const html = await readFile(TEMPLATE, 'utf8')
    const block = html.slice(html.indexOf('"schema"'), html.indexOf('ANNOTATIONS:END'))
    assert.match(block, /"prd-annotations@1"/)          // 不升版本
    assert.match(html, /replies/)                        // 框架认得这个字段
  })

  test('parse 对缺 replies 的旧数据回落成空数组', async () => {
    const html = await readFile(TEMPLATE, 'utf8')
    const seg = html.slice(html.indexOf('function parse('), html.indexOf('function load('))
    assert.match(seg, /d\.replies\s*=\s*Array\.isArray\(d\.replies\)\s*\?\s*d\.replies\s*:\s*\[\]/)
  })

  test('AI 说明气泡带得出稳定锚点，且框架不改写已有的', async () => {
    const html = await readFile(TEMPLATE, 'utf8')
    assert.match(html, /data-anno-id/)
    assert.match(html, /data-anno-note-id/)
  })
  ```

- [ ] **Step 2: 跑测试确认失败** — Run: `node --test test/prototype-annotations.test.mjs` Expected: FAIL
- [ ] **Step 3: 写最小实现**

  3a. `blank()` 与 `parse()` 各加一行：

  ```js
      function blank() {
        return { schema: "prd-annotations@1", updatedAt: "", global: [], items: [], replies: [] };
      }
  ```
  ```js
          d.replies = Array.isArray(d.replies) ? d.replies : [];   // 旧数据没有它 → 空数组
  ```

  3b. `render()` 里给 AI 说明气泡补锚点与引用：

  ```js
        Array.prototype.forEach.call(document.querySelectorAll("[data-anno]"), function (el) {
          var text = el.getAttribute("data-anno");
          if (!text) return;
          var kind = el.getAttribute("data-anno-kind") === "question" ? "ask" : "note";
          var pin = mkPin(kind, "", text);
          pin.setAttribute("data-anno-text", text);   // openNote 靠它精确认出是哪一条
          // 已有 id 一律沿用；没有的等到用户真要提交回复时再补（见 openNote）
          var nid = el.getAttribute("data-anno-id");
          if (nid) pin.setAttribute("data-anno-note-id", nid);
          attach(el, pin);
        });
  ```

  并在 `render()` 末尾（`paint()` 之前）追加一段：把 `replies` 里已失联（`noteId` 在页面上找不到）的条目**保留但标记**，供 `openGlobal` 展示——**MUST NOT 在渲染时删除**，删除只发生在 `slot` 放行路径上：

  ```js
        // 失联的回复不渲染气泡，但数据保留；产出方跑 annotations 仍看得到它们
  ```

  3c. 新增 `nextAnnoId()` 与 `openNote()`：

  ```js
      // AI 说明的稳定锚点：用户第一次回复这条说明时才补。产出方写说明时不必手写 id
      // ——那是给一件八成用不上的事加恒定成本，且漏写没有任何东西会报错。
      function nextAnnoId() {
        var used = [];
        Array.prototype.forEach.call(document.querySelectorAll("[data-anno-id]"), function (el) {
          used.push({ id: el.getAttribute("data-anno-id") });
        });
        return nextId(used, "a");
      }

      function openNote(el, pin) {
        var noteText = el.getAttribute("data-anno") || "";
        var isQuestion = el.getAttribute("data-anno-kind") === "question";
        // ⚠ 这里 MUST NOT 补写 data-anno-id：只是打开看一眼就在文件里留下一个稳定 ID，
        // 与「用户第一次回复这条说明时才补」的约定不符，也会让只读浏览产生 diff。
        // 补写延后到真的提交一条回复的那一刻（见下方 data-role="reply" 的 onclick）。
        var nid = el.getAttribute("data-anno-id");
        var mine = nid ? store.replies.filter(function (r) { return r.noteId === nid; }) : [];
        var rows = mine.map(function (r) {
          return '<li><p data-rtext="' + esc(r.id) + '">' + esc(r.text) +
            '</p><span class="row">' +
            '<button type="button" class="btn btn-ghost btn-icon btn-sm" data-redit="' + esc(r.id) +
            '" aria-label="修改">' + ico("i-message") + "</button>" +
            '<button type="button" class="btn btn-ghost btn-icon btn-sm" data-rdel="' + esc(r.id) +
            '" aria-label="删除">' + ico("i-x") + "</button></span></li>";
        }).join("");
        pop.innerHTML =
          '<div class="anno-pop__head">' + esc(screenOf(el) || "本页") + " · " +
            esc(labelOf(el) || el.tagName.toLowerCase()) + (isQuestion ? " · 待你拍板" : "") + "</div>" +
          '<p class="anno-note__text">' + esc(noteText) + "</p>" +
          (rows ? '<ul class="anno-list">' + rows + "</ul>" : "") +
          '<textarea data-role="text" placeholder="' + (isQuestion ? "写下你的答复" : "对这条说明的意见") + '"></textarea>' +
          '<div class="anno-pop__row"><button type="button" class="btn btn-outline btn-sm" data-role="close">关闭</button>' +
          '<button type="button" class="btn btn-sm" data-role="reply">' + ico("i-message") + "回复</button></div>";
        var ta = pop.querySelector('[data-role="text"]');
        var editing = null;                       // 正在改的那条回复的 id
        pop.querySelector('[data-role="reply"]').onclick = function () {
          var v = ta.value.trim();
          pop.hidden = true;
          if (!v) return;
          if (editing) {                          // 改一条已有的回复
            store.replies.forEach(function (r) {
              if (r.id === editing) { r.text = v; r.at = new Date().toISOString(); }
            });
            persist();
            return;
          }
          // 到这一刻才补写稳定锚点：用户确实要回复这条说明了
          if (!nid) {
            nid = nextAnnoId();
            el.setAttribute("data-anno-id", nid);
            pin.setAttribute("data-anno-note-id", nid);
          }
          store.replies.push({
            id: nextId(store.replies, "r"),
            noteId: nid,
            noteText: noteText,          // 写入时的快照：说明日后被改写或删除，这条回复仍看得懂
            noteKind: isQuestion ? "question" : "note",
            screen: screenOf(el),
            label: labelOf(el),
            tag: el.tagName.toLowerCase(),
            text: v,
            at: new Date().toISOString()
          });
          persist();
        };
        pop.querySelector('[data-role="close"]').onclick = function () { pop.hidden = true; };
        Array.prototype.forEach.call(pop.querySelectorAll("[data-rdel]"), function (b) {
          b.onclick = function () {
            store.replies = store.replies.filter(function (r) { return r.id !== b.getAttribute("data-rdel"); });
            pop.hidden = true;
            persist();
          };
        });
        // 改：把原文回填进输入框，再点「回复」即写回同一条（PRD §五「随时改、随时删」）
        Array.prototype.forEach.call(pop.querySelectorAll("[data-redit]"), function (b) {
          b.onclick = function () {
            var rid = b.getAttribute("data-redit");
            var cur = store.replies.filter(function (r) { return r.id === rid; })[0];
            if (!cur) return;
            editing = rid;
            ta.value = cur.text;
            pop.querySelector('[data-role="reply"]').innerHTML = ico("i-check") + "保存修改";
            ta.focus();
          };
        });
        place(pop, pin);
        ta.focus();
      }
  ```

  3d. 点击分发：note/ask 气泡由"只显示 tip"改为打开说明面板。原 `:1379-1385`：

  ```js
        var pin = e.target.closest(".anno-pin");
        if (pin) {
          var ref = pin.getAttribute("data-anno-ref");
          if (ref) { e.preventDefault(); e.stopPropagation(); openEditor(ref, pin); return; }
          // AI 说明气泡：点开可读全文并追加回复（待拍板的那种尤其如此——它本来就在等答复）
          // hostOf() 会把 void 元素的气泡挂到父元素上，所以 data-anno 可能在 host 自己
          // 身上、也可能在它的某个子元素上；同一个 host 还可能挂着好几条说明。
          // 因此 MUST 按 data-anno-text 逐字比对精确取那一条，取不到就不开——
          // 只取 querySelector 的第一条会让用户回复到另一条说明上，而且毫无提示。
          var host = pin.closest("[data-anno-host]");
          var want = pin.getAttribute("data-anno-text") || "";
          var noteEl = null;
          if (host) {
            var cands = Array.prototype.slice.call(host.querySelectorAll("[data-anno]"));
            if (host.hasAttribute("data-anno")) cands.unshift(host);
            noteEl = cands.filter(function (n) { return n.getAttribute("data-anno") === want; })[0] || null;
          }
          if (noteEl) { e.preventDefault(); e.stopPropagation(); openNote(noteEl, pin); return; }
          tip.textContent = pin.getAttribute("data-anno-text") || "";
          place(tip, pin);
          return;
        }
  ```

  > **`hostOf()` 会把 void 元素的气泡挂到父元素上**（`:1302`），所以 `data-anno` 可能在 host 自己身上、也可能在它的某个子元素上——两种都要认，上面两行就是为此。**MUST 用 `data-anno-text` 逐字比对确认取到的是同一条**，多条说明挂同一 host 时才不会串：`if (noteEl && noteEl.getAttribute("data-anno") !== pin.getAttribute("data-anno-text")) { noteEl = Array.prototype.filter.call(host.querySelectorAll("[data-anno]"), function (n) { return n.getAttribute("data-anno") === pin.getAttribute("data-anno-text"); })[0] || noteEl; }`

  3e. 悬浮仍显示 tip（不变），只是点击行为变了。`ANNO-FRAMEWORK:CSS` 追加：

  ```css
    .anno-note__text {
      margin: 0 0 10px;
      padding: 8px 10px;
      border-left: 2px solid var(--primary);
      background: var(--muted);
      border-radius: var(--radius-sm);
      word-break: break-word;
    }
  ```

  3f. `serialize()` **无需改动**——`data-anno-id` 是落进文件的真实属性，不是运行时属性，MUST NOT 加进那三段剥离逻辑里。

- [ ] **Step 4: 跑测试确认通过** — Run: `node --test test/prototype-annotations.test.mjs` Expected: PASS
- [ ] **Step 5: commit** — `git commit -m "feat(ai-prd): 用户可对任何一条 AI 说明就地追加回复"`

---

### Task 6：取批注输出回复类

**Slice:** 用户回复过 → 产出方跑 `annotations` → 看得出这是回复、回的哪条、是否待拍板、挂在哪一屏哪个元素 ｜ **依赖：** Task 5 的 `replies[]` 与 `data-anno-id`

**满足:** FR-013

**Files:**
- Modify: `ai-dev-system/skills/ai-prd/scripts/preview.mjs`（`collectAiNotes` `:328-356`、`cmdAnnotations` `:365-398`）
- Test: `test/prototype-annotations.test.mjs`

**Interfaces:**
- Consumes: Task 5 的 `replies[]`
- Produces: `--json` 输出增 `user.replies[]`；`ai[]` 每项增 `id` 字段

- [ ] **Step 1: 写失败测试**

  ```js
  test('annotations 把回复列成第四类，五项齐全', async () => {
    const file = await fixtureWithReply()   // 构造：一条 question 说明 + 一条挂在它上的回复
    const r = await run(['annotations', file])
    assert.match(r.stdout, /用户对说明的回复（1）/)
    assert.match(r.stdout, /待拍板/)
    assert.match(r.stdout, /回的是：/)
  })

  test('annotations --json 输出 user.replies 且带被回复说明的原文', async () => {
    const file = await fixtureWithReply()
    const r = await run(['annotations', file, '--json'])
    const out = JSON.parse(r.stdout)
    assert.equal(out.user.replies.length, 1)
    const rep = out.user.replies[0]
    for (const k of ['noteId', 'noteText', 'noteKind', 'screen', 'label', 'text']) {
      assert.ok(rep[k] !== undefined, `回复缺字段 ${k}`)
    }
    // AI 说明侧要能被回复指回来
    assert.ok(out.ai.some((a) => a.id === rep.noteId))
  })

  test('说明已被删时，回复仍带得出它原本回的是什么', async () => {
    const file = await fixtureWithOrphanReply()  // replies 在、data-anno-id 已不在页面上
    const r = await run(['annotations', file, '--json'])
    const out = JSON.parse(r.stdout)
    assert.equal(out.user.replies[0].noteText.length > 0, true)
    assert.equal(out.user.replies[0].orphan, true)
  })
  ```

- [ ] **Step 2: 跑测试确认失败** — Run: `node --test test/prototype-annotations.test.mjs` Expected: FAIL
- [ ] **Step 3: 写最小实现**

  3a. `collectAiNotes` 的 `out.push({...})` 增一项 `id`：

  ```js
      const id = (attrs.match(/data-anno-id="([^"]*)"/) || [])[1] || ''
      out.push({ line: …, screen: …, tag: …, kind, id, label: …, text: m[3] })
  ```

  3b. `cmdAnnotations` 组装回复：

  ```js
    const ai = collectAiNotes(html)
    const known = new Set(ai.map((a) => a.id).filter(Boolean))
    // orphan：被回复的说明已经不在页面上了。快照字段让产出方仍看得懂这条回复原本在回什么，
    // MUST NOT 因为找不到说明就把它藏起来——那是用户写下的意见。
    const replies = (data.replies || []).map((r) => ({ ...r, orphan: !known.has(r.noteId) }))
  ```

  `--json` 分支的 `user` 增 `replies`：`user: { items, global: data.global || [], replies }`。

  人类可读分支在 AI 说明段之后追加：

  ```js
    console.log(`\n用户对说明的回复（${replies.length}）`)
    replies.forEach((r) => {
      const q = r.noteKind === 'question' ? ' [待拍板]' : ''
      const where = r.orphan ? '（这条说明已不在页面上）' : ''
      console.log(`  [${r.id}] ${r.screen || '本页'} › ${r.tag || '?'} "${r.label || ''}"${q}${where}`)
      console.log(`        回的是：${r.noteText}`)
      console.log(`        回复：${r.text}`)
    })
  ```

- [ ] **Step 4: 跑测试确认通过** — Run: `node --test test/prototype-annotations.test.mjs` Expected: PASS
- [ ] **Step 5: commit** — `git commit -m "feat(ai-prd): annotations 输出用户对说明的回复"`

---

### Task 7：改稿放行契约（--agreed / --agreed-plan）

**Slice:** 改掉一个带用户批注的元素 → 被拒并列出受影响每条 → 逐条约定后带 `--agreed` 重跑 → 清掉已落实/作废、校验挪走项、写入并打印放行清单 ｜ **依赖：** Task 5 的 `replies[]` 与 `data-anno-id`

**满足:** FR-015, FR-016, FR-017, FR-018

**Files:**
- Modify: `ai-dev-system/skills/ai-prd/scripts/preview.mjs`（`cmdSlot` `:246-309`、`parseArgs` `:738-756`、`HELP` `:725-736`）
- Test: `test/prototype-preview.test.mjs`

**Interfaces:**
- Produces: `--agreed`、`--agreed-plan`（`done|void|move` 闭集）；放行清单 stdout 格式

- [ ] **Step 1: 写失败测试**

  ```js
  test('未放行时改掉带批注的元素仍拒绝写入', async () => { /* 既有断言改写：从"一律拒绝"改为"未放行则拒绝" */ })

  test('--agreed 单独给出而无 --agreed-plan 时拒绝', async () => {
    const r = await run(['slot', file, '--set', 'screens', '--text', newFrag, '--agreed'], { allowFail: true })
    assert.notEqual(r.code, 0)
    assert.match(r.stderr, /--agreed-plan/)
  })

  test('放行方案漏了某条时拒绝并列出漏项', async () => { /* u1 有批注，方案只给 u2 */ })

  test('未知处置取值时拒绝并列出合法值域', async () => {
    const r = await run([... '--agreed', '--agreed-plan=u1=maybe'], { allowFail: true })
    assert.match(r.stderr, /done.*void.*move/)
  })

  test('done/void 项放行后从批注数据里清掉且记进放行清单', async () => {
    const r = await run([... '--agreed', '--agreed-plan=u1=done'])
    assert.match(r.stdout, /放行清单/)
    assert.match(r.stdout, /u1.*已落实/)
    const data = JSON.parse(annoBlockOf(await readFile(file, 'utf8')))
    assert.equal(data.items.find((x) => x.id === 'u1'), undefined)
    // 交付自检不再报它指不到元素
    const c = JSON.parse((await run(['check', file, '--json'])).stdout)
    assert.equal(c.problems.filter((p) => /u1/.test(p.msg)).length, 0)
  })

  test('move 项带回了锚点 → 放行成功并记进放行清单（三个取值都要有可达的成功路径）', () => {
    // 新片段把 data-anno-user="u1" 写到另一个元素上：锚点仍在，但挪了位置。
    // 这条 MUST 能走通 —— 只按"锚点丢了"取受影响集会让 move 永远走不到成功路径。
    const r = run('slot', file, '--set', 'screens', '--text', fragWithAnchorMoved,
      '--agreed', '--agreed-plan=u1=move')
    assert.equal(r.code, 0)
    assert.match(r.out, /放行清单/)
    assert.match(r.out, /u1.*挪到新元素/)
    const data = readAnnotations(readFileSync(file, 'utf8'))
    assert.ok(data.items.some((x) => x.id === 'u1'), 'move 不删条目，只是换了挂载元素')
  })

  test('move 项的锚点没写到新片段上时拒绝放行', async () => {
    const r = await run([... '--agreed', '--agreed-plan=u1=move'], { allowFail: true })
    assert.notEqual(r.code, 0)
    assert.match(r.stderr, /挪到新元素/)
    assert.match(await readFile(file, 'utf8'), /u1/)   // 文件未变
  })

  test('丢掉 AI 说明锚点只提示不拦，并列出被一并丢弃的回复', async () => {
    const r = await run(['slot', file, '--set', 'screens', '--text', fragWithoutNote])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /丢掉了 1 条 AI 说明/)
    assert.match(r.stdout, /连带丢弃 1 条回复/)
    const data = JSON.parse(annoBlockOf(await readFile(file, 'utf8')))
    assert.equal((data.replies || []).length, 0)
  })

  test('--drop-anchors 已废除，传入即报错并指向新名', async () => {
    const r = await run([... '--drop-anchors'], { allowFail: true })
    assert.notEqual(r.code, 0)
    assert.match(r.stderr, /--agreed/)
  })
  ```

- [ ] **Step 2: 跑测试确认失败** — Run: `node --test test/prototype-preview.test.mjs` Expected: FAIL
- [ ] **Step 3: 写最小实现**

  3a. `parseArgs`：删 `--drop-anchors` 那行，增

  ```js
      else if (a === '--agreed') out.agreed = true
      else if (a === '--drop-anchors') out['drop-anchors'] = true   // 只为报错识别，见 cmdSlot
  ```

  （`--agreed-plan` 走既有的 `--key value` / `--key=value` 通用分支，无需单列。）

  3b. `cmdSlot` 开头加废弃开关拦截：

  ```js
    if (opts['drop-anchors']) {
      fail('`--drop-anchors` 已废除。它字面说的是"丢弃用户意见"，与现在的语义相反。\n' +
        '改用 `--agreed --agreed-plan <逐条处置>`，含义是"我已经和用户逐条约定过了"。', 2)
    }
  ```

  3c. 新增方案解析：

  ```js
  const AGREED_ACTIONS = ['done', 'void', 'move']
  const ACTION_LABEL = { done: '已落实', void: '作废', move: '挪到新元素' }

  async function parseAgreedPlan(raw) {
    if (raw === undefined) return null
    let text = raw
    // 不含 `=` 就当文件路径：`--agreed-plan plan.txt`
    if (!raw.includes('=')) text = await readFile(path.resolve(raw), 'utf8').catch(() => fail(`读不到放行方案文件：${raw}`, 1))
    const plan = {}
    text.split(/[\n,]/).forEach((line) => {
      const s = line.trim()
      if (!s || s.startsWith('#')) return
      const i = s.indexOf('=')
      if (i < 0) fail(`放行方案格式错误：「${s}」\n每条写成 <批注id>=<${AGREED_ACTIONS.join('|')}>`, 2)
      const id = s.slice(0, i).trim()
      const act = s.slice(i + 1).trim()
      if (!AGREED_ACTIONS.includes(act)) {
        fail(`未知处置「${act}」（批注 ${id}）\n合法取值只有：${AGREED_ACTIONS.join(' / ')}`, 2)
      }
      plan[id] = act
    })
    return plan
  }
  ```

  3d. `cmdSlot` 的锚点校验段整体改写（替换 `:285-300`）：

  ```js
    // 受影响的条目 MUST 取两个来源的并集：
    //   ① lost —— 新片段里没有该锚点的（已落实 / 作废 / 忘了带过去）
    //   ② moved —— 锚点还在，但产出方在方案里显式声明为 move 的（挪到了别的元素上）
    // 只取 ① 会让 move 成为死值：带回锚点就不在 ① 里、触发不了放行；不带回就必然被
    // move 的锚点校验拒绝 —— 两条路都走不通，三个取值里有一个永远无法成功。
    const plan = await parseAgreedPlan(opts['agreed-plan'])
    if (opts.agreed && !plan) {
      fail('`--agreed` 表示"已与用户逐条约定过"，MUST 同时给出每条的处置方案：\n' +
        '  --agreed-plan=u1=done,u2=void,u3=move\n' +
        `  取值：${AGREED_ACTIONS.map((a) => `${a}（${ACTION_LABEL[a]}）`).join(' / ')}`, 2)
    }

    const data = before || { items: [], replies: [] }
    const detailOf = (id) => {
      const it = (data.items || []).find((x) => x.id === id)
      return it ? `${it.screen || '本页'} › "${it.label || ''}"：${it.text}` : '(批注数据里没有这一条)'
    }

    if (lost.length && !opts.agreed) {
      fail(
        `拒绝写入：新内容会动到 ${lost.length} 条带用户批注的元素。\n` +
        lost.map((id) => `    ${id}  ${detailOf(id)}`).join('\n') +
        '\n  MUST 先拿这份清单与用户逐条约定处理方案（已落实 / 作废 / 挪到改后的哪个元素），' +
        '\n  约定后带 `--agreed --agreed-plan=<id>=<done|void|move>,…` 重跑。' +
        '\n  MUST NOT 自行判断某条批注"已经不重要了"。',
        1
      )
    }

    // 声明为 move 但锚点仍在新片段里的那些：它们不在 lost 里，但同样要走放行与留痕
    const declaredMove = plan ? Object.keys(plan).filter((id) => plan[id] === 'move') : []
    const affected = [...new Set([...lost, ...declaredMove])]

    let released = []
    if (affected.length && opts.agreed) {
      const missing = affected.filter((id) => !plan[id])
      if (missing.length) {
        fail(`放行方案漏了 ${missing.length} 条，MUST 逐条给出处置：\n` +
          missing.map((id) => `    ${id}  ${detailOf(id)}`).join('\n'), 2)
      }
      // move 的成功条件是「锚点确实出现在新片段里」——即它不在 lost 里
      const moveNoAnchor = affected.filter((id) => plan[id] === 'move' && lost.includes(id))
      if (moveNoAnchor.length) {
        fail(`这几条约定为「挪到新元素」，但新片段里找不到它们的锚点：\n` +
          moveNoAnchor.map((id) => `    data-anno-user="${id}"  ${detailOf(id)}`).join('\n') +
          '\n  MUST 把该属性写到改后的那个元素上，工具确认锚点在位才放行。', 1)
      }
      released = affected.map((id) => ({ id, act: plan[id], detail: detailOf(id) }))
      // 已落实 / 作废：由工具清掉，产出方 MUST NOT 自己去编辑批注数据
      const drop = new Set(released.filter((r) => r.act !== 'move').map((r) => r.id))
      if (drop.size) {
        const kept = { ...data, items: (data.items || []).filter((x) => !drop.has(x.id)) }
        next = replaceAnnoBlock(next, kept)
      }
    }
  ```

  > `notMoved` 的判定 MUST 在 `kept`（改后界面）里查：`const kept = anchorsOf(next)` 已在上文算过，`lost` 正是"不在 `kept` 里的"，所以约定为 `move` 却仍在 `lost` 里 = 锚点没写上 → 拒绝。**这一步 MUST NOT 反过来写成"从 `had` 里查"**。

  3e. 新增 `replaceAnnoBlock(html, data)`（批注块的唯一写入点，Invariant 5 的"显式放行路径上的工具"就是它）：

  ```js
  // 批注块的写入 MUST 只发生在这里。它是 Invariant 5 里"显式放行路径上的工具"那一路，
  // 与页面工具栏并列；任何其它路径改批注块都是 bug。
  function replaceAnnoBlock(html, data) {
    const s = html.indexOf(ANNO_OPEN)
    if (s < 0) fail('找不到批注块，无法放行', 1)
    const from = html.indexOf('>', s) + 1
    const to = html.indexOf(CLOSE_SCRIPT, from)
    const text = JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2)
    return html.slice(0, from) + '\n' + text.replace(/<\//g, '<\\/') + '\n  ' + html.slice(to)
  }
  ```

  3f. 等值不变式（`:281-284`）开口子——**只在放行路径上、只对本次明确允许的两类删除**。

  **顺序 MUST 是"先把两类允许的删除都算进 `expected`，再做一次比对"**，MUST NOT 写成"先比对、再删回复"：那样 3g 的改动整个绕过校验，而 plan 却声称"除 done/void 外差异都判 bug"——声明与实现相反，比没有校验更糟。

  ```js
    // 允许的删除只有两类，都在这里一次算清：
    //   ① 已约定 done / void 的用户批注（3d 放行路径）
    //   ② 被删掉的 AI 说明所连带的回复（3g，说明不在了回复无处可依）
    const dropIds = new Set(released.filter((r) => r.act !== 'move').map((r) => r.id))
    const dropReplyNotes = new Set(lostNotes)          // lostNotes 见 3g，MUST 在本步之前算出
    const expected = (before && (dropIds.size || dropReplyNotes.size))
      ? {
          ...before,
          items: (before.items || []).filter((x) => !dropIds.has(x.id)),
          replies: (before.replies || []).filter((r) => !dropReplyNotes.has(r.noteId)),
        }
      : before
    const after = readAnnoBlock(next)
    if (expected && (!after || JSON.stringify({ ...expected, updatedAt: '' }) !== JSON.stringify({ ...after, updatedAt: '' }))) {
      fail('拒绝写入：本次替换会改动批注块（放行清单与连带回复之外的改动）。这是 bug，请报告。', 1)
    }
  ```

  > **口子的边界 MUST 就这么窄**：`expected` 只扣掉上面那两类，别的任何差异照旧判 bug。`updatedAt` 因写入而变，比对时两边都置空。
  > **因此 3g 的 `lostNotes` 与回复删除 MUST 在本步之前完成**——下面 3g 的代码块位置随之前移。

  3g. AI 说明锚点的丢失提示（提示不拦）+ 回复连带删除：

  ```js
    const noteIdsOf = (s) => new Set([...screensRegion(s).matchAll(/data-anno-id="([^"]+)"/g)].map((m) => m[1]))
    const hadNotes = noteIdsOf(html)
    const keptNotes = noteIdsOf(next)
    const lostNotes = [...hadNotes].filter((id) => !keptNotes.has(id))
    if (lostNotes.length) {
      const dropped = (data.replies || []).filter((r) => lostNotes.includes(r.noteId))
      console.log(`  ⚠ 新内容丢掉了 ${lostNotes.length} 条 AI 说明：`)
      lostNotes.forEach((id) => {
        const r0 = (data.replies || []).find((x) => x.noteId === id)
        console.log(`    ${id}  ${r0 ? r0.noteText : '(说明原文只在旧稿里)'}`)
      })
      if (dropped.length) {
        // 说明不在了，挂在它上面的回复也就无处可依 —— 出声但不阻断
        console.log(`  ⚠ 连带丢弃 ${dropped.length} 条回复：`)
        dropped.forEach((r) => console.log(`    [${r.id}] 回「${r.noteText}」：${r.text}`))
        const keptData = { ...(readAnnoBlock(next) || data), replies: (data.replies || []).filter((r) => !lostNotes.includes(r.noteId)) }
        next = replaceAnnoBlock(next, keptData)
      }
    }
  ```

  > 这段 MUST 排在 3f 的等值校验**之前**（它算出的 `lostNotes` 是 3f `expected` 的输入之一）。**MUST NOT 排在 3f 之后**——那样它对批注块的改动完全绕过校验，而 plan 却声称"除两类允许的删除外差异都判 bug"，声明与实现相反。

  3h. 写入后打印放行清单：

  ```js
    await writeAtomic(file, next)
    console.log(`已写入插槽 ${key}`)
    if (released.length) {
      console.log('  放行清单（已与用户逐条约定）：')
      released.forEach((r) => console.log(`    ${r.id}  ${ACTION_LABEL[r.act]}  ${r.detail}`))
    }
  ```

  3i. `HELP` 同步（`:725-736`）：插槽名加 `script`；`slot` 那两行改为

  ```
    slot   <文件> --set <名> (--from <片段> | --text <文本>)
           插槽名：title | subtitle | screens | notes | theme | custom | script
           改稿走它：只换插槽内容，批注块与 data-anno-user 锚点原样保留
           动到带用户批注的元素时：先与用户逐条约定，再带
           --agreed --agreed-plan=<id>=<done|void|move>,… 放行
  ```

- [ ] **Step 4: 跑测试确认通过** — Run: `node --test test/prototype-preview.test.mjs` Expected: PASS
- [ ] **Step 5: commit** — `git commit -m "feat(ai-prd): 改稿由一律拦住改为逐条约定后显式放行"`

---

### Task 8：自检增第三类（稿间对比措辞）

**Slice:** 稿子里写了"相比上一轮" → `check` 报提示 → 不拦交付 ｜ **依赖：** 无

**满足:** FR-019 剩余那一类

**Files:**
- Modify: `ai-dev-system/skills/ai-prd/scripts/preview.mjs`（`cmdCheck`）
- Test: `test/prototype-preview.test.mjs`

- [ ] **Step 1: 写失败测试**

  ```js
  test('check 报出稿间对比措辞，提示级不拦交付', async () => {
    // 往 notes 插槽写「相比上一轮把筛选挪到了顶部」
    const r = await run(['check', file, '--json'])
    const out = JSON.parse(r.stdout)
    const hit = out.problems.filter((p) => /稿间对比/.test(p.msg))
    assert.equal(hit.length, 1)
    assert.equal(hit[0].level, 'P2')
    assert.equal(out.ok, true)
  })
  ```

- [ ] **Step 2: 跑测试确认失败** — Run: `node --test test/prototype-preview.test.mjs` Expected: FAIL
- [ ] **Step 3: 写最小实现** — `cmdCheck` 追加：

  ```js
    // 稿间对比措辞：未定稿前的改稿只写最新设计。业务文案里可能正好有这些词，
    // 所以只提示、不拦交付，由产出方自己判断。
    const DIFF_WORDS = ['相比上一轮', '相比上一版', '原方案', '本轮把', '上一稿', '改为原来的', '与上一版相比']
    const proseRegions = screensRegion(html) + sliceRegion(html, 'NOTES') +
      [...html.matchAll(/data-anno="([^"]*)"/g)].map((m) => m[1]).join(' ')
    DIFF_WORDS.forEach((w) => {
      if (proseRegions.includes(w)) {
        add('P2', `稿间对比措辞「${w}」`, '未定稿前的改稿只写最新设计；业务文案里正好有这个词就忽略本条')
      }
    })
  ```

  > 检索范围 MUST 含**屏注解区与元素说明**（它们都在 `screensRegion` 内）与设计说明（`NOTES` 区）。**MUST NOT 扫全文**——固定实现区的注释里有"原本用…"这类字样，扫全文会稳定误报。

- [ ] **Step 4: 跑测试确认通过** — Run: `node --test test/prototype-preview.test.mjs` Expected: PASS
- [ ] **Step 5: commit** — `git commit -m "feat(ai-prd): 自检报出稿间对比措辞"`

---

### Checkpoint：Task 5–8 之后

- [ ] `node --test test/*.test.mjs` 全绿
- [ ] 手工端到端：`init` → `screen` ×2 → `slot screens/script/notes` → `serve` → 浏览器里对一条 question 说明回复 → `annotations` 能读出五项 → 改稿动到带批注元素 → 被拒 → `--agreed --agreed-plan` 放行 → 放行清单打印
- [ ] `check` 全过（P0 为 0）

---

### Task 9：`ai-prd` 侧的纪律与模板

**Slice:** 一个零上下文的产 PRD agent 读完纪律，知道三层注释各去哪、注解区怎么写、改稿要先约定、原型文件名日期在前 ｜ **依赖：** Task 1–8（本任务描述它们的行为，写在前面必然与实现漂移）

**满足:** FR-006, FR-014, FR-021, FR-023

**Files:**
- Modify: `ai-dev-system/skills/ai-prd/references/UI原型纪律.md`
- Modify: `ai-dev-system/skills/ai-prd/references/prd写作纪律.md`
- Modify: `ai-dev-system/skills/ai-prd/references/00-prd生成流程.md`
- Modify: `ai-dev-system/skills/ai-prd/references/prd质量清单.md`
- Modify: `ai-dev-system/skills/ai-prd/references/prd复核纪律.md`
- Modify: `ai-dev-system/skills/ai-prd/assets/templates/{change-prd,lite-issue-prd,product-prd}.md`
- Modify: `ai-dev-system/skills/ai-prd/SKILL.md`
- Test: `test/prototype-annotations.test.mjs`（纪律与实现的一致性断言）

**逐条改（每条都给出旧文本→新文本，MUST NOT 凭印象改）：**

| # | 文件:行 | 旧 | 新 |
|---|---|---|---|
| 9.1 | `UI原型纪律.md:29` | `docs/spec/<name>-prototype-YYYYMMDD.html` | `docs/spec/YYYY-MM-DD-<name>-prototype.html` |
| 9.2 | `UI原型纪律.md:49` | 「右侧"设计说明"栏全篇只保留一个」 | 「设计说明全篇只保留一个（入口在顶部工具栏，见 §7.5）」 |
| 9.3 | `UI原型纪律.md:69` 五项表「原型文件」行 | 同 9.1 的旧范式 | 同 9.1 的新范式 |
| 9.4 | `UI原型纪律.md:76` 五项表「不在用户界面内展示」行 | 「整体性说明留在画布外的设计说明栏」 | 「指向一整屏的写进该屏的屏注解区（§7.6），整份原型层面的留在设计说明（§7.5）」 |
| 9.5 | `UI原型纪律.md:88` 自检项 | 「每个声明覆盖的状态都有对应的可点击切换入口」 | 「每个声明覆盖的状态都在该屏的注解区里有对应切换按钮，且按钮有对应行为」 |
| 9.6 | `UI原型纪律.md:92` | 「失联一条报一条 P0」 | 「**未经约定**失联的一条报一条 P0；按 §7.7 约定后由工具清掉的不触发它」 |
| 9.7 | `UI原型纪律.md:110` 三区表「批注数据」行 | 「只有页面工具栏写，AI 一律不碰」 | 「页面工具栏写；§7.7 的显式放行路径上由工具写。**AI 手工编辑本块仍然禁止**」 |
| 9.8 | `UI原型纪律.md:118-119` | 「`slot` 保证批注块原样不动 / 丢锚点就拒绝写入…确实要作废某条批注时才加 `--drop-anchors`」 | 新的放行契约（见 9.12 新节 §7.7），并删掉 `--drop-anchors` 那句 |
| 9.9 | `UI原型纪律.md:144` | 「AI MUST NOT 手工编辑批注块：唯一写入方是页面工具栏」 | 「AI MUST NOT 手工编辑批注块。写入方只有两个：页面工具栏，以及 §7.7 显式放行路径上的 `slot`」 |
| 9.10 | `UI原型纪律.md:175` 容器自带能力 | 「状态切换」 | 「屏注解区（状态切换的唯一入口）」 |
| 9.11 | `UI原型纪律.md:194` §8.1 命令表 | 同 9.9 的旧句 | 同 9.9 的新句；命令表增 `script` 插槽与 `screen --anno-right` |
| 9.12 | `UI原型纪律.md:232` §8.3 | 「状态切换作用于全部屏」 | 「状态切换按屏进行，入口在各屏的注解区」 |

**新增四节**（写在 §7 内，编号接着现有的 §7.4）：

- **§7.5 注释的三层归属**——照 spec §0 流程图与 PRD §二 的三层表原样落一张表（说的是什么 / 唯一去处 / 呈现方式），并写明「三层是闭集，MUST NOT 发明第四个位置」「三层都在用户界面之外，把说明写进屏幕内容里仍然一律违规」。
- **§7.6 屏注解区**——它是什么 / 在哪（默认下方、`--anno-right` 挂右侧）/ 装什么（固定小标题 + 整屏注释 + 切换按钮）/ 屏名不搬进来 / 按钮行为写进 `script` 插槽 / **改状态 MUST 用容器认得的三种表达之一**（给出 `window.setScreenState` 的用法与"用别的方式会被烘进文件且零报错"的理由；**同时写明容器只给状态表达、不给点击语义**，绑定与按下态由产出方自己写）/ 屏注解区不进批注出口。
- **§7.7 改稿动到带用户批注的元素时**——MUST 先列清单、与用户逐条约定（已落实 / 作废 / 挪到新元素）、约定后带 `--agreed --agreed-plan` 放行；MUST NOT 自行判断某条批注"已经不重要了"；已落实/作废由工具清掉，产出方 MUST NOT 自己编辑批注数据；挪走项 MUST 把锚点写到改后的元素上。**另加一条**：AI 说明与挂在其上的回复**不走**这道约定——说明被删，回复跟着删，出声但不阻断，但改界面时 MUST 把现有的 `data-anno-id` 一并抄进新片段。
- **§7.8 预览服务开着时改稿**——改完稿 MUST 让用户刷新页面再继续读，MUST NOT 默认"用户看到的就是最新那版"；页面写回撞版本冲突时会自动取回最新稿，用户批注不丢。

**`prd写作纪律.md` 新增一条「只写最新现状」**：适用面（PRD 正文与原型，含屏级注释、元素说明、设计说明，从起草到用户定稿为止的每一轮）/ 只写此刻的样子 / 不写稿间对比（给出"相比上一轮""原方案是…现在改为""本轮把 X 挪到了 Y"三个反例）/ **必须写的那种变化**（相对现有线上系统的变化照写，两者区别是参照物）/ 不得丢东西 / 定稿后的 changelog 不受此约束。

**`00-prd生成流程.md`**：§组稿 第 7 步落盘命名改为 `docs/spec/YYYY-MM-DD-<name>-PRD.md` 与 `docs/spec/YYYY-MM-DD-<name>-prototype.html`；**落盘确认门那一步**补一句「已被用户回复的待拍板项 MUST 连回复一起摆出供确认，MUST NOT 当成没答过重新问一遍」。

**`prd质量清单.md`**：§落位 的命名同改；对应那条勾验项补「已回复的待拍板项连回复一起摆」。

**`prd复核纪律.md`**：原型结构摘要的口径里补上屏注解区与回复类。

**三类 PRD 模板**：「UI 原型」五项表的「原型文件」与「不在用户界面内展示」两项同 9.3/9.4。

**`ai-prd/SKILL.md`**：目录树里 `preview.mjs` 的子命令说明补 `--anno-right` 与 `--agreed`；路由第 5 步与 §关键纪律 里涉及批注三类的表述改成"三类 + 回复"（与 Task 13 同一句口径，**两处 MUST 一致**）。

- [ ] **Step 1: 逐条改** — 按上表 12 条 + 四个新节 + 五份文件
- [ ] **Step 2: 一致性验证** — Run: `node --test test/prototype-annotations.test.mjs` Expected: PASS（该测试断言纪律里的插槽名/区名与实现一致）
- [ ] **Step 3: 措辞红线自查** — Run: `node --test test/wording-redline.test.mjs` Expected: PASS（**每个被改文件的 MUST/MUST NOT/SHOULD/MAY 条数与正反例条数只准增不准减**；跑红说明删掉了判据，MUST 补回而不是放宽断言）
- [ ] **Step 4: commit** — `git commit -m "docs(ai-prd): 注释三层归属、屏注解区与改稿约定入纪律"`

---

### Task 10：文档日期前缀规则 + 完整路径上的可达性

**Slice:** 走完整流程要给一份新 spec 起名落盘 → 按加载点清单取得到命名规则 → 规则里写着日期前缀是地板 ｜ **依赖：** 无

**满足:** FR-022, FR-025, FR-026

**Files:**
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/文档治理.md`（§默认命名 `:235-245`）
- Modify: `ai-dev-system/skills/ai-dev-workflow/SKILL.md`（〈加载点清单〉）
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/00-流程总纲.md`（§移出常驻的三篇 里 `文档治理.md` 的结论行）
- Modify: `ai-dev-system/skills/ai-dev-workflow/references/core/路径-lean.md`
- Test: `test/cards-mandatory.test.mjs`、`test/lean-selfcontained.test.mjs`、`test/resident-budget.test.mjs`

- [ ] **Step 1: `文档治理.md` §默认命名 补规则** — 在七条范式**之后**、逃生口那句**之前**插入：

  ```markdown
  **日期前缀（MUST）**：`docs/spec/`、`docs/plan/`、`docs/report/` 下**按次产出**的文档，文件名一律以 `YYYY-MM-DD-` 开头，日期取该文档的**创建日期**。上面七条范式因此写全就是 `docs/spec/YYYY-MM-DD-<change-name>-lean-change-spec.md`、`docs/plan/YYYY-MM-DD-<feature>-coding-plan.md`，以此类推。

  - **常青档不加**：需求真相源 `REQUIREMENTS.md`、架构真相源 `ARCHITECTURE.md`、`docs/TODO.md`、两份索引（`docs/index.md` / `docs/index-archive.md`）、两个固定账本（`docs/report/bug修复历史.md` / `docs/report/测试场景覆盖度.md`）、`docs/requirements/` 下的一级子模块——它们是固定名字的长期文档，不属于某一天。
  - **目录形态同样适用**：某次产出大到要拆成一个目录时，目录名同样以 `YYYY-MM-DD-` 开头，规则不因形态改变。
  - **同一天同主题的第二份属改稿**：改原文件，MUST NOT 新建第二份。同一天不同主题的两份文件名天然不冲突。
  - **存量不因新规则改名**：本规则只对新建文档生效。
  ```

  逃生口那句改为：

  ```markdown
  项目已有更严格的文件名约定时可以沿用，但**目录不可改变**，且 **MUST NOT 用本句豁免掉上面的日期前缀**——项目可以在前缀之上更严格（比如再规定主题词的写法），MUST NOT 把前缀本身豁免掉。
  ```

- [ ] **Step 2: 总纲结论行扩到含命名地板** — `00-流程总纲.md` §移出常驻的三篇 里 `文档治理.md` 的第一条结论行末尾追加：

  ```markdown
  **文件名 MUST 以 `YYYY-MM-DD-` 开头**（按次产出的文档；常青档与两份索引除外，清单在原篇），拆成目录时目录名同样带前缀。→ `文档治理.md` §默认命名。
  ```

  > 前置量有余量，但 MUST 跑 `node --test test/resident-budget.test.mjs` 确认仍 ≤50,000（该命令无论绿红都打印逐文件明细，**当前值以它的输出为准，MUST NOT 在文档里再抄一个数**）。

- [ ] **Step 3: 加载点清单并进已有行** — 入口现 7,947 字节、硬上限 8,000，**只剩 53 字节，新增整行必判红**。因此 MUST 改已有行的「触发条件」与「加载对象」两列，把"给新建文档起名落盘"并进「要判文档去留、归档、索引分层」那一行：

  | 触发条件 | 加载对象 |
  |---|---|
  | 要给新建文档起名落盘／要判文档去留、归档、索引分层 | `core/文档治理.md` (L§10bis) |

  改完 MUST 跑 `node --test test/cards-mandatory.test.mjs`（它断言入口 ≤8,000 且清单 ≥18 行）。**字节还是超时 MUST 从别处腾**（例如把〈关键纪律〉那段的重复措辞压掉），**MUST NOT 下调上限**。

- [ ] **Step 4: Lean 自足册补要点** — `路径-lean.md` 的文档落位那一节（§10.2 附近）补一条：

  ```markdown
  - 落盘的文件名 MUST 以 `YYYY-MM-DD-` 开头（`docs/spec/YYYY-MM-DD-<change-name>-lean-change-spec.md`）；常青档与两份索引不加；拆成目录时目录名同样带前缀。项目自己有更严格的命名约定可以更严格，MUST NOT 豁免掉这条前缀。
    来源：`文档治理.md` §默认命名
  ```

  > **来源锚点 MUST 写**——`test/lean-selfcontained.test.mjs` 按锚点匹配，忘了标来源即判红（不是按文本相似度）。

- [ ] **Step 5: 跑三闸** — Run: `node --test test/cards-mandatory.test.mjs test/lean-selfcontained.test.mjs test/resident-budget.test.mjs` Expected: PASS
- [ ] **Step 6: commit** — `git commit -m "docs(workflow): 补回文档日期前缀规则并接上完整路径的加载点"`

---

### Task 11：全仓写死的文件名范式

**Slice:** 全仓任一处写死的按次产出文件名都带日期前缀，与 §默认命名 一致 ｜ **依赖：** Task 10（规则先立，范式才有依据）

**满足:** FR-024

**Files:** 18 个 markdown（实测清单见下），含 `ai-dev-workflow/references/core/` 六份 + 五个模板 frontmatter + `ai-prd` 侧四份 + `文档归档与账本收敛.md`

- [ ] **Step 1: 实测枚举**（**MUST 跑，MUST NOT 照抄本文或 PRD 里的任何数字**）

  ```bash
  grep -rn --include='*.md' -E 'docs/(spec|plan|report)/<|docs/spec/ProjectName|<name>-prototype|<name>-PRD' ai-dev-system/skills/
  grep -rn --include='*.md' -E 'docs/(spec|plan|report)/[^<【][^ )）`]*\.(md|html)' ai-dev-system/skills/
  ```

  > 改造前第一式实测 **37 处 / 18 个文件**；第二式抓的是归档篇那类"具体文件名示例"。两式都要跑——PRD 那份枚举漏了 `ai-prd` 侧与归档篇，PRD 自己已写明「枚举以实测为准」。

- [ ] **Step 2: 逐处改** — 范式 `docs/spec/<repo>-<feature>-eng-spec.md` → `docs/spec/YYYY-MM-DD-<repo>-<feature>-eng-spec.md`，其余同理。**五个模板的 frontmatter 示例各 1 处**（`eng-spec` / `overview` / `coding-plan` / `test-spec` / `lean-change-spec`）。`步骤-1-7-设计与实现.md:69` 参考 prompt 里那处 `docs/spec/ProjectName-overview.md` 一并改。
- [ ] **Step 3: 复跑两式确认零残留** — Expected: 命中的每一处都已带前缀
- [ ] **Step 4: 跑全量** — Run: `node --test test/*.test.mjs` Expected: PASS
- [ ] **Step 5: commit** — `git commit -m "docs: 全仓写死的按次产出文件名范式统一为日期开头"`

---

### Task 12：存量反例改名 + 索引闸改递归

**Slice:** 本仓库每份按次产出文档都以日期开头 → 索引检查递归扫得到（含子目录形态）｜ **依赖：** Task 10

**满足:** FR-027, FR-028

**Files:**
- Rename: `docs/report/agentic-principle-gap-report.md` → `docs/report/2026-08-02-agentic-principle-gap-report.md`
- Modify: `docs/index.md`、`ai-dev-system/migrations/1.6.0.md`
- Modify: `test/doc-index.test.mjs`

- [ ] **Step 1: 写失败测试** — 在 `test/doc-index.test.mjs` 追加一个**构造用例**（AC-029 明确要求：本仓库当前一个子目录实例都没有，不构造的话改完照样全绿而实际没覆盖）：

  ```js
  test('索引检查递归到子目录', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'doc-index-'))
    await mkdir(join(dir, 'spec', '2026-08-27-某次大产出'), { recursive: true })
    await writeFile(join(dir, 'spec', '2026-08-27-某次大产出', 'part-a.md'), '# 无 frontmatter\n')
    const found = collectDocs(dir)      // 被测函数：MUST 递归
    assert.ok(found.some((p) => p.endsWith('part-a.md')), '递归没生效，子目录里的文档整体逃出了检查')
  })
  ```

  > 被测函数 MUST 从 `doc-index.test.mjs` 里抽成可导入的纯函数（或改成接受根目录参数），否则构造用例无从调用它。**这一步 MUST 做**——不抽出来就只能靠"改完人肉看一眼"，正是 AC-029 要挡的。

- [ ] **Step 2: 跑测试确认失败** — Run: `node --test test/doc-index.test.mjs` Expected: FAIL
- [ ] **Step 3: 改实现** — `doc-index.test.mjs` 里那个"只扫第一层"的读目录改为递归（`readdirSync(dir, { withFileTypes: true, recursive: true })`，Node ≥20 支持；或手写递归）。**它把"只扫第一层"写成了明确假设，MUST 连那句注释一起改掉**，否则下一个读它的人会以为递归是 bug。
- [ ] **Step 4: 改名 + 同步引用**

  ```bash
  git mv docs/report/agentic-principle-gap-report.md docs/report/2026-08-02-agentic-principle-gap-report.md
  grep -rn "agentic-principle-gap-report" docs/ ai-dev-system/ CLAUDE.md
  ```

  逐处把路径补上前缀。`ai-dev-system/migrations/1.6.0.md` 改完 MUST 复核两条：**仍 ≤45 行**、**「需要的动作」节仍在**（`test/installer-migration.test.mjs` 断言它们）。

- [ ] **Step 5: 跑闸** — Run: `node --test test/doc-index.test.mjs test/installer-migration.test.mjs` Expected: PASS
- [ ] **Step 6: 全仓自查** — `ls docs/spec docs/plan docs/report | grep -v "^2[0-9]\{3\}-"`，除常青档外应无输出
- [ ] **Step 7: commit** — `git commit -m "chore: 存量反例补日期前缀，索引闸改递归"`

---

### Task 13：「三类批注」口径

**Slice:** 全仓提到批注种类的地方都说"三类 + 回复" ｜ **依赖：** Task 6（回复类先实现）

**满足:** FR-029

**Files:** 按下面的检索式实测（PRD 说约 9 处，**MUST 以实测为准**）

- [ ] **Step 1: 实测枚举**（**MUST NOT 只搜"三类"**——只有 3 处是那个字面，且会命中一堆"三类 PRD 模板"的假阳性；权威定义处 `UI原型纪律.md` 写的是"三样东西"）

  ```bash
  grep -rn --include='*.md' -E '逐元素批注|全局反馈|三样东西|AI 侧.*说明|data-anno' ai-dev-system/skills/ CLAUDE.md docs/index.md
  ```

- [ ] **Step 2: 逐处改** — 每处补上第四类：`用户逐元素批注 / 全局反馈 / AI 侧说明 / **用户对说明的回复**`。已知落点含 `00-流程总纲.md`、`路径-lean.md`、`步骤-1-7-设计与实现.md`、`步骤-8-10-测试.md`、`UI原型纪律.md`（权威定义处）、`00-prd生成流程.md`、`ai-prd/SKILL.md`、`CLAUDE.md`、`docs/index.md`
- [ ] **Step 3: 顺带更新 `CLAUDE.md` 与 `docs/index.md` 里写死的其它口径** — 「六个具名插槽」→ 七个；原型命名"三处同改"的枚举；`--drop-anchors` 那条易错点改为「MUST NOT 未经约定就放行」
- [ ] **Step 4: 跑闸** — Run: `node --test test/counter-word.test.mjs test/contract-sync.test.mjs test/*.test.mjs` Expected: PASS
- [ ] **Step 5: commit** — `git commit -m "docs: 批注口径由三类改为三类 + 回复"`

---

### Task 14：机器闸逐条对齐

**Slice:** 所有断言与新行为一致，新规矩都有断言守着 ｜ **依赖：** Task 1–13

**满足:** FR-030

**Files:** `test/prototype-annotations.test.mjs`、`test/prototype-preview.test.mjs`，以及跑红的任何其它闸

- [ ] **Step 1: 逐条改写失准断言** — 已知的失准点：`prototype-annotations` 里硬编码的**六个插槽名与插槽数**、`notes` 插槽的逐字探针；`prototype-preview` 里的插槽相关断言，以及「丢掉用户批注锚点时拒绝写入」那条——**它验的行为本次从"一律拒绝"改成"未约定则不写入、约定后放行"，断言 MUST 跟着改写而不是删掉**
- [ ] **Step 2: 补新断言**（Task 1–8 各自已写了一部分，这里收口补齐）— 屏注解区、回复类、放行动作、已落实/作废项被清掉、挪走项锚点校验、日期前缀
- [ ] **Step 3: 判据不变的断言 MUST NOT 放宽** — 跑红时先判"是判据变了还是实现错了"；判据没变就改实现
- [ ] **Step 4: 跑全量** — Run: `node --test test/*.test.mjs` Expected: 全绿
- [ ] **Step 5: commit** — `git commit -m "test: 机器闸对齐注解分层与日期前缀"`

---

### Task 15：准出归并（PRD〈收尾动作〉）

**Slice:** 全部门禁通过 → 把本次落地的口径归并回需求真相源 → 变更 PRD 转 merged 并移进归档索引 ｜ **依赖：** Task 1–14 全部完成、代码评审门已过

**满足:** FR-031

**Files:**
- Modify: `docs/REQUIREMENTS.md`
- Modify: `docs/spec/2026-08-26-原型注解分层与文档日期前缀-PRD.md`（frontmatter + 归档头注）
- Modify: `docs/index.md`、`docs/index-archive.md`
- Modify: `docs/TODO.md`（挂那条待观察项）

- [ ] **Step 1: 取判据** — 读 `references/core/文档治理.md` §6（**归并落点按口径类型分派的映射表**）与 §需求真相源写什么、怎么分层。**MUST NOT 凭印象归并**。
- [ ] **Step 2: 按映射表分派** — 本次落地的口径逐条对照映射表决定去哪一层：原型注解三层归属、屏注解区、可写位置七处、改稿放行契约、预览写回契约、文档日期前缀。
  > **「功能清单没变化」MUST NOT 被读成「无需归并」**：本次改的多是**已交付功能的行为规则**（改稿从"一律拦住"变"约定后放行"、命名从无前缀变有前缀），功能清单可能一行不动，但规则变了——漏了它，那些规则会跟着变更 PRD 一起进归档区，**且没有任何机器闸能发现**（`ctx probe` 只验可达性，D 轴要比对的正文压根不存在）。
- [ ] **Step 3: 挂待观察项** — 往 `docs/TODO.md` 加一条：`2026-08-27 ｜ ai-prd ｜ 下次真跑一遍完整产 PRD 流程时回看：产出的原型里"写进屏幕内容的说明文字"是否为零、每屏该说的话是否都在自己的注解区里`（PRD〈运营度量〉那条，spec §6.1 已说明它不构成本次验收）。
- [ ] **Step 4: 变更 PRD 结算** — frontmatter 改 `lifecycle: merged`、填 `archived: 2026-08-27`，正文顶部加归档头注（写法见 `references/core/文档归档与账本收敛.md`），并把它从 `docs/index.md` 移进 `docs/index-archive.md`。**本期的 overview / eng-spec / coding-plan 三份同样按各自的 `lifecycle` 判定**（plan 通常转 `merged`）。
- [ ] **Step 5: 跑闸** — Run: `node --test test/doc-index.test.mjs test/requirements-layering.test.mjs` Expected: PASS
- [ ] **Step 6: commit** — `git commit -m "docs: 准出归并 —— 口径回真相源，变更 PRD 转 merged"`

---

### Checkpoint：Task 9–14 之后（准出前）

- [ ] `node --test test/*.test.mjs` 全绿
- [ ] `ai-dev-system/VERSION` bump（本次改变已安装项目的行为契约与目录约定 → **MUST bump**）
- [ ] 判断要不要写迁移指南：本次**需要用户动作吗**？——重装即升级、不改标记块字段、不要求回填存量文档 → **零手动动作，MUST NOT 建迁移文件**，更 MUST NOT 补一份「需要的动作：无」的空指南
- [ ] `docs/index.md` 收录本次三份文档（PRD 已收录，补 overview / eng-spec / coding-plan）
- [ ] 卡片 `engineering-context/cards/ai-dev-system.md` 四个域的事实与确认时间刷新（本次改了它们）

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 入口 `SKILL.md` 只剩 53 字节余量，改加载点清单必超 | H | Task 10 Step 3 明确要求**并进已有行**；超了从别处腾字节，MUST NOT 下调上限 |
| `check` 新增的 class 没有样式定义被判 P1 | M | 注解区样式写进 `DESIGN-SYSTEM` 固定区，天然有定义；Task 1 Step 4 跑 `check` 验证 |
| 引用了不存在的图标 id 被判 P0 | M | Task 3 Step 3d 明确要求先 `grep symbol id` 取现有清单，MUST NOT 新增 symbol |
| 等值不变式的口子开太大，静默丢批注 | **H** | Task 7 Step 3f 把 `expected` 精确到"只扣掉已约定 done/void 的条目"，别的差异照旧判 bug；AC-020 有断言 |
| `beforeunload` 发不出带头请求 → 要么丢批注要么开覆盖后门 | M | Task 4 Step 3f 定为**卸载期不写回**，依赖既有 `localStorage` + `load()` 择新；spec 已把它列为 Implementation-defined 并在此定案 |
| 「三类批注」靠字面搜"三类"找齐 → 漏 6 处 | **H** | Task 13 Step 1 给了按内容枚举的检索式，并写明权威定义处写的是"三样东西" |
| `doc-index` 改递归后没有实例，改完照样全绿 | **H** | Task 12 Step 1 强制**构造用例**，并要求把被测函数抽成可导入的纯函数 |
| `adoptLatest()` 沿用磁盘 `updatedAt` → reload 后本机批注被整份丢弃 | **H** | Task 4 Step 3e 明确要求用当前时间，并在 `localStorage` 之外再写回一次文件；AC-012/AC-043 有断言 |
| 3g 排在 3f 之后 → 对批注块的改动绕过等值校验 | **H** | Task 7 Step 3f 把两类允许的删除一次算进 `expected`，并明写 3g MUST 前移 |
| 文档改写时把判据一起压掉 | M | Task 9 Step 3 强制跑 `wording-redline`（MUST/MUST NOT 条数只准增不准减）|
| 顺手改了不该改的判据（非目标 5）| M | 交给评审门忠实轴的「越界」类型逐条核对 + 下方替换清单核销 |

## 替换清单核销（来自 spec §8.2）

| 被取代物 | 删除/改写任务 | 实测引用数 | 核销 |
|---|---|---|---|
| `--drop-anchors` 开关 | Task 7 | 2（`preview.mjs:275-276`、`:915`）| ✅ 保留例外：spec §8.2 要求留一条指向新名的报错分支 |
| `opts['drop-anchors']` 判定分支 | Task 7 | 1（`preview.mjs:275`）| ✅ 保留例外：同上，只为识别旧名并报错 |
| `⚠ 按 --drop-anchors 丢弃了…` 输出文案 | Task 7 | 0 | ✅ |
| 状态切换卡片 DOM | Task 2 | 0 | ✅ |
| `setState()` 全局遍历与 `stateButtons` | Task 2 | 0 | ✅ |
| `<aside class="aside-stack">` 外壳 | Task 3 | 0 | ✅ |
| `.aside-stack` / `.state-buttons` CSS | Task 3 | 0 | ✅ |
| `.stage` 两列 + `@media` 两行 | Task 3 | 0（改为 `display: block`）| ✅ |
| 说明栏标题「设计说明（不属于用户界面）」 | Task 3 | 0 | ✅ 评审门残留轴补删：Task 9 只改了标题，纪律里另有 5 处仍把它说成「画布外的说明栏」，一并改为「设计说明面板（§7.5）」|
| `UI原型纪律.md` 九处失准表述（9.2/9.5/9.6/9.7/9.8/9.9/9.10/9.11/9.12）| Task 9 | 0 | ✅ 另在评审门补正 §7.6 的 `setScreenState` 示例——原写作单参数 `('success')`，实际是 `(screenEl, 'state-success')` 两参数 + 完整类名，照抄会静默不生效 |
| `ui-prototype.html:937`、`preview.mjs:734` 的「唯一写入方」 | Task 9 / Task 7 | 0 | ✅ 评审门补改模板 `ANNOTATIONS` 区注释 |
| `文档治理.md:245` 逃生口（**改写不删**）| Task 10 | 1（`:252`，已收窄）| ✅ 改写类：旧表述全仓检索不到，新表述明写 MUST NOT 豁免日期前缀 |
| `CLAUDE.md` 的「MUST NOT 用 `--drop-anchors` 绕过去」 | Task 13 | 0 | ✅ 已改为「MUST NOT 未经约定就放行」并补全放行契约 |
| `docs/report/agentic-principle-gap-report.md` 文件名 | Task 12 | 0 | ✅ 已改名为 `2026-08-02-agentic-principle-gap-report.md`，两处引用同步 |
| `window.protoSetState`（含按钮语义的导出，复核判为越界，方案期即删）| Task 2 | 0（从未落地）| ✅ |

> **核销标准**：删除类 = 实测引用数 0；改写类 = 旧表述全仓检索不到。核销在代码评审门的残留轴逐条核对。

## 完成与自动合并

- [x] **代码评审门通过**：按 `references/core/代码评审纪律.md` §评审轴 逐轴（当轮为规范/忠实/残留/文档）的子代理报告齐全，P0/P1 已清零
- [x] **需求覆盖核销**：FR-001→T1；FR-002→T1；FR-003→T2；FR-004→T2；FR-005→T2；FR-006→T9；FR-007→T3；FR-008→T3；FR-009→T3；FR-010→T4；FR-011→T4；FR-012→T5；FR-013→T6；FR-014→T9；FR-015→T7；FR-016→T7；FR-017→T7；FR-018→T7；FR-019→T1/T2/T8；FR-020→T2；FR-021→T9；FR-022→T10；FR-023→T9；FR-024→T11；FR-025→T10；FR-026→T10；FR-027→T12；FR-028→T12；FR-029→T13；FR-030→T14；FR-031→T15。**31 条全部有归属，无零引用；每个 Task 的 `满足:` 都指得到真实编号，无镀金。**
- [x] 替换清单逐条核销
- [x] **准出归并已做**（Task 15）：口径已按 `文档治理.md` §6 映射表归并进 `docs/REQUIREMENTS.md`，变更 PRD 已转 `merged` + 归档头注 + 移进 `docs/index-archive.md`
- [x] 需求范围、文档、代码和测试全部完成
- [ ] 任务分支已吸收最新 `main` 并重新验证
- [ ] worktree 状态干净，全部改动已提交
- [ ] `merge-gate="direct"`：全部门禁通过后在本地对 `main` 做非快进合并（`git merge --no-ff`）并运行合并后验证，不开 PR
- [ ] 合并成功后移除 worktree；失败则保留 worktree 和任务分支
