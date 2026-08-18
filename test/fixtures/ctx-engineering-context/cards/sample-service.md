# Codebase Card — sample-service

## 职责
提供背单词记录与作业辅导会话能力的后端服务。

## 对外接口
| 接口 | 用途 | 版本/状态 | 调用方 |
|---|---|---|---|
| POST /v2/word/record | 记录背单词进度 | V2 / canonical | 单词 App |
| POST /v2/tutor/chat | 作业辅导对话 | V2 / canonical | 辅导前端 |

## 上下游
- 上游（谁调我）：单词 App、辅导前端
- 下游（我调谁）：user-center、growth-mq

## 废弃 / 中间产物标记
- POST /v1/word/record — 上次重构的中间产物，不可用，务必走 V2

## 测试入口
word_record 集成测试；tutor_chat fixture；DB 表 t_word_record。

## Freshness / Provenance
- 最近确认：2026-07-06
- 来源：PR#123
