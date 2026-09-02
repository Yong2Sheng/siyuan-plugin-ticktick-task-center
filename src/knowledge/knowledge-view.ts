import type { Translate } from "../i18n";
import type { KnowledgeDocumentItem } from "./knowledge-index";
import type { KnowledgeScanReport } from "./knowledge-scanner";
import {
    KNOWLEDGE_REVIEW_RATINGS,
    countKnowledgeReviews,
    isKnowledgeReviewDue,
    type KnowledgeReviewMode,
    type KnowledgeReviewRating,
} from "./knowledge-review";
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
    onOpenError?(error: unknown): void;
};

export class KnowledgeCenterView {
    private readonly root = document.createElement("section");
    private readonly summary = document.createElement("div");
    private readonly reviewControls = document.createElement("div");
    private readonly reviewPanel = document.createElement("section");
    private readonly dueReviewButton = document.createElement("button");
    private readonly randomReviewButton = document.createElement("button");
    private readonly relearningButton = document.createElement("button");
    private readonly scanButton = document.createElement("button");
    private readonly searchInput = document.createElement("input");
    private readonly status = document.createElement("div");
    private readonly feedback = document.createElement("div");
    private readonly list = document.createElement("div");
    private readonly unsubscribe: () => void;
    private destroyed = false;

    constructor(target: HTMLElement, private readonly options: KnowledgeCenterViewOptions) {
        this.root.className = "ticktick-task-center__knowledge";
        this.summary.className = "ticktick-task-center__knowledge-summary";

        this.reviewControls.className = "ticktick-task-center__knowledge-review-controls";
        configureReviewButton(this.dueReviewButton, "due", options.controller);
        configureReviewButton(this.randomReviewButton, "random", options.controller);
        configureReviewButton(this.relearningButton, "relearning", options.controller);
        this.reviewControls.append(
            this.dueReviewButton,
            this.randomReviewButton,
            this.relearningButton,
        );
        this.reviewPanel.className = "ticktick-task-center__knowledge-review fn__none";
        this.reviewPanel.setAttribute("aria-live", "polite");

        const controls = document.createElement("div");
        controls.className = "ticktick-task-center__controls ticktick-task-center__knowledge-controls";
        this.scanButton.type = "button";
        this.scanButton.className = "b3-button b3-button--outline ticktick-task-center__knowledge-scan";
        this.scanButton.addEventListener("click", () => void options.controller.scan());
        this.searchInput.type = "search";
        this.searchInput.className = "b3-text-field ticktick-task-center__search ticktick-task-center__knowledge-search";
        this.searchInput.addEventListener("input", () => {
            options.controller.setSearch(this.searchInput.value);
        });
        controls.append(this.scanButton, this.searchInput);

        this.status.className = "ticktick-task-center__knowledge-status";
        this.status.setAttribute("role", "status");
        this.feedback.className = "ticktick-task-center__knowledge-feedback";
        this.list.className = "ticktick-task-center__knowledge-list";
        this.list.setAttribute("role", "list");

        this.root.append(
            this.summary,
            this.reviewControls,
            this.reviewPanel,
            controls,
            this.status,
            this.feedback,
            this.list,
        );
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
        const availableItems = state.items.filter((item) => item.available);
        const sourceCount = new Set(availableItems.map((item) => item.sourceDocumentId)).size;
        const unavailableCount = state.items.length - availableItems.length;
        const reviewCounts = countKnowledgeReviews(state.items, new Date());
        this.summary.replaceChildren(
            createSummaryItem(translate("knowledgeCenter.summaryAll"), state.items.length),
            createSummaryItem(translate("knowledgeCenter.summaryAvailable"), availableItems.length),
            createSummaryItem(translate("knowledgeCenter.summarySources"), sourceCount),
            createSummaryItem(translate("knowledgeCenter.summaryDue"), reviewCounts.due, "review"),
            createSummaryItem(
                translate("knowledgeCenter.summaryRelearning"),
                reviewCounts.relearning,
                reviewCounts.relearning > 0 ? "warning" : undefined,
            ),
            ...(unavailableCount > 0
                ? [createSummaryItem(translate("knowledgeCenter.summaryUnavailable"), unavailableCount, "warning")]
                : []),
        );

        this.dueReviewButton.textContent = translate("knowledgeCenter.startDueReview");
        this.randomReviewButton.textContent = translate("knowledgeCenter.startRandomReview");
        this.relearningButton.textContent = translate("knowledgeCenter.startRelearning");
        const reviewInProgress = state.reviewSession === "active" || state.reviewSaving;
        this.dueReviewButton.disabled = state.loading
            || reviewInProgress
            || reviewCounts.due === 0;
        this.randomReviewButton.disabled = state.loading
            || reviewInProgress
            || availableItems.length === 0;
        this.relearningButton.disabled = state.loading
            || reviewInProgress
            || reviewCounts.relearning === 0;
        this.renderReviewPanel(state);

        this.scanButton.textContent = translate(
            state.scanning
                ? "knowledgeCenter.scanning"
                : state.lastScannedAt
                    ? "knowledgeCenter.scanNew"
                    : "knowledgeCenter.initialize",
        );
        this.scanButton.disabled = state.loading
            || state.scanning
            || state.reviewSaving
            || state.reviewSession === "active";
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
        if (state.reviewError) {
            this.feedback.append(createFeedback(translate("knowledgeCenter.reviewSaveFailed"), "error"));
        }

        const visibleItems = filterKnowledgeDocuments(state.items, state.search);
        this.list.replaceChildren(...visibleItems.map((item) => this.createItem(item)));
        if (visibleItems.length > 0) {
            return;
        }
        const emptyKey = state.search.trim() !== ""
            ? "knowledgeCenter.emptySearch"
            : state.lastScannedAt
                ? "knowledgeCenter.emptyScanned"
                : "knowledgeCenter.emptyInitial";
        this.feedback.append(createFeedback(translate(emptyKey), "empty"));
    }

