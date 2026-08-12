English | [简体中文](README.md)

# TickTick Task Center for SiYuan

<p align="center">
  <img src="icon.png" width="96" height="96" alt="TickTick Task Center plugin icon">
</p>

> [!IMPORTANT]
> **All source code, tests, and documentation in this project were created entirely with OpenAI GPT and Codex.**
>
> Project requirements, feature decisions, real-world SiYuan testing, acceptance, and release decisions were handled by Yong Sheng.

TickTick Task Center for SiYuan is a SiYuan plugin that associates ordinary SiYuan document blocks with TickTick / Dida365 tasks. The task block in the source document is the only persistent source of data. The plugin adds enhanced task cards, seven local statuses, deadline reminders, daily progress tracking, and a workspace-wide task center without maintaining a second task database.

The current version does not use the TickTick API, OAuth, or background synchronization. A task is associated with TickTick / Dida365 only through the HTTPS task URL supplied by the user.

**This is an unofficial community-developed plugin and is not affiliated with TickTick, Dida365 (滴答清单), or SiYuan.**

## Core features

- Create a TickTick task block from the slash menu in an editable SiYuan document. The default status is `in-progress`, and the new block is inserted at the top of the current root document.
- Store the task title, a validated TickTick URL, seven required attributes, and optional deadline and daily-progress date attributes in one ordinary SiYuan block.
- Keep ordinary Markdown containing the title and link in the source block, so the task remains readable and clickable while the plugin is disabled.
- Non-destructively enhance the block as a task card with a task link, an original checklist icon, a semantically colored status badge, and a Deadline button.
- Open the complete editor from either the status badge or Deadline button to change the title, URL, status, or deadline.
- Show the deadline as remaining days, an eight-segment urgency track, and the calendar date. An undated task keeps the same track layout and a clear setup entry point.
- Keep the track empty outside the seven-day window, then fill one segment per day from seven days remaining. Due-today and overdue tasks use a full track.
- Apply theme-adaptive low-saturation emphasis to active tasks inside the seven-day window, with warning emphasis for due-today tasks and error emphasis for overdue tasks while preserving readable theme contrast.
- Preserve `created-at` and update `updated-at` only when task data actually changes.
- Check `updated-at` for edit conflicts before saving, and attempt to roll back Markdown when a title or URL double-write fails.
- Open a singleton Task Center tab from the SiYuan top bar and dynamically aggregate valid tasks across the workspace.
- Filter Active, Closed, or All tasks and search task titles, source documents, source paths, and localized status names.
- Display All, Active, Closed, and today's progress statistics. Ordinary lists use a stable descending sort based on the task attribute `updated-at`.
- Show **🌤️ To progress today** and **✨ Today's progress** in the Active view. Today's progress is further divided into **🚀 Advanced** and **🏆 Completed today**.
- Force **To progress today** into deadline order: overdue and nearer deadlines first, undated tasks last, then descending update time when deadlines match.
- To do, In progress, Waiting for response, and Blocked tasks all participate in daily progress. Moving a task to Completed automatically records it as progress for the day.
- Use **🚀 Progress today** and **✨ Progressed today** to mark or undo today's record without changing the task status or its existing `updated-at`.
- Determine “today” from the system's local timezone and regroup automatically after local midnight without a background attribute-reset job.
- Locate the original SiYuan task block and safely open the corresponding TickTick task URL in a new tab.
- Immediately update the current list, filtered results, ordering, and statistics after an edit made inside the Task Center.
- Read changes made in ordinary documents or other clients when the user presses **Refresh** in the Task Center.

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

## Development status and changelog

> [!NOTE]
> This project does not yet have a GitHub Release and is not listed in the SiYuan Marketplace. The current `0.1.0` is the planned first version number; it does not mean that the version has been formally released.

### 0.1.0 (in development, unreleased)

- Implement task-card creation and editing, seven local statuses, deadlines, and daily progress tracking.
- Implement the workspace-wide Task Center, filtering and search, source navigation, task editing, and manual refresh.
- Keep SiYuan block attributes as the only data source, with input validation, edit-conflict detection, and Markdown rollback.
- Support light and dark themes, Chinese and English interfaces, and a dedicated plugin icon.
- Declare experimental HarmonyOS native-mobile support after basic verification of the core workflow on a Huawei tablet running HarmonyOS 6.

See [CHANGELOG.en.md](CHANGELOG.en.md) for the complete itemized development record. When the version is formally published, its release date and corresponding Git tag and GitHub Release will be added.

## Installation

### Installation for users

The plugin is not currently listed in the SiYuan Marketplace, and this repository does not yet have a downloadable GitHub Release for end users.

Published builds will be provided through [GitHub Releases](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/releases). Before the first Release, use the development installation below. Do not treat GitHub's automatically generated Source code archives as SiYuan plugin packages.

### Development installation

The development environment follows the project CI configuration: Node.js 20, pnpm 11.7.0, and SiYuan Desktop 3.7.0 or later. Development and real-world acceptance currently focus on SiYuan Desktop for macOS. The core workflow has also received basic verification on a Huawei tablet running HarmonyOS 6, but HarmonyOS native-mobile support remains experimental. Android, iOS, and browser-based mobile clients have not been verified.

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
3. Search for and select **TickTick task card** (shown as “滴答任务卡片” in Chinese).
4. Confirm or edit the task title. The plugin attempts to use the current root document title as the initial value.
5. Paste a valid TickTick / Dida365 HTTPS URL. The hostname must be exactly `ticktick.com` or `dida365.com`.
6. Select a task status. The default is `in-progress` (▶️ In progress).
7. Optionally set a deadline. It can be left empty, added later, or cleared.
8. Select **Create**.
9. The task is inserted as the first child block of the current root document—below the document title and before the existing body—and is immediately enhanced as a task card.

