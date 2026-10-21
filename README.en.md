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
- Store the task title, six required attributes, and optional link, work-category, deadline, focus-plan, and progress-history attributes in one ordinary SiYuan block.
- Keep ordinary Markdown containing the title and link in the source block, so the task remains readable and clickable while the plugin is disabled.
- Non-destructively enhance the block as a task card with an original checklist icon that opens the Task Center, a task link, a work-category button, a semantically colored status badge, and a Deadline button. The work category is stacked above the status.
- Task cards also show a **task weight badge** and a **🚀 Progress today** button: the weight sits below the work category and status, the progress button below the Deadline control. Clicking the weight opens a three-level menu; the progress button records or undoes today's progress.
- Open the complete editor from the work-category, status, or Deadline button to change the title, URL, work category, status, or deadline. Work categories and statuses are both selected from directly visible button groups.
- Right-click anywhere on a document task card or Task Center item to edit it or delete its SiYuan task card after confirmation. Deletion never affects the linked task, document, or resource.
- Show the deadline as remaining days, an eight-segment urgency track, and the calendar date. An undated task keeps the same track layout and a clear setup entry point.
- Keep the track empty outside the seven-day window, then fill one segment per day from seven days remaining. Due-today and overdue tasks use a full track.
- Apply theme-adaptive low-saturation emphasis to active tasks inside the seven-day window, with warning emphasis for due-today tasks and error emphasis for overdue tasks while preserving readable theme contrast.
- Stop deadline and overdue-focus calculations for Completed, Failed, and Cancelled tasks. The Deadline control keeps its original date and edit action while showing Closed.
- Preserve `created-at` and update `updated-at` only when task data actually changes.
- Check `updated-at` for edit conflicts before saving, and attempt to roll back Markdown when a title or URL double-write fails.
- Add an **Inbox** tab to the Task Center for capturing notes as a Title plus an optional Body. Enter in the title saves; Enter in the body inserts a newline and ⌘/Ctrl + Enter saves.
- A note is **not a task**: it stores only text, a tier, and a creation time, carries no status, deadline, work category, focus plan, or link, and never creates, modifies, or hides any document or notebook.
- Notes come in two tiers, ⚡ Quick errand and 🔬 Formal task. A quick errand can be finished in place and moves into ✓ Done today; a formal task can only be moved to the task list.
- Each note renders as a bold title plus a collapsed body. A body longer than two lines can be expanded and is rendered as basic Markdown: paragraphs, bold, italic, inline code, links, unordered lists, and quotes.
- Every pending note can be edited: change its title, body, and tier while keeping the original recorded time, id, and order. Editing never creates a task or writes to SiYuan notes.
- The edit dialog renders a live Markdown preview below the body, sharing the same renderer as the Inbox list. The preview is read-only and collapsible, refreshes 250 ms after typing stops, and keeps the original Markdown when saving.
- The Inbox capture form also has Show preview / Hide preview next to the Body field: expanding it renders Markdown full width below the body and starts collapsed. It is read-only, scrolls internally, and collapses after a successful save without changing note data or the saved Markdown.
- Move to task list creates a new task document and writes the task block into it: the task title comes from the note title and the note body is written into the same document. The order is fixed as create task block → write body → delete note, and any failure keeps the note.
- Add a Quick capture button to the SiYuan top bar that opens a small dialog from anywhere; Save and continue is meant for capturing several notes in a row.
- Inbox data lives in a plugin data file with three rotating backups and a field-by-field read-back after every write. Nothing appears in the document tree.
- Open a singleton Task Center tab from the SiYuan top bar and dynamically aggregate valid tasks across the workspace.
- Add a Knowledge documents section to the Task Center. A manual scan discovers child documents under task documents and writes and verifies `custom-task-center-knowledge = true` only for newly discovered documents.
- Load the Knowledge section from a rebuildable cache without scanning, polling, or live listening. The document tree is read only when the user selects Initialize knowledge index or Scan knowledge documents.
- Mark knowledge documents as Not organized or Organized with one click and undo; the organizing time lives in the document's block attributes, and legacy review data is not migrated.
- An organized document edited later still counts as organized but shows Updated after organizing and is counted in the summary; filter to them in one click and select Mark re-organized to refresh the organizing time after catching up.
- Use Chinese by default on first launch, with a persistent Chinese/English switch to the left of Refresh in the Task Center.
- Filter Active, Closed, or All tasks and search task titles, source documents, source paths, and localized status names.
- Display All, Active, Closed, and today's progress statistics. Ordinary lists use a stable descending sort based on the task attribute `updated-at`.
- Show **🌤️ To progress today** and **✨ Today's progress** in the Active view. Today's progress is further divided into **🚀 Advanced** and **🏆 Completed today**.
- Show **⭐ Today's focus** above pending work. Schedule today or tomorrow quickly, or select multiple focus dates from a task calendar; unfinished focus work carries forward, and focus dates are no longer constrained by the deadline.
- Persist the execution order of today's focus with up/down controls; progress moves an item into Today's progress, while undo restores it to today's focus.
- Switch between the task list and a monthly calendar that shows daily planned and actual counts with five theme-adaptive progress heat levels.
- Split task weight into **🔥 Must advance / ➖ Normal / ☕ When free**, stored in the optional attribute `custom-ticktick-priority`. An absent value means the normal level, so older tasks need no migration.
- Sort **To progress today** by **weight → deadline → update time**: higher weight first, nearer deadlines first within the same weight, undated tasks last in their weight band.
- The **All tasks** view does not use weight ordering and keeps the stable descending `updated-at` sort.
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

