English | [简体中文](README.md)

# SiYuan Task Center

<p align="center">
  <img src="icon.png" width="96" height="96" alt="SiYuan Task Center plugin icon">
</p>

> [!IMPORTANT]
> **All source code, tests, and documentation in this project were created entirely with OpenAI GPT and Codex.**
>
> Project requirements, feature decisions, real-world SiYuan testing, acceptance, and release decisions were handled by Yong Sheng.

SiYuan Task Center is a SiYuan plugin for creating task cards with target links in ordinary SiYuan document blocks. A target can be a TickTick / Dida365 task, a SiYuan document or block, or an ordinary HTTPS resource. The task block in the source document is the only persistent source of data. The plugin adds enhanced task cards, seven local statuses, four work categories, deadline reminders, daily progress tracking, and a workspace-wide task center without maintaining a second task database.

The current version does not call any target-service API, handle OAuth, or perform background synchronization. It stores only a validated target link and opens the corresponding task, SiYuan content, or HTTPS resource when selected by the user.

**This is an unofficial community-developed plugin and is not affiliated with TickTick, Dida365 (滴答清单), or SiYuan.**

## Core features

- Create a task card from the slash menu in an editable SiYuan document. The default status is `in-progress`, and the new block is inserted at the top of the current root document.
- Store the task title, a validated target link, seven required attributes, and optional work-category, deadline, focus-plan, and progress-history attributes in one ordinary SiYuan block.
- Keep ordinary Markdown containing the title and link in the source block, so the task remains readable and clickable while the plugin is disabled.
- Non-destructively enhance the block as a task card with an original checklist icon that opens the Task Center, a task link, a work-category button, a semantically colored status badge, and a Deadline button. The work category is stacked above the status.
- Open the complete editor from the work-category, status, or Deadline button to change the title, URL, work category, status, or deadline. Work categories and statuses are both selected from directly visible button groups.
- Right-click anywhere on a document task card or Task Center item to edit it or delete its SiYuan task card after confirmation. Deletion never affects the linked task, document, or resource.
- Show the deadline as remaining days, an eight-segment urgency track, and the calendar date. An undated task keeps the same track layout and a clear setup entry point.
- Keep the track empty outside the seven-day window, then fill one segment per day from seven days remaining. Due-today and overdue tasks use a full track.
- Apply theme-adaptive low-saturation emphasis to active tasks inside the seven-day window, with warning emphasis for due-today tasks and error emphasis for overdue tasks while preserving readable theme contrast.
- Preserve `created-at` and update `updated-at` only when task data actually changes.
- Check `updated-at` for edit conflicts before saving, and attempt to roll back Markdown when a title or URL double-write fails.
- Open a singleton Task Center tab from the SiYuan top bar and dynamically aggregate valid tasks across the workspace.
- Add a Knowledge documents section to the Task Center. A manual scan discovers child documents under task documents and writes and verifies `custom-task-center-knowledge = true` only for newly discovered documents.
- Load the Knowledge section from a rebuildable cache without scanning, polling, or live listening. The document tree is read only when the user selects Initialize knowledge index or Scan for new knowledge documents.
- Review knowledge through Today, Random, or Relearning entry points and use five feedback levels to schedule the next review dynamically.
- Use Chinese by default on first launch, with a persistent Chinese/English switch to the left of Refresh in the Task Center.
- Filter Active, Closed, or All tasks and search task titles, source documents, source paths, and localized status names.
- Display All, Active, Closed, and today's progress statistics. Ordinary lists use a stable descending sort based on the task attribute `updated-at`.
- Show **🌤️ To progress today** and **✨ Today's progress** in the Active view. Today's progress is further divided into **🚀 Advanced** and **🏆 Completed today**.
- Show **⭐ Today's focus** above pending work. Schedule today or tomorrow quickly, or select multiple focus dates from a task calendar; unfinished focus work carries forward without creating a date after its deadline.
- Persist the execution order of today's focus with up/down controls; progress moves an item into Today's progress, while undo restores it to today's focus.
- Switch between the task list and a monthly calendar that shows daily planned and actual counts with five theme-adaptive progress heat levels.
- Force **To progress today** into deadline order: overdue and nearer deadlines first, undated tasks last, then descending update time when deadlines match.
- To do, In progress, Waiting for response, and Blocked tasks all participate in daily progress. Moving a task to Completed automatically records it as progress for the day.
- Use **🚀 Progress today** and **✨ Progressed today** to mark or undo today's record without changing the task status or its existing `updated-at`.
- Determine “today” from the system's local timezone and regroup automatically after local midnight without a background attribute-reset job.
- Locate the original SiYuan task block; open TickTick, Dida365, and ordinary HTTPS resources safely in a new tab, or use SiYuan internal navigation for SiYuan block and document links.
- Immediately update the current list, filtered results, ordering, and statistics after an edit made inside the Task Center.
- Read changes made in ordinary documents or other clients when the user presses **Refresh** in the Task Center.

