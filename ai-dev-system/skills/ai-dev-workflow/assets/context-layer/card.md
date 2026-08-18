# Codebase Card — 【repo 名】

> 每仓一张。让 AI 从产品能力定位到本仓、判断哪个是当前有效实现。
> 事实以**源码**为准（基于"本次发布 vs 上一基线"的真实 diff 派生）。`ctx get-card <repo> [域]` 会读本卡；段落标题用 `## ` 便于 CLI 切分。
> 卡片记的是**人工判断**：哪个是权威、哪个已废弃、业务含义是什么——这些从代码里读不出来，正是 card 存在的理由。
> 调用图、最后修改时间、DB schema 这类**机器能自己算出来的事实 MUST NOT 抄进 card**：抄进来就有两份、且这一份必然先过期。需要它们时现查（探测到图谱位就走代码图谱，见 `references/capability/graph.md`）。

## 职责
【本仓库权威负责什么；一句话现状。】

## 对外接口
> 服务路径总览：列出部署后**所有对外可达的入口**——不只是 HTTP，还含 RPC、Worker/定时任务、MQ consumer。每条一句话说清能力，不展开 schema。仅内部可见/已废弃仍在线的在"备注"标明。
| 接口/入口 | 类型（HTTP/RPC/cron/MQ）| 用途 | 版本/状态 | 调用方/触发源 | 备注（鉴权/幂等/约束）|
|---|---|---|---|---|---|
| 【POST /api/xxx】 | HTTP | 【】 | 【V2 / canonical】 | 【】 | 【】 |
| 【Service#method】 | RPC | 【】 | 【】 | 【】 | 【】 |
| 【job-name】 | cron | 【】 | 【0 */5 * * *】 | system | 【重试/副作用】 |

## 上下游
- 上游（谁调我）：【】
- 下游（我调谁）：【】

## 废弃 / 中间产物标记 ★ 防误用
- 【旧接口/旧类/中间产物】 — 【为什么不能用】

## 业务域 Card Index（哪个文件做什么）
| 业务域/功能 | 关键文件/类 | 说明 |
|---|---|---|
| 【】 | 【path/Class】 | 【】 |

## 测试入口
【本仓接口测试 / fixture / DB 表 / 回归方式。】

## 日志 / 排障（Observability）
> card 的高频用途之一是"出问题先看哪"。填不满可留关键几行。
- 日志平台 / 库：【日志平台（如 ELK / 云日志服务）+ project/索引名】
- 服务日志标识：【service/app 名或 label，用于按服务过滤】
- 关键追踪字段：【traceId / requestId / caller / errorCode / costMs 等】
- 优先排障路径：【现象 → 先看哪个类/日志/状态】（如：接口报错 → 看 X 日志的 errorCode → 查 Y 表状态）

## 前端仓补充（仅 Client 仓填，后端仓忽略此节）
> 前端仓的"权威面"与后端不同，补以下几项，其余沿用通用节。
- 端类型：【Android / iOS / Web / 小程序】
- UI 入口与导航：【路由/导航路径（router/Intent/deeplink）→ 目标页面（Activity/Fragment/Page）；关键页面流】
- 端侧能力与权限：【Camera/RECORD_AUDIO/存储/Native SDK → owner + 初始化点 + 回归关注】
- 实时通道：【WebSocket/SSE/WebRTC → 连接/关闭点 + 风险点（重连/实例竞争/泄漏）】
- 端侧排障：【client log tag / RUM 埋点 → 关键字段与定位方式】

## Freshness / Provenance
- 最近确认：【2026-07-06】
- 来源：【PR#xxx / diff】
- 线上版本：【】
