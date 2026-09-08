# 思源任务中心 v0.4.0

本版本为任务中心增加“今日重点”执行队列、跨日期重点安排，以及按月汇总计划与实际推进的热力日历。它把前一晚的主动规划和第二天的顺序执行连接起来，同时继续以原始思源任务块作为唯一数据源。

## 主要更新

- 在“今日待推进”上方新增“⭐ 今日重点”，可快速安排或取消今天、明天的重点任务。
- 未推进重点自动顺延；超过截止日期后继续显示为逾期重点，但不能新增晚于截止日期的安排。
- 推进重点后自动进入今日进展；撤销当天推进后恢复到今日重点。
- 增加任务级完整月历，可跨月选择多个重点日期，并通过 ↑↓ 持久调整同日执行顺序。
- 增加任务列表 / 月历切换，逐日显示重点计划数和所有任务的实际推进数。
- 使用 0、1、2、3–4、5+ 五档主题自适应热力颜色显示推进强度，并保留准确数字和“少 → 多”图例。

## 数据与兼容性

- 新增版本化 `custom-ticktick-focus-plan`，保存明确计划日期、完成日期和排序信息。
- 新增版本化 `custom-ticktick-progress-log`，保存去重的本地推进日期历史；现有 `custom-ticktick-last-progressed-date` 继续用于今日分组。
- 自动顺延不增加原计划数；同一任务同一天实际推进只计一次，撤销当天推进会移除当天记录。
- 旧任务无需迁移。第一次使用新版记录推进时，会并入当前仍可读取的最近推进日期；此前已经被覆盖的更早历史无法恢复。
- 所有计划和推进数据仍保存在原任务块属性中，任务中心不保存任务副本。

## 可靠性与验证

- 重点日期严格使用本地日历语义，并覆盖跨日、跨月、跨年、时区和截止日期边界。
- 任务属性写入后立即通过思源块属性接口复核；异常历史或重点计划不会被静默覆盖。
- 37 个测试文件、335 项测试全部通过；类型检查为 0 错误、0 警告，生产构建、`package.zip` 完整性和本机安装校验均通过。
- 主要验收环境为 macOS 思源桌面版；HarmonyOS 原生移动端仍属于实验性支持。

## 安装

请下载本 Release 附件中的 `package.zip`。不要使用 GitHub 自动生成的 Source code 压缩包作为思源插件包。解压后确保 `plugin.json` 直接位于插件目录根部，并重新加载或重启插件。

完整记录见 [CHANGELOG.md](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/blob/v0.4.0/CHANGELOG.md)。

---

# SiYuan Task Center v0.4.0

This release adds a Today's focus execution queue, multi-date focus scheduling, and a monthly heat calendar for planned versus actual progress. It connects intentional planning on the previous evening with ordered execution the next day while keeping the original SiYuan task block as the only data source.

## Highlights

- Add **⭐ Today's focus** above pending work, with quick actions to schedule or cancel today and tomorrow.
- Carry unfinished focus work forward automatically. Work remains visible as overdue focus after its deadline, while new focus dates later than the deadline are rejected.
- Move progressed focus work into Today's progress and restore it to today's focus when that day's progress is undone.
- Add a full per-task calendar for multiple dates across months, plus persistent ↑↓ ordering for same-day execution.
- Add Task list / Calendar switching with daily explicit-plan counts and actual progress across all tasks.
- Use five theme-adaptive heat levels for 0, 1, 2, 3–4, and 5+ actual tasks while retaining exact counts and a Less-to-More legend.

## Data and compatibility

- Add the versioned `custom-ticktick-focus-plan` attribute for explicit dates, completion dates, and ordering.
- Add the versioned `custom-ticktick-progress-log` attribute for deduplicated local progress-date history while retaining `custom-ticktick-last-progressed-date` for today's grouping.
- Automatic carry-over does not inflate the original plan count. A task counts once per actual day, and undoing today's progress removes that day.
- Existing tasks require no migration. The first new progress action carries forward the latest date still available, but older history overwritten before this release cannot be reconstructed.
- All planning and progress data remains on the original task block; the Task Center does not persist task copies.

## Reliability and verification

- Focus dates use system-local calendar semantics with coverage for day, month, year, timezone, and deadline boundaries.
- Task-attribute writes are immediately verified through the SiYuan block-attribute API. Malformed focus or history data is never silently overwritten.
- All 335 tests across 37 test files pass. Type checking reports 0 errors and 0 warnings, and the production build, `package.zip` integrity checks, and local installation verification pass.
- The primary acceptance environment is SiYuan Desktop for macOS. HarmonyOS native-mobile support remains experimental.

## Installation

Download the attached `package.zip`. Do not use GitHub's automatically generated Source code archives as the SiYuan plugin package. After extracting it, make sure `plugin.json` is directly inside the plugin directory, then reload or restart the plugin.

See [CHANGELOG.en.md](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/blob/v0.4.0/CHANGELOG.en.md) for the complete record.
