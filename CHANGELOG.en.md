English | [简体中文](CHANGELOG.md)

# Changelog

## 0.6.0 - 2026-10-18

### Task weight (the second dimension of the active list)

- Add the optional attribute `custom-ticktick-priority` with `high` / `normal` / `low`, shown as 🔥 Must advance, ➖ Normal, and ☕ When free.
- Tasks without a weight — including every task created before this field existed — are treated as the normal level, so no migration is needed. That level sorts identically to "unset", so saving it clears the attribute instead of writing `"normal"`.
- **🌤️ To progress today** now sorts by **weight → deadline → update time**: higher weight first, nearer deadlines first within the same weight, and undated tasks last in their weight band.
- The **All tasks** view does not use weight ordering and keeps the descending `updated-at` sort.
- Both the Task Center and in-document task cards show a weight badge; clicking it opens a three-level menu. An unset weight is shown as "➖ Set weight".
- Every write is verified by re-reading the attribute. An unrecognized weight is skipped as an invalid attribute, exactly like other invalid attributes, instead of silently falling back to a level.

### In-document task cards

- Add a **🚀 Progress today** button that records today's progress and undoes it on a second click. After the write, only that card is rebuilt.
- Daily progress reuses the same attributes and the same write path as the Task Center, so the two surfaces never keep separate records.
- Add a weight badge that shares the same read/write path as the Task Center.
- When a task has no target link, its title now really looks like plain text: the frame stays, but horizontal padding is restored, so text no longer touches the border and the frame no longer appears only on hover.

### Focus dates decoupled from the deadline

- Focus dates are no longer constrained by the deadline: dates after the deadline are no longer greyed out in the calendar, and the Today/Tomorrow shortcuts are no longer disabled.
- Moving a deadline before an existing focus date no longer fails; the `after-deadline` rejection reason and its message are removed.
- A self-imposed soft deadline is no longer treated as a hard constraint: weight expresses importance, the deadline expresses time.

### Layout

- The Task Center card keeps the Deadline control as a standalone 104px control with unchanged size and shape; work category, status, and weight stack vertically next to it.
- The Task Center action area is split into two rows: planning controls (↑↓ / 📅 Plan / ⭐ Today / 🌙 Tomorrow) on top, execution controls (open task link / 🚀 Progress today / Locate) below.
- Optional controls are placed at the left edge of their row (↑↓ and the open-link control), so adding or removing one only extends the row to the left and the right-hand buttons keep their horizontal position, which keeps cards vertically aligned.
- In-document cards place the progress button below the Deadline control and use a grid container so the Deadline control is not stretched by a column flex context.

### Compatibility

- Published attribute names and meanings are unchanged; the new attribute is optional and defaults to the normal level, so existing tasks need no migration.
- The data structure and meaning of `custom-ticktick-focus-plan` are unchanged; this release only drops the "a focus date cannot be later than the deadline" restriction, so existing data stays valid.

## 0.5.0 - 2026-10-14

### Inbox

- Add an Inbox tab to the Task Center for capturing notes as a title plus an optional body. Enter in the title saves; Enter in the body inserts a newline and ⌘/Ctrl + Enter saves.
- A note is not a task: it stores only text, a tier, and a creation time, carries no status, deadline, work category, focus plan, or link, and never creates, modifies, or hides a document or notebook.
- Notes come in two tiers, ⚡ Quick errand and 🔬 Formal task. A quick errand can be finished in place and moves into ✓ Done today; a formal task can only be moved to the task list.
- Each note renders as a bold title plus a collapsed body. A body longer than two lines can be expanded and is rendered as basic Markdown: paragraphs, bold, italic, inline code, links, unordered lists, and quotes.
- Implement a minimal Markdown renderer that builds DOM nodes directly, with no `innerHTML` and no third-party dependency. Links accept `http` and `https` only; any other scheme is treated as plain text.

### Moving notes to the task list

