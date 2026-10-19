import { getLocalDate } from "../domain/local-date";
import type { InboxNoteTier } from "./inbox-note";
import type { InboxLoadResult } from "./inbox-persistence";
import {
    addInboxNote,
    completeInboxNote,
    createEmptyInboxStore,
    createInboxNoteDraft,
    removeInboxNote,
    setInboxNoteTier,
    updateInboxNote,
    type InboxMutationFailure,
    type InboxMutationResult,
    type InboxStore,
} from "./inbox-store";

/**
 * 收件箱的唯一状态所有者。
 *
 * 便条数据不在思源块里，所以这里既是读取方也是写入方：
 * 每次改动都先算出下一份 store，保存成功后才替换内存状态——
 * 保存失败时界面必须继续显示旧内容，不能显示一份没落盘的新内容。
 */

export type InboxState = {
    store: InboxStore;
    loading: boolean;
    saving: boolean;
    error: boolean;
    /** 被丢弃的非法便条数，用于如实提示。 */
    droppedNoteCount: number;
};

/**
 * 界面可以先行拦截的失败：`save-failed` 来自持久化，
 * `title-required` 来自捕获框的预校验（正文可以空，标题不行）。
 */
export type InboxActionFailure =
    | InboxMutationFailure
    | "save-failed"
    | "title-required"
    | "not-loaded";

export type InboxActionResult =
    | { ok: true }
    | { ok: false; reason: InboxActionFailure };

export type InboxControllerOptions = {
    load(): Promise<InboxLoadResult>;
    save(store: InboxStore): Promise<void>;
    now?(): Date;
    onError?(error: unknown): void;
};

export class InboxController {
    private state: InboxState = {
        store: createEmptyInboxStore(),
        // 还没读过盘之前就是「加载中」，避免页签刚打开时先闪一下空收件箱
        loading: true,
        saving: false,
        error: false,
        droppedNoteCount: 0,
    };
    private readonly listeners = new Set<(state: InboxState) => void>();
    private queue: Promise<unknown> = Promise.resolve();
    private started = false;
    private destroyed = false;
    /** 只有成功读过盘之后才允许写入。 */
    private loaded = false;

    constructor(private readonly options: InboxControllerOptions) {}

    async start(): Promise<void> {
        if (this.destroyed || this.started) {
            return;
        }
        this.started = true;
        await this.refresh();
    }

    async refresh(): Promise<void> {
        if (this.destroyed) {
            return;
        }
        this.patch({ loading: true, error: false });
        try {
            const result = await this.options.load();
            if (this.destroyed) {
                return;
            }
            this.loaded = true;
            this.patch({
                store: result.store,
                droppedNoteCount: result.droppedNoteCount,
                loading: false,
                error: false,
            });
        } catch (error) {
            if (this.destroyed) {
                return;
            }
            this.options.onError?.(error);
            this.patch({ loading: false, error: true });
        }
    }

    getState(): InboxState {
        return this.state;
    }

    subscribe(listener: (state: InboxState) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    destroy(): void {
        this.destroyed = true;
        this.listeners.clear();
    }

    capture(text: string, tier: InboxNoteTier): Promise<InboxActionResult> {
        return this.mutate((store) => addInboxNote(
            store,
            createInboxNoteDraft(text, tier, this.now()),
        ));
    }

    complete(id: string): Promise<InboxActionResult> {
        return this.mutate((store) => completeInboxNote(store, id, this.now().toISOString()));
    }

    setTier(id: string, tier: InboxNoteTier): Promise<InboxActionResult> {
        return this.mutate((store) => setInboxNoteTier(store, id, tier));
    }

    /** 修改文字与分级；保存成功后才替换内存状态。 */
    update(id: string, text: string, tier: InboxNoteTier): Promise<InboxActionResult> {
        return this.mutate((store) => updateInboxNote(store, id, { text, tier }));
    }

    remove(id: string): Promise<InboxActionResult> {
        return this.mutate((store) => ({ ok: true, store: removeInboxNote(store, id) }));
    }

    /**
     * 便条已经转成真实任务块，把它从收件箱删掉。
     * 只做删除，不做创建——创建由「移入任务清单」那条链路先完成。
     */
    consume(id: string): Promise<InboxActionResult> {
        return this.remove(id);
    }

    getToday(): string {
        return getLocalDate(this.now());
    }

    private mutate(
        operation: (store: InboxStore) => InboxMutationResult,
    ): Promise<InboxActionResult> {
        return this.enqueue(async (): Promise<InboxActionResult> => {
            if (this.destroyed) {
                return { ok: false, reason: "note-not-found" };
            }
            // 没读过盘就绝不能写：内存里那份是空 store，
            // 直接保存会把用户已有的便条整份覆盖掉。
            if (!this.loaded) {
                await this.refresh();
                if (!this.loaded) {
                    return { ok: false, reason: "not-loaded" };
                }
            }
            const result = operation(this.state.store);
            if (!result.ok) {
                return { ok: false, reason: result.reason };
            }

            this.patch({ saving: true });
            try {
                await this.options.save(result.store);
            } catch (error) {
                if (!this.destroyed) {
                    this.options.onError?.(error);
                    this.patch({ saving: false });
                }
                return { ok: false, reason: "save-failed" };
            }
            if (this.destroyed) {
                return { ok: true };
            }
            this.patch({ store: result.store, saving: false });
            return { ok: true };
        });
    }

    /**
     * 串行化所有改动：便条存储是"读整份—改—写整份"，
     * 并发执行会互相覆盖，所以排队跑。
     */
    private enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.queue.then(operation, operation);
        this.queue = result.then(() => undefined, () => undefined);
        return result;
    }

    private now(): Date {
        return this.options.now?.() ?? new Date();
    }

    private patch(partial: Partial<InboxState>): void {
        this.state = { ...this.state, ...partial };
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }
}
