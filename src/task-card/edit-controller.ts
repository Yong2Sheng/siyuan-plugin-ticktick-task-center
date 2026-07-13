import { showMessage } from "siyuan";

import type { Translate } from "../i18n";
import { editTask, type TaskEditApi } from "./edit-task";
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

export class TaskEditController {
    private readonly dialogs = new EditDialogManager<EditTaskDialog>();
    private readonly warn: (message: string, detail?: unknown) => void;

    constructor(private readonly options: TaskEditControllerOptions) {
        this.warn = options.warn ?? ((message, detail) => console.error(message, detail));
    }

    async open(blockId: string): Promise<void> {
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
                    onDestroy: removeDialog,
                });
            });
        } catch (error) {
            this.warn(`TickTick task editor could not be opened for ${blockId}`, error);
        }
    }

    stop(): void {
        this.dialogs.destroyAll();
    }
}
