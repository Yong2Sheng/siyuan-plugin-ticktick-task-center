import { confirm, Dialog, openTab, Plugin, showMessage, type Protyle } from "siyuan";

import en from "../public/i18n/en.json";
import zhCN from "../public/i18n/zh-CN.json";
import {
    createLanguageTranslator,
    DEFAULT_INTERFACE_LANGUAGE,
    escapeHtml,
    isInterfaceLanguage,
    type InterfaceLanguage,
    type Translate,
} from "./i18n";
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
import { saveDailyProgress } from "./task-center/daily-progress";
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
import { TaskDeleteController } from "./task-card/delete-controller";
import "./index.scss";

const LANGUAGE_PREFERENCE_FILE = "language.json";

export default class TickTickTaskCenterPlugin extends Plugin {
    private readonly activeDialogs = new Set<Dialog>();
    private taskCardLifecycle?: TaskCardLifecycle;
    private taskEditController?: TaskEditController;
    private taskDeleteController?: TaskDeleteController;
    private taskCenterTab?: TaskCenterTabService;
    private interfaceLanguage: InterfaceLanguage = DEFAULT_INTERFACE_LANGUAGE;
    private readonly translate = createLanguageTranslator(
        { "zh-CN": zhCN, en },
        () => this.interfaceLanguage,
    );

    onload(): void {
        const { translate } = this;
        this.taskDeleteController = new TaskDeleteController({
            translate,
            deleteBlock,
            confirm: (title, message) => new Promise((resolve) => {
                confirm(title, message, () => resolve(true), () => resolve(false));
            }),
            onDeleted: () => showMessage(translate("taskActions.deleted")),
            onError: (error, blockId) => {
                console.error(`Failed to delete TickTick task block ${blockId}`, error);
                showMessage(translate("taskActions.deleteFailed"), 7000, "error");
            },
        });
        this.taskCardLifecycle = new TaskCardLifecycle(this.eventBus, {
            translate,
            loadAttributes: getBlockAttributes,
            repairMarkdown: updateMarkdownBlock,
            actions: {
                onEditTask: (blockId, { focus }) => {
                    void this.taskEditController?.open(blockId, { focus });
                },
                onDeleteTask: (blockId, title) => {
                    void this.taskDeleteController?.request(blockId, title);
                },
                onOpenTaskCenter: () => {
                    void this.taskCenterTab?.open();
                },
            },
        });
        this.taskEditController = new TaskEditController({
            translate,
            taskLabel: () => translate("taskCard"),
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
        void this.loadLanguagePreference();
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
        this.taskDeleteController = undefined;
        this.taskCardLifecycle?.stop();
        this.taskCardLifecycle = undefined;
        for (const dialog of this.activeDialogs) {
            dialog.destroy();
        }
        this.activeDialogs.clear();
    }

    private async openCreateTaskDialog(protyle: Protyle): Promise<void> {
        const { translate } = this;
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
        translate: Translate,
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
            locale: () => this.interfaceLanguage === "zh-CN" ? "zh-CN" : "en-US",
            onToggleLanguage: () => this.toggleInterfaceLanguage(),
            onEditTask: (blockId, focus) => void this.taskEditController?.open(blockId, {
                focus,
                onSaved: ({ result }) => {
                    editSession.apply(blockId, result.data);
                },
            }),
            onLocateTask: (blockId, rootId, notebookId) => void this.locateTask(
                { blockId, rootId, notebookId },
                translate,
            ),
            onDeleteTask: (blockId, title) => this.taskDeleteController?.request(blockId, title)
                ?? Promise.resolve(false),
            onSaveDailyProgress: (blockId, date) => saveDailyProgress(
                { setBlockAttributes },
                blockId,
                date,
            ),
            onDailyProgressError: (error) => {
                console.error("Failed to update daily TickTick task progress", error);
                showMessage(translate("taskCenterView.dailyProgressFailed"), 5000, "error");
            },
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
            refreshLanguage: () => view.refreshLanguage(),
        };
    }

    private async locateTask(
        location: { blockId: string; rootId: string; notebookId?: string },
        translate: Translate,
    ): Promise<void> {
        try {
            await locateSiYuanBlock(this.app, location);
        } catch (error) {
            console.error(`Failed to locate TickTick task block ${location.blockId}`, error);
            showMessage(translate("taskCenterView.locateFailed"), 5000, "error");
        }
    }

    private async loadLanguagePreference(): Promise<void> {
        try {
            const stored: unknown = await this.loadData(LANGUAGE_PREFERENCE_FILE);
            const language = typeof stored === "object" && stored !== null
                ? (stored as { language?: unknown }).language
                : stored;
            if (isInterfaceLanguage(language)) {
                this.applyInterfaceLanguage(language);
            }
        } catch (error) {
            console.warn("Failed to load TickTick Task Center language preference", error);
        }
    }

    private async toggleInterfaceLanguage(): Promise<void> {
        const nextLanguage: InterfaceLanguage = this.interfaceLanguage === "zh-CN"
            ? "en"
            : "zh-CN";
        try {
            await this.saveData(LANGUAGE_PREFERENCE_FILE, { language: nextLanguage });
            this.applyInterfaceLanguage(nextLanguage);
        } catch (error) {
            console.error("Failed to save TickTick Task Center language preference", error);
            showMessage(this.translate("taskCenterView.switchLanguageFailed"), 5000, "error");
        }
    }

    private applyInterfaceLanguage(language: InterfaceLanguage): void {
        if (language === this.interfaceLanguage) {
            return;
        }
        this.interfaceLanguage = language;
        const slashCommand = this.protyleSlash.find(({ id }) => id === "insertTickTickTaskCard");
        if (slashCommand) {
            slashCommand.html = `<div class="b3-list-item__first"><span class="b3-list-item__text">${escapeHtml(this.translate("taskCreate.slashName"))}</span></div>`;
        }
        this.taskCenterTab?.refreshLanguage();
        void this.taskCardLifecycle?.refreshAll();
    }
}
