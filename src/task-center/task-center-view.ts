import { TASK_STATUS_CONFIG } from "../domain/status";
import type { Translate } from "../i18n";
import type { TaskCenterItem } from "./task-center-data";
import {
    countTaskCenterItems,
    filterTaskCenterItems,
    TASK_CENTER_FILTERS,
    type TaskCenterFilter,
} from "./task-center-filter";
import { TaskCenterController, type TaskCenterState } from "./task-center-controller";
import {
    getLocalDate,
    isProgressedToday,
    millisecondsUntilNextLocalDay,
} from "./daily-progress";

export type TaskCenterViewOptions = {
    controller: TaskCenterController;
    translate: Translate;
    locale?: string;
    onEditTask(blockId: string): void;
    onLocateTask(blockId: string): void;
    onSaveDailyProgress(blockId: string, date: string | undefined): Promise<void>;
    onDailyProgressError?(error: unknown): void;
};

type DailyTaskAction = false | "toggle" | "completed";

export class TaskCenterView {
    private readonly root = document.createElement("section");
    private readonly refreshButton = document.createElement("button");
    private readonly summary = document.createElement("div");
    private readonly filterButtons = new Map<TaskCenterFilter, HTMLButtonElement>();
    private readonly searchInput = document.createElement("input");
    private readonly notice = document.createElement("div");
    private readonly feedback = document.createElement("div");
    private readonly list = document.createElement("div");
    private readonly pendingDailyProgress = new Set<string>();
    private readonly unsubscribe: () => void;
    private dayBoundaryTimer?: number;
    private destroyed = false;
    private readonly handleWindowFocus = (): void => {
        if (!this.destroyed) {
            this.render(this.options.controller.getState());
            this.scheduleDayBoundary();
        }
    };

    constructor(target: HTMLElement, private readonly options: TaskCenterViewOptions) {
        this.root.className = "ticktick-task-center";

        const header = document.createElement("header");
        header.className = "ticktick-task-center__header";
        const heading = document.createElement("h1");
        heading.className = "ticktick-task-center__heading";
        heading.textContent = options.translate("taskCenterView.title");
        this.refreshButton.type = "button";
        this.refreshButton.className = "b3-button b3-button--outline ticktick-task-center__refresh";
        this.refreshButton.addEventListener("click", () => void options.controller.refresh());
        header.append(heading, this.refreshButton);

        this.summary.className = "ticktick-task-center__summary";

        const controls = document.createElement("div");
        controls.className = "ticktick-task-center__controls";
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
        this.searchInput.placeholder = options.translate("taskCenterView.searchPlaceholder");
        this.searchInput.addEventListener("input", () => options.controller.setSearch(this.searchInput.value));
        controls.append(filters, this.searchInput);

        this.notice.className = "ticktick-task-center__notice fn__none";
        this.notice.setAttribute("role", "status");
        this.feedback.className = "ticktick-task-center__feedback";
        this.list.className = "ticktick-task-center__list";
        this.list.setAttribute("role", "list");

        this.root.append(header, this.summary, controls, this.notice, this.feedback, this.list);
        target.append(this.root);
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
        this.root.remove();
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
        this.refreshButton.textContent = translate(
            state.refreshing ? "taskCenterView.refreshing" : "taskCenterView.refresh",
        );
        this.refreshButton.disabled = state.loading || state.refreshing;
        this.searchInput.value = state.search;

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

        const visibleItems = filterTaskCenterItems(
            state.items,
            state.filter,
            state.search,
            translate,
        );
        let hasVisibleItems = visibleItems.length > 0;
        if (state.filter === "active") {
            const pendingItems = visibleItems.filter((item) => (
                !isProgressedToday(item.lastProgressedDate, today)
            ));
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
            hasVisibleItems = pendingItems.length + progressedItems.length + completedItems.length > 0;
            if (hasVisibleItems) {
                this.list.replaceChildren(
                    this.createPendingGroup(pendingItems, today),
                    this.createProgressGroup(progressedItems, completedItems, today),
                );
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
    ): HTMLElement {
        const { translate } = this.options;
        const status = TASK_STATUS_CONFIG[item.status];
        const article = document.createElement("article");
        article.className = "ticktick-task-center__item";
        article.setAttribute("data-status-tone", status.tone);
        article.setAttribute("role", "listitem");

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
        statusButton.addEventListener("click", () => this.options.onEditTask(item.blockId));

        const content = document.createElement("div");
        content.className = "ticktick-task-center__content";
        const title = document.createElement("button");
        title.type = "button";
        title.className = "ticktick-task-center__title";
        title.textContent = item.title;
        title.addEventListener("click", () => this.options.onLocateTask(item.blockId));
        const source = document.createElement("div");
        source.className = "ticktick-task-center__source";
        source.textContent = `${translate("taskCenterView.source")}: ${item.documentTitle}`;
        const path = document.createElement("div");
        path.className = "ticktick-task-center__path";
        path.textContent = item.documentPath;
        const updated = document.createElement("div");
        updated.className = "ticktick-task-center__updated";
        updated.append(`${translate("taskCenterView.updated")}: `, createTime(item.updatedAt, this.options.locale));
        content.append(title, source, path, updated);

        const actions = document.createElement("div");
        actions.className = "ticktick-task-center__actions";
        if (dailyAction === "toggle") {
            actions.append(this.createDailyProgressButton(item, today));
        } else if (dailyAction === "completed") {
            actions.append(this.createDailyCompletedBadge());
        }
        const locate = document.createElement("button");
        locate.type = "button";
        locate.className = "b3-button b3-button--outline ticktick-task-center__locate";
        locate.textContent = translate("taskCenterView.locate");
        locate.addEventListener("click", () => this.options.onLocateTask(item.blockId));
        const external = document.createElement("a");
        external.className = "b3-button b3-button--text ticktick-task-center__external";
        external.href = item.url;
        external.target = "_blank";
        external.rel = "noopener noreferrer";
        external.textContent = `${translate("taskCenterView.openTickTick")} ↗️`;
        actions.append(locate, external);

        article.append(statusButton, content, actions);
        return article;
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
            await this.options.onSaveDailyProgress(item.blockId, nextDate);
            if (!this.options.controller.applyDailyProgress(item.blockId, nextDate)) {
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
            this.scheduleDayBoundary();
        }, millisecondsUntilNextLocalDay());
    }
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