### 2. Edit a task in a document

- Select the status badge on the right side of the task card to open the complete editor with the status field focused.
- Select the rightmost Deadline button to open the same editor with the deadline field focused.
- Change the task title, TickTick URL, status, or deadline, then save.
- The card in the current document updates immediately after a successful save.
- When the title or URL changes, the fallback Markdown is updated as well.
- Status is not written to Markdown; its stable ID is stored in structured attributes.
- `created-at` stays unchanged, and a new `updated-at` is generated only for an actual edit.

### 3. Use deadline reminders

- A deadline is a local calendar date without a time of day. Display and calculations follow the computer's current timezone.
- The first button row shows “N days left,” “Due today,” “N days overdue,” or “No deadline.” The second row always contains eight track segments, and the third row shows the date or setup action.
- The track remains low-contrast and empty when more than seven days remain or no deadline is configured.
- The first segment fills at seven days remaining, then one more segment fills each day. One day remaining shows seven filled segments; due-today and overdue tasks show all eight.
- Deadlines are stored only in SiYuan task-block attributes. They are not written to TickTick and do not create system notifications or background reminders.

### 4. Open the Task Center

- Select the TickTick Task Center button in the SiYuan top bar.
- The Task Center opens as an independent custom tab.
- Only one Task Center tab exists at a time. Selecting the top-bar button again focuses the existing tab instead of creating another one.
- The workspace is queried once when the tab first opens.

### 5. Use the Task Center

- View counts for All, Active, Closed, and today's progress.
- Switch between the Active, Closed, and All tasks filters.
- Search task titles, source document titles, source paths, or localized status names.
- Select a task title or **Locate source block** to open and locate the original SiYuan block.
- Select **Open TickTick task** to open the validated external task URL in a new tab.
- Select an item's status badge to reuse the same complete task editor.
- Select an item's Deadline button to edit or clear its deadline directly.
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
- Daily progress stores only the latest progressed date. It does not complete the task or change its `updated-at` and existing sort order.
- “Today” follows the computer's current system timezone. The view automatically treats yesterday's marks as pending after local midnight and rechecks the date when the SiYuan window regains focus.

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

The **Refresh** button is not merely an error-recovery button. It is the explicit entry point for synchronizing changes made outside the Task Center.

If Refresh is selected immediately after an edit or daily-progress update inside the Task Center, the SiYuan SQL index may temporarily return the older value. The plugin keeps the recent edit or progress result in the current Task Center tab so that the UI does not fall back to an older title, URL, status, deadline, or progress group. The temporary overlay is cleared when SQL returns the corresponding data or when the task is no longer valid. It never replaces the task block attributes, is not persisted across tabs, and is not a second task database.

## Data model and privacy

- One ordinary SiYuan block corresponds to one TickTick task.
- The original SiYuan task block is the only persistent source of task data.
- The Task Center is a dynamic view and does not persist a second task list.
- Ordinary Markdown keeps the task title and link as fallback content while the plugin is disabled or unavailable.
- The plugin does not require a TickTick login, use OAuth, or call the TickTick API.
- It does not upload or synchronize task data to TickTick in the background. External links open only when selected by the user.

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

Daily progress uses one optional attribute:

```text
custom-ticktick-last-progressed-date = YYYY-MM-DD
```

The deadline uses another optional attribute:

```text
custom-ticktick-deadline = YYYY-MM-DD
```

Older tasks require no migration when either optional attribute is absent. A missing daily-progress date is treated as pending today; a missing deadline is displayed as “No deadline” and sorted after dated tasks. The plugin compares stored dates with the system-local date instead of rewriting every task block at midnight.

## Task Center query

The Task Center executes one global SQL query when it loads or is manually refreshed. Conditional aggregation converts the seven required task attributes and the optional daily-progress and deadline attributes into one row per task. This avoids the older “one row per attribute” shape producing a partially read task at SiYuan's SQL result-count limit.

The query is still subject to SiYuan's global SQL result-count limit, and pagination is not currently implemented. Search and filters operate only on the validated results already loaded in memory and do not execute additional SQL queries.

## Known limitations

- Changes from ordinary documents, other tabs, or other clients are not pushed automatically to the Task Center; use manual Refresh.
- No TickTick API, OAuth, or two-way synchronization.
- No task deletion from the plugin.
- No batch operations or batch status changes.
- No task context menu.
- No pagination or virtual scrolling; the Task Center is subject to SiYuan's SQL result-count limit.
- No settings page.
- Daily progress stores only the latest date; there is no history, streak, or trend reporting.
- The daily date follows the current system timezone. When traveling across timezones, tasks are reevaluated using the local date at the current location.
- Deadlines are local SiYuan metadata. The plugin does not read or synchronize existing TickTick deadlines and does not issue system notifications.
- HarmonyOS native-mobile support has passed basic core-workflow verification on a Huawei tablet running HarmonyOS 6, but remains experimental. Android, iOS, and browser-based mobile clients have not been verified.
- Cross-app links on mobile depend on the operating system, browser, and target app. TickTick / Dida365 links may open on the web first, and `siyuan://blocks/...` links in external apps may not launch SiYuan and locate the block directly.

## Development and verification

```bash
pnpm install
pnpm dev
pnpm test
pnpm run check
pnpm build
```

- `pnpm dev`: starts the long-running development watch build.
- `pnpm test`: runs the Vitest test suite.
- `pnpm run check`: runs Svelte / TypeScript static checks.
- `pnpm build`: creates the production bundle, `dist/`, and `package.zip` in the repository root.

The current verification suite contains 22 test files and 218 tests.

## License

This project is licensed under the [MIT License](LICENSE).
