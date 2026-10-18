# 思源任务中心 v0.6.0

本版本给活跃列表引入**第二维度：任务权重**。此前“今日待推进”只按截止日期排序，而很多截止日期是自己给自己定的软日期，过期也没有真实代价——两个月前的软截止任务会一直霸占列表顶部。现在权重是第一主键、截止日期退为同档内的相对先后；同时把文档内任务卡片的“今日推进”补齐，并把重点安排从截止日期上解绑。

## 主要更新

- 任务权重分三档：**🔥 必须推进 / ➖ 正常推进 / ☕ 有空再说**，保存在可选属性 `custom-ticktick-priority` 中。
- “🌤️ 今日待推进”排序改为 **权重 → 截止日期 → 更新时间**：权重高者在前，同一权重内截止日期越近越前，未设置截止日期的排在同权重末尾。“全部任务”视图不受影响，仍按更新时间。
- 任务中心与文档内任务卡片都显示权重徽标，点击弹出三档菜单；未设置时显示“➖ 设置权重”。
- 文档内任务卡片新增 **🚀 今日推进** 按钮：点一下记录今天推进过，再点撤销，与任务中心共用同一组属性和同一套写入逻辑。
- 重点日期不再受截止日期限制：月历里晚于截止日期的日期不再置灰，“今天 / 明天”快捷按钮不再禁用，编辑任务把截止日期提前到已有重点日期之前也不再报错。
- 任务中心操作区拆成两行——计划组（↑↓ / 📅 计划 / ⭐ 今天 / 🌙 明天）在上，推进组（打开任务链接 / 🚀 今日推进 / 定位原块）在下；可能缺席的控件放在行首，使不同卡片的按钮保持竖向对齐。
- 无目标链接的任务标题恢复为普通文本外观：保留外框但补回左右内边距，不再出现文字顶住框线、以及只有悬停才冒出外框的现象。

## 数据与兼容性

- 新增属性可选。未设置权重（包括本版本之前的全部旧任务）一律按“正常推进”处理，**不需要任何数据迁移**。
- “正常推进”与“未设置”在排序上完全等价，因此保存这一档时清空属性，而不是写入 `"normal"`；存储层只有“某一档”和“空”两种状态。
- 无法识别的权重值与其他非法属性一样按“属性无效”跳过，不会静默降级成某一档。
- 已发布属性名与含义均未改变；`custom-ticktick-focus-plan` 的数据结构不变，本次只是取消了“重点日期不能晚于截止日期”的限制，旧数据继续有效。
- 取消限制后，此前因为该限制而无法保存的重点安排可以正常写入；已经存在的、晚于截止日期的重点条目保持原样。

## 可靠性与验证

- 权重与今日推进的写入都在写后重新读取属性复核，复核不一致即报错，不把部分成功当成成功。
- 今日推进不修改任务的 `updated-at`，因此不会把任务顶到按更新时间排序的列表前面。
- 布局改动遵循“不改动既有控件的尺寸与形状”：截止日期仍是独立的 104px 控件；文档卡片用 grid 容器承载“截止日期 + 今日推进”，避免纵向 flex 把控件拉伸变形。
- 完整测试 561 个用例通过，类型检查 0 错误 0 警告，生产构建与 `package.zip` 校验正常。

## 安装

- 在思源“集市 → 已下载”中更新，或从本 Release 附件下载 `package.zip` 解压到工作空间的 `data/plugins/` 目录。
- 更新后如界面未刷新，可在“设置 → 集市 → 已下载”里对该插件执行一次“禁用/启用”，或重启思源。

---

# SiYuan Task Center v0.6.0

This release adds a **second dimension to the active list: task weight**. Previously "To progress today" was sorted by deadline alone, but many deadlines are self-imposed soft dates whose passing costs nothing — a task with a soft deadline from two months ago would sit at the top of the list forever. Weight is now the primary key and the deadline only breaks ties inside a weight band. This release also brings "Progress today" to in-document task cards and decouples focus planning from the deadline.

## Highlights

- Task weight has three levels: **🔥 Must advance / ➖ Normal / ☕ When free**, stored in the optional attribute `custom-ticktick-priority`.
- **🌤️ To progress today** now sorts by **weight → deadline → update time**: higher weight first, nearer deadlines first within the same weight, and undated tasks last in their weight band. The **All tasks** view is unchanged and still sorts by update time.
- Both the Task Center and in-document task cards show a weight badge; clicking it opens a three-level menu. An unset weight is shown as "➖ Set weight".
- In-document task cards gain a **🚀 Progress today** button that records today's progress and undoes it on a second click, sharing the same attributes and write path as the Task Center.
- Focus dates are no longer constrained by the deadline: dates after the deadline are not greyed out in the calendar, the Today/Tomorrow shortcuts are not disabled, and moving a deadline before an existing focus date no longer fails.
- The Task Center action area is split into two rows — planning controls (↑↓ / 📅 Plan / ⭐ Today / 🌙 Tomorrow) on top, execution controls (open task link / 🚀 Progress today / Locate) below. Optional controls sit at the left edge of their row so buttons stay vertically aligned across cards.
- Tasks without a target link now render their title as plain text: the frame stays but horizontal padding is restored, so text no longer touches the border and the frame no longer appears only on hover.

## Data and compatibility

- The new attribute is optional. Tasks without a weight — including every task created before this version — are treated as the normal level, so **no migration is required**.
- "Normal" and "unset" sort identically, so saving that level clears the attribute instead of writing `"normal"`; storage only ever holds a level or an empty value.
- An unrecognized weight is skipped as an invalid attribute, exactly like other invalid attributes, instead of silently falling back to a level.
- Published attribute names and meanings are unchanged. The `custom-ticktick-focus-plan` structure is unchanged; this release only drops "a focus date cannot be later than the deadline", so existing data stays valid.
- Focus entries that used to be rejected can now be saved normally; existing entries later than their deadline are left as they are.

## Reliability and verification

- Weight and daily-progress writes are verified by re-reading the attribute right after writing; a mismatch is reported instead of being treated as success.
- Daily progress does not touch `updated-at`, so it never moves a task to the front of a list sorted by update time.
- Layout changes respect "do not alter the size or shape of existing controls": the Deadline control is still a standalone 104px control, and in-document cards use a grid container for "Deadline + Progress today" so a column flex context cannot stretch it.
- All 561 tests pass, type checking reports 0 errors and 0 warnings, and the production build plus `package.zip` verification succeed.

## Installation

- Update from **Bazaar → Downloaded** in SiYuan, or download `package.zip` from this Release and extract it into `data/plugins/` of your workspace.
- If the UI does not refresh, disable and re-enable the plugin under **Settings → Bazaar → Downloaded**, or restart SiYuan.
