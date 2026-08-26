# 思源任务中心 v0.2.0

本版本将插件从面向 TickTick / 滴答清单的任务卡片，扩展为可连接多种任务目标的“思源任务中心”。

## 主要更新

- 支持四类目标链接：TickTick、滴答清单、思源文档或块，以及普通 HTTPS 资源。
- 打开按钮会按链接类型显示“打开 TickTick”“打开滴答清单”“打开思源文档”或“打开网络资源”。
- `siyuan://blocks/<块 ID>` 通过思源内部导航打开；HTTPS 资源在安全的新标签页中打开。
- 增加严格的链接安全校验，拒绝 HTTP、脚本与数据协议、本地文件协议、嵌入凭据的 URL 和格式错误的自定义协议。
- 用户界面更名为“思源任务中心”，创建、编辑和删除流程改用通用任务文案。

## 兼容性

- 现有 TickTick / 滴答清单任务卡片继续有效，无需迁移。
- 已发布的 `custom-ticktick-*` 块属性保持不变，仍是唯一持久化任务数据源。
- 本版本不接入任何目标服务 API、OAuth 或后台同步。

## 安装

请下载本 Release 附件中的 `package.zip`。不要使用 GitHub 自动生成的 Source code 压缩包作为思源插件包。

完整记录见 [CHANGELOG.md](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/blob/v0.2.0/CHANGELOG.md)。

---

# SiYuan Task Center v0.2.0

This release expands the plugin from TickTick / Dida365 task cards into a SiYuan Task Center that can link tasks to several target types.

## Highlights

- Support TickTick, Dida365, SiYuan document or block links, and ordinary HTTPS resources.
- Show a target-specific Open action for each link type.
- Open `siyuan://blocks/<block ID>` through SiYuan internal navigation and HTTPS resources in a safe new tab.
- Reject HTTP, script and data schemes, local-file URLs, embedded credentials, and malformed custom schemes.
- Rename the user-facing interface to SiYuan Task Center and generalize task creation, editing, and deletion wording.

## Compatibility

- Existing TickTick / Dida365 task cards continue to work without migration.
- Released `custom-ticktick-*` block attributes remain unchanged and continue to be the only persistent task-data source.
- No target-service API, OAuth, or background synchronization is introduced.

## Installation

Download the attached `package.zip`. Do not use GitHub's automatically generated Source code archives as the SiYuan plugin package.

See [CHANGELOG.en.md](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/blob/v0.2.0/CHANGELOG.en.md) for the complete record.
