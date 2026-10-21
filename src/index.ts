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
import { locateSiYuanBlock, openSiYuanBlock } from "./siyuan/navigation";
import {
    createDocument,
    listChildDocuments,
    listNotebooks,
    searchDocuments,
} from "./siyuan/documents";
import { insertMarkdownBlockAfter } from "./siyuan/blocks";
import {
    InboxController,
    type InboxActionFailure,
} from "./inbox/inbox-controller";
import { loadInboxStore, saveInboxStore, type InboxPersistenceApi } from "./inbox/inbox-persistence";
import { findInboxNote } from "./inbox/inbox-store";
import { splitInboxNoteText } from "./inbox/inbox-note";
import type { InboxNote } from "./inbox/inbox-note";
import { selectPendingInboxNotes } from "./inbox/inbox-store";
import { showPromoteInboxNoteDialog } from "./inbox/promote-dialog";
import { showQuickCaptureDialog } from "./inbox/quick-capture-dialog";
import { showEditInboxNoteDialog } from "./inbox/edit-note-dialog";
import { DEFAULT_INBOX_NOTE_TIER, type InboxNoteTier } from "./inbox/inbox-note";
import {
    promoteToTaskList,
    promoteToTaskListOrThrow,
    resolveTargetDocument,
} from "./inbox/promote";
import {
    createTaskCenterEditSession,
    TaskCenterController,
} from "./task-center/task-center-controller";
import { saveDailyProgress } from "./task-center/daily-progress";
import { saveTaskPriority } from "./task-center/task-priority";
import {
    setTaskFocusOrder,
    toggleTaskFocusDate,
} from "./task-center/focus-plan";
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
import { KnowledgeCenterController } from "./knowledge/knowledge-controller";
import {
    KNOWLEDGE_INDEX_FILE,
    parseKnowledgeIndex,
} from "./knowledge/knowledge-index";
import { scanKnowledgeDocuments } from "./knowledge/knowledge-scanner";
import {
    clearKnowledgeOrganizedMark,
    loadKnowledgeOrganizedMarks,
    writeKnowledgeOrganizedMark,
} from "./knowledge/knowledge-organized";
import "./index.scss";

const LANGUAGE_PREFERENCE_FILE = "language.json";
const QUICK_CAPTURE_ICON_ID = "iconTickTickQuickCapture";
const QUICK_CAPTURE_ICON = `<symbol id="${QUICK_CAPTURE_ICON_ID}" viewBox="4 4 24 24">
    <path d="M13 4 6 14h5l-1 8 7-10h-5l1-8Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
</symbol>`;

export default class TickTickTaskCenterPlugin extends Plugin {
    private readonly activeDialogs = new Set<Dialog>();
    private inboxController?: InboxController;
    private taskCardLifecycle?: TaskCardLifecycle;
    private taskEditController?: TaskEditController;
    private taskDeleteController?: TaskDeleteController;
    private taskCenterTab?: TaskCenterTabService;
    private quickCaptureButton?: HTMLElement;
    private quickCaptureDialog?: Dialog;
    /** 上次用过的分级，收件箱捕获框与快速记录弹窗共用。 */
    private lastCaptureTier: InboxNoteTier = DEFAULT_INBOX_NOTE_TIER;
    private interfaceLanguage: InterfaceLanguage = DEFAULT_INTERFACE_LANGUAGE;
    private readonly translate = createLanguageTranslator(
        { "zh-CN": zhCN, en },
        () => this.interfaceLanguage,
    );