- Moving a note to the task list creates a new task document: the task title comes from the note title, the note body is written into the same document, and the note is then deleted.
- The order is fixed as create task block → write body → delete note. A failed body write keeps the note, a failed note deletion keeps the task block, and both report the real outcome instead of silently dropping content.
- The target picker now answers where the new task document goes: select a notebook to create it at the notebook root, select a document to create it underneath, and the triangle only expands and collapses. A persistent line shows the full path that will be created together with an editable document name.
- The picker has no default selection and does not remember the previous choice; every move requires an explicit decision.
- The document name defaults to the note title after removing line breaks and path separators, and is no longer overwritten by the title once edited by hand.
- Enlarge the document-tree triangle to a 22×22 hit area with solid ▶ / ▼ glyphs, fixing both the 10px light-grey outline triangle that read as a small dot and the tree jumping back to the top after expanding.

### Quick capture

- Add a Quick capture button to the SiYuan top bar that opens a small dialog from anywhere; Save and continue is meant for capturing several notes in a row.
- The Quick capture dialog and the Inbox capture box share one data set and one InboxController, so there is never a second inbox, and the tier choice is shared across both entry points.

### Optional task link

- `custom-ticktick-url` changed from required to optional: a task can be created and saved without a link, and the card then shows the title as plain text.
- This only relaxes the requirement; attribute meaning and format validation are unchanged. A present but invalid link is still rejected, and existing tasks need no migration.
- The number of required structured attributes drops from seven to six.

### Fixed

- Refuse any Inbox write until the data file has been read successfully, so an empty in-memory state right after startup can no longer overwrite existing notes.
- Refuse to save a note that has a body but no title, which previously produced a title-less note.
- Stop deadline urgency and overdue-focus calculations for Completed, Failed, and Cancelled tasks. Their original deadline remains visible and editable with a Closed label.
- Make the Task Center calendar interaction test derive dates from the current local day so fixed dates cannot expire and cause false failures.

### Development workflow

- Require a reviewable design and explicit user approval before implementing user-visible UI changes. Drafts cover relevant states, interaction flow, themes, and wide/narrow layouts; the temporary `design/` directory is not committed.
- Add automated coverage for Inbox domain rules, store, persistence, controller, view, document tree, document picker, promotion flow, promotion dialog, Quick capture dialog, and Markdown rendering.

## 0.4.0 - 2026-09-08

### Today's focus and scheduling rules

- Add Today's focus above pending work, with quick actions to schedule or cancel today and tomorrow.
- Carry unprogressed focus work forward automatically. After its deadline it remains visible as overdue focus, while new focus dates later than the deadline are rejected.
- Move progressed focus work into Today's progress and restore it to today's focus when that day's progress is undone.
- Add a full per-task monthly calendar for multiple dates across months, retaining the planned date, scheduling time, completion date, and manual order.
- Persist up/down ordering for same-day focus work. New plans append to the end and carried work keeps its original position.

### Monthly plans, actual progress, and heat map

- Add Task list / Calendar switching in the Task Center, with previous month, next month, and return-to-current-month navigation.
- Show explicit focus-plan counts and all actual progress counts for every date, including both focus and ordinary pending work.
- Do not inflate plan counts when work carries forward. Count each task once per actual day and remove that day when today's progress is undone.
- Shade date cells with five theme-adaptive heat levels for 0, 1, 2, 3–4, and 5+ actual tasks, plus a Less-to-More legend.
- Add the versioned `custom-ticktick-progress-log` history while continuing to maintain `custom-ticktick-last-progressed-date` for today's grouping and legacy compatibility.
- Add the versioned `custom-ticktick-focus-plan` for focus schedules. All task data remains on the original task block without task copies.
- Existing tasks require no migration. Their first new progress action carries forward the latest date still available, but older dates overwritten before v0.4.0 cannot be reconstructed.

### Compatibility and verification

- Use system-local calendar semantics across day, month, year, and timezone boundaries, while rejecting invalid dates, duplicates, and malformed attribute data.
- Preserve released task attributes, SQL aggregation, edit-conflict checks, write verification, and tab-scoped protection from stale query responses.
- Extend Chinese/English UI, light/dark theme styling, and horizontal overflow behavior for narrow windows.
- Expand verification to 37 test files and 335 tests, with static checks, production build, local installation, and package-integrity validation passing.

