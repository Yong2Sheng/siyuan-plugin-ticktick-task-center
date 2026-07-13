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

export type TaskCenterViewOptions = {
    controller: TaskCenterController;
    translate: Translate;
    locale?: string;
    onEditTask(blockId: string): void;
    onLocateTask(blockId: string): void;
};

export class TaskCenterView {
    private readonly root = document.createElement("section");
    private readonly refreshButton = document.createElement("button");
    private readonly summary = document.createElement("div");
    private readonly filterButtons = new Map<TaskCenterFilter, HTMLButtonElement>();
    private readonly searchInput = document.createElement("input");
    private readonly notice = document.createElement("div");
    private readonly feedback = document.createElement("div");
    private readonly list = document.createElement("div");
    private readonly unsubscribe: () => void;

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
    }

    destroy(): void {
        this.unsubscribe();
        this.root.remove();
    }

    private render(state: TaskCenterState): void {
        const { translate } = this.options;
        const statistics = countTaskCenterItems(state.items);
        this.refreshButton.textContent = translate(
            state.refreshing ? "taskCenterView.refreshing" : "taskCenterView.refresh",
        );
        this.refreshButton.disabled = state.loading || state.refreshing;
        this.searchInput.value = state.search;

        this.summary.replaceChildren(
            createSummaryItem(translate("taskCenterView.summaryAll"), statistics.all),
            createSummaryItem(translate("taskCenterView.summaryActive"), statistics.active),
            createSummaryItem(translate("taskCenterView.summaryClosed"), statistics.closed),
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
        this.list.replaceChildren(...visibleItems.map((item) => this.createTaskItem(item)));
        if (visibleItems.length === 0) {
            const key = getEmptyStateKey(state);
            this.feedback.append(createFeedback(translate(key), "empty"));
        }
    }

    private createTaskItem(item: TaskCenterItem): HTMLElement {
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
}

function createSummaryItem(label: string, count: number): HTMLElement {
    const item = document.createElement("span");
    item.className = "ticktick-task-center__summary-item";
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
