import type { Translate } from "../i18n";
import type { KnowledgeDocumentItem } from "./knowledge-index";
import type { KnowledgeScanReport } from "./knowledge-scanner";
import {
    countKnowledgeItems,
    filterKnowledgeItems,
    isKnowledgeUpdated,
    type KnowledgeCounts,
    type KnowledgeFilter,
} from "./knowledge-status";
import {
    KnowledgeCenterController,
    type KnowledgeCenterState,
} from "./knowledge-controller";

export type KnowledgeCenterViewOptions = {
    controller: KnowledgeCenterController;
    translate: Translate;
    locale?: string | (() => string);
    onOpenDocument(documentId: string): Promise<void>;
    onOpenSource(documentId: string): Promise<void>;
    onNotify?(messageKey: string): void;
    onOpenError?(error: unknown): void;
};

const FILTERS: readonly { key: KnowledgeFilter; labelKey: string }[] = [
    { key: "all", labelKey: "knowledgeCenter.filterAll" },
    { key: "unorganized", labelKey: "knowledgeCenter.filterUnorganized" },
    { key: "organized", labelKey: "knowledgeCenter.filterOrganized" },
    { key: "updated", labelKey: "knowledgeCenter.filterUpdated" },
];

export class KnowledgeCenterView {
    private readonly root = document.createElement("section");
    private readonly summary = document.createElement("div");
    private readonly scanButton = document.createElement("button");
    private readonly filterGroup = document.createElement("div");
    private readonly filterButtons = new Map<KnowledgeFilter, HTMLButtonElement>();
    private readonly searchInput = document.createElement("input");
    private readonly status = document.createElement("div");
    private readonly feedback = document.createElement("div");
    private readonly list = document.createElement("div");
    private readonly unsubscribe: () => void;
    private destroyed = false;

    constructor(target: HTMLElement, private readonly options: KnowledgeCenterViewOptions) {
        this.root.className = "ticktick-task-center__knowledge";
        this.summary.className = "ticktick-task-center__knowledge-summary";

        const controls = document.createElement("div");
        controls.className = "ticktick-task-center__controls ticktick-task-center__knowledge-controls";
        this.scanButton.type = "button";
        this.scanButton.className = "b3-button b3-button--outline ticktick-task-center__knowledge-scan";
        this.scanButton.addEventListener("click", () => void options.controller.scan());

        this.filterGroup.className = "ticktick-task-center__filters";
        this.filterGroup.setAttribute("role", "group");
        for (const filter of FILTERS) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "ticktick-task-center__filter";
            button.addEventListener("click", () => options.controller.setFilter(filter.key));
            this.filterButtons.set(filter.key, button);
            this.filterGroup.append(button);
        }

        this.searchInput.type = "search";
        this.searchInput.className = "b3-text-field ticktick-task-center__search ticktick-task-center__knowledge-search";
        this.searchInput.addEventListener("input", () => {
            options.controller.setSearch(this.searchInput.value);
        });
        controls.append(this.scanButton, this.filterGroup, this.searchInput);

        this.status.className = "ticktick-task-center__knowledge-status";
        this.status.setAttribute("aria-live", "polite");
        this.feedback.className = "ticktick-task-center__knowledge-feedback";
        this.list.className = "ticktick-task-center__knowledge-list";
        this.list.setAttribute("role", "list");