    private createItem(item: KnowledgeDocumentItem): HTMLElement {
        const { translate } = this.options;
        const article = document.createElement("article");
        article.className = "ticktick-task-center__knowledge-item";
        article.classList.toggle("ticktick-task-center__knowledge-item--unavailable", !item.available);
        article.setAttribute("role", "listitem");

        const badge = document.createElement("span");
        badge.className = "ticktick-task-center__knowledge-badge";
        badge.textContent = item.available
            ? translate("knowledgeCenter.badge")
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
        const updated = document.createElement("div");
        updated.className = "ticktick-task-center__knowledge-updated";
        updated.append(
            `${translate("taskCenterView.updated")}: `,
            createTime(item.updatedAt, this.getLocale()),
        );
        const review = document.createElement("div");
        review.className = "ticktick-task-center__knowledge-review-state";
        if (item.review) {
            review.append(
                `${translate("knowledgeCenter.lastReviewed")}: `,
                createTime(item.review.lastReviewedAt, this.getLocale()),
                ` · ${translate("knowledgeCenter.feedbackLabel")}: ${translate(reviewRatingKey(item.review.rating))}`,
                ` · ${translate("knowledgeCenter.nextReview")}: `,
                createTime(item.review.nextReviewAt, this.getLocale()),
            );
            if (item.review.needsRelearning) {
                const relearning = document.createElement("strong");
                relearning.textContent = translate("knowledgeCenter.relearningBadge");
                review.append(" · ", relearning);
            } else if (isKnowledgeReviewDue(item, new Date())) {
                review.classList.add("ticktick-task-center__knowledge-review-state--due");
            }
        } else {
            review.textContent = translate("knowledgeCenter.neverReviewed");
            review.classList.add("ticktick-task-center__knowledge-review-state--due");
        }
        content.append(title, source, path, updated, review);

        const actions = document.createElement("div");
        actions.className = "ticktick-task-center__knowledge-actions";
        const open = document.createElement("button");
        open.type = "button";
        open.className = "b3-button b3-button--outline ticktick-task-center__knowledge-open";
        open.textContent = translate("knowledgeCenter.openDocument");
        open.disabled = !item.available;
        open.addEventListener("click", () => void this.openDocument(item.id));
        const openSource = document.createElement("button");
        openSource.type = "button";
        openSource.className = "b3-button b3-button--outline ticktick-task-center__knowledge-open-source";
        openSource.textContent = translate("knowledgeCenter.openSource");
        openSource.addEventListener("click", () => void this.openSource(item.sourceDocumentId));
        actions.append(open, openSource);

        article.append(badge, content, actions);
        return article;
    }

