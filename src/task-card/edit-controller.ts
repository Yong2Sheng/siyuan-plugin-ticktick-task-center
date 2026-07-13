import { showMessage } from "siyuan";

import type { Translate } from "../i18n";
import { editTask, type EditTaskResult, type TaskEditApi } from "./edit-task";
import {
    EditDialogManager,
} from "./edit-dialog-manager";
import { showEditTaskDialog, type EditTaskDialog } from "./edit-task-form";
import { parseTaskBlockAttributes } from "./task-data";

export type TaskEditControllerOptions = {
    translate: Translate;
    taskLabel: string;
    api: TaskEditApi;
    refreshBlock(blockId: string): Promise<boolean>;
    warn?: (message: string, detail?: unknown) => void;
};

export type SuccessfulTaskEditResult = {
    blockId: string;
    result: Extract<EditTaskResult, { changed: true }>;
};

export type OpenTaskEditOptions = {
    onSaved?(result: SuccessfulTaskEditResult): void;
};

export class TaskEditController {
    private readonly dialogs = new EditDialogManager<EditTaskDialog>();
    private readonly onSaved = new Map<string, NonNullable<OpenTaskEditOptions["onSaved"]>>();
    private readonly warn: (message: string, detail?: unknown) => void;

    constructor(private readonly options: TaskEditControllerOptions) {
        this.warn = options.warn ?? ((message, detail) => console.error(message, detail));
    }

    async open(blockId: string, options: OpenTaskEditOptions = {}): Promise<void> {
        if (options.onSaved) {
            this.onSaved.set(blockId, options.onSaved);
        } else {
            this.onSaved.delete(blockId);
        }
        try {
            await this.dialogs.open(blockId, async (removeDialog) => {
                let attributes: Record<string, unknown>;
                try {
                    attributes = await this.options.api.loadAttributes(blockId);
                } catch (error) {
                    this.warn(`TickTick task ${blockId} could not be loaded for editing`, error);
                    showMessage(this.options.translate("taskEdit.errors.blockUnavailable"), 7000, "error");
                    throw error;
                }

                const parsed = parseTaskBlockAttributes(attributes);
                if (!parsed.valid) {
                    this.warn(`TickTick task ${blockId} is invalid and cannot be edited: ${parsed.reason}`);
                    showMessage(this.options.translate("taskEdit.errors.currentDataInvalid"), 7000, "error");
                    throw new Error(parsed.reason);
                }

                return showEditTaskDialog({
                    translate: this.options.translate,
                    initial: parsed.data,
                    onSave: async (next) => {
                        const result = await editTask(this.options.api, {
                            blockId,
                            original: parsed.data,
                            taskLabel: this.options.taskLabel,
                            next,
                        });
                        if (result.changed) {
                            const onSaved = this.onSaved.get(blockId);
                            this.onSaved.delete(blockId);
                            try {
                                onSaved?.({ blockId, result });
                            } catch (error) {
                                this.warn(`TickTick task ${blockId} was saved but its caller could not apply the result`, error);
                            }
                            try {
                                const refreshed = await this.options.refreshBlock(blockId);
                                if (!refreshed) {
                                    this.warn(`TickTick task ${blockId} was saved but no open card was available to refresh`);
                                }
                            } catch (error) {
                                this.warn(`TickTick task ${blockId} was saved but its card could not be refreshed`, error);
                            }
                        }
                        return result;
                    },
                    onDestroy: () => {
                        this.onSaved.delete(blockId);
                        removeDialog();
                    },
                });
            });
        } catch (error) {
            this.onSaved.delete(blockId);
            this.warn(`TickTick task editor could not be opened for ${blockId}`, error);
        }
    }

    stop(): void {
        this.onSaved.clear();
        this.dialogs.destroyAll();
    }
}