The task link is **optional**: a task can be created and saved without one, and the card then shows the title as plain text. Existing tasks need no migration.

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
> `v0.8.0` was published on 2026-10-21. The project is not yet listed in the SiYuan Marketplace.

### 0.8.0 (2026-10-21)

- Add Not organized / Organized marks to knowledge documents, showing only Not organized by default; the organizing time lives in block attributes and can be undone at any time.
- An organized document edited later shows Updated after organizing, can be filtered and sorted first, and Mark re-organized refreshes its organizing time.
- Remove the knowledge review entry points, five-level feedback, and review progress; legacy review data is ignored, not migrated.
- Add a live Markdown preview to the Inbox quick-capture body without changing the saved format or data.

### 0.7.0 (2026-10-19)

- Add note editing for title, body, and tier. Editing keeps the original recorded time, id, and order; it never creates a task or writes to SiYuan notes, and a failed save leaves the dialog open with the input intact.
- Render a live Markdown preview below the body in the edit dialog, using the same renderer as the Inbox list. The preview is read-only and collapsible, refreshes 250 ms after typing stops, shows a hint for an empty body, and scrolls long bodies internally.
- The preview only affects display: saving still stores the original Markdown. It adds no fields, performs no separate writes, and makes no network requests.

### 0.6.0 (2026-10-18)

- Add the optional task weight attribute `custom-ticktick-priority` with three levels: 🔥 Must advance / ➖ Normal / ☕ When free. An absent value means normal, so older tasks need no migration.
- Sort To progress today by weight → deadline → update time; the All tasks view still sorts by update time.
- Add a 🚀 Progress today button and a weight badge to in-document task cards, sharing the same attributes and write path as the Task Center.
- Focus dates are no longer constrained by the deadline: the calendar is not greyed out, Today/Tomorrow are not disabled, and moving a deadline before a focus date no longer fails.
- Split the Task Center action area into a planning row and an execution row, with optional controls at the row start so buttons stay vertically aligned across cards.

### 0.5.0 (2026-10-14)

- Add the Inbox tab for capturing notes as a title plus an optional body. Notes carry no task fields and are never written into or hidden from the document tree.
- Notes come in two tiers, quick errand and formal task. Moving a note to the task list creates a task document, takes the note title as the task title, writes the body into the same document, and then deletes the note.
- Add a Quick capture button to the SiYuan top bar that opens a small dialog from anywhere, with Save and continue for capturing several notes in a row.
- The task link is now optional: tasks can be created without one, and existing tasks need no migration.

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