    private renderReviewPanel(state: KnowledgeCenterState): void {
        this.reviewPanel.replaceChildren();
        this.reviewPanel.classList.toggle("fn__none", state.reviewSession === "idle");
        if (state.reviewSession === "idle") {
            return;
        }

        const { translate } = this.options;
        const header = document.createElement("div");
        header.className = "ticktick-task-center__knowledge-review-header";
        const heading = document.createElement("h2");
        heading.textContent = translate("knowledgeCenter.reviewHeading");
        const stop = document.createElement("button");
        stop.type = "button";
        stop.className = "b3-button b3-button--outline ticktick-task-center__knowledge-review-stop";
        stop.textContent = translate("knowledgeCenter.stopReview");
        stop.disabled = state.reviewSaving;
        stop.addEventListener("click", () => this.options.controller.stopReview());
        header.append(heading, stop);
        this.reviewPanel.append(header);

        const item = state.reviewItem;
        if (state.reviewSession === "complete" || !item) {
            const complete = document.createElement("div");
            complete.className = "ticktick-task-center__knowledge-review-complete";
            complete.textContent = translate(reviewCompleteKey(state.reviewMode));
            this.reviewPanel.append(complete);
            return;
        }

        const identity = document.createElement("div");
        identity.className = "ticktick-task-center__knowledge-review-identity";
        const title = document.createElement("h3");
        title.textContent = item.title;
        const source = document.createElement("div");
        source.textContent = `${translate("knowledgeCenter.sourceTask")}: ${item.sourceDocumentTitle}`;
        const path = document.createElement("div");
        path.textContent = item.documentPath;
        identity.append(title, source, path);

        const actions = document.createElement("div");
        actions.className = "ticktick-task-center__knowledge-review-actions";
        const open = document.createElement("button");
        open.type = "button";
        open.className = "b3-button b3-button--outline ticktick-task-center__knowledge-review-open";
        open.textContent = translate("knowledgeCenter.openForReview");
        open.addEventListener("click", () => void this.openDocument(item.id));
        const openSource = document.createElement("button");
        openSource.type = "button";
        openSource.className = "b3-button b3-button--outline ticktick-task-center__knowledge-review-open-source";
        openSource.textContent = translate("knowledgeCenter.openSource");
        openSource.addEventListener("click", () => void this.openSource(item.sourceDocumentId));
        actions.append(open, openSource);

        const prompt = document.createElement("p");
        prompt.className = "ticktick-task-center__knowledge-review-prompt";
        prompt.textContent = translate("knowledgeCenter.reviewPrompt");
        const ratings = document.createElement("div");
        ratings.className = "ticktick-task-center__knowledge-review-ratings";
        for (const rating of KNOWLEDGE_REVIEW_RATINGS) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `ticktick-task-center__knowledge-review-rating ticktick-task-center__knowledge-review-rating--${rating}`;
            button.dataset.rating = rating;
            button.textContent = translate(reviewRatingKey(rating));
            button.title = translate(reviewRatingDescriptionKey(rating));
            button.disabled = state.reviewSaving;
            button.addEventListener("click", () => void this.options.controller.submitReview(rating));
            ratings.append(button);
        }

        this.reviewPanel.append(identity, actions, prompt, ratings);
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

function filterKnowledgeDocuments(
    items: readonly KnowledgeDocumentItem[],
    search: string,
): KnowledgeDocumentItem[] {
    const query = search.trim().toLocaleLowerCase();
    if (query === "") {
        return [...items];
    }
    return items.filter((item) => [
        item.title,
        item.documentPath,
        item.sourceDocumentTitle,
        item.sourceDocumentPath,
    ].some((value) => value.toLocaleLowerCase().includes(query)));
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
    kind?: "warning" | "review",
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

function configureReviewButton(
    button: HTMLButtonElement,
    mode: KnowledgeReviewMode,
    controller: KnowledgeCenterController,
): void {
    button.type = "button";
    button.className = `b3-button b3-button--outline ticktick-task-center__knowledge-review-start ticktick-task-center__knowledge-review-start--${mode}`;
    button.addEventListener("click", () => controller.startReview(mode));
}

function reviewRatingKey(rating: KnowledgeReviewRating): string {
    return `knowledgeCenter.rating.${rating}.label`;
}

function reviewRatingDescriptionKey(rating: KnowledgeReviewRating): string {
    return `knowledgeCenter.rating.${rating}.description`;
}

function reviewCompleteKey(mode: KnowledgeReviewMode | undefined): string {
    switch (mode) {
        case "random":
            return "knowledgeCenter.randomReviewComplete";
        case "relearning":
            return "knowledgeCenter.relearningComplete";
        default:
            return "knowledgeCenter.dueReviewComplete";
    }
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
