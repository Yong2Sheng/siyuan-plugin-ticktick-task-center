import { TASK_STATUS_CONFIG } from "../domain/status";
import type { Translate } from "../i18n";
import type { TaskCenterItem } from "./task-center-data";
import {
    countTaskCenterItems,
    filterTaskCenterItems,
    TASK_CENTER_FILTERS,
    type TaskCenterFilter,
    sortTaskCenterFocusItems,
    sortTaskCenterItemsByDeadline,
} from "./task-center-filter";
import { TaskCenterController, type TaskCenterState } from "./task-center-controller";
import {
    getLocalDate,
    isProgressedToday,
    millisecondsUntilNextLocalDay,
    type DailyProgressSaveResult,
} from "./daily-progress";
import { getDeadlineState } from "../domain/deadline";
import { createDeadlineButton } from "../task-card/deadline-button";
import { TASK_WORK_MODE_CONFIG } from "../domain/work-mode";
import { openTaskActionsMenu } from "../task-card/task-actions-menu";
import { parseTaskTarget, TASK_TARGET_OPEN_LABEL_KEYS } from "../domain/task-target";
import type { KnowledgeCenterController } from "../knowledge/knowledge-controller";
import { KnowledgeCenterView } from "../knowledge/knowledge-view";
import { addLocalCalendarDays } from "../domain/local-date";
import {
    getFocusDisposition,
    getFocusEntryOrder,
    isQuickFocusDateSelected,
    type FocusPlan,
} from "../domain/focus-plan";
import {
    calendarMonthFromDate,
    formatCalendarMonthKey,
    getCalendarMonthCells,
    shiftCalendarMonth,
} from "../domain/calendar-month";
import { countTaskCenterActivityByDate, getActivityHeatLevel } from "./activity-calendar";

type TaskCenterSection = "tasks" | "knowledge";
type TaskViewMode = "list" | "calendar";

export type TaskCenterViewOptions = {
    controller: TaskCenterController;
    translate: Translate;
    locale?: string | (() => string);
    onToggleLanguage(): Promise<void>;
    onEditTask(blockId: string, focus: "status" | "work-mode" | "deadline"): void;
    onLocateTask(blockId: string, rootId: string, notebookId?: string): void;
    onOpenSiYuanTarget?(blockId: string): void;
    onDeleteTask(blockId: string, title: string): Promise<boolean>;
    onSaveDailyProgress(blockId: string, date: string | undefined): Promise<DailyProgressSaveResult>;
    onDailyProgressError?(error: unknown): void;
    onToggleFocusDate(
        blockId: string,
        targetDate: string,
        today: string,
        mode: "quick" | "exact",
    ): Promise<FocusPlan>;
    onSetFocusOrder(blockId: string, focusDate: string, order: number): Promise<FocusPlan>;
    onFocusPlanError?(error: unknown): void;
    knowledgeController: KnowledgeCenterController;
    onOpenKnowledgeDocument(documentId: string): Promise<void>;
    onOpenKnowledgeSource(documentId: string): Promise<void>;
    onKnowledgeOpenError?(error: unknown): void;
};

type DailyTaskAction = false | "toggle" | "completed";

export class TaskCenterView {
    private readonly root = document.createElement("section");
    private readonly heading = document.createElement("h1");
    private readonly languageButton = document.createElement("button");
    private readonly refreshButton = document.createElement("button");
    private readonly sectionButtons = new Map<TaskCenterSection, HTMLButtonElement>();
    private readonly taskPanel = document.createElement("section");
    private readonly knowledgePanel = document.createElement("section");
    private readonly knowledgeView: KnowledgeCenterView;
    private readonly summary = document.createElement("div");
    private readonly viewButtons = new Map<TaskViewMode, HTMLButtonElement>();
    private readonly controls = document.createElement("div");
    private readonly filterButtons = new Map<TaskCenterFilter, HTMLButtonElement>();
    private readonly searchInput = document.createElement("input");
    private readonly notice = document.createElement("div");
    private readonly feedback = document.createElement("div");
    private readonly list = document.createElement("div");
    private readonly pendingDailyProgress = new Set<string>();
    private readonly pendingFocusPlans = new Set<string>();
    private readonly calendarMonths = new Map<string, string>();
    private readonly unsubscribe: () => void;
    private dayBoundaryTimer?: number;
    private switchingLanguage = false;
    private section: TaskCenterSection = "tasks";
    private taskViewMode: TaskViewMode = "list";
    private activityMonthKey = getLocalDate().slice(0, 7);
    private destroyed = false;
    private readonly handleWindowFocus = (): void => {
        if (!this.destroyed) {
            this.render(this.options.controller.getState());
            this.knowledgeView?.refreshLanguage();
            this.scheduleDayBoundary();
        }
    };

    constructor(target: HTMLElement, private readonly options: TaskCenterViewOptions) {
        this.root.className = "ticktick-task-center";

        const header = document.createElement("header");
        header.className = "ticktick-task-center__header";
        this.heading.className = "ticktick-task-center__heading";
        const headerActions = document.createElement("div");
        headerActions.className = "ticktick-task-center__header-actions";
        this.languageButton.type = "button";
        this.languageButton.className = "b3-button b3-button--outline ticktick-task-center__language";
        this.languageButton.addEventListener("click", () => void this.toggleLanguage());
        this.refreshButton.type = "button";
        this.refreshButton.className = "b3-button b3-button--outline ticktick-task-center__refresh";
        this.refreshButton.addEventListener("click", () => void options.controller.refresh());
        headerActions.append(this.languageButton, this.refreshButton);
        header.append(this.heading, headerActions);

        const sectionNavigation = document.createElement("nav");
        sectionNavigation.className = "ticktick-task-center__section-navigation";
        sectionNavigation.setAttribute("aria-label", "Task center sections");
        for (const section of ["tasks", "knowledge"] as const) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "ticktick-task-center__section-button";
            button.addEventListener("click", () => this.setSection(section));
            this.sectionButtons.set(section, button);
            sectionNavigation.append(button);
        }