## Supported task links

| Type | Accepted format | UI action |
| --- | --- | --- |
| TickTick | `https://ticktick.com/...` | Open TickTick |
| Dida365 | `https://dida365.com/...` | Open Dida365 |
| SiYuan document or block | `siyuan://blocks/<valid SiYuan block ID>` | Open SiYuan document |
| Ordinary HTTPS resource | Any other well-formed `https://...` URL | Open resource |

The plugin rejects `http:`, `javascript:`, `data:`, `file:`, URLs containing embedded usernames or passwords, and any unsupported or malformed custom scheme. TickTick and Dida365 hostnames must match exactly. A SiYuan link must contain exactly one valid block ID, without extra path segments, query parameters, or fragments. Validation checks syntax and security boundaries only; it does not verify that a remote resource exists.

## Seven task statuses

Status IDs are the stable values used for persistence and queries. Emoji and labels are display-only.

| Key | 中文 | English | Category |
| --- | --- | --- | --- |
| `todo` | ⚪ 待开始 | To do | Active |
| `in-progress` | ▶️ 进行中 | In progress | Active |
| `waiting` | ⏳ 等待回复 | Waiting for response | Active |
| `blocked` | ⛔ 已阻塞 | Blocked | Active |
| `completed` | ✅ 已完成 | Completed | Closed |
| `failed` | ❌ 已失败 | Failed | Closed |
| `cancelled` | ⏹️ 已取消 | Cancelled | Closed |

## Four work categories

The work category describes how a task is approached and remains independent of its current status. Stable category IDs are stored in SiYuan block attributes; Emoji and bilingual labels are display-only.

| Key | Display label | Meaning |
| --- | --- | --- |
| `explore` | 🔭 探索-Explore | Research, learn, test feasibility, or find a direction when outcomes and effort remain uncertain |
| `build` | 🛠️ 构建-Build | Turn an established method, derivation, or design into code, tooling, or a working process |
| `execute` | ⚙️ 执行-Execute | Complete analysis or delivery with mature tools and an established workflow |
| `review` | 🔎 评审-Review | Inspect implementations or results, provide feedback, and make a judgment, such as a PR review |

## Development status and changelog

> [!NOTE]
> `v0.4.0` was published on 2026-09-08. The project is not yet listed in the SiYuan Marketplace.

### 0.4.0 (2026-09-08)

- Add Today's focus, today/tomorrow shortcuts, multi-date calendar planning, deadline constraints, automatic carry-over, and manual ordering.
- Add a Task Center monthly calendar with daily planned/actual counts and five-level progress heat shading.
- Add compatible focus-plan and progress-history attributes while keeping the original task block as the only persistent source. Existing tasks require no migration.

### 0.3.0 (2026-09-01)

- Add the knowledge-document index, explicit manual scanning, and task-tree ownership.
- Add Today, Random, and Relearning review entry points with five-level feedback scheduling.

### 0.2.0 (2026-08-26)

- Expand task targets to TickTick, Dida365, SiYuan documents or blocks, and ordinary HTTPS resources.
- Add target-specific Open actions, SiYuan internal navigation, and strict link-security validation.
- Generalize the user-facing interface as SiYuan Task Center while keeping `custom-ticktick-*` attributes and existing tasks fully compatible.

