# TickTick Task Center for SiYuan

TickTick Task Center is a SiYuan plugin for associating ordinary document blocks with TickTick tasks. Task data is stored in structured block attributes, while each source block keeps readable fallback Markdown:

```markdown
TickTick task: [Task name](https://ticktick.com/...)
```

The plugin provides task-card enhancement, seven local task statuses, and a dynamic task-center tab. The original document block remains the only source of truth; the task center does not maintain a second task database.

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
- Opening a singleton TickTick Task Center tab from the top bar and dynamically aggregating validated tasks across the whole workspace.
- Reading the seven task attributes with a conditional SQL aggregate so each task occupies one deterministic grouped result row.
- Active, closed, and all-task filters, local search across tasks and source documents, and stable sorting by task `updated-at` descending.
- Workspace-wide task statistics, source-block navigation, safe TickTick links, and explicit refresh for changes made in source documents or other clients.
- Reusing the existing complete editor from each task-center status badge and applying successful edits immediately to the current in-memory list without waiting for the SiYuan SQL index.
- Keeping a tab-scoped recent-edit overlay so an immediately requested manual refresh cannot visually revert a newer task-center edit when the SQL index is temporarily stale.
- Querying SQL only when the task-center tab first opens, when the user refreshes, or when the user retries a failed query; the task center does not poll or refresh in the background.
- Distinguishing temporarily incomplete SQL attribute rows from task blocks whose complete structured data is genuinely invalid.
- Automated tests for validation, Markdown escaping, attribute generation, creation and editing workflows, task-card lifecycle, task-center aggregation, filtering, refresh control, tab lifecycle, and UI behavior.

Batch operations, task deletion, task context menus, and TickTick API synchronization are not implemented yet.

After creating or editing a task in a normal document, use the task center's **Refresh** button to synchronize that external change. The recent-edit overlay is temporary view state only: it is cleared with the tab and never replaces the seven task-block attributes as the source of truth.

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
pnpm test
pnpm run check
pnpm build
```

The production build creates `dist/` and `package.zip`.

## Assets

`icon.png` and `preview.png` are retained temporarily to keep marketplace packaging complete. They must be replaced with project-specific artwork before release.

## License

[MIT](./LICENSE)
