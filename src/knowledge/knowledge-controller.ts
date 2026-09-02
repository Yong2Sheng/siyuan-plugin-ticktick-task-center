import type { TaskCenterItem } from "../task-center/task-center-data";
import {
    createEmptyKnowledgeIndex,
    type KnowledgeDocumentItem,
    type KnowledgeIndex,
} from "./knowledge-index";
import type { KnowledgeScanReport, KnowledgeScanResult } from "./knowledge-scanner";
import {
    scheduleKnowledgeReview,
    selectKnowledgeReviewItem,
    type KnowledgeReviewMode,
    type KnowledgeReviewRating,
} from "./knowledge-review";

export type KnowledgeReviewSessionState = "idle" | "active" | "complete";

export type KnowledgeCenterState = {
    items: readonly KnowledgeDocumentItem[];
    lastScannedAt?: string;
    search: string;
    loading: boolean;
    scanning: boolean;
    loadError: boolean;
    scanError: boolean;
    lastReport?: KnowledgeScanReport;
    reviewSession: KnowledgeReviewSessionState;
    reviewMode?: KnowledgeReviewMode;
    reviewItem?: KnowledgeDocumentItem;
    reviewSaving: boolean;
    reviewError: boolean;
};

export type KnowledgeCenterControllerOptions = {
    loadIndex(): Promise<KnowledgeIndex>;
    saveIndex(index: KnowledgeIndex): Promise<void>;
    loadTasks(): Promise<readonly TaskCenterItem[]>;
    scan(
        tasks: readonly TaskCenterItem[],
        previousIndex: KnowledgeIndex,
    ): Promise<KnowledgeScanResult>;
    now?(): Date;
    random?(): number;
    onError?(error: unknown): void;
};

export class KnowledgeCenterController {
    private index = createEmptyKnowledgeIndex();
    private state: KnowledgeCenterState = {
        items: [],
        search: "",
        loading: false,
        scanning: false,
        loadError: false,
        scanError: false,
        reviewSession: "idle",
        reviewSaving: false,
        reviewError: false,
    };
    private readonly listeners = new Set<(state: KnowledgeCenterState) => void>();
    private readonly reviewedInSession = new Set<string>();
    private started = false;
    private destroyed = false;

    constructor(private readonly options: KnowledgeCenterControllerOptions) {}

    async start(): Promise<void> {
        if (this.destroyed || this.started) {
            return;
        }
        this.started = true;
        this.update({ loading: true, loadError: false });
        try {
            this.index = await this.options.loadIndex();
            if (this.destroyed) {
                return;
            }
            this.update({
                items: this.index.documents,
                ...(this.index.lastScannedAt ? { lastScannedAt: this.index.lastScannedAt } : {}),
                loading: false,
                loadError: false,
            });
        } catch (error) {
            if (this.destroyed) {
                return;
            }
            this.options.onError?.(error);
            this.update({ loading: false, loadError: true });
        }
    }

    async scan(): Promise<void> {
        if (this.destroyed || this.state.scanning) {
            return;
        }
        this.update({ scanning: true, scanError: false });
        try {
            const tasks = await this.options.loadTasks();
            const result = await this.options.scan(tasks, this.index);
            await this.options.saveIndex(result.index);
            if (this.destroyed) {
                return;
            }
            this.index = result.index;
            this.update({
                items: result.index.documents,
                lastScannedAt: result.index.lastScannedAt,
                lastReport: result.report,
                scanning: false,
                loadError: false,
                scanError: false,
            });
        } catch (error) {
            if (this.destroyed) {
                return;
            }
            this.options.onError?.(error);
            this.update({ scanning: false, scanError: true });
        }
    }

    setSearch(search: string): void {
        this.update({ search });
    }

    startReview(mode: KnowledgeReviewMode = "due"): void {
        if (this.destroyed || this.state.loading || this.state.reviewSaving) {
            return;
        }
        this.reviewedInSession.clear();
        const reviewItem = this.selectReviewItem(mode);
        this.update({
            reviewMode: mode,
            ...(reviewItem ? { reviewItem } : { reviewItem: undefined }),
            reviewSession: reviewItem ? "active" : "complete",
            reviewError: false,
        });
    }

    stopReview(): void {
        if (this.destroyed || this.state.reviewSaving) {
            return;
        }
        this.reviewedInSession.clear();
        this.update({
            reviewSession: "idle",
            reviewMode: undefined,
            reviewItem: undefined,
            reviewError: false,
        });
    }

    async submitReview(rating: KnowledgeReviewRating): Promise<void> {
        const current = this.state.reviewItem;
        const mode = this.state.reviewMode;
        if (
            this.destroyed
            || this.state.reviewSaving
            || this.state.reviewSession !== "active"
            || !current
            || !mode
        ) {
            return;
        }
        this.update({ reviewSaving: true, reviewError: false });
        try {
            const review = scheduleKnowledgeReview(
                current.review,
                rating,
                this.options.now?.() ?? new Date(),
            );
            const nextIndex: KnowledgeIndex = {
                ...this.index,
                documents: this.index.documents.map((item) => item.id === current.id
                    ? { ...item, review }
                    : item),
            };
            await this.options.saveIndex(nextIndex);
            if (this.destroyed) {
                return;
            }
            this.index = nextIndex;
            this.reviewedInSession.add(current.id);
            const reviewItem = this.selectReviewItem(mode);
            this.update({
                items: nextIndex.documents,
                ...(reviewItem ? { reviewItem } : { reviewItem: undefined }),
                reviewSession: reviewItem ? "active" : "complete",
                reviewSaving: false,
                reviewError: false,
            });
        } catch (error) {
            if (this.destroyed) {
                return;
            }
            this.options.onError?.(error);
            this.update({ reviewSaving: false, reviewError: true });
        }
    }

    subscribe(listener: (state: KnowledgeCenterState) => void): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    getState(): KnowledgeCenterState {
        return this.state;
    }

    destroy(): void {
        this.destroyed = true;
        this.reviewedInSession.clear();
        this.listeners.clear();
    }

    private selectReviewItem(mode: KnowledgeReviewMode): KnowledgeDocumentItem | undefined {
        return selectKnowledgeReviewItem(
            this.index.documents,
            mode,
            this.options.now?.() ?? new Date(),
            this.options.random ?? Math.random,
            this.reviewedInSession,
        );
    }

    private update(patch: Partial<KnowledgeCenterState>): void {
        if (this.destroyed) {
            return;
        }
        this.state = { ...this.state, ...patch };
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }
}
