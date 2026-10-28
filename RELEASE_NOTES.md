# 思源任务中心 v0.9.0

本次加入任务层级：可以把大任务拆成子任务，每个子任务住在自己的子文档里；任务中心新增「按项目」列表和「项目图」，文档卡片也能直接进入子项目。

## 主要更新

### 任务层级与子任务

- 新增可选属性 `custom-ticktick-parent` 保存父任务块 id；父任务显示「已完成 / 总数」和百分比，子任务卡片显示「↑ 上级任务」。
- 任务中心列表提供「按今日 / 按项目」两种结构，选择会被记住；「按项目」把子任务缩进到父任务下，可折叠，并显示项目进度和项目图入口。
- 「按今日」里的子任务卡片显示「↳ 属于「项目名」」，点一下直接打开项目图。
- 「新建子任务」在父任务所在文档下新建一篇子文档，把任务块放在子文档顶部并写入父级属性，子任务因此可以拥有自己的正文。
- 删除带子任务的父任务时，确认框明确说明子任务会保留并变成顶层任务；「移出父任务」只清空父级属性，不删除任何内容。
- 父级失效或父子关系成环时按顶层任务显示并提示，不自动改写子任务属性。

### 项目图

- 以根项目为单位自动布局整棵任务树；根节点和分支节点都显示自己的完成度。
- 拖动节点只改变布局，坐标保存在插件数据中；`Ctrl / ⌘ + 滚轮`缩放，拖动空白处平移，「重置自动排布」恢复默认。
- 分支可折叠（折叠后显示「+N」），可隐藏已完成，专注没做完的部分。
- 节点上可直接改状态、改截止；右键提供编辑、重点安排、今日推进、打开链接、定位、新建子任务、项目图、移出父任务和删除。

### 文档卡片：上级任务与子项目

- 子任务卡片显示「↑ 上级任务」，点击打开父任务。
- 有子项目的任务显示「子项目 N」胶囊：只有一个时直接进入；多个时弹出浮层列出状态和剩余天数，点行进入对应子项目文档。
- 浮层右上角「项目图」进入任务中心并选中该项目；超过 5 个子项目时提供「查看全部 N 个」。
- 没有子项目时卡片不渲染胶囊，与旧版完全一致。

## 数据与兼容性

- 任务块仍是唯一数据源，新增的只是可选属性 `custom-ticktick-parent`；缺失或为空即顶层任务，旧数据零迁移。
- 视图状态（列表模式、折叠状态、项目图坐标）保存在插件数据 `task-center-view.json`，不写入任务块、不随单篇文档导出。
- 子任务数量随卡片加载刷新；查询失败只少一个胶囊，不影响卡片和其他按钮。
- 复制或移动文档会改变块 id，复制出来的任务不会自动继承父子关系。

## 可靠性与验证

- 测试总数由 607 增至 675（新增 68 条），覆盖父子树、防环、孤儿降级、列表结构、项目图布局、视图状态、子任务文档、子项目查询与浮层。
- 类型检查 0 错误 0 警告；生产构建与 `package.zip` 校验正常；已在本机思源完成安装校验。

## 安装

- 从本 Release 下载 `package.zip`，解压到工作空间的 `data/plugins/siyuan-plugin-ticktick-task-center/`；或按集市更新流程安装。
- 请不要使用 GitHub 自动生成的 Source code 压缩包。
- 如果界面没有刷新，可在「设置 → 集市 → 已下载」中禁用后重新启用插件，或重启思源。

---

# SiYuan Task Center v0.9.0

This release adds task hierarchy: break a large task into subtasks, each living in its own child document. The Task Center gains a By project layout and a Project map, and document cards can open a subproject directly.

## Highlights

### Task hierarchy and subtasks

- Add the optional `custom-ticktick-parent` attribute for the parent block ID. Parent tasks show completed / total and a percentage; child cards show "↑ Parent task".
- The task list offers By day and By project layouts and remembers the choice. By project indents subtasks under their parent with collapsing, project progress, and a project-map entry.
- By day subtask cards show "↳ Under project" and open the project map in one click.
- New subtask creates a child document under the parent's document, puts the task block at its top, and writes the parent attribute, so each subproject can have its own body.
- Deleting a parent with children explains that children are kept and become top-level tasks; Detach subtask only clears the parent attribute.
- Missing parents and parent cycles fall back to top-level tasks with a notice; child attributes are never rewritten automatically.

### Project map

- Lays out a project's whole task tree; root and branch nodes each show their own progress.
- Dragging a node only changes the layout, stored in plugin data. Ctrl / ⌘ + wheel zooms, dragging blank space pans, and Reset auto layout restores the default.
- Collapse branches (shown as "+N") and hide completed tasks to focus on what is left.
- Change status and deadline on a node; the context menu offers edit, focus plan, today's progress, open link, locate, new subtask, project map, detach from parent, and delete.

### Document cards: parent task and sub-projects

- Child cards show "↑ Parent task" and open the parent.
- Tasks with children show a "Sub-projects N" chip: a single subproject opens directly; several open a popover with status and days left, and a row opens that subproject document.
- The popover header's Project map opens the Task Center on that project; more than five children get a View all entry.
- Without children no chip is rendered, so the card looks exactly like before.

## Data and compatibility

- Task blocks remain the single source of truth; the only addition is the optional `custom-ticktick-parent` attribute. Missing or empty means a top-level task, with zero migration for existing data.
- View state (list layout, collapsed branches, map positions) lives in `task-center-view.json`, never in task blocks, and is not exported with a single document.
- The subproject count refreshes when the card loads; a failed query only hides the chip.
- Copying or moving a document changes block IDs, so copied tasks do not inherit parent links automatically.

## Reliability and verification

- The suite grows from 607 to 675 tests (68 added), covering the task tree, cycle prevention, orphan fallback, list layouts, map layout, view state, subtask documents, subproject queries, and the popover.
- The type check reports 0 errors and 0 warnings; the production build and `package.zip` validation succeed; installation was verified in a local SiYuan workspace.

## Installation

- Download `package.zip` from this release and extract it into the workspace's `data/plugins/siyuan-plugin-ticktick-task-center/`, or update through the Marketplace flow.
- Do not use GitHub's automatically generated Source code archives.
- If the interface does not refresh, disable and re-enable the plugin under Settings → Marketplace → Downloaded, or restart SiYuan.
