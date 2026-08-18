# Capability Registry (fixture)

| Capability | 业务含义 | 权威仓库 | 权威接口(含版本) | 废弃/中间产物替代 | 兼容窗口 | owner | 测试入口 | freshness | 理由链 |
|---|---|---|---|---|---|---|---|---|---|
| 背单词记录 | 记录用户单词学习进度 | sample-service | POST /v2/word/record | V1 为重构中间产物，不可用 | 05/29前兼容,06/10后不兼容 | alice | word_record 集成测试 | 2026-07-06 / PR#123 | 06/10 事故复盘后收敛到 V2 |
| 作业辅导会话 | 学生与辅导 agent 的对话 | sample-service | POST /v2/tutor/chat | 无 | 长期 | bob | tutor_chat fixture | 2026-07-06 / PR#130 | 新增能力 |