### 0.1.0 (2026-08-22)

- Implement task-card creation and editing, seven local statuses, four work categories, deadlines, and daily progress tracking.
- Implement the workspace-wide Task Center, filtering and search, source navigation, task editing, and manual refresh.
- Keep SiYuan block attributes as the only data source, with input validation, edit-conflict detection, and Markdown rollback.
- Support light and dark themes, Chinese and English interfaces, and a dedicated plugin icon.
- Declare experimental HarmonyOS native-mobile support after basic verification of the core workflow on a Huawei tablet running HarmonyOS 6.

See [CHANGELOG.en.md](CHANGELOG.en.md) for the complete itemized development record and the [v0.4.0 GitHub Release](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/releases/tag/v0.4.0) for the installable package.

## Installation

### Installation for users

The plugin is not currently listed in the SiYuan Marketplace, but it can be installed manually from GitHub Releases.

Download `package.zip` from the [v0.4.0 release page](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/releases/tag/v0.4.0). Do not treat GitHub's automatically generated Source code archives as SiYuan plugin packages; developers can still use the development installation below.

### Development installation

The development environment follows the project CI configuration: Node.js 24, pnpm 11.7.0, and SiYuan Desktop 3.7.0 or later. Development and real-world acceptance currently focus on SiYuan Desktop for macOS. The core workflow has also received basic verification on a Huawei tablet running HarmonyOS 6, but HarmonyOS native-mobile support remains experimental. Android, iOS, and browser-based mobile clients have not been verified.

Make sure SiYuan is running, then execute:

```bash
git clone https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center.git
cd siyuan-plugin-ticktick-task-center
corepack enable
pnpm install
pnpm make-link
pnpm dev
```

`pnpm make-link` attempts to read the current SiYuan workspaces and links the development output directory into the selected workspace's plugin directory. If automatic discovery is unavailable, set `SIYUAN_PLUGIN_DIR` to the target workspace's `data/plugins` directory.

`pnpm dev` is a long-running watch build. The watcher rebuilds the development bundle after source changes. If SiYuan does not load the latest bundle automatically, disable and re-enable the plugin.

After `pnpm build`, you can also extract the generated `package.zip` from the repository root into:

```text
<SiYuan workspace>/data/plugins/siyuan-plugin-ticktick-task-center/
```

Make sure `plugin.json` is directly inside that directory, then fully restart SiYuan. Alternatively, while SiYuan is running, execute `pnpm make-install`, select the current workspace, and let the script build and overwrite the installed plugin.

## Usage

### 1. Create a task

1. Open a regular editable SiYuan document.
2. Type `/` to open the Protyle slash menu.
3. Search for and select **Task card** (shown as “任务卡片” in Chinese).
4. Confirm or edit the task title. The plugin attempts to use the current root document title as the initial value.
5. Paste a valid task link. TickTick, Dida365, `siyuan://blocks/<block ID>`, and ordinary HTTPS resources are supported.
6. Select a task status. The default is `in-progress` (▶️ In progress).
7. Select one work category from the four directly visible buttons. New tasks require an explicit choice and are not categorized automatically.
8. Optionally set a deadline. It can be left empty, added later, or cleared.
9. Select **Create**.
10. The task is inserted as the first child block of the current root document—below the document title and before the existing body—and is immediately enhanced as a task card.

### 2. Edit a task in a document

- Select the work-category button at the top of the right-side vertical group to open the complete editor with the work category focused.
- Select the status badge below it to open the same editor with the task status focused.
- Select the rightmost Deadline button to open the same editor with the deadline field focused.
- Work categories and task statuses both expose all choices as buttons instead of dropdown menus.
- Change the task title, target link, work category, status, or deadline, then save.
- The card in the current document updates immediately after a successful save.
- When the title or URL changes, the fallback Markdown is updated as well.
- Status is not written to Markdown; its stable ID is stored in structured attributes.
- `created-at` stays unchanged, and a new `updated-at` is generated only for an actual edit.

### 3. Use deadline reminders

