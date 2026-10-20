import type { Translate } from "../i18n";
import {
    DEFAULT_INBOX_NOTE_TIER,
    INBOX_NOTE_TIERS,
    splitInboxNoteText,
    type InboxNote,
    type InboxNoteTier,
} from "./inbox-note";
import { renderMarkdownBlocks } from "./inbox-markdown";
import {
    InboxController,
    type InboxActionFailure,
    type InboxState,
} from "./inbox-controller";
import { selectInboxNotesCompletedOn, selectPendingInboxNotes } from "./inbox-store";

export type InboxViewOptions = {
    controller: InboxController;
    translate: Translate;
    /** 上次用过的分级，和快速记录弹窗共用同一个偏好。 */
    initialTier?: InboxNoteTier;
    onTierChange?(tier: InboxNoteTier): void;
    locale?: string | (() => string);
    /** 打开「移入任务清单」弹窗；真正的建块与删便条由插件层完成。 */
    onPromote(note: InboxNote): void;
    /** 打开编辑便条的弹窗；保存仍走控制器。 */
    onEdit(note: InboxNote): void;
    onActionFailed(failure: InboxActionFailure): void;
};

/**
 * 收件箱分区。
 *
 * 便条只展示「文字 + 时间」，操作只有完成、移入任务清单、编辑、改级和删除五种，
 * 没有状态、截止日期、工作分类——那些一旦出现在便条上就变成任务字段了。
 */
export class InboxView {
    private readonly root = document.createElement("section");
    private readonly captureForm = document.createElement("form");
    private readonly titleInput = document.createElement("input");
    private readonly bodyInput = document.createElement("textarea");
    private readonly previewToggle = document.createElement("button");
    private readonly previewHost = document.createElement("div");
    private readonly tierGroup = document.createElement("div");
    private readonly tierButtons = new Map<InboxNoteTier, HTMLButtonElement>();
    private readonly submitButton = document.createElement("button");
    private readonly captureHint = document.createElement("span");
    private readonly summary = document.createElement("div");
    private readonly feedback = document.createElement("div");
    private readonly list = document.createElement("div");
    private readonly pendingNoteIds = new Set<string>();
    private readonly expandedNoteIds = new Set<string>();
    private readonly unsubscribe: () => void;
    private tier: InboxNoteTier;
    private doneOpen = false;
    private destroyed = false;
    private previewVisible = false;
    private composing = false;
    private previewTimer: number | undefined;

