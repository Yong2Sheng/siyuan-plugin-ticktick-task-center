import { Dialog, Plugin, showMessage, type Protyle } from "siyuan";

import { createTranslator, escapeHtml } from "./i18n";
import { deleteBlock, getRootDocumentInfo, prependMarkdownBlock, setBlockAttributes } from "./siyuan/blocks";
import { createTaskBlock } from "./task-card/create-task";
import { getEditableRootDocumentId } from "./task-card/context";
import { showCreateTaskDialog } from "./task-card/task-form";
import "./index.scss";

export default class TickTickTaskCenterPlugin extends Plugin {
    private readonly activeDialogs = new Set<Dialog>();

    onload(): void {
        const translate = createTranslator(this.i18n);
        this.protyleSlash = [{
            id: "insertTickTickTaskCard",
            filter: ["滴答", "任务", "TickTick", "task"],
            html: `<div class="b3-list-item__first"><span class="b3-list-item__text">${escapeHtml(translate("taskCreate.slashName"))}</span></div>`,
            callback: (protyle: Protyle) => {
                void this.openCreateTaskDialog(protyle);
            },
        }];
    }

    onunload(): void {
        for (const dialog of this.activeDialogs) {
            dialog.destroy();
        }
        this.activeDialogs.clear();
    }

    private async openCreateTaskDialog(protyle: Protyle): Promise<void> {
        const translate = createTranslator(this.i18n);
        const rootDocumentId = getEditableRootDocumentId(protyle);
        if (rootDocumentId === null) {
            showMessage(translate("taskCreate.errors.documentUnavailable"), 7000, "error");
            return;
        }

        let initialTitle = "";
        try {
            const documentInfo = await getRootDocumentInfo(rootDocumentId);
            if (documentInfo === null) {
                showMessage(translate("taskCreate.errors.documentUnavailable"), 7000, "error");
                return;
            }
            initialTitle = documentInfo.title;
        } catch (error) {
            console.error("Failed to get the current SiYuan document title", error);
            showMessage(translate("taskCreate.errors.titleUnavailable"), 5000, "error");
        }

        let dialog: Dialog;
        dialog = showCreateTaskDialog({
            translate,
            initialTitle,
            onCreate: async (task) => {
                await createTaskBlock(
                    { prependMarkdownBlock, setBlockAttributes, deleteBlock },
                    {
                        rootDocumentId,
                        taskLabel: translate("taskCard"),
                        task,
                    },
                );
            },
            onDestroy: () => {
                this.activeDialogs.delete(dialog);
            },
        });
        this.activeDialogs.add(dialog);
    }
}
