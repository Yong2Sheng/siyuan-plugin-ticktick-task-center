# 思源任务中心 v0.3.0

本版本为任务中心增加知识文档索引与复习系统，让分散在任务文档下的科研知识可以集中查找、定期复习，同时保持原文档位置和正文不变。

## 主要更新

- 新增“任务 / 知识文档”页签，通过手动扫描递归识别任务文档下的知识子文档。
- 为新发现的知识文档写入并复核中性属性 `custom-task-center-knowledge = true`；已缓存文档不会重复写入。
- 插件启动时只读取可重建索引缓存，不自动扫描、不轮询，也不监听文档树变更。
- 新增“开始今日复习”“随机复习”和“重新学习”三个复习入口。
- 使用“毫无印象、似曾相识、记得但不懂、部分掌握、已经掌握”五级反馈。
- 根据反馈动态安排下次复习；“记得但不懂”会进入独立的重新学习队列。
- 复习次数、反馈、间隔和下次复习时间保存在插件索引中，不修改知识文档正文。
- 增加知识文档搜索、来源任务导航、失效提示，以及适配宽屏和窄窗口的统一界面。

## 可靠性

- 仅通过思源官方文档树与块属性接口发现和标记知识文档。
- 复习反馈先保存再切换下一篇；保存失败时保留当前文档和原有进度。
- 重新扫描会保留已有复习进度。
- 31 个测试文件、279 项测试全部通过，并通过类型检查、生产构建和响应式视觉检查。

## 安装

请下载本 Release 附件中的 `package.zip`。不要使用 GitHub 自动生成的 Source code 压缩包作为思源插件包。

完整记录见 [CHANGELOG.md](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/blob/v0.3.0/CHANGELOG.md)。

---

# SiYuan Task Center v0.3.0

This release adds a knowledge-document index and review system to the Task Center. Research notes can stay under their source task documents while becoming centrally searchable and reviewable.

## Highlights

- Add Tasks / Knowledge documents sections and manually discover descendant documents under task documents.
- Write and verify the neutral `custom-task-center-knowledge = true` marker only for newly discovered documents.
- Load a rebuildable cache at startup without automatic scans, polling, or document-tree listeners.
- Add Today, Random, and Relearning review entry points.
- Use five feedback levels: No impression, Looks familiar, Remembered but not understood, Partially mastered, and Mastered.
- Schedule later reviews dynamically and route comprehension failures into a separate relearning queue.
- Keep review count, feedback, interval, and next-review time in the plugin index without changing document content.
- Add local search, source-task navigation, unavailable-document warnings, and a responsive SiYuan-themed interface.

## Reliability

- Discover and mark knowledge documents only through official SiYuan document-tree and block-attribute APIs.
- Save feedback before advancing; a failed save preserves the current document and previous progress.
- Preserve review progress during later scans.
- All 279 tests across 31 test files pass, along with type checking, production build, and responsive visual verification.

## Installation

Download the attached `package.zip`. Do not use GitHub's automatically generated Source code archives as the SiYuan plugin package.

See [CHANGELOG.en.md](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/blob/v0.3.0/CHANGELOG.en.md) for the complete record.
