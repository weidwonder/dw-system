---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-17'
authority_refs:
  - '伴生 skill 的仓库地址：https://github.com/weidwonder/agentic-principle.git（install.mjs COMPANION_SKILLS）'
  - '仓库改名后本体系内一律用连字符名 agentic-principle 指代该仓库，含历史文档里给使用者点的链接'
  - '本次为 patch bump 2.13.0 → 2.13.1：改动含 skill 内文本，需随 tag 分发；纯措辞修订按版本规范 MUST NOT 建迁移文件'
---

# Lean Change Spec（一页）— 伴生仓库 agentic-principle 改名

- **Issue / 链接**：N/A（用户在本次对话直接提出）
- **Owner**：weidwonder
- **写作进度**：Done
- **Triage 复核**：AI/LLM 行为？否 鉴权/安全/设备？否 跨服务/迁移/不可逆？borderline 指标/规则/对外承诺？borderline
  - borderline 说明：改的是安装器联网 clone 的伴生仓库地址与文档里给使用者的 clone 命令，属对外契约的字面变更；但 GitHub 对旧仓库名保留重定向，新旧地址都能拉到同一个仓库，改动可逆、无迁移动作，故按 Lean 一页落地。

## 改什么（现状 → 期望）

现状：伴生 skill 的仓库上游已由 `weidwonder/agentic_principle` 更名为 `weidwonder/agentic-principle`（与其 skill 本体目录名 `agentic-principle` 对齐）。本仓库的安装器、测试断言与四处文档仍写下划线旧名。

期望：本体系内一律用新名指代该仓库，安装器直接拉新地址，不再依赖 GitHub 的旧名重定向。

**本次功能需求**：

- FR-001 — `install.mjs` 的 `COMPANION_SKILLS[0].repo` MUST 指向 `https://github.com/weidwonder/agentic-principle.git`。
- FR-002 — `test/companion-skill.test.mjs` 中锁定该地址的断言与相关注释、用例名 MUST 同步为新名，保持测试对真实地址的守护能力。
- FR-003 — 文档中给使用者的 clone 命令与仓库指代 MUST 用新名，覆盖 `AI-LLM-overlay.md`（它不在场时的手动 clone 指引）、`migrations/1.6.0.md`、`docs/index.md`、`docs/report/2026-08-02-agentic-principle-gap-report.md`。

## 为什么

安装器每次运行都会浅克隆这个仓库读版本。靠重定向能跑，但仓库名与文档、与 skill 本体目录名三者不一致，下一个读这段代码的人（或 agent）会怀疑指向的是不是同一个仓库；缺口报告的 `audience` 字段更是直接指向一个已经改名的地址。改名成本极低，留着不改是纯粹的认知负债。

## 具体改动点

- `install.mjs` — `COMPANION_SKILLS[0].repo` 换新地址（该常量块其余字段不动）。
- `test/companion-skill.test.mjs` — 断言正则、fixture 注释、用例名三处同步新名。
- `ai-dev-system/skills/ai-dev-workflow/references/core/AI-LLM-overlay.md` — 手动 clone 指引换新地址。
- `ai-dev-system/migrations/1.6.0.md` — 两处仓库指代换新名（历史叙述的事实不变，只更新链接与名称）。
- `docs/index.md` — 缺口报告条目的仓库指代换新名，并登记本 spec。
- `docs/report/2026-08-02-agentic-principle-gap-report.md` — `status` 与 `audience` 两个 frontmatter 字段换新名。
- `ai-dev-system/VERSION` — 2.13.0 → 2.13.1（patch bump，让 skill 内的文本修正随 tag 分发；按版本规范不建迁移文件）。
- `engineering-context/cards/ai-dev-system.md` — 新增〈伴生 skill 同步（install.mjs）〉域（本次读了该链路源码，按代码事实纪律当场补卡）。

## 影响范围 / 不做什么

