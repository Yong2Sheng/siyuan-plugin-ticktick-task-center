# 思源任务中心 v0.8.0

本次把知识文档页签从「复习」改为「整理」，并补上收件箱「记一笔」的 Markdown 预览。

## 主要更新

### 知识文档：未整理 / 已整理

- 每篇知识文档新增「未整理 / 已整理」标记；可以随时「标记为已整理」或「撤销整理标记」。
- 整理时间写入文档块属性 `custom-task-center-knowledge-organized` 和 `custom-task-center-knowledge-organized-at`，写入后读回复核；重建索引不会丢标记。
- 知识页签默认只看未整理；汇总为全部 / 未整理 / 已整理 / 整理后有更新 / 可能失效。
- 已整理文档之后又被编辑过，仍算已整理，但显示「整理后有更新」；可用「整理后有更新」筛选集中处理，已整理列表也把这几篇排在前面。
- 点「完成补整理」刷新整理时间，提醒消失，文档不会退回未整理。
- 「整理后有更新」按最近一次扫描的文档更新时间计算。编辑知识文档后，点「扫描知识文档」才会刷新；仍只由用户手动触发，不自动扫描或轮询。

### 移除知识复习

- 移除今日复习、随机复习、重新学习和五级反馈；知识页签不再保存复习进度。
- 旧知识索引里的 `review` 数据解析时忽略，不迁移；知识文档的正文和块属性不受影响。

### 收件箱「记一笔」Markdown 预览

- 正文框旁边新增「显示预览 / 隐藏预览」；展开后在正文框下方全宽渲染 Markdown，默认收起。
- 停止输入 200 ms 后刷新；只读、可滚动，不重排输入框、不抢焦点，输入法组合期间不刷新。
- 不改保存格式，不新增字段，不单独写盘，不发网络请求。

## 数据与兼容性

- 任务块和 `custom-ticktick-*` 属性不变；知识文档身份标记 `custom-task-center-knowledge = true` 不变。
- 新增两个整理属性；知识索引仍是可重建缓存，旧 `review` 字段直接忽略。
- 收件箱数据文件结构不变，旧便条无需迁移。

## 可靠性与验证

- 新增 42 条测试（知识模块 36 条、收件箱预览 6 条）。
- 完整测试 607 个用例通过；类型检查 0 错误 0 警告；生产构建与 `package.zip` 校验正常。

## 安装

- 从本 Release 下载 `package.zip`，解压到工作空间的 `data/plugins/siyuan-plugin-ticktick-task-center/`；或按集市更新流程安装。
- 不要使用 GitHub 自动生成的 Source code 压缩包。
- 更新后如界面未刷新，可在「设置 → 集市 → 已下载」里对该插件执行一次「禁用/启用」，或重启思源。

---

# SiYuan Task Center v0.8.0

This release turns the Knowledge section from review into organizing, and adds a live Markdown preview to the Inbox quick-capture body.

## Highlights

### Knowledge documents: Not organized / Organized

- Every knowledge document now has a Not organized / Organized mark; select **Mark as organized** or **Undo organized mark** at any time.
- The organizing time is stored in `custom-task-center-knowledge-organized` and `custom-task-center-knowledge-organized-at`, then read back for verification. Rebuilding the index does not lose the mark.
- The Knowledge section defaults to Not organized. The summary is All / Not organized / Organized / Updated after organizing / Possibly missing.
- An organized document edited later still counts as organized but shows **Updated after organizing**. Use the **Updated after organizing** filter to handle them together, and the Organized view sorts them first.
- Select **Mark re-organized** to refresh the organizing time; the hint clears and the document never returns to Not organized.
- Updated after organizing is derived from document timestamps during the last scan. After editing a knowledge document, select **Scan knowledge documents** to refresh it; scanning remains manual, with no automatic scan or polling.

### Knowledge review removed

- Remove Today's review, Random review, Relearning, and the five feedback levels; the Knowledge section no longer stores review progress.
- Legacy `review` data in the knowledge index is ignored, not migrated. Knowledge document content and block attributes are unaffected.

### Inbox quick-capture Markdown preview

- Add Show preview / Hide preview next to the capture body. Expanding it renders Markdown full width below the body and starts collapsed.
- Refresh 200 ms after typing stops. It is read-only, scrolls internally, does not reflow the textarea, and does not steal focus. No refresh during IME composition.
- It changes no saved format, adds no fields, performs no separate writes, and makes no network requests.

## Data and compatibility

- Task blocks and `custom-ticktick-*` attributes are unchanged; the knowledge identity marker `custom-task-center-knowledge = true` is unchanged.
- Two organizing attributes are added. The knowledge index remains a rebuildable cache, and the legacy `review` field is ignored.
- The Inbox data file structure is unchanged; existing notes need no migration.

## Reliability and verification

- Add 42 tests (36 knowledge, 6 Inbox preview).
- The full suite passes with 607 tests; the type check reports 0 errors and 0 warnings; the production build and `package.zip` validation succeed.

## Installation

- Download `package.zip` from this release and extract it into the workspace's `data/plugins/siyuan-plugin-ticktick-task-center/`, or update through the Marketplace flow.
- Do not use GitHub's automatically generated Source code archives.
- If the interface does not refresh, disable and re-enable the plugin under Settings → Marketplace → Downloaded, or restart SiYuan.