        this.root.append(this.summary, controls, this.status, this.feedback, this.list);
        target.append(this.root);
        this.unsubscribe = options.controller.subscribe((state) => this.render(state));
    }

    destroy(): void {
        this.destroyed = true;
        this.unsubscribe();
        this.root.remove();
    }

    refreshLanguage(): void {
        if (!this.destroyed) {
            this.render(this.options.controller.getState());
        }
    }

    private render(state: KnowledgeCenterState): void {
        const { translate } = this.options;
        const counts = countKnowledgeItems(state.items);
        this.summary.replaceChildren(
            createSummaryItem(translate("knowledgeCenter.summaryAll"), counts.all),
            createSummaryItem(translate("knowledgeCenter.summaryUnorganized"), counts.unorganized, "primary"),
            createSummaryItem(translate("knowledgeCenter.summaryOrganized"), counts.organized, "success"),
            ...(counts.updated > 0
                ? [createSummaryItem(translate("knowledgeCenter.summaryUpdated"), counts.updated, "warning")]
                : []),
            ...(counts.unavailable > 0
                ? [createSummaryItem(translate("knowledgeCenter.summaryUnavailable"), counts.unavailable, "warning")]
                : []),
        );

        this.filterGroup.setAttribute("aria-label", translate("knowledgeCenter.filterLabel"));
        for (const [key, button] of this.filterButtons) {
            button.textContent = translate(
                FILTERS.find((filter) => filter.key === key)?.labelKey
                    ?? "knowledgeCenter.filterAll",
            );
            button.classList.toggle("ticktick-task-center__filter--active", key === state.filter);
            button.setAttribute("aria-pressed", String(key === state.filter));
            if (key === "updated") {
                button.title = translate("knowledgeCenter.filterUpdatedTitle");
            }
        }

        this.scanButton.textContent = translate(
            state.scanning
                ? "knowledgeCenter.scanning"
                : state.lastScannedAt
                    ? "knowledgeCenter.scanNew"
                    : "knowledgeCenter.initialize",
        );
        this.scanButton.disabled = state.loading
            || state.scanning
            || state.savingIds.size > 0;
        this.searchInput.value = state.search;
        this.searchInput.placeholder = translate("knowledgeCenter.searchPlaceholder");

        this.status.replaceChildren();
        if (state.lastScannedAt) {
            const lastScan = document.createElement("div");
            lastScan.className = "ticktick-task-center__knowledge-last-scan";
            lastScan.append(
                `${translate("knowledgeCenter.lastScanned")}: `,
                createTime(state.lastScannedAt, this.getLocale()),
            );
            this.status.append(lastScan);
        }
        if (state.lastReport) {
            const report = document.createElement("div");
            report.className = "ticktick-task-center__knowledge-report";
            report.textContent = formatReport(state.lastReport, translate);
            this.status.append(report);
        }

        this.feedback.replaceChildren();
        if (state.loading) {
            this.feedback.append(createFeedback(translate("knowledgeCenter.loading"), "loading"));
            this.list.replaceChildren();
            return;
        }
        if (state.loadError) {
            this.feedback.append(createFeedback(translate("knowledgeCenter.loadFailed"), "error"));
        }
        if (state.scanError) {
            this.feedback.append(createFeedback(translate("knowledgeCenter.scanFailed"), "error"));
        }
        if (state.saveError) {
            this.feedback.append(createFeedback(translate("knowledgeCenter.saveFailed"), "error"));
        }
        if (state.cacheError) {
            this.feedback.append(createFeedback(translate("knowledgeCenter.cacheFailed"), "error"));
        }

        const visibleItems = filterKnowledgeItems(state.items, state.filter, state.search);
        this.list.replaceChildren(
            ...visibleItems.map((item) => this.createItem(item, state.savingIds.has(item.id))),
        );
        if (visibleItems.length > 0) {
            return;
        }
        if (!state.loadError) {
            this.feedback.append(createFeedback(
                emptyMessage(state, counts, translate),
                "empty",
            ));
        }
    }

    private createItem(item: KnowledgeDocumentItem, busy: boolean): HTMLElement {
        const { translate } = this.options;
        const organized = Boolean(item.organizedAt);
        const organizedAvailable = organized && item.available;
        const updated = isKnowledgeUpdated(item);
        const article = document.createElement("article");
        article.className = "ticktick-task-center__knowledge-item";
        article.classList.toggle("ticktick-task-center__knowledge-item--unavailable", !item.available);
        article.classList.toggle("ticktick-task-center__knowledge-item--organized", organizedAvailable);
        article.setAttribute("role", "listitem");
        article.setAttribute("aria-busy", String(busy));

        const badge = document.createElement("span");
        badge.className = "ticktick-task-center__knowledge-badge";
        badge.classList.toggle("ticktick-task-center__knowledge-badge--organized", organizedAvailable);
        badge.textContent = item.available
            ? organized
                ? translate("knowledgeCenter.badgeOrganized")
                : translate("knowledgeCenter.badgeUnorganized")
            : translate("knowledgeCenter.unavailableBadge");

        const content = document.createElement("div");
        content.className = "ticktick-task-center__knowledge-content";
        const title = document.createElement("button");
        title.type = "button";
        title.className = "ticktick-task-center__knowledge-title";
        title.textContent = item.title;
        title.disabled = !item.available;
        title.addEventListener("click", () => void this.openDocument(item.id));
        const source = document.createElement("div");
        source.className = "ticktick-task-center__knowledge-source";
        source.textContent = `${translate("knowledgeCenter.sourceTask")}: ${item.sourceDocumentTitle}`;
        const path = document.createElement("div");
        path.className = "ticktick-task-center__knowledge-path";
        path.textContent = item.documentPath;
        const updatedAt = document.createElement("div");
        updatedAt.className = "ticktick-task-center__knowledge-updated";
        updatedAt.append(
            `${translate("taskCenterView.updated")}: `,
            createTime(item.updatedAt, this.getLocale()),
        );
        content.append(title, source, path, updatedAt);

        if (organized && item.organizedAt) {
            const organizedLine = document.createElement("div");
            organizedLine.className = "ticktick-task-center__knowledge-organized";
            organizedLine.append(
                `${translate("knowledgeCenter.organizedOn")}: `,
                createTime(item.organizedAt, this.getLocale()),
            );
            if (updated) {
                const hint = document.createElement("span");
                hint.className = "ticktick-task-center__knowledge-organized-updated";
                hint.textContent = ` · ${translate("knowledgeCenter.updatedAfterOrganizing")}`;
                organizedLine.append(hint);
            }
            content.append(organizedLine);
        }

        const actions = document.createElement("div");
        actions.className = "ticktick-task-center__knowledge-actions";
        actions.append(
            this.createActionButton(
                "b3-button b3-button--outline ticktick-task-center__knowledge-open",
                translate("knowledgeCenter.openDocument"),
                !item.available,
                () => void this.openDocument(item.id),
            ),
            this.createActionButton(
                "b3-button b3-button--outline ticktick-task-center__knowledge-open-source",
                translate("knowledgeCenter.openSource"),
                !item.available,
                () => void this.openSource(item.sourceDocumentId),
            ),
        );
        if (item.available) {
            if (organized) {
                actions.append(this.createActionButton(
                    "b3-button b3-button--outline ticktick-task-center__knowledge-unmark",
                    translate("knowledgeCenter.unmarkOrganized"),
                    busy,
                    () => void this.clearOrganized(item),
                ));
                if (updated) {
                    actions.append(this.createActionButton(
                        "b3-button ticktick-task-center__knowledge-mark",
                        translate("knowledgeCenter.refreshOrganized"),
                        busy,
                        () => void this.markOrganized(item),
                    ));
                }
            } else {
                actions.append(this.createActionButton(
                    "b3-button ticktick-task-center__knowledge-mark",
                    translate("knowledgeCenter.markOrganized"),
                    busy,
                    () => void this.markOrganized(item),
                ));
            }
        }

        article.append(badge, content, actions);
        return article;
    }

    private createActionButton(
        className: string,
        label: string,
        disabled: boolean,
        action: () => void,
    ): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener("click", action);
        return button;
    }

    private async markOrganized(item: KnowledgeDocumentItem): Promise<void> {
        const refreshed = Boolean(item.organizedAt);
        const ok = await this.options.controller.markOrganized(item.id);
        if (!ok || this.destroyed) {
            return;
        }
        this.options.onNotify?.(
            refreshed
                ? "knowledgeCenter.toastRefreshed"
                : "knowledgeCenter.toastMarked",
        );
    }

    private async clearOrganized(item: KnowledgeDocumentItem): Promise<void> {
        const ok = await this.options.controller.clearOrganized(item.id);
        if (!ok || this.destroyed) {
            return;
        }
        this.options.onNotify?.("knowledgeCenter.toastUnmarked");
    }

    private async openDocument(documentId: string): Promise<void> {
        try {
            await this.options.onOpenDocument(documentId);
        } catch (error) {
            this.options.onOpenError?.(error);
        }
    }

    private async openSource(documentId: string): Promise<void> {
        try {
            await this.options.onOpenSource(documentId);
        } catch (error) {
            this.options.onOpenError?.(error);
        }
    }

    private getLocale(): string | undefined {
        return typeof this.options.locale === "function"
            ? this.options.locale()
            : this.options.locale;
    }
}