- A deadline is a local calendar date without a time of day. Display and calculations follow the computer's current timezone.
- The first button row shows “N days left,” “Due today,” “N days overdue,” or “No deadline.” The second row always contains eight track segments, and the third row shows the date or setup action.
- The track remains low-contrast and empty when more than seven days remain or no deadline is configured.
- The first segment fills at seven days remaining, then one more segment fills each day. One day remaining shows seven filled segments; due-today and overdue tasks show all eight.
- Deadlines are stored only in SiYuan task-block attributes. They are not written to the linked target and do not create system notifications or background reminders.

### 4. Open the Task Center

- Select the checklist icon on the left side of any document task card, or select the SiYuan Task Center button in the SiYuan top bar.
- The Task Center opens as an independent custom tab.
- Only one Task Center tab exists at a time. Selecting either entry again focuses the existing tab instead of creating another one.
- The workspace is queried once when the tab first opens.

### 5. Use the Task Center

- Click `Switch to English` to the left of Refresh to use the English interface; the button then changes to “切换为中文” so you can switch back.
- View counts for All, Active, Closed, and today's progress.
- Switch between the Active, Closed, and All tasks filters.
- Search task titles, source document titles, source paths, or localized status names.
- Select a task title or **Locate source block** to open and locate the original SiYuan block.
- Select the target-specific Open button. TickTick, Dida365, and ordinary HTTPS resources open in a new tab; SiYuan links use internal navigation to open the corresponding document or block.
- Select an item's work-category button to reuse the complete task editor with the work category focused.
- Select an item's status badge to reuse the same complete task editor.
- Select an item's Deadline button to edit or clear its deadline directly.
- Right-click anywhere on an item to edit it or delete its task card. A successful Task Center deletion updates the current list immediately, while SiYuan removes the source block from any open source document.
- After saving an edit from the Task Center, its list, filtered results, ordering, and statistics update immediately without a refresh.
- **To progress today** prioritizes overdue and upcoming tasks, with undated tasks placed last.

### 6. Track today's progress

- The Active view is automatically divided into **🌤️ To progress today** and **✨ Today's progress**.
- Today's progress is further divided into **🚀 Advanced** and **🏆 Completed today**, keeping ongoing progress and completed work visible together.
- Every non-terminal status participates, including To do, In progress, Waiting for response, and Blocked. Checking whether a blocker has been resolved can itself count as progress for the day.
- Select **🚀 Progress today** to move a task into the Advanced subsection and update the top progress count.
- Select **✨ Progressed today** to undo an accidental mark and move the task back to To progress today.
- Moving a task from a non-completed status to **✅ Completed** automatically records the local date and retains the card under **🏆 Completed today**. It remains a Closed task and is not counted as Active.
- Failed and Cancelled tasks are not included in Completed today.
- The top numerator combines Advanced and Completed today. Its denominator combines pending tasks with today's progress, so completing every task still produces a motivating `10 / 10`.
- Daily progress keeps the latest date for today's grouping and appends a deduplicated local-date history. It does not complete the task or change its `updated-at` and existing sort order.
- “Today” follows the computer's current system timezone. The view automatically treats yesterday's marks as pending after local midnight and rechecks the date when the SiYuan window regains focus.

### 7. Plan today's focus

1. Select **⭐ Today** or **🌙 Tomorrow** on an active task to schedule or cancel that date quickly.
2. Open the task's **📅 Plan** calendar to select multiple dates across months. New plans cannot use past dates or dates after the deadline.
3. On its focus date, the task appears under **⭐ Today's focus**. Unprogressed focus work carries into later days and is shown as overdue after its deadline until progressed or manually cancelled.
4. Use ↑↓ to arrange multiple focus tasks into an execution order stored on the original task block.
5. Progress moves a focus task into **✨ Today's progress**; undoing today's progress restores it to today's focus.

### 8. View the planning and progress calendar

1. Switch the Tasks section of the Task Center to **Calendar**.
2. Each date shows Planned and Actual. Planned counts only explicit focus dates, so automatic carry-over does not inflate the original plan. Actual counts every task progressed that day.
3. A task counts once per day regardless of repeated interaction. Undoing today's progress removes that day's actual record.
4. Date cells use five heat levels for 0, 1, 2, 3–4, and 5+ actual tasks, making monthly work rhythms easy to scan.

