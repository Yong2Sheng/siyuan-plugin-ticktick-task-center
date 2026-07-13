# TickTick Task Center for SiYuan

TickTick Task Center is a SiYuan plugin for associating ordinary document blocks with TickTick tasks. Task data is stored in structured block attributes, while each source block keeps readable fallback Markdown:

```markdown
TickTick task: [Task name](https://ticktick.com/...)
```

The planned MVP will provide task-card enhancement, seven local task statuses, and a dynamic task-center tab. The original document block remains the only source of truth; the task center will not maintain a second task database.

## Current status

The plugin currently supports:

- Creating TickTick tasks from the Protyle slash menu.
- Keeping readable Markdown fallback blocks in source documents.
- Persisting task data in seven structured block attributes.
- Validating task input and rolling back inserted blocks when attribute persistence fails.
- Task-card enhancement with an identity label, task link, and interactive localized status badge.
- Non-destructive rendering that keeps the original Markdown and block attributes underneath and restores Markdown when the plugin is disabled.
- Opening the complete task editor from the status badge to edit task titles, TickTick URLs, and statuses.
- Synchronizing successful edits to all seven structured attributes and, when the title or URL changes, to fallback Markdown while preserving `created-at` and updating `updated-at` only for real changes.
- Optimistic conflict detection and Markdown rollback when attribute persistence fails.
- Automated tests for validation, Markdown escaping, attribute generation, creation and editing workflows, submission control, conflict handling, rendering, and rollback behavior.

The task-center Summary page, task deletion, task context menus, and TickTick API synchronization are not implemented yet.

## MVP boundaries

- Accept HTTPS task links from `dida365.com` and `ticktick.com`.
- Use official SiYuan APIs for block data.
- Do not integrate TickTick API, OAuth, or two-way synchronization.
- Do not use tags or full-text search as the primary status index.
- Build only a SiYuan frontend plugin; no kernel plugin is included.

Development and testing currently focus on SiYuan Desktop for macOS. Compatibility support for other platforms is not yet guaranteed.

## Development

Requirements: Node.js 20 and pnpm.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

The production build creates `dist/` and `package.zip`.

## Assets

`icon.png` and `preview.png` are retained temporarily to keep marketplace packaging complete. They must be replaced with project-specific artwork before release.

## License

[MIT](./LICENSE)