function emptyMessage(
    state: KnowledgeCenterState,
    counts: KnowledgeCounts,
    translate: Translate,
): string {
    if (state.search.trim() !== "") {
        return translate("knowledgeCenter.emptySearch");
    }
    if (!state.lastScannedAt && counts.all === 0) {
        return translate("knowledgeCenter.emptyInitial");
    }
    if (state.filter === "unorganized") {
        if (counts.available === 0) {
            return translate("knowledgeCenter.emptyScanned");
        }
        if (counts.updated > 0) {
            return translate("knowledgeCenter.emptyUnorganizedWithUpdates")
                .replace("${count}", String(counts.updated));
        }
        return translate("knowledgeCenter.emptyUnorganized");
    }
    if (state.filter === "organized") {
        return translate("knowledgeCenter.emptyOrganized");
    }
    if (state.filter === "updated") {
        return translate("knowledgeCenter.emptyUpdated");
    }
    return state.lastScannedAt
        ? translate("knowledgeCenter.emptyScanned")
        : translate("knowledgeCenter.emptyInitial");
}

function formatReport(
    report: KnowledgeScanReport,
    translate: Translate,
): string {
    return translate("knowledgeCenter.scanReport")
        .replace("${tasks}", String(report.taskDocumentCount))
        .replace("${examined}", String(report.examinedDocumentCount))
        .replace("${added}", String(report.addedDocumentCount))
        .replace("${existing}", String(report.existingDocumentCount))
        .replace("${unavailable}", String(report.unavailableDocumentCount))
        .replace("${failed}", String(report.failedDocumentCount));
}

function createSummaryItem(
    label: string,
    count: number,
    kind?: "warning" | "primary" | "success",
): HTMLElement {
    const item = document.createElement("span");
    item.className = "ticktick-task-center__knowledge-summary-item";
    if (kind) {
        item.classList.add(`ticktick-task-center__knowledge-summary-item--${kind}`);
    }
    const value = document.createElement("strong");
    value.textContent = String(count);
    item.append(`${label} `, value);
    return item;
}

function createFeedback(message: string, kind: "loading" | "error" | "empty"): HTMLElement {
    const element = document.createElement("div");
    element.className = `ticktick-task-center__knowledge-${kind}`;
    element.textContent = message;
    return element;
}

function createTime(iso: string, locale?: string): HTMLTimeElement {
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
