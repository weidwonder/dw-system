---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-21'
authority_refs:
  - '安装器 codegraph 段：升级成没成的判定依据与升级未生效时的处置'
---

# Lean Change Spec（一页）— 安装器不再用 `codegraph upgrade` 的退出码判升级成没成

- **Issue / 链接**：N/A（使用者在 2026-09-21 的安装过程中报告）
- **Owner**：自己
- **写作进度**：Done
- **Triage 复核**：AI/LLM 行为？否 鉴权/安全/设备？否 跨服务/迁移/不可逆？否 指标/规则/对外承诺？否
  - borderline 一句：第 4 问拿不准过一遍——本次改的是安装器对使用者可见的输出与处置，但它是把**本应如此**的行为修回来（原行为会谎报"已是最新"），不是新立规则，判否。

## 改什么（现状 → 期望）

现状：安装器用 `codegraph upgrade` 的退出码判升级成没成，退出码为 0 就认为升完了；版本没变时打印「已是最新（v1.5.0），版本未变」，而此时它自己刚算出远端是 1.6.0。期望：以升级后重新探测到的版本为准，仍落后于远端就继续处置，并且任何情况下都不谎报"已是最新"。

**本次功能需求**：

- FR-001 — `codegraph upgrade` 退出码为 0 但升级后 PATH 上的版本仍低于远端时，安装器 MUST 判为升级未生效，退回 `npm install -g <包>@latest`。
- FR-002 — npm 也换不掉 PATH 上那份时，安装器 MUST 明确告警：报出实际版本与远端版本，并提示用 `which -a codegraph`（Windows 用 `where codegraph`）查本机的多份副本。
- FR-003 — 升级后版本仍落后于远端时，安装器 MUST NOT 输出"已是最新"。
- FR-004 — 远端版本未知（`upgrade --check` 失败的盲升路径）时，既有口径不变：以升级前后的版本号比较为准报告，版本没变仍写「已是最新（v…），版本未变」。

## 为什么

使用者每次跑安装器都被提示 codegraph `1.5.0 → 1.6.0` 并执行升级，升级无报错，下次安装照旧再报一遍。根因是本机同时装了 npm 包（`/opt/homebrew/bin/codegraph`，PATH 优先）与独立包（`~/.local/bin/codegraph`）：`upgrade` 认得自己是独立包那份并把它升到最新，退出码 0，而 PATH 优先命中的 npm 那份版本不变。安装器只看退出码，于是既不继续处置，又把这个状态说成"已是最新"。

## 具体改动点

- `install.mjs#codegraphBehindLatest`（新增）— 判 PATH 上那份是否仍低于远端；两个版本号缺任一个都判 false（未知不等于落后）。引入它是因为同一判断在"要不要退回 npm"和"该打印哪句话"两处都要用，写成一处避免两边口径漂移。
- `install.mjs#ensureCodegraphCli` — 升级后重新探测；仍落后就退回 `npm install -g …@latest` 并再探测一次；最终仍落后则告警并提示查多份副本。
- `test/codegraph.test.mjs` — 假 codegraph 新增 `upgradeNoop`（退出码 0 但版本不变）、假 npm 新增 `npmNoop`（装了但 PATH 那份不变）两个状态，加两条回归用例。

## 影响范围 / 不做什么

- 影响：只影响安装器 codegraph 段里"已装且有新版本"这一条路径。
- **不做**：不改 `upgrade --check` 的版本检测方式（仍交给 codegraph 自己）；不改"已装时优先用它自己的 upgrade、不盲目 npm 装"的既有策略；不替使用者删除本机的任何一份 codegraph 副本；不碰接线（`codegraph install`）与建索引（`codegraph init`）两段。
- 既有系统清单：
  - codegraph 安装与升级 —— cite: `cards/dw-system/外部工具接线.md#权威实现与对外接口` @2026-09-18 —— 本次改的就是它的升级判定
  - `install.mjs#detectCodegraph` / `install.mjs#checkCodegraphUpdate` / `install.mjs#installCodegraphViaNpm` —— 同上 cite —— 复用，不改
  - `install.mjs#cmpVersion` —— `install.mjs:721`（本次现读）—— 新判定函数复用它
- 本次补的卡片：无需新补；`engineering-context/cards/dw-system/外部工具接线.md` 已刷新（升级判定一行 + 一条陷阱项，`确认` 改 2026-09-21）。

## 兼容取舍（用户拍板，定稿前必填）

- 「upgrade 跑通但版本没变」时的行为 —— 旧行为是打印"已是最新"后继续，新行为是退回 npm 装 latest、仍不变则告警 —— 用户决定（2026-09-21）：**不构成兼容取舍**。旧行为是谎报（安装器自己刚算出远端更高，却说"已是最新"），不是任何调用方能依赖的契约，把它修回本应如此的样子不算改变对外承诺；CHANGELOG 记在 `修复` 下，不出 `不兼容` 条目。

## 过稿记录（拍板人表态，开始实现前必填）

- 2026-09-21｜拍板人在诊断结论后选择"现在修"，修复方向（升级后比对实际版本 → 退回 npm → 仍不变则告警并提示查多份副本）已在提问时写明并被选中；本页据此成稿。**实现与红回路先于本页落盘**——红回路门要求先造回路再改代码，本页补写在其后，据实记录。本页摆稿后拍板人回「可以按这个走，你最后实际验证就行了」，定稿；据此在合并前补一次真机验证（见 §如何验证 末条）。

## 替换清单（本次淘汰了什么）

| 被取代物 | 类型 | 取代者 | 处置 | 保留理由 + 到期日 |
|---|---|---|---|---|
| 「upgrade 退出码为 0 即认为升级成功」这条判定 | 逻辑分支 | `install.mjs#codegraphBehindLatest` 的版本比对 | 删除 | — |

## 验收标准

- [x] AC-001 本机 v1.5.0、远端 v1.6.0、`upgrade` 退出码 0 但版本不变 → 调用 `npm install -g <包>@latest`，输出不含"已是最新"，最终报"已升级到 v1.6.0" —— 满足：FR-001、FR-003
- [x] AC-002 同上且 npm 也换不掉 PATH 那份 → 输出不含"已是最新"与"已升级到"，明确报出仍是 v1.5.0 并提示查多份副本 —— 满足：FR-002、FR-003
- [x] AC-003 `upgrade --check` 失败的盲升路径、版本前后一致 → 仍输出「已是最新（v1.5.0），版本未变」，不误判为落后 —— 满足：FR-004
- [x] AC-004 已是最新（本机与远端同版本）→ 跳过升级，既不调 `upgrade` 也不调 npm —— 满足：FR-004

## 如何验证

- [x] `node --test test/codegraph.test.mjs` → 16 项全绿；修复前两条新用例判红（14 pass / 2 fail）
- [x] 反向自检：把 `codegraphBehindLatest` 的版本比较方向写反 → 判红（14 pass / 2 fail），还原转绿
- [x] `node --test test/*.test.mjs` → 502 项全绿
- [x] 真机验证（拍板人要求）：2026-09-21 在本机真跑一次带 codegraph 段的项目级安装 → 输出「本机 v1.6.0｜远端 v1.6.0 · 已是最新，跳过升级」，既不调 `upgrade` 也不调 npm，接线与 `codegraph init` 照常、目标目录真建出 `.codegraph/codegraph.db`
