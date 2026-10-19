import { Dialog, showMessage } from "siyuan";

import type { Translate } from "../i18n";
import { SubmissionController } from "../task-card/submission-controller";
import { createTaskChoiceGroup } from "../task-card/task-choice-group";
import { renderMarkdownBlocks } from "./inbox-markdown";
import {
    MAX_INBOX_NOTE_TEXT_LENGTH,
    splitInboxNoteText,
    type InboxNote,
    type InboxNoteTier,
} from "./inbox-note";
import type { InboxActionFailure, InboxActionResult } from "./inbox-controller";

/**
 * 编辑一张收件箱便条。
 *
 * 只改文字与分级，id、记录时间和完成状态都由控制器保留：
 * 编辑不是重记一条，便条不能因此跳到列表顶部。
 * 保存成功后弹窗关闭；任何失败都留在弹窗里，输入不丢。
 */

type FormOutcome =
    | { kind: "saved" }
    | { kind: "failed"; reason: InboxActionFailure };

export type EditInboxNoteDialogOptions = {
    translate: Translate;
    note: InboxNote;
    locale?: string;
    onSave(text: string, tier: InboxNoteTier): Promise<InboxActionResult>;
    onDestroy?(): void;
};

export function showEditInboxNoteDialog(options: EditInboxNoteDialogOptions): Dialog {
    const { translate, note } = options;
    const parts = splitInboxNoteText(note.text);
    let saving = false;

    const controller = new SubmissionController<void, FormOutcome>(async () => {
        if (readTitle() === "") {
            return { kind: "failed", reason: "title-required" };
        }
        const text = composeText();
        if (text.length > MAX_INBOX_NOTE_TEXT_LENGTH) {
            return { kind: "failed", reason: "text-too-long" };
        }
        const result = await options.onSave(text, readTier());
        return result.ok ? { kind: "saved" } : { kind: "failed", reason: result.reason };
    });

    const dialog = new Dialog({
        title: translate("inbox.editTitle"),
        width: "520px",
        content: `<form class="ticktick-task-form ticktick-inbox-edit">
            <div class="ticktick-inbox-edit__meta">
                <span data-field-label="recorded"></span>
                <time data-field="recorded-at"></time>
            </div>
            <label class="b3-label">
                <span><span data-field-label="title"></span><span class="ticktick-inbox-edit__required" aria-hidden="true">*</span></span>
                <input class="b3-text-field fn__block ticktick-quick-capture__title" data-field="title" type="text" autocomplete="off" aria-required="true">
            </label>
            <div class="b3-label">
                <div class="ticktick-inbox-edit__body-head">
                    <span data-field-label="body"></span>
                    <button type="button" class="ticktick-inbox-edit__preview-toggle" data-action="toggle-preview" aria-pressed="true"></button>
                </div>
                <textarea class="b3-text-field fn__block ticktick-quick-capture__body" data-field="body" rows="6"></textarea>
                <div class="ticktick-inbox-edit__preview-host" data-field="preview"></div>
            </div>
            <div class="b3-label">
                <span data-field-label="tier"></span>
                <div class="ticktick-task-form__choices" data-choice-group="tier" role="radiogroup"></div>
                <input data-field="tier" type="hidden">
            </div>
            <div class="b3-label fn__none ticktick-task-form__error" data-field="error" role="alert"></div>
            <div class="b3-dialog__action">
                <button class="b3-button b3-button--cancel" data-action="cancel" type="button"></button>
                <button class="b3-button b3-button--text" data-action="save" type="submit"></button>
            </div>
        </form>`,
        destroyCallback: () => {
            window.clearTimeout(previewTimer);
            controller.cancel();
            options.onDestroy?.();
        },
    });

    const form = requireElement<HTMLFormElement>(dialog.element, ".ticktick-inbox-edit");
    const titleInput = requireElement<HTMLInputElement>(form, '[data-field="title"]');
    const bodyInput = requireElement<HTMLTextAreaElement>(form, '[data-field="body"]');
    const tierInput = requireElement<HTMLInputElement>(form, '[data-field="tier"]');
    const errorElement = requireElement<HTMLElement>(form, '[data-field="error"]');
    const cancelButton = requireElement<HTMLButtonElement>(form, '[data-action="cancel"]');
    const saveButton = requireElement<HTMLButtonElement>(form, '[data-action="save"]');
    const recordedAt = requireElement<HTMLTimeElement>(form, '[data-field="recorded-at"]');
    const previewHost = requireElement<HTMLElement>(form, '[data-field="preview"]');
    const previewToggle = requireElement<HTMLButtonElement>(form, '[data-action="toggle-preview"]');
    let previewVisible = true;
    let previewTimer: number | undefined;

    /**
     * 预览用与收件箱列表同一个渲染器，只读、不参与保存。
     * 打字时只替换预览容器，输入框的焦点和滚动都不动。
     */
    function renderPreview(): void {
        previewHost.replaceChildren();
        if (!previewVisible) {
            return;
        }
        const source = bodyInput.value.trim();
        if (source === "") {
            const hint = document.createElement("p");
            hint.className = "ticktick-inbox-edit__preview-hint";
            hint.textContent = translate("inbox.previewEmpty");
            previewHost.append(hint);
            return;
        }

        const preview = document.createElement("div");
        preview.className = "ticktick-inbox-edit__preview";
        preview.setAttribute("aria-hidden", "true");

        const head = document.createElement("div");
        head.className = "ticktick-inbox-edit__preview-head";
        const label = document.createElement("span");
        label.textContent = translate("inbox.preview");
        const note = document.createElement("span");
        note.textContent = translate("inbox.previewHint");
        head.append(label, note);

        const body = document.createElement("div");
        body.className = "ticktick-inbox-edit__preview-body";
        body.append(...renderMarkdownBlocks(source, document));

        preview.append(head, body);
        previewHost.append(preview);
    }

    function updatePreviewToggle(): void {
        previewToggle.textContent = previewVisible
            ? translate("inbox.hidePreview")
            : translate("inbox.showPreview");
        previewToggle.setAttribute("aria-pressed", String(previewVisible));
    }

    requireElement<HTMLElement>(form, '[data-field-label="recorded"]').textContent
        = translate("inbox.recordedAt");
    requireElement<HTMLElement>(form, '[data-field-label="title"]').textContent
        = translate("inbox.titleLabel");
    requireElement<HTMLElement>(form, '[data-field-label="body"]').textContent
        = translate("inbox.bodyLabel");
    requireElement<HTMLElement>(form, '[data-field-label="tier"]').textContent
        = translate("inbox.tierGroupLabel");
    cancelButton.textContent = translate("common.cancel");
    saveButton.textContent = translate("inbox.saveChanges");
    titleInput.placeholder = translate("inbox.titlePlaceholder");
    bodyInput.placeholder = translate("inbox.bodyPlaceholder");

    titleInput.value = parts.title;
    bodyInput.value = parts.body;
    updatePreviewToggle();
    renderPreview();
    recordedAt.dateTime = note.createdAt;
    recordedAt.textContent = new Intl.DateTimeFormat(options.locale, {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(note.createdAt));

    const tierChoices = createTaskChoiceGroup({
        container: requireElement(form, '[data-choice-group="tier"]'),
        input: tierInput,
        choices: [
            { value: "quick", text: translate("inbox.tierQuick") },
            { value: "formal", text: translate("inbox.tierFormal") },
        ],
        initialValue: note.tier,
    });

    function readTitle(): string {
        return titleInput.value.trim();
    }

    function readTier(): InboxNoteTier {
        return tierInput.value === "formal" ? "formal" : "quick";
    }

    function composeText(): string {
        const body = bodyInput.value.trim();
        return body === "" ? readTitle() : `${readTitle()}\n\n${body}`;
    }

    function setBusy(busy: boolean): void {
        saving = busy;
        titleInput.disabled = busy;
        bodyInput.disabled = busy;
        cancelButton.disabled = busy;
        saveButton.disabled = busy;
        saveButton.textContent = busy ? translate("inbox.saving") : translate("inbox.saveChanges");
        tierChoices.setDisabled(busy);
    }

    async function save(): Promise<void> {
        if (saving) {
            return;
        }
        setBusy(true);
        hideError(errorElement);
        const submission = await controller.submit(undefined);
        if (submission.accepted && submission.value.kind === "saved") {
            showMessage(translate("inbox.editSaved"));
            dialog.destroy();
            return;
        }
        setBusy(false);
        if (submission.accepted && submission.value.kind === "failed") {
            showError(errorElement, translate(`inbox.errors.${submission.value.reason}`));
        }
    }

    titleInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.isComposing) {
            event.preventDefault();
            void save();
        }
    });
    bodyInput.addEventListener("input", () => {
        window.clearTimeout(previewTimer);
        previewTimer = window.setTimeout(renderPreview, 250);
    });
    bodyInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.isComposing) {
            event.preventDefault();
            void save();
        }
    });
    previewToggle.addEventListener("click", () => {
        previewVisible = !previewVisible;
        updatePreviewToggle();
        renderPreview();
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        void save();
    });
    cancelButton.addEventListener("click", () => dialog.destroy());

    // 焦点放在标题末尾：用户常常是接着改，而不是整段重写
    titleInput.focus();
    titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);

    return dialog;
}

function requireElement<TElement extends Element>(root: ParentNode, selector: string): TElement {
    const element = root.querySelector<TElement>(selector);
    if (element === null) {
        throw new Error(`Edit note dialog element not found: ${selector}`);
    }
    return element;
}

function hideError(element: HTMLElement): void {
    element.textContent = "";
    element.classList.add("fn__none");
}

function showError(element: HTMLElement, message: string): void {
    element.textContent = message;
    element.classList.remove("fn__none");
}
