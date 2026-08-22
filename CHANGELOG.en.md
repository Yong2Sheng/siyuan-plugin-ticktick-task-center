English | [简体中文](CHANGELOG.md)

# Changelog

## 0.1.0 - 2026-08-22

This is the first official release. The entries below summarize the version by capability rather than listing individual commits or pushes.

### Task cards

- Add TickTick task creation through the SiYuan Protyle slash menu and insert new tasks at the top of the current root document.
- Store each task in one ordinary SiYuan block, using seven required structured attributes as the only persistent task-data source.
- Support seven stable local statuses: To do, In progress, Waiting for response, Blocked, Completed, Failed, and Cancelled.
- Preserve readable fallback Markdown containing the task title and TickTick / Dida365 link when the plugin is disabled.
- Non-destructively enhance marked blocks with a task identity icon, safe external task link, semantic status badge, and deadline control.
- Turn the checklist SVG on the left side of each task card into a Task Center shortcut while preserving its original shape, color, size, and layout.
- Edit the task title, URL, status, and deadline from source cards or the Task Center while preserving the original creation timestamp.
- Right-click anywhere on a source-document task card to open its actions menu and delete the SiYuan task card after confirmation without deleting the actual task in TickTick or Dida365.
- Restore the original block presentation when card enhancement is removed, and keep cards synchronized with Protyle rendering and edit-mode changes.

### Work categories and editing interaction

- Add four stable work categories: `explore` (🔭 探索-Explore), `build` (🛠️ 构建-Build), `execute` (⚙️ 执行-Execute), and `review` (🔎 评审-Review).
- Persist the category ID in the optional `custom-ticktick-work-mode` block attribute. Legacy tasks remain valid when it is absent and display “未分类-Unclassified”.
- Stack the work category above task status in source-document cards and Task Center items, using a theme-primary adaptive tint to keep Emoji legible.
- Replace the status dropdown with directly visible button choices, and use the same interaction for all four work categories in create and edit dialogs.
- Open the same editor with the corresponding field focused from the category, status, or Deadline button.

### Workspace Task Center

- Add a singleton Task Center tab opened from either the SiYuan top bar or a document task-card icon without maintaining a second task database.
- Dynamically aggregate validated tasks across the workspace and provide Active, Closed, and All filters.
- Add localized search across task titles, source documents, source paths, and status labels.
- Add task statistics, stable updated-time sorting, source-block navigation, safe TickTick links, and explicit manual refresh.
- Update the current list, filters, ordering, and statistics immediately after edits made in the Task Center.
- Right-click anywhere on a Task Center item to edit or delete its task card; successful deletion updates the list immediately and lets SiYuan remove the source block from any open source document.
- Protect recent in-tab edits and deletions from temporarily stale SQL refresh results with a tab-scoped in-memory overlay.

### Daily progress and deadlines

- Add local-calendar daily progress tracking for active tasks without changing their task status or `updated-at` value.
- Split the Active view into “To progress today” and “Today's progress”, with separate “Advanced” and “Completed today” sections.
- Record tasks completed today as daily progress and keep them visible after they move into the closed state.
- Reevaluate daily groups after local midnight without a background job that rewrites task attributes.
- Add an optional local deadline to task creation, editing, validation, persistence, cards, and Task Center aggregation.
- Display remaining days, the exact date, and an eight-segment urgency track with theme-adaptive upcoming, due-today, and overdue emphasis.
- Widen Deadline controls with an internal wrapping fallback for long localized labels, and distinguish singular `1 day` from plural `days` so overdue text stays inside its border.
- Sort tasks awaiting progress by nearest deadline, with overdue tasks first and undated tasks last.

### Data integrity and reliability

- Validate task data, SiYuan block IDs, and TickTick / Dida365 URLs before persistence or navigation.
- Preserve `created-at`, update `updated-at` only when task data changes, and detect optimistic edit conflicts before saving.
- Attempt to roll back fallback Markdown when a title or URL double-write fails.
- Stabilize card discovery, rendering, enhancement lifecycle, persistence, and restoration across editor rerenders.
- Aggregate required and optional attributes into one deterministic SQL row per task to reduce partial results at SiYuan's query limit.
- Distinguish temporarily incomplete SQL rows from complete but invalid task metadata.
- Fix cold-opening a source task from the Task Center loading only the task block and making the document appear blank; navigation now reuses SiYuan's normal file-tree document-opening actions before scrolling to and highlighting the task card in the loaded editor.

### Interface, packaging, and compatibility

- Add light- and dark-theme styling plus persistent Chinese/English interface switching, with Chinese as the first-launch default.
- Add an original theme-aware checklist SVG for task cards and a marketplace-ready 160×160 plugin icon.
- Tighten the Task Center SVG's internal whitespace so its top-bar and tab icons match the visual size of adjacent SiYuan and plugin icons.
- Unify the subtle upward hover feedback across clickable card and Task Center controls; give Open task, Locate source, and Open TickTick actions theme-adaptive button styling while stabilizing task-link text and border rendering throughout the animation.
- Initialize the TypeScript, Vite, and Svelte project; remove template sample features and the unused kernel-plugin example.
- Add automated domain, persistence, card, editing, query, filtering, daily-progress, deadline, and Task Center tests.
- Add CI checks, production packaging, GitHub Release workflow configuration, development documentation, and the MIT License.
- Declare experimental HarmonyOS native-mobile support after basic core-workflow verification on a Huawei tablet running HarmonyOS 6; Android, iOS, and browser-based mobile clients remain unverified.