### Development workflow

- Expand the repository-level `AGENTS.md` with the task-block single-source rule, local SiYuan API boundaries, explicit authorization for live-workspace writes, risk-based testing, local installation, and GitHub Actions release rules.
- Add the `.agents/skills/task-center-development` project skill with on-demand architecture, testing, build, automatic installation, push, and release guidance for DeepSeek Harness and Codex.
- Document that `pnpm build` creates both `dist/` and `package.zip`, while `pnpm run make-install` installs the production build into the user-selected SiYuan workspace.

## 0.3.0 - 2026-09-01

### Knowledge document index

- Add consistent Tasks / Knowledge documents section tabs to the Task Center using the existing SiYuan-theme statistics, controls, and card language.
- Add an explicit manual Initialize knowledge index / Scan for new knowledge documents workflow. Startup, section switching, and window focus never scan automatically, and no polling or live-change listener is introduced.
- Refresh tasks on demand, then traverse descendants through the SiYuan document-tree API. A nested task document becomes a new task root instead of being marked as knowledge under its ancestor task.
- Write `custom-task-center-knowledge = true` only for documents absent from the cache and immediately verify every write through the block-attribute API. Failed documents remain uncached so a later scan can retry them.
- Load the Knowledge section from a rebuildable plugin index cache without storing document content. The document attribute remains the persistent identity marker.
- Add knowledge statistics, local search, last-scan time, scan reports, source navigation, and non-destructive warnings for cached documents that may have moved or been deleted.
- Add tests for cache parsing, recursive scanning, nested-task boundaries, bounded concurrent attribute verification, manual-only triggering, and the Knowledge section UI.

### Knowledge review

- Add Today, Random, and Relearning review entry points with a focused one-document panel for recall, source checking, and feedback.
- Use five explicit feedback levels: No impression, Looks familiar, Remembered but not understood, Partially mastered, and Mastered, each with an in-product definition.
- Route Remembered but not understood into a separate relearning queue. Other feedback starts from 1-, 3-, 7-, or 30-day intervals and grows, shrinks, or resets with later reviews.
- Store review count, latest feedback, current interval, and next-review time in the knowledge-index cache without changing document content or adding background polling.
- Add tests for scheduling, cache compatibility, scan-time progress preservation, failed-save rollback, and the complete review interaction.

## 0.2.0 - 2026-08-26

### Task targets and security validation

- Expand task links from TickTick / Dida365 only to four target types: TickTick, Dida365, a SiYuan document or block, and an ordinary HTTPS resource.
- Detect and normalize the target by link type. TickTick and Dida365 hostnames use exact matching, while ordinary HTTPS links may use any valid host.
- Strictly validate `siyuan://blocks/<block ID>` links: the block ID must be valid, with no extra path segments, query parameters, fragments, or surplus slashes.
- Reject `http:`, `javascript:`, `data:`, `file:`, URLs with embedded usernames or passwords, and every unsupported or malformed custom scheme.
- Validate only syntax and security boundaries without contacting a remote service to verify resource existence.

### SiYuan internal navigation and generalized interface

- Open `siyuan://blocks/...` links through SiYuan's official internal navigation; continue opening external HTTPS targets in a new tab with `noopener` and `noreferrer`.
- Rename the user-facing plugin from TickTick Task Center for SiYuan to SiYuan Task Center, and generalize TickTick-specific wording in the slash menu, create/edit dialogs, and deletion warnings.
- Change the Open action dynamically by target type: Open TickTick, Open Dida365, Open SiYuan document, or Open resource.
- Share one target-classification result across source cards and the Task Center so labels, navigation, and security validation remain consistent.

### Data compatibility and verification

- Retain the released `custom-ticktick-*` block attributes as compatibility identifiers. Existing tasks require no migration, and no second attribute set or task-data copy is introduced.
- Add tests for task-target classification, security validation, SiYuan navigation, interface labels, card rendering, and Task Center behavior.
- The verification suite now contains 26 test files and 260 tests and passes Svelte / TypeScript static checks and the production build.

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
