# 原型框架源码

> 读者是**维护框架本身**的人。产出一份原型不需要读这里，也不需要读 `ui-prototype.html`——照 `references/UI原型纪律.md` §8 填插槽即可。

这里的**七份源文件**装配成 `ui-prototype.html` 的**六个固定实现区**。`preview.mjs` 的 `composeTemplate()` 在 `init` 时把它们填回容器；产物仍是单文件、零外链——外置的是源码组织方式，不是运行时依赖。

## 装配表（权威定义在 `preview.mjs` 的 `FRAMEWORK` 常量）

| 固定实现区 | 恒装配 `files[]` | 仅 `--with-baseline` 追加 `baselineFiles[]` |
|---|---|---|
| `THEME` | `theme.css` | |
| `DESIGN-SYSTEM` | `structure.css` | `components.css` |
| `ANNO-FRAMEWORK:CSS` | `anno.css` | |
| `ICONS` | `icons.svg` | |
| `SCREEN-SCRIPT` | `screen.js` | |
| `ANNO-FRAMEWORK:JS` | `anno.js` | |

## 结构层与外观层的切分线

`DESIGN-SYSTEM` 分两层：

- **`structure.css` 恒装配**——画布、设备壳、屏、状态层、屏注解区、图标尺寸、排版原语、`.fill` / `.scroll-y`。它们是批注框架与 `check` 的锚点，**与视觉风格无关**。
- **`components.css` 默认不装配**——按钮、表单、卡片、徽标、提示条、空态、列表、导航、浮层这套控件外观，只有 `init --with-baseline` 才追加。

判据（权威定义在 `../../../references/UI原型纪律.md` §8.3）：**原型的视觉风格 MUST 由本次项目的真实样式来源决定，MUST NOT 由容器替产出方定死**。容器塞一套完整控件库进去，产出方就会照它画。

**新增一份源文件时 MUST 先判它属于哪一层**：与视觉风格无关、批注框架或 `check` 依赖它 → 进 `files[]`；纯控件外观 → 进 `baselineFiles[]`。判错方向的代价不对称——外观层误进 `files[]` 会把风格重新定死（正是 2.12.0 要拆掉的东西），结构层误进 `baselineFiles[]` 会让默认路径下批注框架失去锚点。

## 两条容易踩空的约定

- **框架自用的控件 MUST 用私有 class**（`.anno-btn` / `.anno-notes-body` 等），**MUST NOT 借用 `components.css` 里的 `.btn` / `.card-content`**——外观层默认不装配，借用的那一刻框架 UI 在默认路径下就完全没有样式，而页面照常打开、零报错。初始 `innerHTML` 与运行时 `className` 赋值**两条路径都算**（机器闸：分发源仓库的 `test/prototype-framework.test.mjs`〈框架 JS 只用私有 class〉；`test/` 不随 skill 分发）。
- `icons.svg` 存的是 `<symbol>` 序列，不是可独立渲染的 SVG 文档。根 `<svg>` 由装配表提供，且 **MUST NOT 加 `xmlns`**——它会带进 `http://` 串，直接挂掉零外链自检。

改这些文件不需要动 `ui-prototype.html`；**反过来，MUST NOT 往容器的固定区里写正文**（写了就有两份副本，装配后同一段内容出现两次而页面照常打开）。改分区标记或装配表时两处同改，并在分发源仓库跑 `node --test test/prototype-framework.test.mjs`（该目录不随 skill 分发，装进目标项目后没有它）。
