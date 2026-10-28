import type { Translate } from "../i18n";
import { escapeHtml } from "../i18n";

export type TaskDeleteControllerOptions = {
    translate: Translate;
    deleteBlock(blockId: string): Promise<void>;
    confirm(title: string, message: string): Promise<boolean>;
    onDeleted?(): void;
    onError?(error: unknown, blockId: string): void;
};

export class TaskDeleteController {
    private readonly pending = new Map<string, Promise<boolean>>();

    constructor(private readonly options: TaskDeleteControllerOptions) {}

    request(blockId: string, taskTitle: string, childCount = 0): Promise<boolean> {
        const existing = this.pending.get(blockId);
        if (existing) {
            return existing;
        }

        const operation = this.run(blockId, taskTitle, childCount);
        this.pending.set(blockId, operation);
        const cleanup = () => {
            if (this.pending.get(blockId) === operation) {
                this.pending.delete(blockId);
            }
        };
        void operation.then(cleanup, cleanup);
        return operation;
    }

    private async run(blockId: string, taskTitle: string, childCount: number): Promise<boolean> {
        const confirmed = await this.options.confirm(
            this.options.translate("taskActions.deleteConfirmTitle"),
            this.options.translate(childCount > 0
                ? "taskActions.deleteConfirmWithChildren"
                : "taskActions.deleteConfirmMessage")
                .replace("${title}", escapeHtml(taskTitle))
                .replace("${count}", String(childCount)),
        );
        if (!confirmed) {
            return false;
        }

        try {
            await this.options.deleteBlock(blockId);
        } catch (error) {
            this.options.onError?.(error, blockId);
            return false;
        }
        this.options.onDeleted?.();
        return true;
    }
}
