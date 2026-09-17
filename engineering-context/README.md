# engineering-context

代码事实的语义层（"信哪个"）——装了 dw-workflow 的项目一律维护它。
用 `ctx` 查询：discover / get-card / find-scenes / list-services；每条事实带 cite，
没写 freshness 的会标「未声明新鲜度」，不当作新鲜用。
**内容渐进补齐**：要用某个模块的事实就先查卡片，查不到就读源码、读完当场补卡
（判据与最小形态见 dw-workflow 的 references/core/代码事实纪律.md §4）。
只剩【】模板占位行是正常起步态，MUST NOT 据此退回裸 grep。
结构与字段设计见 references/core/engineering-context设计.md。
