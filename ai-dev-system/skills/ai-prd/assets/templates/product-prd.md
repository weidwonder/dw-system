---
date: 'YYYY-MM-DD'
status: '【当前状态描述，自由文本】'
lifecycle: active          # 整品 PRD 是唯一真相源，长期保持 active；它是变更 PRD 归并的去处，自己不归档
last_confirmed: 'YYYY-MM-DD'       # 最近一次被权威面触发复核、判定仍准确的日期；新建时填当天，每次归并变更 PRD 后更新
authority_refs:            # 本 PRD 冻结了哪些对用户可见的行为契约；非空，随归并逐条补充
  - '【如：同一学生每天最多发起 3 次错题重练】'
documentRole: 'primary-prd'
sourceOfTruth: true
---

# 【产品名】 — 产品需求文档

> **文档治理说明**：本文档是产品需求的**唯一真相源**。所有影响产品范围、用户旅程和成功指标的变更必须先改此文档。本文只写业务需求，不描述程序实现和技术选型。

## Executive Summary

【一段话概括产品定位与核心差异化：为谁、解决什么、凭什么不同。】

## Success Criteria

### User Success

【用户侧成功是什么样：可观察的行为/结果。】

### 服务质量

| 指标 | 目标值 |
|---|---|
| 【用户等待时间/业务成功率/业务覆盖率…】 | 【具体数值】 |

### Measurable Outcomes

【上线后如何度量成功：成功指标（北极星）+ 关键结果。】

## Product Scope

### MVP（带状态）

- ✅ / 🚧 / 📋 【功能项】

### Growth（按优先级）

1. 【…】

### Vision

【长期形态，不承诺本期。】

### Risk Mitigation

【主要产品风险与缓解。】

## User Journeys（叙事体）

【角色 → Opening（场景/动机）→ Rising Action（遇到什么）→ Climax（关键时刻）→ Resolution（得到什么）。至少一条主旅程。】

## UI 原型（如适用）

| 项 | 内容 |
|---|---|
| 原型文件 | 【docs/spec/<name>-prototype-YYYYMMDD.html；不涉及 UI 或纯文案改动时写“不适用 + 原因”】 |
| 覆盖路径 | 【核心用户旅程、关键页面和状态】 |
| 样式依据 | 【现有设计 token / 组件库 / 现有页面 / 截图 / 临时视觉假设，写清具体来源】 |
| 关键状态 | 【默认 / 加载 / 空态 / 错误或无权限 / 成功反馈等】 |
| 不在用户界面内展示 | 【面向 PM 的解释、设计理由、开放问题】 |

## Functional Requirements

【按业务能力或业务流程组织。每条可判定，用 MUST / SHOULD / MAY 表达约束强度。】

## 服务质量要求

| 维度 | 指标 |
|---|---|
| 用户等待时间 / 服务连续性 / 权限边界 / 新旧业务延续 | 【…】 |

## 开放问题

【待澄清点：来源 + 卡住谁的决策。】