        this.summary.className = "ticktick-task-center__summary";

        const viewNavigation = document.createElement("nav");
        viewNavigation.className = "ticktick-task-center__view-navigation";
        for (const mode of ["list", "calendar"] as const) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "ticktick-task-center__view-button";
            button.addEventListener("click", () => this.setTaskViewMode(mode));
            this.viewButtons.set(mode, button);
            viewNavigation.append(button);
        }

        this.controls.className = "ticktick-task-center__controls";
        const filters = document.createElement("div");
        filters.className = "ticktick-task-center__filters";
        for (const filter of TASK_CENTER_FILTERS) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "ticktick-task-center__filter";
            button.addEventListener("click", () => options.controller.setFilter(filter));
            this.filterButtons.set(filter, button);
            filters.append(button);
        }
        this.searchInput.type = "search";
        this.searchInput.className = "b3-text-field ticktick-task-center__search";
        this.searchInput.addEventListener("input", () => options.controller.setSearch(this.searchInput.value));
        this.controls.append(filters, this.searchInput);

        this.notice.className = "ticktick-task-center__notice fn__none";
        this.notice.setAttribute("role", "status");
        this.feedback.className = "ticktick-task-center__feedback";
        this.list.className = "ticktick-task-center__list";
        this.list.setAttribute("role", "list");

        this.taskPanel.className = "ticktick-task-center__task-panel";
        this.taskPanel.append(
            this.summary,
            viewNavigation,
            this.controls,
            this.notice,
            this.feedback,
            this.list,
        );
        this.knowledgePanel.className = "ticktick-task-center__knowledge-panel fn__none";
        this.root.append(header, sectionNavigation, this.taskPanel, this.knowledgePanel);
        target.append(this.root);
        this.knowledgeView = new KnowledgeCenterView(this.knowledgePanel, {
            controller: options.knowledgeController,
            translate: options.translate,
            locale: options.locale,
            onOpenDocument: options.onOpenKnowledgeDocument,
            onOpenSource: options.onOpenKnowledgeSource,
            onOpenError: options.onKnowledgeOpenError,
        });
        this.unsubscribe = options.controller.subscribe((state) => this.render(state));
        window.addEventListener("focus", this.handleWindowFocus);
        this.scheduleDayBoundary();
    }

    destroy(): void {
        this.destroyed = true;
        if (this.dayBoundaryTimer !== undefined) {
            window.clearTimeout(this.dayBoundaryTimer);
        }
        window.removeEventListener("focus", this.handleWindowFocus);
        this.unsubscribe();
        this.knowledgeView.destroy();
        this.root.remove();
    }

    refreshLanguage(): void {
        if (!this.destroyed) {
            this.render(this.options.controller.getState());
            this.knowledgeView.refreshLanguage();
        }
    }

    private render(state: TaskCenterState): void {
        const { translate } = this.options;
        const statistics = countTaskCenterItems(state.items);
        const today = getLocalDate();
        const activeProgressedToday = state.items.filter((item) => (
            !TASK_STATUS_CONFIG[item.status].terminal
            && isProgressedToday(item.lastProgressedDate, today)
        )).length;
        const completedToday = state.items.filter((item) => (
            item.status === "completed"
            && isProgressedToday(item.lastProgressedDate, today)
        )).length;
        const dailyProgressCount = activeProgressedToday + completedToday;
        const dailyPendingCount = statistics.active - activeProgressedToday;
        const dailyTaskCount = dailyPendingCount + dailyProgressCount;
        this.heading.textContent = translate("taskCenterView.title");
        this.languageButton.textContent = translate("taskCenterView.switchLanguage");
        this.languageButton.title = translate("taskCenterView.switchLanguageTitle");
        this.languageButton.disabled = this.switchingLanguage;
        this.refreshButton.textContent = translate(
            state.refreshing ? "taskCenterView.refreshing" : "taskCenterView.refresh",
        );
        this.refreshButton.disabled = state.loading || state.refreshing;
        this.refreshButton.classList.toggle("fn__none", this.section !== "tasks");
        this.searchInput.value = state.search;
        this.searchInput.placeholder = translate("taskCenterView.searchPlaceholder");
        const sectionLabels: Record<TaskCenterSection, string> = {
            tasks: translate("knowledgeCenter.tabTasks"),
            knowledge: translate("knowledgeCenter.tabKnowledge"),
        };
        for (const [section, button] of this.sectionButtons) {
            button.textContent = sectionLabels[section];
            button.classList.toggle(
                "ticktick-task-center__section-button--active",
                section === this.section,
            );
            if (section === this.section) {
                button.setAttribute("aria-current", "page");
            } else {
                button.removeAttribute("aria-current");
            }
        }

        this.summary.replaceChildren(
            createSummaryItem(translate("taskCenterView.summaryAll"), statistics.all),
            createSummaryItem(translate("taskCenterView.summaryActive"), statistics.active),
            createSummaryItem(translate("taskCenterView.summaryClosed"), statistics.closed),
            createSummaryItem(
                translate("taskCenterView.summaryToday"),
                `${dailyProgressCount} / ${dailyTaskCount}`,
                "daily",
            ),
        );
        const filterLabels: Record<TaskCenterFilter, string> = {
            active: translate("taskCenterView.filterActive"),
            closed: translate("taskCenterView.filterClosed"),
            all: translate("taskCenterView.filterAll"),
        };
        for (const [filter, button] of this.filterButtons) {
            button.textContent = filterLabels[filter];
            button.classList.toggle("ticktick-task-center__filter--active", filter === state.filter);
            button.setAttribute("aria-pressed", String(filter === state.filter));
        }
        const viewLabels: Record<TaskViewMode, string> = {
            list: translate("taskCenterView.viewList"),
            calendar: translate("taskCenterView.viewCalendar"),
        };
        for (const [mode, button] of this.viewButtons) {
            button.textContent = viewLabels[mode];
            button.classList.toggle(
                "ticktick-task-center__view-button--active",
                mode === this.taskViewMode,
            );
            button.setAttribute("aria-pressed", String(mode === this.taskViewMode));
        }
        this.controls.classList.toggle("fn__none", this.taskViewMode === "calendar");

        const notices: HTMLElement[] = [];
        if (state.incompleteCount > 0) {
            notices.push(createNotice(
                translate("taskCenterView.incompleteRead")
                    .replace("${count}", String(state.incompleteCount)),
            ));
        }
        if (state.invalidCount > 0) {
            notices.push(createNotice(
                translate("taskCenterView.invalidSkipped")
                    .replace("${count}", String(state.invalidCount)),
            ));
        }
        if (notices.length > 0) {
            this.notice.replaceChildren(...notices);
            this.notice.classList.remove("fn__none");
        } else {
            this.notice.replaceChildren();
            this.notice.classList.add("fn__none");
        }

        this.feedback.replaceChildren();
        if (state.loading) {
            this.feedback.append(createFeedback(translate("taskCenterView.loading"), "loading"));
            this.list.replaceChildren();
            return;
        }
        if (state.error) {
            const error = createFeedback(translate("taskCenterView.loadFailed"), "error");
            const retry = document.createElement("button");
            retry.type = "button";
            retry.className = "b3-button b3-button--outline ticktick-task-center__retry";
            retry.textContent = translate("taskCenterView.retry");
            retry.addEventListener("click", () => void this.options.controller.refresh());
            error.append(retry);
            this.feedback.append(error);
            if (state.items.length === 0) {
                this.list.replaceChildren();
                return;
            }
        }

        if (this.taskViewMode === "calendar") {
            this.list.removeAttribute("role");
            this.list.replaceChildren(this.createActivityCalendar(state.items, today));
            return;
        }
        this.list.setAttribute("role", "list");

        const visibleItems = filterTaskCenterItems(
            state.items,
            state.filter,
            state.search,
            translate,
        );
        let hasVisibleItems = visibleItems.length > 0;
        if (state.filter === "active") {
            const unprogressedItems = visibleItems.filter((item) => (
                !isProgressedToday(item.lastProgressedDate, today)
            ));
            const focusItems = sortTaskCenterFocusItems(unprogressedItems.filter((item) => (
                getFocusDisposition(item.focusPlan, today, item.deadline) !== undefined
            )), today);
            const pendingItems = sortTaskCenterItemsByDeadline(unprogressedItems.filter((item) => (
                getFocusDisposition(item.focusPlan, today, item.deadline) === undefined
            )));
            const progressedItems = visibleItems.filter((item) => (
                isProgressedToday(item.lastProgressedDate, today)
            ));
            const completedItems = filterTaskCenterItems(
                state.items,
                "all",
                state.search,
                translate,
            ).filter((item) => (
                item.status === "completed"
                && isProgressedToday(item.lastProgressedDate, today)
            ));
            hasVisibleItems = focusItems.length + pendingItems.length
                + progressedItems.length + completedItems.length > 0;
            if (hasVisibleItems) {
                const groups: HTMLElement[] = [];
                if (focusItems.length > 0) {
                    groups.push(this.createFocusGroup(focusItems, today));
                }
                if (pendingItems.length > 0) {
                    groups.push(this.createPendingGroup(pendingItems, today));
                }
                if (progressedItems.length + completedItems.length > 0) {
                    groups.push(this.createProgressGroup(progressedItems, completedItems, today));
                }
                this.list.replaceChildren(...groups);
            } else {
                this.list.replaceChildren();
            }
        } else {
            this.list.replaceChildren(...visibleItems.map((item) => (
                this.createTaskItem(item, false, today)
            )));
        }
        if (!hasVisibleItems) {
            const key = getEmptyStateKey(state);
            this.feedback.append(createFeedback(translate(key), "empty"));
        }
    }

    private createFocusGroup(
        items: readonly TaskCenterItem[],
        today: string,
    ): HTMLElement {
        const group = document.createElement("section");
        group.className = "ticktick-task-center__daily-group ticktick-task-center__daily-group--focus";
        group.setAttribute("role", "group");

        const heading = document.createElement("h2");
        heading.className = "ticktick-task-center__daily-heading";
        const count = document.createElement("strong");
        count.textContent = String(items.length);
        heading.append(`${this.options.translate("taskCenterView.dailyFocus")} `, count);

        const sortRule = document.createElement("p");
        sortRule.className = "ticktick-task-center__focus-sort-rule";
        sortRule.textContent = this.options.translate("taskCenterView.focusSortRule");

        const groupList = document.createElement("div");
        groupList.className = "ticktick-task-center__daily-list";
        groupList.append(...items.map((item, index) => this.createTaskItem(
            item,
            "toggle",
            today,
            { items, index },
        )));
        group.append(heading, sortRule, groupList);
        return group;
    }

    private setSection(section: TaskCenterSection): void {
        if (this.section === section) {
            return;
        }
        this.section = section;
        this.taskPanel.classList.toggle("fn__none", section !== "tasks");
        this.knowledgePanel.classList.toggle("fn__none", section !== "knowledge");
        this.render(this.options.controller.getState());
        if (section === "knowledge") {
            this.knowledgeView.refreshLanguage();
        }
    }

    private setTaskViewMode(mode: TaskViewMode): void {
        if (this.taskViewMode === mode) {
            return;
        }
        this.taskViewMode = mode;
        if (mode === "calendar") {
            this.activityMonthKey = getLocalDate().slice(0, 7);
        }
        this.render(this.options.controller.getState());
    }

    private createActivityCalendar(
        items: readonly TaskCenterItem[],
        today: string,
    ): HTMLElement {
        const calendarMonth = calendarMonthFromDate(`${this.activityMonthKey}-01`)
            ?? calendarMonthFromDate(today)!;
        const counts = countTaskCenterActivityByDate(items, today);
        const panel = document.createElement("section");
        panel.className = "ticktick-task-center__activity-calendar";
        panel.setAttribute("aria-label", this.options.translate("taskCenterView.activityCalendarLabel"));

        const header = document.createElement("header");
        header.className = "ticktick-task-center__activity-calendar-header";
        const previous = this.createActivityCalendarNavigationButton(calendarMonth, -1, "‹");
        const heading = document.createElement("h2");
        heading.textContent = new Intl.DateTimeFormat(this.getLocale(), {
            year: "numeric",
            month: "long",
        }).format(new Date(calendarMonth.year, calendarMonth.month - 1, 1, 12));
        const next = this.createActivityCalendarNavigationButton(calendarMonth, 1, "›");
        const current = document.createElement("button");
        current.type = "button";
        current.className = "ticktick-task-center__activity-calendar-today";
        current.textContent = this.options.translate("taskCenterView.calendarToday");
        current.addEventListener("click", () => {
            this.activityMonthKey = today.slice(0, 7);
            this.render(this.options.controller.getState());
        });
        header.append(previous, heading, next, current);

        const grid = document.createElement("div");
        grid.className = "ticktick-task-center__activity-calendar-grid";
        for (const label of this.getWeekdayLabels()) {
            const weekday = document.createElement("span");
            weekday.className = "ticktick-task-center__activity-calendar-weekday";
            weekday.textContent = label;
            grid.append(weekday);
        }
        for (const date of getCalendarMonthCells(calendarMonth)) {
            if (!date) {
                const spacer = document.createElement("span");
                spacer.className = "ticktick-task-center__activity-calendar-spacer";
                grid.append(spacer);
                continue;
            }
            const day = document.createElement("div");
            day.className = "ticktick-task-center__activity-calendar-day";
            day.dataset.date = date;
            day.dataset.today = String(date === today);
            const dayNumber = document.createElement("strong");
            dayNumber.textContent = String(Number(date.slice(8, 10)));
            const dayCounts = counts.get(date) ?? { planned: 0, actual: 0 };
            day.dataset.activityLevel = String(getActivityHeatLevel(dayCounts.actual));
            day.title = `${date} · ${this.options.translate("taskCenterView.calendarPlanned")} ${dayCounts.planned} · ${this.options.translate("taskCenterView.calendarActual")} ${dayCounts.actual}`;
            const planned = document.createElement("span");
            planned.className = "ticktick-task-center__activity-calendar-count ticktick-task-center__activity-calendar-count--planned";
            planned.textContent = `${this.options.translate("taskCenterView.calendarPlanned")} ${dayCounts.planned}`;
            const actual = document.createElement("span");
            actual.className = "ticktick-task-center__activity-calendar-count ticktick-task-center__activity-calendar-count--actual";
            actual.textContent = `${this.options.translate("taskCenterView.calendarActual")} ${dayCounts.actual}`;
            day.append(dayNumber, planned, actual);
            grid.append(day);
        }
        const legend = document.createElement("div");
        legend.className = "ticktick-task-center__activity-calendar-legend";
        const legendLabel = document.createElement("span");
        legendLabel.textContent = this.options.translate("taskCenterView.calendarHeatLegend");
        const less = document.createElement("span");
        less.textContent = this.options.translate("taskCenterView.calendarHeatLess");
        legend.append(legendLabel, less);
        for (let level = 0; level <= 4; level += 1) {
            const swatch = document.createElement("span");
            swatch.className = "ticktick-task-center__activity-calendar-swatch";
            swatch.dataset.activityLevel = String(level);
            swatch.setAttribute("aria-hidden", "true");
            legend.append(swatch);
        }
        const more = document.createElement("span");
        more.textContent = this.options.translate("taskCenterView.calendarHeatMore");
        legend.append(more);
        panel.append(header, grid, legend);
        return panel;
    }

    private createActivityCalendarNavigationButton(
        calendarMonth: { year: number; month: number },
        offset: number,
        label: string,
    ): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ticktick-task-center__activity-calendar-navigation";
        button.textContent = label;
        button.addEventListener("click", () => {
            const shifted = shiftCalendarMonth(calendarMonth, offset);
            const key = shifted ? formatCalendarMonthKey(shifted) : undefined;
            if (key) {
                this.activityMonthKey = key;
                this.render(this.options.controller.getState());
            }
        });
        return button;
    }

    private createPendingGroup(
        items: readonly TaskCenterItem[],
        today: string,
    ): HTMLElement {
        const group = document.createElement("section");
        group.className = "ticktick-task-center__daily-group ticktick-task-center__daily-group--pending";
        group.setAttribute("role", "group");

        const heading = document.createElement("h2");
        heading.className = "ticktick-task-center__daily-heading";
        const label = this.options.translate("taskCenterView.dailyPending");
        const count = document.createElement("strong");
        count.textContent = String(items.length);
        heading.append(`${label} `, count);

        const groupList = document.createElement("div");
        groupList.className = "ticktick-task-center__daily-list";
        groupList.append(...items.map((item) => this.createTaskItem(item, "toggle", today)));
        group.append(heading, groupList);
        return group;
    }

    private createProgressGroup(
        progressedItems: readonly TaskCenterItem[],
        completedItems: readonly TaskCenterItem[],
        today: string,
    ): HTMLElement {
        const group = document.createElement("section");
        group.className = "ticktick-task-center__daily-group ticktick-task-center__daily-group--progressed";
        group.setAttribute("role", "group");

        const heading = document.createElement("h2");
        heading.className = "ticktick-task-center__daily-heading";
        const count = document.createElement("strong");
        count.textContent = String(progressedItems.length + completedItems.length);
        heading.append(`${this.options.translate("taskCenterView.dailyProgressed")} `, count);

        const subgroups: HTMLElement[] = [];
        if (progressedItems.length > 0) {
            subgroups.push(this.createProgressSubgroup("advanced", progressedItems, today));
        }
        if (completedItems.length > 0) {
            subgroups.push(this.createProgressSubgroup("completed", completedItems, today));
        }
        group.append(heading, ...subgroups);
        return group;
    }

    private createProgressSubgroup(
        kind: "advanced" | "completed",
        items: readonly TaskCenterItem[],
        today: string,
    ): HTMLElement {
        const subgroup = document.createElement("section");
        subgroup.className = `ticktick-task-center__daily-subgroup ticktick-task-center__daily-subgroup--${kind}`;

        const heading = document.createElement("h3");
        heading.className = "ticktick-task-center__daily-subheading";
        const label = this.options.translate(
            kind === "advanced"
                ? "taskCenterView.dailyAdvanced"
                : "taskCenterView.dailyCompleted",
        );
        const count = document.createElement("strong");
        count.textContent = String(items.length);
        heading.append(`${label} `, count);

        const list = document.createElement("div");
        list.className = "ticktick-task-center__daily-list";
        const action: DailyTaskAction = kind === "advanced" ? "toggle" : "completed";
        list.append(...items.map((item) => this.createTaskItem(item, action, today)));
        subgroup.append(heading, list);
        return subgroup;
    }

    private createTaskItem(
        item: TaskCenterItem,
        dailyAction: DailyTaskAction,
        today: string,
        focusPosition?: { items: readonly TaskCenterItem[]; index: number },
    ): HTMLElement {
        const { translate } = this.options;
        const status = TASK_STATUS_CONFIG[item.status];
        const article = document.createElement("article");
        article.className = "ticktick-task-center__item";
        article.setAttribute("data-status-tone", status.tone);
        article.setAttribute("data-deadline-state", getDeadlineState(item.deadline, today).kind);
        article.setAttribute("role", "listitem");
        article.addEventListener("contextmenu", (event) => {
            openTaskActionsMenu(event, {
                translate,
                onEdit: () => this.options.onEditTask(item.blockId, "status"),
                onDelete: () => void this.deleteTask(item),
            });
        });

        const statusButton = document.createElement("button");
        statusButton.type = "button";
        statusButton.className = "ticktick-task-center__status";
        const statusLabel = translate(status.labelKey);
        statusButton.textContent = `${status.icon} ${statusLabel}`;
        statusButton.title = translate("taskEdit.statusButtonTitle");
        statusButton.setAttribute(
            "aria-label",
            translate("taskEdit.statusButtonAriaLabel").replace("${status}", statusLabel),
        );
        statusButton.addEventListener("click", () => this.options.onEditTask(item.blockId, "status"));

        const workModeButton = document.createElement("button");
        workModeButton.type = "button";
        workModeButton.className = "ticktick-task-center__work-mode";
        const workModeLabel = item.workMode
            ? `${TASK_WORK_MODE_CONFIG[item.workMode].icon} ${translate(TASK_WORK_MODE_CONFIG[item.workMode].labelKey)}`
            : translate("workMode.unclassified");
        workModeButton.textContent = workModeLabel;
        workModeButton.title = translate("taskEdit.workModeButtonTitle");
        workModeButton.setAttribute(
            "aria-label",
            translate("taskEdit.workModeButtonAriaLabel").replace("${workMode}", workModeLabel),
        );
        workModeButton.addEventListener("click", () => this.options.onEditTask(item.blockId, "work-mode"));

        const classification = document.createElement("div");
        classification.className = "ticktick-task-center__classification";
        classification.append(workModeButton, statusButton);

        const deadlineButton = createDeadlineButton({
            className: "ticktick-task-center__deadline",
            deadline: item.deadline,
            today,
            locale: this.getLocale(),
            translate,
            onClick: () => this.options.onEditTask(item.blockId, "deadline"),
        });

        const content = document.createElement("div");
        content.className = "ticktick-task-center__content";
        const title = document.createElement("button");
        title.type = "button";
        title.className = "ticktick-task-center__title";
        title.textContent = item.title;
        title.addEventListener("click", () => this.options.onLocateTask(
            item.blockId,
            item.rootId,
            item.notebookId,
        ));
        const source = document.createElement("div");
        source.className = "ticktick-task-center__source";
        source.textContent = `${translate("taskCenterView.source")}: ${item.documentTitle}`;
        const path = document.createElement("div");
        path.className = "ticktick-task-center__path";
        path.textContent = item.documentPath;
        const updated = document.createElement("div");
        updated.className = "ticktick-task-center__updated";
        updated.append(`${translate("taskCenterView.updated")}: `, createTime(item.updatedAt, this.getLocale()));
        content.append(title);
        const focusDisposition = getFocusDisposition(item.focusPlan, today, item.deadline);
        if (focusDisposition) {
            const focusState = document.createElement("div");
            focusState.className = `ticktick-task-center__focus-state ticktick-task-center__focus-state--${focusDisposition.kind}`;
            focusState.textContent = this.getFocusStateLabel(focusDisposition.kind, focusDisposition.entry.date);
            content.append(focusState);
            article.dataset.focusKind = focusDisposition.kind;
        }
        content.append(source, path, updated);

        const actions = document.createElement("div");
        actions.className = "ticktick-task-center__actions";
        if (!status.terminal) {
            actions.append(this.createCalendarToggleButton(item, today));
            actions.append(...this.createFocusPlanButtons(item, today));
        }
        if (focusPosition) {
            actions.append(...this.createFocusOrderButtons(item, today, focusPosition));
        }
        if (dailyAction === "toggle") {
            actions.append(this.createDailyProgressButton(item, today));
        } else if (dailyAction === "completed") {
            actions.append(this.createDailyCompletedBadge());
        }
        const locate = document.createElement("button");
        locate.type = "button";
        locate.className = "b3-button b3-button--outline ticktick-task-center__locate";
        locate.textContent = translate("taskCenterView.locate");
        locate.addEventListener("click", () => this.options.onLocateTask(
            item.blockId,
            item.rootId,
            item.notebookId,
        ));
        const parsedTarget = parseTaskTarget(item.url);
        if (!parsedTarget.valid) {
            throw new Error(`Cannot render invalid task target: ${parsedTarget.reason}`);
        }
        const targetLabel = `${translate(TASK_TARGET_OPEN_LABEL_KEYS[parsedTarget.target.kind])} ↗️`;
        const targetControl = parsedTarget.target.kind === "siyuan-block"
            ? this.createSiYuanTargetButton(parsedTarget.target.blockId, targetLabel)
            : createExternalTargetLink(parsedTarget.target.url, targetLabel);
        actions.append(locate, targetControl);

        article.append(deadlineButton, classification, content, actions);
        const calendarMonth = this.calendarMonths.get(item.blockId);
        if (!status.terminal && calendarMonth) {
            article.append(this.createFocusCalendar(item, today, calendarMonth));
        }
        return article;
    }

    private createCalendarToggleButton(item: TaskCenterItem, today: string): HTMLButtonElement {
        const open = this.calendarMonths.has(item.blockId);
        const count = item.focusPlan?.entries.filter((entry) => !entry.completedOn).length ?? 0;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "b3-button b3-button--outline ticktick-task-center__focus-calendar-toggle";
        button.dataset.open = String(open);
        button.textContent = this.options.translate("taskCenterView.focusCalendar")
            .replace("${count}", String(count));
        button.setAttribute("aria-expanded", String(open));
        button.addEventListener("click", () => {
            if (open) {
                this.calendarMonths.delete(item.blockId);
            } else {
                this.calendarMonths.set(item.blockId, today.slice(0, 7));
            }
            this.render(this.options.controller.getState());
        });
        return button;
    }

    private createFocusCalendar(
        item: TaskCenterItem,
        today: string,
        monthKey: string,
    ): HTMLElement {
        const calendarMonth = calendarMonthFromDate(`${monthKey}-01`)
            ?? calendarMonthFromDate(today)!;
        const panel = document.createElement("section");
        panel.className = "ticktick-task-center__focus-calendar";
        panel.setAttribute("aria-label", this.options.translate("taskCenterView.focusCalendarLabel"));

        const header = document.createElement("header");
        header.className = "ticktick-task-center__focus-calendar-header";
        const previous = this.createCalendarNavigationButton(item.blockId, calendarMonth, -1, "‹");
        const heading = document.createElement("strong");
        heading.textContent = new Intl.DateTimeFormat(this.getLocale(), {
            year: "numeric",
            month: "long",
        }).format(new Date(calendarMonth.year, calendarMonth.month - 1, 1, 12));
        const next = this.createCalendarNavigationButton(item.blockId, calendarMonth, 1, "›");
        const close = document.createElement("button");
        close.type = "button";
        close.className = "ticktick-task-center__focus-calendar-close";
        close.textContent = "×";
        close.title = this.options.translate("taskCenterView.focusCalendarClose");
        close.addEventListener("click", () => {
            this.calendarMonths.delete(item.blockId);
            this.render(this.options.controller.getState());
        });
        header.append(previous, heading, next, close);

        const grid = document.createElement("div");
        grid.className = "ticktick-task-center__focus-calendar-grid";
        for (const label of this.getWeekdayLabels()) {
            const weekday = document.createElement("span");
            weekday.className = "ticktick-task-center__focus-calendar-weekday";
            weekday.textContent = label;
            grid.append(weekday);
        }
        for (const date of getCalendarMonthCells(calendarMonth)) {
            if (!date) {
                const spacer = document.createElement("span");
                spacer.className = "ticktick-task-center__focus-calendar-spacer";
                grid.append(spacer);
                continue;
            }
            grid.append(this.createCalendarDateButton(item, date, today));
        }
        panel.append(header, grid);
        return panel;
    }

    private createCalendarNavigationButton(
        blockId: string,
        calendarMonth: { year: number; month: number },
        offset: number,
        label: string,
    ): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ticktick-task-center__focus-calendar-navigation";
        button.textContent = label;
        button.addEventListener("click", () => {
            const shifted = shiftCalendarMonth(calendarMonth, offset);
            const key = shifted ? formatCalendarMonthKey(shifted) : undefined;
            if (key) {
                this.calendarMonths.set(blockId, key);
                this.render(this.options.controller.getState());
            }
        });
        return button;
    }

    private getWeekdayLabels(): string[] {
        const formatter = new Intl.DateTimeFormat(this.getLocale(), { weekday: "narrow" });
        return Array.from({ length: 7 }, (_, index) => (
            formatter.format(new Date(2026, 0, 5 + index, 12))
        ));
    }

    private createCalendarDateButton(
        item: TaskCenterItem,
        date: string,
        today: string,
    ): HTMLButtonElement {
        const entry = item.focusPlan?.entries.find((candidate) => candidate.date === date);
        const selected = entry !== undefined;
        const afterDeadline = item.deadline !== undefined && date > item.deadline;
        const beforeToday = date < today;
        const progressedToday = date === today
            && isProgressedToday(item.lastProgressedDate, today)
            && !selected;
        const pending = this.pendingFocusPlans.has(item.blockId);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ticktick-task-center__focus-calendar-date";
        button.textContent = String(Number(date.slice(-2)));
        button.dataset.date = date;
        button.dataset.today = String(date === today);
        button.dataset.selected = String(selected);
        button.dataset.completed = String(entry?.completedOn !== undefined);
        button.dataset.deadline = String(date === item.deadline);
        button.setAttribute("aria-pressed", String(selected));
        button.disabled = pending || beforeToday || afterDeadline || progressedToday;
        button.title = this.options.translate(
            beforeToday
                ? "taskCenterView.focusPastDate"
                : afterDeadline
                    ? "taskCenterView.focusAfterDeadline"
                    : progressedToday
                        ? "taskCenterView.focusProgressedToday"
                        : selected
                            ? "taskCenterView.focusCancelTitle"
                            : "taskCenterView.focusArrangeTitle",
        ).replace("${date}", date);
        button.addEventListener("click", () => {
            void this.toggleFocusPlan(item, date, today, "exact");
        });
        return button;
    }

    private getFocusStateLabel(kind: "overdue" | "carried" | "today", date: string): string {
        if (kind === "today") {
            return this.options.translate("taskCenterView.focusStateToday");
        }
        return this.options.translate(
            kind === "overdue"
                ? "taskCenterView.focusStateOverdue"
                : "taskCenterView.focusStateCarried",
        ).replace("${date}", date);
    }

    private createFocusPlanButtons(item: TaskCenterItem, today: string): HTMLButtonElement[] {
        const tomorrow = addLocalCalendarDays(today, 1);
        if (!tomorrow) {
            return [];
        }
        return [
            this.createFocusPlanButton(item, today, today, "today"),
            this.createFocusPlanButton(item, tomorrow, today, "tomorrow"),
        ];
    }

    private createFocusPlanButton(
        item: TaskCenterItem,
        targetDate: string,
        today: string,
        kind: "today" | "tomorrow",
    ): HTMLButtonElement {
        const selected = isQuickFocusDateSelected(item.focusPlan, targetDate, today);
        const pending = this.pendingFocusPlans.has(item.blockId);
        const afterDeadline = item.deadline !== undefined && targetDate > item.deadline;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "b3-button b3-button--outline ticktick-task-center__focus-plan";
        button.dataset.focusDate = kind;
        button.dataset.selected = String(selected);
        button.textContent = this.options.translate(
            kind === "today" ? "taskCenterView.focusToday" : "taskCenterView.focusTomorrow",
        );
        button.setAttribute("aria-pressed", String(selected));
        button.disabled = pending || (afterDeadline && !selected);
        button.title = this.options.translate(
            selected
                ? "taskCenterView.focusCancelTitle"
                : afterDeadline
                    ? "taskCenterView.focusAfterDeadline"
                    : "taskCenterView.focusArrangeTitle",
        ).replace("${date}", targetDate);
        button.addEventListener("click", () => {
            void this.toggleFocusPlan(item, targetDate, today, "quick");
        });
        return button;
    }

    private createFocusOrderButtons(
        item: TaskCenterItem,
        today: string,
        position: { items: readonly TaskCenterItem[]; index: number },
    ): HTMLButtonElement[] {
        return (["up", "down"] as const).map((direction) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "b3-button b3-button--outline ticktick-task-center__focus-order";
            button.dataset.direction = direction;
            button.textContent = direction === "up" ? "↑" : "↓";
            button.title = this.options.translate(
                direction === "up" ? "taskCenterView.focusMoveUp" : "taskCenterView.focusMoveDown",
            );
            button.disabled = this.pendingFocusPlans.has(item.blockId)
                || (direction === "up" ? position.index === 0 : position.index === position.items.length - 1);
            button.addEventListener("click", () => {
                void this.moveFocusItem(item, today, position, direction);
            });
            return button;
        });
    }

    private async moveFocusItem(
        item: TaskCenterItem,
        today: string,
        position: { items: readonly TaskCenterItem[]; index: number },
        direction: "up" | "down",
    ): Promise<void> {
        const disposition = getFocusDisposition(item.focusPlan, today, item.deadline);
        const order = calculateMovedFocusOrder(position.items, position.index, direction, today);
        if (!disposition || order === undefined || this.pendingFocusPlans.has(item.blockId)) {
            return;
        }
        this.pendingFocusPlans.add(item.blockId);
        this.render(this.options.controller.getState());
        try {
            const focusPlan = await this.options.onSetFocusOrder(
                item.blockId,
                disposition.entry.date,
                order,
            );
            if (!this.options.controller.applyFocusPlan(item.blockId, focusPlan)) {
                throw new Error(`TickTick task ${item.blockId} is no longer available`);
            }
        } catch (error) {
            this.options.onFocusPlanError?.(error);
        } finally {
            this.pendingFocusPlans.delete(item.blockId);
            if (!this.destroyed) {
                this.render(this.options.controller.getState());
            }
        }
    }

    private async toggleFocusPlan(
        item: TaskCenterItem,
        targetDate: string,
        today: string,
        mode: "quick" | "exact",
    ): Promise<void> {
        if (this.pendingFocusPlans.has(item.blockId)) {
            return;
        }
        this.pendingFocusPlans.add(item.blockId);
        this.render(this.options.controller.getState());
        try {
            const focusPlan = await this.options.onToggleFocusDate(
                item.blockId,
                targetDate,
                today,
                mode,
            );
            if (!this.options.controller.applyFocusPlan(item.blockId, focusPlan)) {
                throw new Error(`TickTick task ${item.blockId} is no longer available`);
            }
        } catch (error) {
            this.options.onFocusPlanError?.(error);
        } finally {
            this.pendingFocusPlans.delete(item.blockId);
            if (!this.destroyed) {
                this.render(this.options.controller.getState());
            }
        }
    }

    private createSiYuanTargetButton(blockId: string, label: string): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "b3-button b3-button--outline ticktick-task-center__external";
        button.textContent = label;
        button.addEventListener("click", () => this.options.onOpenSiYuanTarget?.(blockId));
        return button;
    }

    private async deleteTask(item: TaskCenterItem): Promise<void> {
        const deleted = await this.options.onDeleteTask(item.blockId, item.title);
        if (deleted) {
            this.options.controller.applyDeletedTask(item.blockId);
        }
    }

    private async toggleLanguage(): Promise<void> {
        if (this.switchingLanguage) {
            return;
        }
        this.switchingLanguage = true;
        this.render(this.options.controller.getState());
        try {
            await this.options.onToggleLanguage();
        } finally {
            this.switchingLanguage = false;
            this.refreshLanguage();
        }
    }

    private getLocale(): string | undefined {
        return typeof this.options.locale === "function"
            ? this.options.locale()
            : this.options.locale;
    }

    private createDailyCompletedBadge(): HTMLSpanElement {
        const badge = document.createElement("span");
        badge.className = "ticktick-task-center__daily-completed";
        badge.textContent = this.options.translate("taskCenterView.dailyCompletedBadge");
        return badge;
    }

    private createDailyProgressButton(item: TaskCenterItem, today: string): HTMLButtonElement {
        const progressed = isProgressedToday(item.lastProgressedDate, today);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "b3-button b3-button--outline ticktick-task-center__daily-progress";
        button.dataset.progressedToday = String(progressed);
        button.textContent = this.options.translate(
            progressed
                ? "taskCenterView.dailyProgressDone"
                : "taskCenterView.dailyProgressAction",
        );
        button.title = this.options.translate(
            progressed
                ? "taskCenterView.dailyProgressUndoTitle"
                : "taskCenterView.dailyProgressTitle",
        );
        button.setAttribute("aria-pressed", String(progressed));
        button.disabled = this.pendingDailyProgress.has(item.blockId);
        button.addEventListener("click", () => {
            void this.toggleDailyProgress(item, today);
        });
        return button;
    }

    private async toggleDailyProgress(item: TaskCenterItem, today: string): Promise<void> {
        if (this.pendingDailyProgress.has(item.blockId)) {
            return;
        }
        const nextDate = isProgressedToday(item.lastProgressedDate, today) ? undefined : today;
        this.pendingDailyProgress.add(item.blockId);
        this.render(this.options.controller.getState());
        try {
            const result = await this.options.onSaveDailyProgress(item.blockId, nextDate);
            if (!this.options.controller.applyDailyProgressWithFocus(
                item.blockId,
                nextDate,
                result?.focusPlan,
                result?.progressLog,
            )) {
                throw new Error(`TickTick task ${item.blockId} is no longer available`);
            }
        } catch (error) {
            this.options.onDailyProgressError?.(error);
        } finally {
            this.pendingDailyProgress.delete(item.blockId);
            if (!this.destroyed) {
                this.render(this.options.controller.getState());
            }
        }
    }

    private scheduleDayBoundary(): void {
        if (this.dayBoundaryTimer !== undefined) {
            window.clearTimeout(this.dayBoundaryTimer);
        }
        this.dayBoundaryTimer = window.setTimeout(() => {
            if (this.destroyed) {
                return;
            }
            this.render(this.options.controller.getState());
            this.knowledgeView.refreshLanguage();
            this.scheduleDayBoundary();
        }, millisecondsUntilNextLocalDay());
    }
}

