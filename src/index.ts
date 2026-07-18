import { Dialog, openTab, Plugin, showMessage, type Protyle } from "siyuan";

import { createTranslator, escapeHtml } from "./i18n";
import {
    deleteBlock,
    getBlockAttributes,
    getRootDocumentInfo,
    prependMarkdownBlock,
    setBlockAttributes,
    updateMarkdownBlock,
} from "./siyuan/blocks";
import { locateSiYuanBlock } from "./siyuan/navigation";
import {
    createTaskCenterEditSession,
    TaskCenterController,
} from "./task-center/task-center-controller";
import { loadTaskCenterData } from "./task-center/task-center-query";
import {
    TaskCenterTabService,
    type TaskCenterTabInstance,
} from "./task-center/task-center-tab";
import { TaskCenterView } from "./task-center/task-center-view";
import { createTaskBlock } from "./task-card/create-task";
import { getEditableRootDocumentId } from "./task-card/context";
import { TaskEditController } from "./task-card/edit-controller";
import { TaskCardLifecycle } from "./task-card/lifecycle";
import { showCreateTaskDialog } from "./task-card/task-form";
import "./index.scss";

export default class TickTickTaskCenterPlugin extends Plugin {
    private readonly activeDialogs = new Set<Dialog>();
    private taskCardLifecycle?: TaskCardLifecycle;
    private taskEditController?: TaskEditController;
    private taskCenterTab?: TaskCenterTabService;

    onload(): void {
        const translate = createTranslator(this.i18n);
        this.taskCardLifecycle = new TaskCardLifecycle(this.eventBus, {
            translate,
            loadAttributes: getBlockAttributes,
            repairMarkdown: updateMarkdownBlock,
            actions: {
                onEditTask: (blockId, { focus }) => {
                    if (focus === "status") {
                        void this.taskEditController?.open(blockId);
                    }
                },
            },
        });
        this.taskEditController = new TaskEditController({
            translate,
            taskLabel: translate("taskCard"),
            api: {
                loadAttributes: getBlockAttributes,
                updateMarkdownBlock,
                setBlockAttributes,
            },
            refreshBlock: (blockId) => this.taskCardLifecycle?.refreshBlockById(blockId)
                ?? Promise.resolve(false),
        });
        this.taskCenterTab = new TaskCenterTabService(this, {
            translate,
            openTab,
            createInstance: (target) => this.createTaskCenterInstance(
                target,
                translate,
            ),
        });
        this.taskCenterTab.registerTab();

        this.protyleSlash = [{
            id: "insertTickTickTaskCard",
            filter: ["滴答", "任务", "TickTick", "task"],
            html: `<div class="b3-list-item__first"><span class="b3-list-item__text">${escapeHtml(translate("taskCreate.slashName"))}</span></div>`,
            callback: (protyle: Protyle) => {
                void this.openCreateTaskDialog(protyle);
            },
        }];
    }

    onLayoutReady(): void {
        this.taskCardLifecycle?.start();
        this.taskCenterTab?.mountTopBar();
    }

    onunload(): void {
        this.taskCenterTab?.stop();
        this.taskCenterTab = undefined;
        this.taskEditController?.stop();
        this.taskEditController = undefined;
        this.taskCardLifecycle?.stop();
        this.taskCardLifecycle = undefined;
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
                const { blockId } = await createTaskBlock(
                    { prependMarkdownBlock, setBlockAttributes, deleteBlock },
                    {
                        rootDocumentId,
                        taskLabel: translate("taskCard"),
                        task,
                    },
                );
                this.taskCardLifecycle?.refreshBlock(protyle.protyle, blockId);
            },
            onDestroy: () => {
                this.activeDialogs.delete(dialog);
            },
        });
        this.activeDialogs.add(dialog);
    }

    private createTaskCenterInstance(
        target: HTMLElement,
        translate: ReturnType<typeof createTranslator>,
    ): TaskCenterTabInstance {
        const controller = new TaskCenterController({
            load: async () => {
                const result = await loadTaskCenterData();
                for (const invalid of result.invalidBlocks) {
                    console.warn(
                        `Skipped invalid TickTick task block ${invalid.blockId}: ${invalid.reason}`,
                    );
                }
                for (const incomplete of result.incompleteBlocks) {
                    console.warn(
                        `TickTick task block ${incomplete.blockId} is temporarily incomplete in the SQL index`,
                        { missingAttributes: incomplete.missingAttributes },
                    );
                }
                return result;
            },
            onError: (error) => console.error("Failed to load TickTick task center", error),
            onWarning: (message, detail) => console.warn(message, detail),
        });
        const editSession = createTaskCenterEditSession(controller, () => {
            showMessage(translate("taskCenterView.localUpdateUnavailable"), 5000, "info");
        });
        const view = new TaskCenterView(target, {
            controller,
            translate,
            locale: document.documentElement.lang || navigator.language,
            onEditTask: (blockId) => void this.taskEditController?.open(blockId, {
                onSaved: ({ result }) => {
                    editSession.apply(blockId, result.data);
                },
            }),
            onLocateTask: (blockId) => void this.locateTask(blockId, translate),
        });
        let started = false;
        return {
            start: async () => {
                if (started) {
                    return;
                }
                started = true;
                await controller.start();
            },
            destroy: () => {
                editSession.dispose();
                view.destroy();
                controller.destroy();
            },
        };
    }

    private async locateTask(
        blockId: string,
        translate: ReturnType<typeof createTranslator>,
    ): Promise<void> {
        try {
            await locateSiYuanBlock(this.app, blockId);
        } catch (error) {
            console.error(`Failed to locate TickTick task block ${blockId}`, error);
            showMessage(translate("taskCenterView.locateFailed"), 5000, "error");
        }
    }
}
