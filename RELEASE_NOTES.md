# 思源任务中心 v0.5.0

本版本为任务中心增加“收件箱”：在任务还不成形的时候，先用“标题 + 可选正文”把想法记下来，之后再决定是就地完成，还是变成一篇真正的任务文档。它把“灵感到来时先抓住”和“想清楚之后再建任务”分开，同时继续以原始思源任务块作为任务的唯一数据源。任务链接同时改为可选字段。

## 主要更新

- 任务中心增加“收件箱”页签：标题框回车即存，正文框回车换行、`⌘/Ctrl + 回车` 保存；正文可选。
- 便条分为“⚡ 快速事项”和“🔬 正式任务”两级。快速事项可以就地完成并进入“✓ 今日已完成”；正式任务没有完成按钮，只能移入任务清单。
- 每条便条按“标题加粗 + 正文折叠”显示。正文超过两行时出现“展开正文”，展开后按基础 Markdown 渲染段落、粗体、斜体、行内代码、链接、无序列表和引用。
- 思源顶栏增加“快速记录”按钮，在任意位置都能唤出小弹窗记一笔；其中的“保存并继续”适合灵感连着冒出来时一条接一条地记。
- “移入任务清单”会新建一篇任务文档并写入任务块：任务标题取便条标题，便条正文写进同一篇文档。
- 目标位置选择器改为回答“新任务文档放在哪”：点笔记本＝建在它根下，点文档＝建在它下面；常驻显示将要创建的完整路径和可编辑的文档名。
- 任务链接由必需改为可选：不填链接同样可以创建和保存任务，卡片以纯文本显示标题。

## 数据与兼容性

- 便条不是任务：只保存文字、分级和创建时间，不携带状态、截止日期、工作分类、重点计划或链接等任何任务字段。
- 收件箱数据保存在插件数据文件 `inbox.json` 中，并在同一目录轮换保留三份备份；收件箱不会创建、修改或隐藏任何文档与笔记本，文档树里不会出现任何痕迹。
- 便条只有在“移入任务清单”时才转换成真实任务块，并同时从插件数据中删除；不存在“既是便条又是任务”的中间态。
- 移入的执行顺序固定为“建任务块 → 写正文 → 删便条”。正文写入失败时保留便条，便条删除失败时保留任务块，两种情况都如实提示，不静默丢失内容。
- `custom-ticktick-url` 由必需变为可选，只放宽必填要求，属性含义与格式校验不变；非空但非法的链接仍然被拒绝。
- 必需结构化属性由七项变为六项，其它已发布属性名与含义均未改变，已有任务无需迁移。
- 快速记录弹窗与收件箱捕获框共用同一份数据和同一个控制器，不会产生第二份收件箱；分级选择在两个入口之间共用。

## 可靠性与验证

- 收件箱控制器在成功读取数据文件之前拒绝任何写入，避免刚启动思源时用内存里的空状态覆盖已有便条。
- 只填写正文、不填标题时拒绝写入，避免存下一张没有标题的便条。
- 便条正文的 Markdown 渲染器自行实现、直接构造 DOM 节点，不使用 `innerHTML`、不引入第三方依赖；链接只接受 `http` 和 `https`，其它协议按普通文字处理。
- 文档树三角放大到 22×22 点击区并改用实体 `▶ / ▼`，修复原有三角会被误读成小圆点、以及展开后列表跳回顶部的问题。
- 49 个测试文件、505 项测试全部通过；类型检查为 0 错误、0 警告，生产构建与 `package.zip` 完整性校验均通过。
- 主要验收环境为 macOS 思源桌面版；HarmonyOS 原生移动端仍属于实验性支持。

## 安装

请下载本 Release 附件中的 `package.zip`。不要使用 GitHub 自动生成的 Source code 压缩包作为思源插件包。解压后确保 `plugin.json` 直接位于插件目录根部，并重新加载或重启插件。

完整记录见 [CHANGELOG.md](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/blob/v0.5.0/CHANGELOG.md)。

---

# SiYuan Task Center v0.5.0

This release adds an Inbox to the Task Center: capture an idea as a title plus an optional body while it is still unformed, then decide later whether to finish it in place or turn it into a real task document. It separates catching an idea from creating a task, while the original SiYuan task block remains the only source of task data. The task link also becomes optional.

## Highlights

- Add the Inbox tab to the Task Center. Enter in the title saves; Enter in the body inserts a newline and ⌘/Ctrl + Enter saves. The body is optional.
- Notes come in two tiers, ⚡ Quick errand and 🔬 Formal task. A quick errand can be finished in place and moves into ✓ Done today; a formal task has no complete button and can only be moved to the task list.
- Each note renders as a bold title plus a collapsed body. A body longer than two lines gets a Show full text control and is then rendered as basic Markdown: paragraphs, bold, italic, inline code, links, unordered lists, and quotes.
- Add a Quick capture button to the SiYuan top bar so a note can be captured from anywhere; Save and continue is meant for jotting down several ideas in a row.
- Move to task list creates a new task document and writes the task block into it: the task title comes from the note title and the note body is written into the same document.
- The target picker now answers where the new task document goes: select a notebook to create it at the notebook root, select a document to create it underneath. A persistent line shows the full path that will be created together with an editable document name.
- The task link changed from required to optional: a task can be created and saved without one, and the card then shows the title as plain text.

## Data and compatibility

- A note is not a task: it stores only text, a tier, and a creation time, and carries no status, deadline, work category, focus plan, or link.
- Inbox data is stored in the plugin data file `inbox.json`, with three rotating copies in the same directory. The Inbox never creates, modifies, or hides a document or notebook, so nothing appears in the document tree.
- A note becomes a real task block only when it is moved to the task list, and it is deleted from the plugin data at the same time. There is no intermediate state where something is both a note and a task.
- The order is fixed as create task block → write body → delete note. A failed body write keeps the note, a failed note deletion keeps the task block, and both report the real outcome instead of silently dropping content.
- `custom-ticktick-url` changed from required to optional. This only relaxes the requirement; attribute meaning and format validation are unchanged, and a present but invalid link is still rejected.
- The number of required structured attributes drops from seven to six. All other published attribute names and meanings are unchanged, and existing tasks need no migration.
- The Quick capture dialog and the Inbox capture box share one data set and one controller, so there is never a second inbox, and the tier choice is shared across both entry points.

## Reliability and verification

- Refuse any Inbox write until the data file has been read successfully, so an empty in-memory state right after startup can no longer overwrite existing notes.
- Refuse to save a note that has a body but no title, which previously produced a title-less note.
- The note-body Markdown renderer is implemented in-house and builds DOM nodes directly, with no `innerHTML` and no third-party dependency. Links accept `http` and `https` only; any other scheme is treated as plain text.
- Enlarge the document-tree triangle to a 22×22 hit area with solid ▶ / ▼ glyphs, fixing both the outline triangle that read as a small dot and the tree jumping back to the top after expanding.
- All 505 tests across 49 test files pass; the type check reports 0 errors and 0 warnings, and the production build plus `package.zip` integrity verification pass.
- The primary acceptance environment is SiYuan Desktop on macOS; HarmonyOS native mobile remains experimental.

## Installation

Download `package.zip` from the assets of this release. Do not use the GitHub-generated Source code archives as a SiYuan plugin package. After extracting, make sure `plugin.json` sits directly at the root of the plugin directory, then reload or restart the plugin.

See [CHANGELOG.en.md](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/blob/v0.5.0/CHANGELOG.en.md) for the complete record.
