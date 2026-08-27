# 原型框架源码

目录中的六个文件分别是 `ui-prototype.html` 六个固定实现区的正文：默认主题、设计系统、批注样式、图标 sprite、屏幕脚本与批注脚本。`preview.mjs` 的 `composeTemplate()` 会在执行 `init` 时将它们装配回单文件模板；产物仍是单文件、零外链，这里不是运行时外链。

`icons.svg` 保存的是 `<symbol>` 元素序列，不是可独立渲染的 SVG 文档。根 `<svg>` 标签由装配表提供，且 MUST NOT 添加 `xmlns` 属性。

修改这些文件不需要改动 `ui-prototype.html`。