function calculateMovedFocusOrder(
    items: readonly TaskCenterItem[],
    index: number,
    direction: "up" | "down",
    today: string,
): number | undefined {
    const orders = items.map((item) => {
        const disposition = getFocusDisposition(item.focusPlan, today, item.deadline);
        return disposition ? getFocusEntryOrder(disposition.entry) : undefined;
    });
    if (orders.some((order) => order === undefined)) {
        return undefined;
    }
    const values = orders as number[];
    if (direction === "up") {
        if (index <= 0) {
            return undefined;
        }
        const previous = values[index - 1];
        if (index === 1) {
            return previous - 1024;
        }
        const outer = values[index - 2];
        return outer < previous ? outer + ((previous - outer) / 2) : previous - 0.5;
    }
    if (index >= values.length - 1) {
        return undefined;
    }
    const next = values[index + 1];
    if (index === values.length - 2) {
        return next + 1024;
    }
    const outer = values[index + 2];
    return next < outer ? next + ((outer - next) / 2) : next + 0.5;
}

function createExternalTargetLink(url: string, label: string): HTMLAnchorElement {
    const link = document.createElement("a");
    link.className = "b3-button b3-button--outline ticktick-task-center__external";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
}

function createSummaryItem(
    label: string,
    count: number | string,
    kind?: "daily",
): HTMLElement {
    const item = document.createElement("span");
    item.className = "ticktick-task-center__summary-item";
    if (kind) {
        item.classList.add(`ticktick-task-center__summary-item--${kind}`);
    }
    const value = document.createElement("strong");
    value.textContent = String(count);
    item.append(`${label} `, value);
    return item;
}

function createNotice(message: string): HTMLElement {
    const notice = document.createElement("div");
    notice.textContent = message;
    return notice;
}

function createFeedback(message: string, kind: "loading" | "error" | "empty"): HTMLElement {
    const element = document.createElement("div");
    element.className = `ticktick-task-center__${kind}`;
    element.textContent = message;
    return element;
}

function getEmptyStateKey(state: TaskCenterState): string {
    if (state.search.trim() !== "") {
        return "taskCenterView.emptySearch";
    }
    if (state.items.length === 0) {
        return "taskCenterView.emptyAll";
    }
    return state.filter === "closed"
        ? "taskCenterView.emptyClosed"
        : "taskCenterView.emptyActive";
}

export function createTime(iso: string, locale?: string): HTMLTimeElement {
    const time = document.createElement("time");
    const date = new Date(iso);
    time.dateTime = iso;
    time.textContent = new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date);
    time.title = date.toLocaleString(locale);
    return time;
}
