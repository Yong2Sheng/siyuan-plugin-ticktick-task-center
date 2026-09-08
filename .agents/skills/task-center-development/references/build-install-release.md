# 构建、本机安装与发布参考

仅在任务涉及生产构建、安装包、本机思源部署、Git push 或 Release 时读取。

## 生产构建与 ZIP

仓库的真实入口是：

```bash
CI=true pnpm build
```

该命令应同时生成：

- `dist/index.js`、`dist/index.css`；
- `dist/plugin.json`、中英文 README/CHANGELOG、许可证、图标、预览图和 i18n 文件；
- 仓库根目录 `package.zip`。

构建后至少执行与 `.github/workflows/release.yml` 等价的检查：

1. `package.zip` 存在且 `unzip -tq package.zip` 通过。
2. 解压到临时目录后，`plugin.json` 位于 ZIP 根目录，必需运行文件、资源和中英文文档齐全。
3. ZIP 内的清单、文档、图标和 i18n 与工作树来源一致。
4. ZIP 不包含 `src`、测试、`node_modules`、`.git`、`docs`、补丁目录、source map 或嵌套 `package.zip`。
5. `package.json` 与 `plugin.json` 的版本一致；发布时还要与 tag 一致。

不要手改 `dist/` 或 ZIP 修补构建问题，应修正源码或构建配置后重建。

## 自动安装到本机思源

完成所需测试和构建后运行：

```bash
CI=true pnpm run make-install
```

`make-install` 会再次构建，因此也会刷新 `package.zip`，随后把 `dist/` 复制到：

```text
<所选工作空间>/data/plugins/siyuan-plugin-ticktick-task-center/
```

操作规则：

1. 确认思源正在运行。当前脚本固定通过 `127.0.0.1:6806/api/system/getWorkspaces` 发现空间。
2. 若默认端口失败、API 需要 token 或存在多个空间且目标不明确，先向用户索取连接信息或选择；不得凭历史路径猜测。
3. 安装前展示解析后的精确目标目录。只复制 `dist/` 内容，不把 `package.zip` 解压成多余嵌套目录。
4. 不清空目标目录，不使用 `rsync --delete`，不删除未知文件或用户数据。
5. 安装后计算并比较以下文件在 `dist/` 与目标目录中的 SHA-256：`index.js`、`index.css`、`plugin.json`。缺失或不同即安装失败。
6. 提醒用户重新加载插件；若缓存未刷新，禁用后启用或重启思源。

安装编译产物不授权修改任何思源文档内容。真实笔记验收若会创建、修改或删除块，必须另行取得用户明确允许。

## Push

只有用户明确要求 push 时才执行：

1. 检查状态、diff 和目标分支，保留并排除无关用户修改。
2. 运行与变更风险相称的测试、静态检查、生产构建和空白错误检查。
3. 更新 `README.md`、`README.en.md`、`CHANGELOG.md`、`CHANGELOG.en.md`，让两种语言都准确反映此次变更。
4. 创建聚焦提交并推送。若目标为 `main`，必须确认全部必要验证已通过。
5. 用 GitHub CLI 查看 CI 状态；不打开浏览器代替核验。

Push 授权不包含版本 tag 或 Release，除非用户同时明确要求 release。

## Release

用户明确要求 release 后：

1. 确认版本号与发布范围。
2. 同步更新 `package.json`、`plugin.json`、中英文 README、两份 CHANGELOG 和 `RELEASE_NOTES.md`。
3. `RELEASE_NOTES.md` 必须在一个文件中先后包含完整中文与英文内容，功能、修复、兼容性、验证和安装说明相互对应。
4. 运行相关测试、`CI=true pnpm run check`、`CI=true pnpm test`、`CI=true pnpm build`、ZIP 校验和 `git diff --check`。
5. 提交并推送发布改动，再创建并推送 `v<version>` tag。
6. 由 `.github/workflows/release.yml` 根据 tag 构建和创建 GitHub Release。禁止浏览器手动发布，也不使用本地 Release 创建命令绕过 Actions。
7. 使用 GitHub CLI 观察 workflow，最后核对 tag、Release 标题/双语正文和 `package.zip` 附件。

工作流失败时保留失败证据并修复根因；不要重复创建不同 tag，不覆盖已发布 tag，除非用户明确决定采用相应恢复方案。