    onload(): void {
        const { translate } = this;
        const inboxApi: InboxPersistenceApi = {
            loadData: (file) => this.loadData(file),
            saveData: (file, value) => this.saveData(file, value),
        };
        this.inboxController = new InboxController({
            load: () => loadInboxStore(inboxApi),
            save: (store) => saveInboxStore(inboxApi, store),
            onError: (error) => console.error("Failed to read the SiYuan Task Center inbox", error),
        });
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
                onOpenSiYuanTarget: (blockId) => {
                    void this.openSiYuanTarget(blockId, translate);
                },
                onToggleDailyProgress: async (blockId, date) => {
                    await saveDailyProgress(
                        { loadAttributes: getBlockAttributes, setBlockAttributes },
                        blockId,
                        date,
                    );
                    // 写后重新读取该块属性并局部重建卡片，让按钮状态跟上。
                    await this.taskCardLifecycle?.refreshBlockById(blockId);
                },
                onDailyProgressError: (error) => {
                    console.error("Failed to update daily TickTick task progress", error);
                    showMessage(translate("taskCenterView.dailyProgressFailed"), 5000, "error");
                },
                onSavePriority: (blockId, priority) => saveTaskPriority(
                    { loadAttributes: getBlockAttributes, setBlockAttributes },
                    blockId,
                    priority,
                ),
                onPriorityError: (error) => {
                    console.error("Failed to update TickTick task priority", error);
                    showMessage(translate("priority.saveFailed"), 5000, "error");
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
            filter: ["思源", "滴答", "链接", "任务", "SiYuan", "TickTick", "link", "task"],
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
        this.addIcons(QUICK_CAPTURE_ICON);
        this.quickCaptureButton = this.addTopBar({
            icon: QUICK_CAPTURE_ICON_ID,
            title: this.translate("quickCapture.openTooltip"),
            position: "right",
            callback: () => void this.openQuickCapture(),
        });
    }

    onunload(): void {
        this.quickCaptureButton?.remove();
        this.quickCaptureButton = undefined;
        this.quickCaptureDialog?.destroy();
        this.quickCaptureDialog = undefined;
        this.inboxController?.destroy();
        this.inboxController = undefined;
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

    private getFormalInboxNotes(): InboxNote[] {
        const store = this.inboxController?.getState().store;
        return store ? selectPendingInboxNotes(store).formal : [];
    }

    private showInboxActionFailure(failure: InboxActionFailure): void {
        const message = this.translate(`inbox.errors.${failure}`);
        showMessage(message, 6000, "error");
    }

    private async openCreateTaskDialog(protyle: Protyle): Promise<void> {
        const { translate } = this;
        // 带入列表必须来自最新数据：用户可能从未打开过任务中心。
        await this.inboxController?.refresh();
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
            inboxNotes: this.getFormalInboxNotes(),
            onCreate: async (task, inboxNoteId) => {
                const inboxController = this.requireInboxController();
                const note = inboxNoteId
                    ? findInboxNote(inboxController.getState().store, inboxNoteId)
                    : undefined;
                const noteBody = note ? splitInboxNoteText(note.text).body : "";
                const { blockId } = await promoteToTaskListOrThrow({
                    createTaskBlock: (request) => createTaskBlock(
                        { prependMarkdownBlock, setBlockAttributes, deleteBlock },
                        request,
                    ),
                    insertNoteBody: async (blockId, markdown) => {
                        await insertMarkdownBlockAfter(blockId, markdown);
                    },
                    removeInboxNote: async (noteId) => (await inboxController.consume(noteId)).ok,
                }, {
                    rootDocumentId,
                    taskLabel: translate("taskCard"),
                    task,
                    ...(inboxNoteId ? { noteId: inboxNoteId } : {}),
                    ...(noteBody ? { noteBody } : {}),
                });
                // 先让卡片渲染出来：任务块已经建好了，后面无论便条出了什么状况，
                // 文档里的这张卡片都应该立刻可见。
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
            onError: (error) => console.error("Failed to load SiYuan Task Center", error),
            onWarning: (message, detail) => console.warn(message, detail),
        });
        const editSession = createTaskCenterEditSession(controller, () => {
            showMessage(translate("taskCenterView.localUpdateUnavailable"), 5000, "info");
        });
        const knowledgeController = new KnowledgeCenterController({
            loadIndex: async () => parseKnowledgeIndex(await this.loadData(KNOWLEDGE_INDEX_FILE)),
            saveIndex: async (index) => {
                await this.saveData(KNOWLEDGE_INDEX_FILE, index);
            },
            loadTasks: async () => {
                await controller.refresh();
                const state = controller.getState();
                if (state.error) {
                    throw new Error("Task refresh failed before knowledge scan");
                }
                return state.items;
            },
            scan: (tasks, previousIndex) => scanKnowledgeDocuments(tasks, previousIndex, {
                listChildDocuments,
                setBlockAttributes,
                getBlockAttributes,
                loadOrganizedMarks: loadKnowledgeOrganizedMarks,
            }),
            writeOrganizedMark: async (blockId, organizedAt) => {
                await writeKnowledgeOrganizedMark(
                    { loadAttributes: getBlockAttributes, setAttributes: setBlockAttributes },
                    blockId,
                    organizedAt,
                );
            },
            clearOrganizedMark: (blockId) => clearKnowledgeOrganizedMark(
                { loadAttributes: getBlockAttributes, setAttributes: setBlockAttributes },
                blockId,
            ),
            now: () => new Date(),
            onError: (error) => console.error("Failed to update the knowledge document index", error),
        });
        const inboxController = this.requireInboxController();
        const view = new TaskCenterView(target, {
            controller,
            inboxController,
            onPromoteInboxNote: (note) => this.openPromoteDialog(note, translate, controller),
            onEditInboxNote: (note) => this.openInboxNoteEditDialog(note, translate),
            onInboxActionFailed: (failure) => this.showInboxActionFailure(failure),
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
            onOpenSiYuanTarget: (blockId) => void this.openSiYuanTarget(blockId, translate),
            onDeleteTask: (blockId, title) => this.taskDeleteController?.request(blockId, title)
                ?? Promise.resolve(false),
            onSaveDailyProgress: (blockId, date) => saveDailyProgress(
                { loadAttributes: getBlockAttributes, setBlockAttributes },
                blockId,
                date,
            ),
            onDailyProgressError: (error) => {
                console.error("Failed to update daily TickTick task progress", error);
                showMessage(translate("taskCenterView.dailyProgressFailed"), 5000, "error");
            },
            onSavePriority: (blockId, priority) => saveTaskPriority(
                { loadAttributes: getBlockAttributes, setBlockAttributes },
                blockId,
                priority,
            ),
            onPriorityError: (error) => {
                console.error("Failed to update TickTick task priority", error);
                showMessage(translate("priority.saveFailed"), 5000, "error");
            },
            onToggleFocusDate: (blockId, targetDate, today, mode) => toggleTaskFocusDate(
                { loadAttributes: getBlockAttributes, setBlockAttributes },
                blockId,
                targetDate,
                today,
                mode,
            ),
            onSetFocusOrder: (blockId, focusDate, order) => setTaskFocusOrder(
                { loadAttributes: getBlockAttributes, setBlockAttributes },
                blockId,
                focusDate,
                order,
            ),
            onFocusPlanError: (error) => {
                console.error("Failed to update TickTick task focus plan", error);
                // 重点日期已与截止日期解耦，不再有「晚于截止日期」这一类失败。
                showMessage(translate("taskCenterView.focusPlanFailed"), 5000, "error");
            },
            knowledgeController,
            onOpenKnowledgeDocument: (documentId) => openSiYuanBlock(this.app, documentId),
            onOpenKnowledgeSource: (documentId) => openSiYuanBlock(this.app, documentId),
            onKnowledgeNotify: (messageKey) => showMessage(translate(messageKey), 3000, "info"),
            onKnowledgeOpenError: (error) => {
                console.error("Failed to open a knowledge center document", error);
                showMessage(translate("knowledgeCenter.openFailed"), 5000, "error");
            },
        });
        let started = false;
        return {
            start: async () => {
                if (started) {
                    return;
                }
                started = true;
                await Promise.all([
                    controller.start(),
                    inboxController.refresh(),
                    knowledgeController.start(),
                ]);
            },
            destroy: () => {
                editSession.dispose();
                view.destroy();
                knowledgeController.destroy();
                controller.destroy();
            },
            refreshLanguage: () => view.refreshLanguage(),
        };
    }

    /**
     * 顶栏「快速记录」：不必先打开任务中心页签。
     *
     * 打开前先读一次盘——控制器本身也会拦住"没读盘就写"，
     * 但这里主动读一次能让用户看到最新的收件箱状态。
     */
    private async openQuickCapture(): Promise<void> {
        const existing = this.quickCaptureDialog;
        if (existing) {
            existing.element.querySelector<HTMLInputElement>('[data-field="title"]')?.focus();
            return;
        }
        const controller = this.requireInboxController();
        await controller.refresh();
        if (this.quickCaptureDialog) {
            return;
        }

        let dialog: Dialog;
        dialog = showQuickCaptureDialog({
            translate: this.translate,
            initialTier: this.lastCaptureTier,
            onCapture: async (text, tier) => {
                this.lastCaptureTier = tier;
                return controller.capture(text, tier);
            },
            onDestroy: () => {
                this.quickCaptureDialog = undefined;
                this.activeDialogs.delete(dialog);
            },
        });
        this.quickCaptureDialog = dialog;
        this.activeDialogs.add(dialog);
    }

    private requireInboxController(): InboxController {
        const controller = this.inboxController;
        if (!controller) {
            throw new Error("The SiYuan Task Center inbox controller is not ready");
        }
        return controller;
    }

    /**
     * 编辑收件箱便条：只改插件数据文件里的文字与分级，
     * 不创建任务块，也不写任何思源笔记内容。
     */
    private openInboxNoteEditDialog(note: InboxNote, translate: Translate): void {
        const controller = this.requireInboxController();
        let dialog: Dialog;
        dialog = showEditInboxNoteDialog({
            translate,
            note,
            locale: this.interfaceLanguage === "zh-CN" ? "zh-CN" : "en-US",
            onSave: (text, tier) => controller.update(note.id, text, tier),
            onDestroy: () => {
                this.activeDialogs.delete(dialog);
            },
        });
        this.activeDialogs.add(dialog);
    }

    /**
     * 入口 1：从收件箱移入任务清单。
     * 目标位置必须由用户在文档树里选；成功后立刻刷新当前任务中心列表。
     */
    private openPromoteDialog(
        note: InboxNote,
        translate: Translate,
        taskController: TaskCenterController,
    ): void {
        const inboxController = this.requireInboxController();
        let dialog: Dialog;
        dialog = showPromoteInboxNoteDialog({
            translate,
            note,
            pickerApi: { listNotebooks, listChildDocuments, searchDocuments },
            onCreate: async ({ target, task }) => {
                const resolved = await resolveTargetDocument({ createDocument }, target);
                if (!resolved.ok) {
                    return { ok: false, reason: resolved.reason };
                }
                const noteBody = splitInboxNoteText(note.text).body;
                const result = await promoteToTaskList({
                    createTaskBlock: (request) => createTaskBlock(
                        { prependMarkdownBlock, setBlockAttributes, deleteBlock },
                        request,
                    ),
                    insertNoteBody: async (blockId, markdown) => {
                        await insertMarkdownBlockAfter(blockId, markdown);
                    },
                    removeInboxNote: async (noteId) => (await inboxController.consume(noteId)).ok,
                }, {
                    rootDocumentId: resolved.documentId,
                    taskLabel: translate("taskCard"),
                    task,
                    noteId: note.id,
                    ...(noteBody ? { noteBody } : {}),
                });
                if (result.ok) {
                    await taskController.refresh();
                }
                return result;
            },
            onDestroy: () => {
                this.activeDialogs.delete(dialog);
            },
        });
        this.activeDialogs.add(dialog);
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

    private async openSiYuanTarget(blockId: string, translate: Translate): Promise<void> {
        try {
            await openSiYuanBlock(this.app, blockId);
        } catch (error) {
            console.error(`Failed to open SiYuan task target ${blockId}`, error);
            showMessage(translate("taskTarget.openSiYuanFailed"), 5000, "error");
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
            console.warn("Failed to load SiYuan Task Center language preference", error);
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
            console.error("Failed to save SiYuan Task Center language preference", error);
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
        if (this.quickCaptureButton) {
            const title = this.translate("quickCapture.openTooltip");
            this.quickCaptureButton.title = title;
            this.quickCaptureButton.setAttribute("aria-label", title);
        }
        this.taskCenterTab?.refreshLanguage();
        void this.taskCardLifecycle?.refreshAll();
    }
}
