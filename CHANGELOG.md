# Changelog

## 0.1.0

- Initialize the TickTick Task Center project.
- Remove the frontend sample features and the kernel plugin example.
- Add the task status and task-data domain model.
- Add TickTick task creation through the Protyle slash menu.
- Persist task metadata in seven structured block attributes.
- Add validation, rollback handling, and automated tests.
- Add non-destructive read-only task-card enhancement for marked task blocks.
- Add localized identity, task-link, and semantic status-badge rendering.
- Restore the original Markdown display when task enhancement is removed.
- Add task editing through the interactive status badge.
- Support editing task titles, TickTick URLs, and task statuses.
- Synchronize edits to complete block attributes and fallback Markdown while preserving creation timestamps.
- Add optimistic edit-conflict detection, Markdown rollback, immediate card refresh, and edit workflow tests.
- Add a singleton TickTick Task Center tab opened from the SiYuan top bar.
- Dynamically aggregate validated task blocks across the workspace without persisting a second task list.
- Add active, closed, and all-task filters, local search, stable updated-time sorting, and task statistics.
- Add source-block navigation, safe TickTick links, explicit workspace refresh, and task-center editing that updates the current list immediately without waiting for SQL indexing.
- Protect recent task-center edits from temporarily stale manual-refresh results with a tab-scoped in-memory overlay.
- Distinguish temporarily incomplete SQL attribute rows from complete but invalid task metadata.
- Aggregate all seven task attributes into one deterministic SQL row per task to avoid partial tasks at the SiYuan query result limit.
- Add an optional local-calendar deadline to task creation, editing, persistence, validation, and Task Center aggregation.
- Add a reusable three-row Deadline button with remaining-day text, an eight-segment urgency track, and direct deadline editing in source cards and the Task Center.
- Add theme-adaptive warning and overdue emphasis without overriding readable status controls.
- Sort the “To progress today” group by the nearest deadline, placing overdue tasks first and undated tasks last.
- Replace the task-card identity emoji with an original theme-aware checklist SVG.
- Replace the placeholder marketplace icon with a summer teal-to-sky-blue 3D checklist icon that meets SiYuan's 160×160 and 20KB recommendations.
