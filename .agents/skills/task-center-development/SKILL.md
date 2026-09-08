---
name: task-center-development
description: Develop, debug, review, test, package, locally install, push, or release the SiYuan Task Center plugin in this repository. Use for task cards, Task Center, knowledge indexing and review, SiYuan API integration, Svelte UI, build ZIPs, workspace plugin installation, and GitHub Actions releases; do not use for unrelated SiYuan plugins or general product planning.
---

# 思源任务中心插件开发

沿着插件真实调用链完成最小范围修改，保持任务块单一数据源、思源内容写入授权和已发布属性兼容性，并用与风险相称的验证证明结果。

## 开始工作

1. 完整遵循仓库根目录 `AGENTS.md`；它是权限、安全、架构、Git、部署和发布规则的权威来源。
2. 检查工作区状态，识别并保留已有修改。
3. 阅读与请求直接相关的源码、测试和 `docs/DEVELOPMENT_TICKET.md` 章节；用 `rg` 从用户操作入口追踪到领域逻辑和思源 API。
4. 修改前说明原因或当前证据、方案和影响范围。证据不足时继续定位，不先写补丁。

## 按任务加载参考

- 任务属性、SQL 汇总、知识索引、缓存或思源 API：先读 [references/architecture-and-siyuan.md](references/architecture-and-siyuan.md)。
- Svelte 交互、日期、异步状态、布局或测试选择：先读 [references/testing-and-ui.md](references/testing-and-ui.md)。
- 生产构建、`package.zip`、本机自动安装、push 或 release：先读 [references/build-install-release.md](references/build-install-release.md)。

只加载当前任务需要的参考。发布或部署任务不得把普通代码修改自动扩大为 commit、push、tag 或 Release。

## 实施方法

1. 建立可验证链路：用户动作 → 入口/组件 → 领域转换 → 思源 API 或可重建缓存 → 重新读取后的状态。
2. 找到拥有该规则的最小模块，只修改它及必要的调用方和测试。优先复用现有解析、验证、日期、查询、控制器和 API 边界。
3. 数据字段变化同时检查默认值、旧数据解析、非法值、清除分支、保存结果、SQL 查询、界面展示和中英文文案。
4. 对真实思源空间只可直接读取。任何内容写入、删除、属性变更或批量操作都先取得用户明确授权；获准后精确定位目标并在写后用非导出 API 复核。
5. 不使用 Markdown 导出内容回写思源，不整体覆盖文档根块，不直接操作思源笔记底层文件。

## 验证与交付

1. 增加或更新能在修改前暴露问题、修改后证明行为的测试，并先运行直接相关测试。
2. 根据影响范围继续运行静态检查、完整测试、生产构建、安装包校验和真实思源验收。
3. 用户要求自动安装时，构建生成 ZIP 后使用仓库现有安装流程，确认精确空间并比较编译目录与安装目录的关键文件校验值。
4. 用户要求 push 时同步维护中英文 README 和 CHANGELOG；用户要求 release 时还要维护双语 `RELEASE_NOTES.md`，通过推送 tag 触发 GitHub Actions，禁止浏览器发布。
5. 按 `AGENTS.md` 的完成汇报清单交付，明确列出所有未执行验证和未经授权而未进行的思源写操作。