### 9. Build the knowledge document index

1. Open the Task Center and switch to **Knowledge documents**.
2. On first use, select **Initialize knowledge index**. The plugin manually refreshes tasks, then traverses child documents under each task document.
3. A nested task document becomes a new task root. It is not marked as knowledge under its ancestor task, and its own descendants belong to it.
4. The scan writes `custom-task-center-knowledge = true` only to documents absent from the cache, then immediately reads the block attribute back for verification.
5. Later, select **Scan for new knowledge documents** whenever you want to discover recent work. The plugin never polls or scans in the background.
6. Search by knowledge title, path, or source task, and open either the original knowledge document or its task document.

### 10. Review knowledge documents

1. Due today includes available documents that have never been reviewed or whose next-review date has arrived. Select **Start today's review** to process them one at a time.
2. **Random review** draws from available documents not yet shown in the current round, so a document does not repeat within that round.
3. Recall the core content first, open the knowledge document when needed, then choose No impression, Looks familiar, Remembered but not understood, Partially mastered, or Mastered.
4. Remembered but not understood means the content is remembered but was never understood. It enters a separate relearning queue used by the **Relearn** entry point.
5. Initial intervals are 1, 3, 1, 7, and 30 days. Weak feedback resets the interval; repeated partial or full mastery grows it; dropping from Mastered to Partially mastered shortens it.
6. Each response is saved to the knowledge index before the next document appears. A failed save leaves the current document and previous progress unchanged for a safe retry.

## Refresh and synchronization behavior

> [!WARNING]
> **After creating or changing a task outside the Task Center, return to the Task Center and select “Refresh” before the latest result will appear.**
>
> The Task Center does not poll or automatically query ordinary document changes in the background.

| Where the action occurs | Task Center behavior |
| --- | --- |
| Edit a task in the Task Center | The current list updates immediately after saving; no refresh is needed |
| Mark or undo today's progress | The task moves between groups and today's count updates immediately; no refresh is needed |
| Create a task in an ordinary document | It does not appear automatically; select **Refresh** |
| Edit a task in an ordinary document | The Task Center does not change automatically; select **Refresh** |
| Directly change task block attributes | Select **Refresh** |
| Change a task in another client or on another device | Select **Refresh** |
| Open the Task Center for the first time | One query runs automatically |
| Search or change a filter | Only the current list is processed; no SQL query runs |
| Leave the Task Center idle | No background query runs |
| Switch to Knowledge documents | Show the last cache only; do not scan the document tree |
| Select Scan for new knowledge documents | Refresh tasks, then manually scan task subdocuments |

The **Refresh** button is not merely an error-recovery button. It is the explicit entry point for synchronizing changes made outside the Task Center.

If Refresh is selected immediately after an edit or daily-progress update inside the Task Center, the SiYuan SQL index may temporarily return the older value. The plugin keeps the recent edit or progress result in the current Task Center tab so that the UI does not fall back to an older title, URL, status, deadline, or progress group. The temporary overlay is cleared when SQL returns the corresponding data or when the task is no longer valid. It never replaces the task block attributes, is not persisted across tabs, and is not a second task database.

## Data model and privacy

- One ordinary SiYuan block corresponds to one local task card and its target link.
- The original SiYuan task block is the only persistent source of task data.
- The Task Center is a dynamic view and does not persist a second task list.
- Ordinary Markdown keeps the task title and link as fallback content while the plugin is disabled or unavailable.
- The plugin does not require a target-service login, use OAuth, or call a target-service API.
- It does not upload or synchronize task data to linked services in the background. A target opens only when selected by the user.

The seven required structured attributes are:

```text
custom-ticktick-card
custom-ticktick-version
custom-ticktick-title
custom-ticktick-url
custom-ticktick-status
custom-ticktick-created-at
custom-ticktick-updated-at
```

Daily progress uses a compatible latest-date attribute plus a versioned history attribute:

```text
custom-ticktick-last-progressed-date = YYYY-MM-DD
custom-ticktick-progress-log = {"version":1,"dates":["YYYY-MM-DD", ...]}
```