See [CHANGELOG.en.md](CHANGELOG.en.md) for the complete itemized development record and the [v0.8.0 GitHub Release](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/releases/tag/v0.8.0) for the installable package.

## Installation

### Installation for users

The plugin is not currently listed in the SiYuan Marketplace, but it can be installed manually from GitHub Releases.

Download `package.zip` from the [v0.8.0 release page](https://github.com/Yong2Sheng/siyuan-plugin-ticktick-task-center/releases/tag/v0.8.0). Do not treat GitHub's automatically generated Source code archives as SiYuan plugin packages; developers can still use the development installation below.

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
- Completed, Failed, and Cancelled tasks stop deadline-urgency and overdue-focus calculations. Their original deadline remains visible and editable with a Closed label.
- Deadlines are stored only in SiYuan task-block attributes. They are not written to the linked target and do not create system notifications or background reminders.

### 4. Capture a note into the Inbox

1. Open the Task Center and switch to the Inbox tab, or select the ⚡ button in the SiYuan top bar to capture from the Quick capture dialog.
2. Write what needs doing in Title. Press Enter in the title field to save.
3. Body is optional: use it for background, context, or a pasted email. Enter inserts a newline; ⌘/Ctrl + Enter saves. The Body field also has Show preview; expanding it shows the Markdown result and starts collapsed.
4. Choose ⚡ Quick errand or 🔬 Formal task. The last choice is reused by default.
5. Captured notes appear under Open with a bold title and a collapsed body. A body longer than two lines can be expanded and is rendered as basic Markdown.

### 5. Process the Inbox

- A ⚡ Quick errand can be finished in place with ✓ Done and moves into ✓ Done today. A 🔬 Formal task has no complete button and can only be moved to the task list.
- Select Edit to open the note dialog: title, body, and tier are editable, with a live Markdown preview under the body that can be hidden. Saving updates the list in place and keeps the recorded time and order.
- Use Make it a formal task or Make it a quick errand to change the tier at any time.
- Select → To task list to turn a note into a real task: first choose where the new task document goes (select a notebook to create it at the notebook root, select a document to create it underneath; the triangle only expands and collapses), then confirm the document name, then fill in status, work category, deadline, and task link.
- Moving always runs create task block → write body → delete note. The task title comes from the note title and the note body is written into the newly created task document. Any failure keeps the note; nothing is dropped silently.
- You can also create a task card inside a document with `/` and bring a note in from the Inbox: the task and the note body are both written into the current document.
- ✓ Done today shows today's records only and prunes them after 7 days.

### 6. Open the Task Center

- Select the checklist icon on the left side of any document task card, or select the SiYuan Task Center button in the SiYuan top bar.
- The Task Center opens as an independent custom tab.
- Only one Task Center tab exists at a time. Selecting either entry again focuses the existing tab instead of creating another one.
- The workspace is queried once when the tab first opens.

### 7. Use the Task Center

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
- **To progress today** is sorted automatically by **weight → deadline → update time**: higher weight first, nearer deadlines first within the same weight, undated tasks last in their weight band. Pending work has no manual ordering.

### 8. Track today's progress

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

### 9. Plan today's focus

1. Select **⭐ Today** or **🌙 Tomorrow** on an active task to schedule or cancel that date quickly.
2. Open the task's **📅 Plan** calendar to select multiple dates across months. Only past dates are rejected; the deadline no longer constrains focus dates.
3. On its focus date, the task appears under **⭐ Today's focus**. Unprogressed focus work carries into later days and is shown as overdue after its deadline until progressed or manually cancelled.
4. Use ↑↓ to arrange multiple focus tasks into an execution order stored on the original task block.
5. Progress moves a focus task into **✨ Today's progress**; undoing today's progress restores it to today's focus.

### 10. View the planning and progress calendar

1. Switch the Tasks section of the Task Center to **Calendar**.
2. Each date shows Planned and Actual. Planned counts only explicit focus dates, so automatic carry-over does not inflate the original plan. Actual counts every task progressed that day.
3. A task counts once per day regardless of repeated interaction. Undoing today's progress removes that day's actual record.
4. Date cells use five heat levels for 0, 1, 2, 3–4, and 5+ actual tasks, making monthly work rhythms easy to scan.

### 11. Build the knowledge document index

1. Open the Task Center and switch to **Knowledge documents**.
2. On first use, select **Initialize knowledge index**. The plugin manually refreshes tasks, then traverses child documents under each task document.
3. A nested task document becomes a new task root. It is not marked as knowledge under its ancestor task, and its own descendants belong to it.
4. The scan writes `custom-task-center-knowledge = true` only to documents absent from the cache, then immediately reads the block attribute back for verification.
5. Later, select **Scan knowledge documents** whenever you want to discover new documents or refresh **Updated after organizing**. The plugin never polls or scans in the background.
6. The scan also batches organizing marks (`custom-task-center-knowledge-organized-at`) to refresh the organizing state and the updated check. It never reads or rewrites document content.
7. Search by knowledge title, path, or source task, and open either the original knowledge document or its task document.

### 12. Organize knowledge documents

1. The Knowledge section defaults to **Not organized**, which lists available knowledge documents without a mark. After organizing one, select **Mark as organized**.
2. Marking writes the organizing time to `custom-task-center-knowledge-organized` and `custom-task-center-knowledge-organized-at` on the knowledge document, then reads it back for verification. Select **Undo organized mark** to clear it.
3. An organized document that is edited later still counts as organized, but shows **Updated after organizing**. The summary counts these documents separately, the **Updated after organizing** filter lists only them, and the Organized view puts them first.
4. After folding the new content into the organized documents, select **Mark re-organized** to refresh the organizing time; the hint clears and the document does not return to Not organized.
5. The updated state is based on document timestamps from the last scan. After editing a knowledge document, select **Scan knowledge documents** to refresh it; the plugin does not scan automatically or poll.
6. Marking writes only attributes on that document and the rebuildable index cache; it never moves, rewrites, or copies knowledge content.

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
| Capture, edit, complete, re-tier, or delete a note in the Inbox | The current list updates immediately; no refresh needed |
| Open the Quick capture dialog | Reads the plugin data file once first |
| Switch to the Inbox | Reads the plugin data file once |
| Switch to Knowledge documents | Show the last cache only; do not scan the document tree |
| Select Scan knowledge documents | Refresh tasks, scan task subdocuments, and refresh organizing marks |

The **Refresh** button is not merely an error-recovery button. It is the explicit entry point for synchronizing changes made outside the Task Center.

If Refresh is selected immediately after an edit or daily-progress update inside the Task Center, the SiYuan SQL index may temporarily return the older value. The plugin keeps the recent edit or progress result in the current Task Center tab so that the UI does not fall back to an older title, URL, status, deadline, or progress group. The temporary overlay is cleared when SQL returns the corresponding data or when the task is no longer valid. It never replaces the task block attributes, is not persisted across tabs, and is not a second task database.

## Data model and privacy

- One ordinary SiYuan block corresponds to one local task card and its target link.
- The original SiYuan task block is the only persistent source of task data.
- The Task Center is a dynamic view and does not persist a second task list.
- Ordinary Markdown keeps the task title and link as fallback content while the plugin is disabled or unavailable.
- The plugin does not require a target-service login, use OAuth, or call a target-service API.
- It does not upload or synchronize task data to linked services in the background. A target opens only when selected by the user.

### Inbox

An inbox note is **not a task**; it is a note captured before a task exists. It contains only text, a tier, and a creation time, and carries no status, deadline, work category, focus plan, or task link.

- Notes are stored in the plugin data file `inbox.json`, with rotating copies `inbox.backup-1.json`, `inbox.backup-2.json`, and `inbox.backup-3.json` in the same directory. Every write is read back and verified field by field.
- The Inbox never creates, modifies, or hides a document or notebook, so nothing appears in the document tree.
- A note becomes a real task block only when it is moved to the task list, and it is deleted from the plugin data at the same time. There is no intermediate state where something is both a note and a task.
- Editing a note changes only the text and tier in the plugin data file. The preview is read-only, never participates in saving, and does not change the note data structure.
- The capture form can preview the body too: the entry sits immediately to the right of the visible “Body (optional)” text (「正文（可选）」 in Chinese) and starts collapsed. It shares the renderer and typography with the list and edit dialog and collapses after a successful save without changing the note data structure.
- Completing a note only means the note has been dealt with; it never counts toward task statistics.
- A write is refused unless the data file has been read successfully first, so an empty in-memory state can never overwrite existing notes.

The six required structured attributes are:

```text
custom-ticktick-card
custom-ticktick-version
custom-ticktick-title
custom-ticktick-status
custom-ticktick-created-at
custom-ticktick-updated-at
```

The task link is an optional attribute; a task is equally valid without it:

```text
custom-ticktick-url = https://... | siyuan://blocks/<block ID>
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
custom-task-center-knowledge-organized = true
custom-task-center-knowledge-organized-at = YYYY-MM-DDTHH:mm:ss.sssZ
```

**Updated after organizing** is not stored separately: a scan compares the document's update time with `custom-task-center-knowledge-organized-at`, and a document edited after it was organized counts as updated. The plugin also stores a rebuildable knowledge-index cache for fast list loading; it contains no document content and never replaces SiYuan documents or block attributes.

Older tasks require no migration when these optional attributes are absent. A missing daily-progress date is treated as pending today; a missing focus plan does not enter Today's focus; a missing deadline is displayed as “No deadline” and sorted after dated tasks; a missing work category is displayed as “未分类-Unclassified”. The first new progress action on an older task carries its currently stored latest date into history, but dates already overwritten before v0.4.0 cannot be reconstructed. The plugin compares stored dates with the system-local date instead of rewriting every task block at midnight.

## Task Center query

The Task Center executes one global SQL query when it loads or is manually refreshed. Conditional aggregation converts the six required task attributes and the optional link, work-category, daily-progress, focus-plan, and deadline attributes into one row per task. This avoids the older “one row per attribute” shape producing a partially read task at SiYuan's SQL result-count limit.

The query is still subject to SiYuan's global SQL result-count limit, and pagination is not currently implemented. Search and filters operate only on the validated results already loaded in memory and do not execute additional SQL queries.

## Known limitations

- Changes from ordinary documents, other tabs, or other clients are not pushed automatically to the Task Center; use manual Refresh.
- Knowledge documents are not watched, polled, or scanned automatically. After a task subtree or knowledge document changes, manually select **Scan knowledge documents**; Updated after organizing also refreshes only during a scan.
- No target-service API, OAuth, or two-way synchronization.
- No batch operations or batch status changes.
- No pagination or virtual scrolling; the Task Center is subject to SiYuan's SQL result-count limit.
- No settings page.
- The Inbox holds at most 5000 notes, and a single note is limited to 2000 characters.
- The Inbox shows today's completed records only and prunes them after 7 days; there is no full-text search across notes.
- Note bodies support basic Markdown only (paragraphs, bold, italic, inline code, links, unordered lists, and quotes). Tables, code blocks, images, and ordered lists are not supported.
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

For user-visible UI changes, present a reviewable design first and obtain explicit user approval before changing UI code. See [AGENTS.md](AGENTS.md) for the scope and design requirements. Temporary design drafts belong in the untracked `design/` directory.

The current verification suite contains 49 test files and 505 tests.

## License

This project is licensed under the [MIT License](LICENSE).
