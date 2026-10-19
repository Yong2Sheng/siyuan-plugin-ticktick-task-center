# 思源任务中心 v0.7.0

本版本补齐收件箱的两个缺口：便条记下之后可以编辑，以及编辑正文时能直接看到 Markdown 的渲染效果。

## 主要更新

### 编辑便条

- 每条待处理便条新增「编辑」入口，快速事项与正式任务都有；标题、正文、分级都能改。
- 保存后列表原地更新，保留原记录时间、id 和排序；便条不会跳到顶部，也不会产生任务块。
- 标题为空、内容超过 2000 字、写盘失败、便条已被移入任务清单或删除时，弹窗保持打开、输入不丢，并给出对应提示。
- 只修改插件数据文件中的便条文字和分级；不写思源笔记、不新增任务字段、不改变数据版本。

### Markdown 实时预览

- 编辑弹窗在正文下方新增只读预览，与收件箱列表共用同一个渲染器，两边效果一致。
- 停止输入 250 ms 后刷新；打字过程中不重排、不抢焦点。
- 预览可折叠，折叠状态不记忆，每次打开默认展开；空正文显示一行提示；长正文在预览内滚动（上限 200 px，窄屏和矮窗口 140 px）。
- 预览只影响显示，保存的仍是原始 Markdown；不新增字段、不单独写盘、不发网络请求。

## 数据与兼容性

- 便条仍然只存一段原始 Markdown；数据版本、`inbox.json` 结构、三轮备份和写入后逐字段复核逻辑都没有变化。
- 编辑复用现有串行写入队列，保存成功后才替换内存状态。
- 预览不需要新的配置或存储，旧便条打开即可看到预览。

## 可靠性与验证

- 新增 5 条编辑弹窗预览测试：渲染、折叠、空正文、250 ms 防抖、关闭后不再刷新。
- 完整测试 583 个用例通过，类型检查 0 错误 0 警告，生产构建与 `package.zip` 校验正常。
- 预览与列表共用渲染器，避免出现「预览里有、保存后列表没有」的两套效果。

## 安装

- 在思源「集市 → 已下载」中更新，或从本 Release 附件下载 `package.zip` 解压到工作空间的 `data/plugins/` 目录。
- 更新后如界面未刷新，可在「设置 → 集市 → 已下载」里对该插件执行一次「禁用/启用」，或重启思源。

---

# SiYuan Task Center v0.7.0

This release fills two gaps in the Inbox: notes can be edited after capture, and the body shows its rendered Markdown while being edited.

## Highlights

### Note editing

- Every pending note now has an Edit entry, for both quick errands and formal tasks. Title, body, and tier are all editable.
- Saving updates the list in place and keeps the original recorded time, id, and order. The note does not jump to the top, and no task block is created.
- When the title is empty, the text exceeds 2000 characters, a write fails, or the note was already promoted or deleted, the dialog stays open with the input intact and shows the matching message.
- Editing changes only the note text and tier in the plugin data file. It does not write to SiYuan notes, add task fields, or change the data version.

### Live Markdown preview

- The edit dialog renders a read-only preview below the body, using the same renderer as the Inbox list so both surfaces agree.
- The preview refreshes 250 ms after typing stops, without reflowing during typing or stealing focus.
- It can be collapsed; the collapsed state is not remembered and every open starts expanded. An empty body shows a one-line hint, and long bodies scroll inside the preview (200 px, 140 px on narrow or short windows).
- The preview only affects display: saving still stores the original Markdown. It adds no fields, performs no separate writes, and makes no network requests.

## Data and compatibility

- A note still stores a single block of original Markdown. The data version, `inbox.json` structure, three rotating backups, and field-by-field verification are unchanged.
- Editing reuses the existing serial write queue and only replaces in-memory state after a successful save.
- The preview needs no new configuration or storage; existing notes show it as soon as they are opened.

## Reliability and verification

- Add 5 edit-dialog preview tests: rendering, collapsing, empty body, the 250 ms debounce, and no refresh after the dialog closes.
- The full suite passes with 583 tests; the type check reports 0 errors and 0 warnings; the production build and `package.zip` validation succeed.
- The preview and the Inbox list share one renderer, avoiding a "preview shows it, the saved list does not" mismatch.

## Installation

- Update from SiYuan Marketplace → Downloaded, or download `package.zip` from this release and extract it into the workspace's `data/plugins/` directory.
- If the interface does not refresh, disable and re-enable the plugin under Settings → Marketplace → Downloaded, or restart SiYuan.
