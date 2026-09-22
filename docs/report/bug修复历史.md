---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-21'
authority_refs:
  - '本仓库已处理过的 bug：现象、根因、处理方案、防回归落点'
---

# Bug 修复历史

> 每修一个 bug 追加一条，按日期倒序。修 bug 前 MUST 先用关键词检索本文（`dw-bug-diagnosis` 的 Phase 0），MUST NOT 整份读进上下文。

### [2026-09-21] 安装器每次都报 codegraph 有新版本，升完下次照旧再报

- 根因：`install.mjs#ensureCodegraphCli` 用 `codegraph upgrade` 的退出码判升级成没成。本机同时装了 npm 包（`/opt/homebrew/bin/codegraph`，PATH 优先）与独立包（`~/.local/bin/codegraph`）两份时，`upgrade` 认得自己是独立包那份并把它升到最新、退出码为 0，而 PATH 优先命中的 npm 那份版本不变。退出码为 0 时代码不再退回 npm，并在版本没变时打印「已是最新（v1.5.0），版本未变」——此时它自己刚算出远端是 1.6.0，这句是谎报。
- 处理方案：升级后重新探测，PATH 上那份仍低于远端（`install.mjs#codegraphBehindLatest`）即判升级未生效，退回 `npm install -g <包>@latest`；npm 也换不掉则明确告警并提示用 `which -a codegraph`（Windows 用 `where`）查多份副本。远端版本未知的盲升路径口径不变。使用者当场把本机 npm 那份升到 1.6.0，两份版本一致。
- 修复版本：3.1.0 之后的未发布改动（`dw-system/VERSION` 为 3.1.0，本条随下一个版本发布）
- 回归测试：`test/codegraph.test.mjs` 的 `upgrade 跑通却没换版本：退回 npm 装最新版，MUST NOT 说成"已是最新"` 与 `npm 也换不掉 PATH 上那份：明确告警并指出本机有多份副本`（假 CLI 新增 `upgradeNoop` / `npmNoop` 两个状态）
- 测试样本：无（触发条件是本机 PATH 上有两份 codegraph，没有可固化的输入文件；现场版本号已写进上面的根因）