Focus planning uses another versioned optional attribute:

```text
custom-ticktick-focus-plan = {"version":1,"entries":[...]}
```

The deadline uses another optional attribute:

```text
custom-ticktick-deadline = YYYY-MM-DD
```

The work category stores a stable category ID in another optional attribute:

```text
custom-ticktick-work-mode = explore | build | execute | review
```

The `custom-ticktick-*` attribute names are retained as legacy internal identifiers for backward compatibility. They do not limit the supported target-link types, and existing task cards require no data migration.

Knowledge documents use a neutral attribute unrelated to the legacy TickTick namespace:

```text
custom-task-center-knowledge = true
```

The plugin also stores a rebuildable knowledge-index cache for fast list loading and review count, feedback, interval, and next-review time. It contains no document content and never replaces SiYuan documents or block attributes.

Older tasks require no migration when these optional attributes are absent. A missing daily-progress date is treated as pending today; a missing focus plan does not enter Today's focus; a missing deadline is displayed as “No deadline” and sorted after dated tasks; a missing work category is displayed as “未分类-Unclassified”. The first new progress action on an older task carries its currently stored latest date into history, but dates already overwritten before v0.4.0 cannot be reconstructed. The plugin compares stored dates with the system-local date instead of rewriting every task block at midnight.

## Task Center query

The Task Center executes one global SQL query when it loads or is manually refreshed. Conditional aggregation converts the seven required task attributes and the optional work-category, daily-progress, focus-plan, and deadline attributes into one row per task. This avoids the older “one row per attribute” shape producing a partially read task at SiYuan's SQL result-count limit.

The query is still subject to SiYuan's global SQL result-count limit, and pagination is not currently implemented. Search and filters operate only on the validated results already loaded in memory and do not execute additional SQL queries.

## Known limitations

- Changes from ordinary documents, other tabs, or other clients are not pushed automatically to the Task Center; use manual Refresh.
- Knowledge documents are not watched, polled, or scanned automatically. After a task subtree changes, manually select **Scan for new knowledge documents**.
- No target-service API, OAuth, or two-way synchronization.
- No batch operations or batch status changes.
- No pagination or virtual scrolling; the Task Center is subject to SiYuan's SQL result-count limit.
- No settings page.
- Progress dates overwritten before v0.4.0 cannot be reconstructed. The current calendar does not provide streaks or a click-through task list for a date.
- The daily date follows the current system timezone. When traveling across timezones, tasks are reevaluated using the local date at the current location.
- Deadlines are local SiYuan metadata. The plugin does not read or synchronize deadlines from linked services and does not issue system notifications.
- Work categories are local SiYuan metadata and do not automatically create or synchronize tags in linked services.
- HarmonyOS native-mobile support has passed basic core-workflow verification on a Huawei tablet running HarmonyOS 6, but remains experimental. Android, iOS, and browser-based mobile clients have not been verified.
- Cross-app links on mobile depend on the operating system, browser, and target app. TickTick / Dida365 links may open on the web first, and `siyuan://blocks/...` links in external apps may not launch SiYuan and locate the block directly.

## Development and verification

```bash
pnpm install
pnpm dev
pnpm test
pnpm run check
pnpm build
pnpm run make-install
```

- `pnpm dev`: starts the long-running development watch build.
- `pnpm test`: runs the Vitest test suite.
- `pnpm run check`: runs Svelte / TypeScript static checks.
- `pnpm build`: creates the production bundle, `dist/`, and `package.zip` in the repository root.
- `pnpm run make-install`: creates a production build and automatically copies `dist/` into the selected SiYuan workspace plugin directory; reload the plugin afterward.

Repository-wide development constraints live in [AGENTS.md](AGENTS.md). The project skill discovered by DeepSeek Harness and Codex lives in [.agents/skills/task-center-development](.agents/skills/task-center-development). Together they define SiYuan API read/write boundaries, test selection, package verification, local automatic installation, and the GitHub Actions release workflow.

The current verification suite contains 37 test files and 335 tests.

## License

This project is licensed under the [MIT License](LICENSE).