    constructor(target: HTMLElement, private readonly options: InboxViewOptions) {
        const { translate } = options;
        this.tier = options.initialTier ?? DEFAULT_INBOX_NOTE_TIER;
        this.root.className = "ticktick-task-center__inbox";

        this.captureForm.className = "ticktick-task-center__inbox-capture";
        const captureLabel = document.createElement("span");
        captureLabel.className = "ticktick-task-center__inbox-capture-label";
        captureLabel.textContent = translate("inbox.captureLabel");

        // 标题用单行输入框：结构上就不可能混入换行，标题与正文不会再糊在一起
        this.titleInput.id = "ticktick-inbox-title";
        this.titleInput.type = "text";
        this.titleInput.autocomplete = "off";
        this.titleInput.className = "ticktick-task-center__inbox-title-input";
        this.titleInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.isComposing) {
                event.preventDefault();
                void this.submitCapture();
            }
        });

        this.bodyInput.id = "ticktick-inbox-body";
        this.bodyInput.className = "ticktick-task-center__inbox-input";
        this.bodyInput.rows = 3;
        this.bodyInput.addEventListener("keydown", (event) => {
            // 正文里回车换行；保存用 ⌘/Ctrl+回车，避免正常换行被当成提交
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.isComposing) {
                event.preventDefault();
                void this.submitCapture();
            }
        });
        this.bodyInput.addEventListener("input", () => this.schedulePreview());
        // 输入法组合期间不刷新预览，避免把中间态当成最终正文渲染
        this.bodyInput.addEventListener("compositionstart", () => {
            this.composing = true;
            window.clearTimeout(this.previewTimer);
        });
        this.bodyInput.addEventListener("compositionend", () => {
            this.composing = false;
            this.schedulePreview();
        });

        const titleField = document.createElement("label");
        titleField.className = "ticktick-task-center__inbox-field";
        titleField.htmlFor = this.titleInput.id;
        const titleLabel = document.createElement("span");
        titleLabel.className = "ticktick-task-center__inbox-field-label";
        titleLabel.dataset.fieldLabel = "title";
        titleField.append(titleLabel, this.titleInput);

        // 正文上方是「正文（可选）」和预览开关；开关必须放在 label 外面，
        // 否则点开关会触发 label 的聚焦行为，把焦点抢回正文框。
        this.previewToggle.type = "button";
        this.previewToggle.className = "ticktick-task-center__inbox-preview-toggle";
        this.previewToggle.setAttribute("aria-pressed", "false");
        this.previewToggle.setAttribute("aria-controls", "ticktick-inbox-preview");
        this.previewToggle.addEventListener("click", () => this.togglePreview());
        this.previewHost.id = "ticktick-inbox-preview";
        this.previewHost.className = "ticktick-task-center__inbox-preview-host";

        const bodyField = document.createElement("div");
        bodyField.className = "ticktick-task-center__inbox-field";
        const bodyHead = document.createElement("div");
        bodyHead.className = "ticktick-task-center__inbox-body-head";
        const bodyLabel = document.createElement("label");
        bodyLabel.className = "ticktick-task-center__inbox-field-label";
        bodyLabel.htmlFor = this.bodyInput.id;
        bodyLabel.dataset.fieldLabel = "body";
        bodyHead.append(bodyLabel, this.previewToggle);
        bodyField.append(bodyHead, this.bodyInput, this.previewHost);

        const captureRow = document.createElement("div");
        captureRow.className = "ticktick-task-center__inbox-capture-row";
        this.tierGroup.className = "ticktick-task-center__inbox-tier";
        this.tierGroup.setAttribute("role", "radiogroup");
        this.tierGroup.setAttribute("aria-label", translate("inbox.tierGroupLabel"));
        for (const tier of INBOX_NOTE_TIERS) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "ticktick-task-center__inbox-tier-option";
            button.dataset.tier = tier;
            button.setAttribute("role", "radio");
            button.addEventListener("click", () => this.setTier(tier));
            this.tierButtons.set(tier, button);
            this.tierGroup.append(button);
        }

        this.captureHint.className = "ticktick-task-center__inbox-capture-hint";
        this.captureHint.textContent = translate("inbox.captureHint");

        this.submitButton.type = "submit";
        this.submitButton.className = "b3-button b3-button--text ticktick-task-center__inbox-submit";
        this.submitButton.textContent = translate("inbox.captureSubmit");

        captureRow.append(this.tierGroup, this.captureHint, this.submitButton);
        this.captureForm.append(captureLabel, titleField, bodyField, captureRow);
        this.captureForm.addEventListener("submit", (event) => {
            event.preventDefault();
            void this.submitCapture();
        });

        this.summary.className = "ticktick-task-center__inbox-summary";
        this.feedback.className = "ticktick-task-center__inbox-feedback";
        this.list.className = "ticktick-task-center__list ticktick-task-center__inbox-list";
        this.list.setAttribute("role", "list");

        this.root.append(this.captureForm, this.summary, this.feedback, this.list);
        target.append(this.root);

        this.unsubscribe = options.controller.subscribe((state) => this.render(state));
        this.render(options.controller.getState());
    }

    destroy(): void {
        this.destroyed = true;
        window.clearTimeout(this.previewTimer);
        this.previewTimer = undefined;
        this.unsubscribe();
        this.root.remove();
    }

    refreshLanguage(): void {
        if (!this.destroyed) {
            this.render(this.options.controller.getState());
        }
    }

    focusCapture(): void {
        this.titleInput.focus();
    }

    /** 正文输入后延迟刷新预览；只替换预览 DOM，不碰输入框的焦点和光标。 */
    private schedulePreview(): void {
        window.clearTimeout(this.previewTimer);
        if (!this.previewVisible || this.composing || this.destroyed) {
            return;
        }
        this.previewTimer = window.setTimeout(() => {
            this.previewTimer = undefined;
            if (this.destroyed || !this.previewVisible) {
                return;
            }
            this.renderPreview();
        }, 200);
    }

    private togglePreview(): void {
        window.clearTimeout(this.previewTimer);
        this.previewTimer = undefined;
        this.previewVisible = !this.previewVisible;
        this.updatePreviewToggle();
        this.renderPreview();
    }

    private updatePreviewToggle(): void {
        this.previewToggle.textContent = this.options.translate(
            this.previewVisible ? "inbox.hidePreview" : "inbox.showPreview",
        );
        this.previewToggle.setAttribute("aria-pressed", String(this.previewVisible));
    }

    /**
     * 预览只渲染正文，和列表卡片共用 renderMarkdownBlocks。
     * 预览是只读的视觉副本，标 aria-hidden，避免读屏把同一段正文念两遍。
     */
    private renderPreview(): void {
        this.previewHost.replaceChildren();
        if (!this.previewVisible) {
            return;
        }
        const source = this.bodyInput.value.trim();
        if (source === "") {
            const emptyHint = document.createElement("p");
            emptyHint.className = "ticktick-task-center__inbox-preview-hint";
            emptyHint.textContent = this.options.translate("inbox.previewEmpty");
            this.previewHost.append(emptyHint);
            return;
        }

        const preview = document.createElement("div");
        preview.className = "ticktick-task-center__inbox-preview";
        preview.setAttribute("aria-hidden", "true");

        const head = document.createElement("div");
        head.className = "ticktick-task-center__inbox-preview-head";
        const label = document.createElement("span");
        label.textContent = this.options.translate("inbox.preview");
        const hint = document.createElement("span");
        hint.textContent = this.options.translate("inbox.previewHint");
        head.append(label, hint);

        const body = document.createElement("div");
        body.className = "ticktick-task-center__inbox-preview-body";
        body.append(...renderMarkdownBlocks(source, document));

        preview.append(head, body);
        this.previewHost.append(preview);
    }

    private setTier(tier: InboxNoteTier): void {
        this.tier = tier;
        this.options.onTierChange?.(tier);
        this.renderTierButtons();
    }

    /** 标题 + 空行 + 正文拼回便条的那一份文字，存储结构不变。 */
    private composeCaptureText(): string {
        const title = this.titleInput.value.trim();
        const body = this.bodyInput.value.trim();
        return body === "" ? title : `${title}\n\n${body}`;
    }

    private async submitCapture(): Promise<void> {
        // 标题必填：只有正文时若放行，组合出来的文字会以空段落开头，
        // 存下来就是一张没有标题的便条。
        if (this.titleInput.value.trim() === "") {
            this.options.onActionFailed("title-required");
            return;
        }
        const text = this.composeCaptureText();
        if (text === "") {
            this.options.onActionFailed("text-empty");
            return;
        }
        this.submitButton.disabled = true;
        const result = await this.options.controller.capture(text, this.tier);
        if (this.destroyed) {
            return;
        }
        this.submitButton.disabled = false;
        if (!result.ok) {
            // 失败时保留输入内容，用户不用重打一遍
            this.options.onActionFailed(result.reason);
            return;
        }
        this.titleInput.value = "";
        this.bodyInput.value = "";
        // 记完一笔回到紧凑态，把预览占的高度立刻还给列表
        window.clearTimeout(this.previewTimer);
        this.previewTimer = undefined;
        this.previewVisible = false;
        this.updatePreviewToggle();
        this.previewHost.replaceChildren();
        this.titleInput.focus();
    }

    private render(state: InboxState): void {
        if (this.destroyed) {
            return;
        }
        const { translate } = this.options;
        this.titleInput.placeholder = translate("inbox.titlePlaceholder");
        this.bodyInput.placeholder = translate("inbox.bodyPlaceholder");
        const titleLabel = this.captureForm.querySelector<HTMLElement>('[data-field-label="title"]');
        const bodyLabel = this.captureForm.querySelector<HTMLElement>('[data-field-label="body"]');
        if (titleLabel) {
            titleLabel.textContent = translate("inbox.titleLabel");
        }
        if (bodyLabel) {
            bodyLabel.textContent = translate("inbox.bodyLabel");
        }
        this.captureHint.textContent = translate("inbox.captureHint");
        this.submitButton.textContent = translate("inbox.captureSubmit");
        this.submitButton.disabled = state.saving;
        this.updatePreviewToggle();
        this.renderPreview();
        this.renderTierButtons();

        const today = this.options.controller.getToday();
        const pending = selectPendingInboxNotes(state.store);
        const completedToday = selectInboxNotesCompletedOn(state.store, today);

        this.renderSummary(pending.total, pending.quick.length, pending.formal.length, completedToday.length);
        const showSummary = !state.loading && !state.error;
        this.summary.classList.toggle("fn__none", !showSummary);

        this.feedback.replaceChildren();
        this.list.replaceChildren();
        if (state.loading) {
            this.feedback.append(this.createFeedback(translate("inbox.loading")));
            return;
        }
        if (state.error) {
            const error = this.createFeedback(translate("inbox.loadFailed"), "error");
            const retry = document.createElement("button");
            retry.type = "button";
            retry.className = "b3-button b3-button--outline ticktick-task-center__inbox-retry";
            retry.textContent = translate("inbox.retry");
            retry.addEventListener("click", () => void this.options.controller.refresh());
            error.append(retry);
            this.feedback.append(error);
            return;
        }
        if (state.droppedNoteCount > 0) {
            this.feedback.append(this.createFeedback(
                translate("inbox.droppedNotes").replace("${count}", String(state.droppedNoteCount)),
                "notice",
            ));
        }

        if (pending.quick.length === 0 && pending.formal.length === 0) {
            if (completedToday.length > 0) {
                this.list.append(this.createDoneSection(completedToday));
            } else {
                this.feedback.append(this.createFeedback(translate("inbox.empty")));
            }
            this.refreshBodyCollapseStates();
            return;
        }

        const groups: HTMLElement[] = [];
        if (pending.quick.length > 0) {
            groups.push(this.createGroup("quick", pending.quick));
        }
        if (pending.formal.length > 0) {
            groups.push(this.createGroup("formal", pending.formal));
        }
        if (completedToday.length > 0) {
            groups.push(this.createDoneSection(completedToday));
        }
        this.list.append(...groups);
        this.refreshBodyCollapseStates();
    }

    private renderTierButtons(): void {
        const { translate } = this.options;
        for (const [tier, button] of this.tierButtons) {
            button.textContent = tier === "quick"
                ? translate("inbox.tierQuick")
                : translate("inbox.tierFormal");
            const active = tier === this.tier;
            button.classList.toggle("ticktick-task-center__inbox-tier-option--active", active);
            button.setAttribute("aria-checked", String(active));
        }
    }

    private renderSummary(pending: number, quick: number, formal: number, doneToday: number): void {
        const { translate } = this.options;
        this.summary.replaceChildren(
            createSummaryItem(translate("inbox.summaryPending"), pending),
            createSummaryItem(translate("inbox.summaryQuick"), quick),
            createSummaryItem(translate("inbox.summaryFormal"), formal),
            createSummaryItem(translate("inbox.summaryDoneToday"), doneToday),
        );
    }

    private createGroup(tier: InboxNoteTier, notes: readonly InboxNote[]): HTMLElement {
        const { translate } = this.options;
        const group = document.createElement("section");
        group.className = `ticktick-task-center__inbox-group ticktick-task-center__inbox-group--${tier}`;

        const head = document.createElement("h2");
        head.className = "ticktick-task-center__inbox-group-head";
        const title = document.createElement("span");
        title.className = "ticktick-task-center__inbox-group-title";
        title.textContent = tier === "quick"
            ? translate("inbox.tierQuick")
            : translate("inbox.tierFormal");
        const count = document.createElement("span");
        count.className = "ticktick-task-center__inbox-group-count";
        count.textContent = String(notes.length);
        const hint = document.createElement("span");
        hint.className = "ticktick-task-center__inbox-group-hint";
        hint.textContent = tier === "quick"
            ? translate("inbox.groupQuickHint")
            : translate("inbox.groupFormalHint");
        head.append(title, count, hint);

        const list = document.createElement("div");
        list.className = "ticktick-task-center__inbox-group-list";
        list.append(...notes.map((note) => this.createItem(note)));
        group.append(head, list);
        return group;
    }

    private createItem(note: InboxNote): HTMLElement {
        const { translate } = this.options;
        const item = document.createElement("article");
        item.className = "ticktick-task-center__inbox-item";
        item.setAttribute("role", "listitem");
        item.dataset.noteId = note.id;
        item.dataset.tier = note.tier;

        const body = document.createElement("div");
        body.className = "ticktick-task-center__inbox-item-body";
        // 第一段是标题，其余是正文；便条本身仍只存一段文字，不新增字段
        const parts = splitInboxNoteText(note.text);
        const text = document.createElement("p");
        text.className = "ticktick-task-center__inbox-item-text";
        text.textContent = parts.title;
        body.append(text);
        if (parts.body !== "") {
            body.append(...this.createBody(note, parts.body));
        }
        const meta = document.createElement("p");
        meta.className = "ticktick-task-center__inbox-item-meta";
        meta.append(createInboxTime(note.createdAt, this.getLocale()));
        meta.append(this.createRetierButton(note));
        body.append(meta);

        const actions = document.createElement("div");
        actions.className = "ticktick-task-center__inbox-item-actions";
        const pending = this.pendingNoteIds.has(note.id);
        // 位置固定：完成（仅快速事项）→ 移入任务清单 → 编辑 → 删除。
        // 正式任务没有「完成」——它必须先移入任务清单，不可能在收件箱里完成。
        if (note.tier === "quick") {
            actions.append(this.createActionButton("inbox.complete", {
                primary: true,
                disabled: pending,
                onClick: () => void this.complete(note),
            }));
        }
        actions.append(this.createActionButton("inbox.promote", {
            primary: note.tier === "formal",
            disabled: pending,
            onClick: () => this.options.onPromote(note),
        }));
        actions.append(this.createActionButton("inbox.edit", {
            disabled: pending,
            title: translate("inbox.editTitle"),
            onClick: () => this.options.onEdit(note),
        }));
        actions.append(this.createActionButton("inbox.delete", {
            icon: true,
            disabled: pending,
            title: translate("inbox.deleteTitle"),
            onClick: () => void this.remove(note),
        }));

        item.append(body, actions);
        return item;
    }

    /**
     * 正文：默认折成 2 行，只有真的放不下时才出现「展开正文」。
     * 判断依据是渲染后的实际高度，不靠猜字数。
     */
    private createBody(note: InboxNote, bodySource: string): HTMLElement[] {
        const expanded = this.expandedNoteIds.has(note.id);
        const bodyText = document.createElement("div");
        bodyText.className = "ticktick-task-center__inbox-item-body-text";
        bodyText.dataset.collapsed = String(!expanded);
        bodyText.append(...renderMarkdownBlocks(bodySource, document));

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "ticktick-task-center__inbox-body-toggle fn__none";
        toggle.textContent = this.options.translate(
            expanded ? "inbox.bodyCollapse" : "inbox.bodyExpand",
        );
        toggle.addEventListener("click", () => {
            if (this.expandedNoteIds.has(note.id)) {
                this.expandedNoteIds.delete(note.id);
            } else {
                this.expandedNoteIds.add(note.id);
            }
            this.render(this.options.controller.getState());
        });
        return [bodyText, toggle];
    }

    private refreshBodyCollapseStates(): void {
        for (const item of Array.from(
            this.list.querySelectorAll<HTMLElement>(".ticktick-task-center__inbox-item"),
        )) {
            const bodyText = item.querySelector<HTMLElement>(
                ".ticktick-task-center__inbox-item-body-text",
            );
            const toggle = item.querySelector<HTMLButtonElement>(
                ".ticktick-task-center__inbox-body-toggle",
            );
            if (!bodyText || !toggle) {
                continue;
            }
            // 折叠状态下量出来的高度才有意义；一旦确认放不下就记下来，
            // 展开后按钮要留着，否则用户没法再收起来。
            if (
                bodyText.dataset.collapsed === "true"
                && bodyText.scrollHeight > bodyText.clientHeight + 1
            ) {
                bodyText.dataset.overflow = "true";
            }
            toggle.classList.toggle("fn__none", bodyText.dataset.overflow !== "true");
        }
    }

    private createRetierButton(note: InboxNote): HTMLButtonElement {
        const { translate } = this.options;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ticktick-task-center__inbox-retier";
        button.textContent = note.tier === "quick"
            ? translate("inbox.retierToFormal")
            : translate("inbox.retierToQuick");
        button.disabled = this.pendingNoteIds.has(note.id);
        button.addEventListener("click", () => {
            void this.setNoteTier(note, note.tier === "quick" ? "formal" : "quick");
        });
        return button;
    }

    private createActionButton(
        labelKey: string,
        options: { primary?: boolean; icon?: boolean; disabled: boolean; title?: string; onClick: () => void },
    ): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = [
            "b3-button",
            options.primary ? "" : "b3-button--outline",
            "ticktick-task-center__inbox-action",
            options.primary ? "ticktick-task-center__inbox-action--primary" : "",
            options.icon ? "ticktick-task-center__inbox-action--icon" : "",
        ].filter(Boolean).join(" ");
        button.textContent = this.options.translate(labelKey);
        if (options.title) {
            button.title = options.title;
            button.setAttribute("aria-label", options.title);
        }
        button.disabled = options.disabled;
        button.addEventListener("click", options.onClick);
        return button;
    }

    private createDoneSection(notes: readonly InboxNote[]): HTMLElement {
        const { translate } = this.options;
        const details = document.createElement("details");
        details.className = "ticktick-task-center__inbox-done";
        details.open = this.doneOpen;
        details.addEventListener("toggle", () => {
            this.doneOpen = details.open;
        });
        const summary = document.createElement("summary");
        const label = document.createElement("span");
        label.textContent = translate("inbox.doneToday").replace("${count}", String(notes.length));
        const hint = document.createElement("span");
        hint.className = "ticktick-task-center__inbox-done-hint";
        hint.textContent = translate("inbox.doneTodayHint");
        summary.append(label, hint);

        const list = document.createElement("ul");
        list.className = "ticktick-task-center__inbox-done-list";
        for (const note of notes) {
            const item = document.createElement("li");
            item.className = "ticktick-task-center__inbox-done-item";
            const text = document.createElement("span");
            text.textContent = note.text;
            const time = createInboxTime(note.completedAt ?? note.createdAt, this.getLocale());
            time.classList.add("ticktick-task-center__inbox-done-time");
            item.append(text, time);
            list.append(item);
        }
        details.append(summary, list);
        return details;
    }

    private createFeedback(message: string, kind: "notice" | "error" | "plain" = "plain"): HTMLElement {
        const element = document.createElement("div");
        element.className = "ticktick-task-center__inbox-state";
        if (kind === "error") {
            element.classList.add("ticktick-task-center__inbox-state--error");
        } else if (kind === "notice") {
            element.classList.add("ticktick-task-center__inbox-state--notice");
        }
        element.textContent = message;
        return element;
    }

    private async complete(note: InboxNote): Promise<void> {
        await this.runNoteAction(note.id, () => this.options.controller.complete(note.id));
    }

    private async remove(note: InboxNote): Promise<void> {
        await this.runNoteAction(note.id, () => this.options.controller.remove(note.id));
    }

    private async setNoteTier(note: InboxNote, tier: InboxNoteTier): Promise<void> {
        await this.runNoteAction(note.id, () => this.options.controller.setTier(note.id, tier));
    }

    private async runNoteAction(
        noteId: string,
        action: () => Promise<{ ok: boolean; reason?: InboxActionFailure }>,
    ): Promise<void> {
        if (this.pendingNoteIds.has(noteId)) {
            return;
        }
        this.pendingNoteIds.add(noteId);
        this.render(this.options.controller.getState());
        const result = await action();
        this.pendingNoteIds.delete(noteId);
        if (this.destroyed) {
            return;
        }
        this.render(this.options.controller.getState());
        if (!result.ok && result.reason) {
            this.options.onActionFailed(result.reason);
        }
    }

    private getLocale(): string | undefined {
        const { locale } = this.options;
        return typeof locale === "function" ? locale() : locale;
    }
}

/** 与任务中心汇总条同一套标记，保证两处外观一致。 */
function createSummaryItem(label: string, count: number): HTMLElement {
    const item = document.createElement("span");
    item.className = "ticktick-task-center__inbox-summary-item";
    const value = document.createElement("strong");
    value.textContent = String(count);
    item.append(`${label} `, value);
    return item;
}

export function createInboxTime(iso: string, locale?: string): HTMLTimeElement {
    const time = document.createElement("time");
    time.dateTime = iso;
    time.textContent = new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(iso));
    return time;
}