- 影响：安装器拉伴生 skill 的地址字面值，以及本仓库文档里对该仓库的称呼。
- **不做**：不写 migration —— 零手动动作的升级按版本规范 MUST NOT 建迁移文件（VERSION 仍按兼容取舍升到 2.13.1）。
- **不做**：不改伴生 skill 的安装位置、subdir、版本比对逻辑与 `--no-agentic` 开关。
- **不做**：不改本仓库自身的名字（本地目录 `ai_dev_system` 与 GitHub 上的 `ai-dev-system` 维持现状，不在本次范围内）。
- 关键 NFR：无。纯字面替换，无新增依赖与网络行为。
- 既有系统清单：`COMPANION_SKILLS` 常量（`install.mjs:71`）、`fetchCompanion`（`install.mjs:820`）、`companionNeedsUpdate`（`install.mjs:846`）、`syncCompanions`（`install.mjs:853`）、`--agentic-repo=` 覆盖入口（`install.mjs:209`）、fake remote 装置（`test/companion-skill.test.mjs:25`）。
- 本次补的卡片：`engineering-context/cards/ai-dev-system.md` 新增〈伴生 skill 同步（install.mjs）〉域——本次核对地址时读了这条链路的源码，按代码事实纪律当场补卡（此前 6 个域都没覆盖安装器）。

## 兼容取舍（用户拍板，定稿前必填）

- 是否随改名发一个新版本 —— 谁在依赖：所有跑本安装器的人 —— 用户**先答不升版，评审门指出后重新拍板**：**升到 2.13.1 并推 tag** —— 确认于 2026-09-02。
  - 重新拍板的依据：安装器按 `DEFAULT_REF = v${SELF_VERSION}`（`install.mjs:66`）从 **tag** 取 skill 内容，本次改动含一处 skill 内文本（`AI-LLM-overlay.md` 的手动 clone 指引）。不发 tag，使用者默认装到的仍是旧地址那一版（靠 GitHub 重定向仍可用，但文本长期滞后）。`install.mjs` 自身的改动跟着 main 立即生效，两者节奏不同。
  - 按 `docs/spec/2026-07-16-skill版本管理与迁移机制.md` §bump 判据，纯措辞修订走 patch bump 且 **MUST NOT 建迁移文件**（零手动动作），故本次只动 `VERSION`，不写 migration。
- 历史文档（`migrations/1.6.0.md`、2026-08-02 缺口报告）里的旧地址 —— 用户决定：**一并改成新地址**（这些链接是给人点的，叙述的事实不变） —— 确认于 2026-09-02。

## 过稿记录（拍板人表态，开始实现前必填）

- 【2026-09-02】｜已定稿｜兼容取舍两条与本页范围同一批抛给拍板人，两条均当场表态（不升版、历史文档一并改），据此定稿开工。

## 替换清单（本次淘汰了什么）

| 被取代物 | 类型 | 取代者 | 处置 | 保留理由 + 到期日 |
|---|---|---|---|---|
| `https://github.com/weidwonder/agentic_principle.git` | 常量字面值 | `https://github.com/weidwonder/agentic-principle.git` | 删除 | — |
| 文档中以 `agentic_principle` 指代该仓库的写法 | 文档措辞 | 一律用 `agentic-principle` | 删除 | — |

## 验收标准（可判定，含边界/失败用例）

- [x] AC-001 全仓检索 `agentic_principle`，排除 `.git/`、本 spec 与 `docs/index.md` 中叙述改名事实的引用后零命中——即 `grep -rn "agentic_principle" --exclude-dir=.git --exclude=docs/index.md --exclude='2026-09-02-*.md' .` 零命中 —— 满足：FR-001 FR-002 FR-003
- [x] AC-002 `node --test test/*.test.mjs` 全绿，其中「COMPANION_SKILLS 指向真实的 agentic-principle 仓库与子目录」用例通过 —— 满足：FR-001 FR-002
- [x] AC-003 失败用例：把 `install.mjs` 的地址改回旧名时，上述用例 MUST 变红（断言确实锁住地址，不是空守护）—— 满足：FR-002

## 如何验证

- [x] `grep -rn "agentic_principle" --exclude-dir=.git --exclude=docs/index.md --exclude='2026-09-02-*.md' .` → 零命中（本 spec 与索引条目里叙述改名事实的引用按 AC-001 口径排除）。
- [x] `node --test test/*.test.mjs` → 390 项全绿。
- [x] **代码评审门**：单子代理跑 Lean 精简版四轴，A1/A2/B1/C1/D1 等 P1 与文档结算项已修完复核。
- [x] 忠实自查：只做了字面替换与本 spec、索引登记、按纪律当场补的一张卡片域，未改安装器行为、未碰本仓库自身名字；VERSION 的 patch bump 由拍板人明确要求。

## 回滚方式

`git revert` 本次合并提交即可；旧地址在 GitHub 的重定向仍然有效，回滚后安装器照常工作。
