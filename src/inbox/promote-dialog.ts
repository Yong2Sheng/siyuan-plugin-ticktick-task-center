import { Dialog, showMessage } from "siyuan";

import { TASK_STATUS_CONFIG, TASK_STATUS_IDS } from "../domain/status";
import { DEFAULT_TASK_STATUS } from "../domain/task";
import { TASK_WORK_MODE_CONFIG, TASK_WORK_MODE_IDS } from "../domain/work-mode";
import {
    normalizeTaskData,
    type NormalizedTaskData,
    type TaskDataCandidate,
    type TaskValidationError,
} from "../domain/validation";
import type { Translate } from "../i18n";
import { SubmissionController } from "../task-card/submission-controller";
import { createTaskChoiceGroup } from "../task-card/task-choice-group";
import { DocumentPicker, type DocumentPickerApi, type DocumentTarget } from "./document-picker";
import { splitInboxNoteText, type InboxNote } from "./inbox-note";
import type { PromoteResult } from "./promote";

type FormOutcome =
    | { kind: "validation-error"; errors: TaskValidationError[] }
    | { kind: "success" }
    | { kind: "promote-failed"; result: Extract<PromoteResult, { ok: false }> }
    | { kind: "failure"; error: unknown };

export type PromoteDialogOptions = {
    translate: Translate;
    note: InboxNote;
    pickerApi: DocumentPickerApi;
    onCreate(request: { target: DocumentTarget; task: NormalizedTaskData }): Promise<PromoteResult>;
    onDestroy?(): void;
};

const VALIDATION_I18N_KEYS: Record<TaskValidationError, string> = {
    "title-required": "validation.titleRequired",
    "url-invalid": "validation.urlInvalid",
    "url-protocol-unsupported": "validation.urlProtocolUnsupported",
    "url-credentials-unsupported": "validation.urlCredentialsUnsupported",
    "url-siyuan-invalid": "validation.urlSiYuanInvalid",
    "status-invalid": "validation.statusInvalid",
    "work-mode-invalid": "validation.workModeInvalid",
    "deadline-invalid": "validation.deadlineInvalid",
};

/**
 * 入口 1：从收件箱把便条移进任务清单。
 *
 * 目标位置没有默认值，也没有记忆——每一次都要用户亲自选。
 */
export function showPromoteInboxNoteDialog(options: PromoteDialogOptions): Dialog {
    const { translate } = options;
    let picker: DocumentPicker | undefined;

    const controller = new SubmissionController<TaskDataCandidate, FormOutcome>(async (candidate) => {
        const target = picker?.getTarget();
        if (!target) {
            return { kind: "failure", error: new Error("target-required") };
        }
        const normalized = normalizeTaskData(candidate);
        if (!normalized.valid) {
            return { kind: "validation-error", errors: normalized.errors };
        }
        try {
            const result = await options.onCreate({ target, task: normalized.data });
            return result.ok
                ? { kind: "success" }
                : { kind: "promote-failed", result };
        } catch (error) {
            return { kind: "failure", error };
        }
    });

    const dialog = new Dialog({
        title: translate("inboxPromote.dialogTitle"),
        width: "620px",
        disableClose: true,
        hideCloseIcon: true,
        content: `<form class="ticktick-task-form ticktick-inbox-promote">
            <div class="b3-label ticktick-inbox-promote__note">
                <span data-field-label="note"></span>
                <p class="ticktick-inbox-promote__note-text" data-field="note-text"></p>
            </div>
            <label class="b3-label">
                <span data-field-label="title"></span>
                <input class="b3-text-field fn__block" data-field="title" type="text" autocomplete="off">
            </label>
            <div class="b3-label">
                <span data-field-label="target"></span>
                <div data-field="target"></div>
                <div class="fn__none ticktick-task-form__error" data-field="target-error" role="alert"></div>
            </div>
            <div class="b3-label">
                <span data-field-label="status"></span>
                <div class="ticktick-task-form__choices ticktick-task-form__choices--status" data-choice-group="status" role="radiogroup"></div>
                <input data-field="status" type="hidden">
            </div>
            <div class="b3-label">
                <span data-field-label="work-mode"></span>
                <div class="ticktick-task-form__choices ticktick-task-form__choices--work-mode" data-choice-group="work-mode" role="radiogroup"></div>
                <input data-field="work-mode" type="hidden">
            </div>
            <label class="b3-label">
                <span data-field-label="deadline"></span>
                <input class="b3-text-field fn__block" data-field="deadline" type="date">
            </label>
            <label class="b3-label">
                <span data-field-label="url"></span>
                <input class="b3-text-field fn__block" data-field="url" type="url" autocomplete="off">
            </label>
            <div class="b3-label fn__none ticktick-task-form__error" data-field="error" role="alert"></div>
            <div class="b3-dialog__action">
                <button class="b3-button b3-button--cancel" data-action="cancel" type="button"></button>
                <button class="b3-button b3-button--text" data-action="submit" type="submit"></button>
            </div>
        </form>`,
        destroyCallback: () => {
            controller.cancel();
            picker?.destroy();
            picker = undefined;
            options.onDestroy?.();
        },
    });

    const form = requireElement<HTMLFormElement>(dialog.element, ".ticktick-inbox-promote");
    const titleInput = requireElement<HTMLInputElement>(form, '[data-field="title"]');
    const urlInput = requireElement<HTMLInputElement>(form, '[data-field="url"]');
    const statusInput = requireElement<HTMLInputElement>(form, '[data-field="status"]');
    const workModeInput = requireElement<HTMLInputElement>(form, '[data-field="work-mode"]');
    const deadlineInput = requireElement<HTMLInputElement>(form, '[data-field="deadline"]');
    const errorElement = requireElement<HTMLElement>(form, '[data-field="error"]');
    const targetErrorElement = requireElement<HTMLElement>(form, '[data-field="target-error"]');
    const cancelButton = requireElement<HTMLButtonElement>(form, '[data-action="cancel"]');
    const submitButton = requireElement<HTMLButtonElement>(form, '[data-action="submit"]');

    requireElement<HTMLElement>(form, '[data-field-label="note"]').textContent
        = `${translate("inboxPromote.noteLabel")}：`;
    requireElement<HTMLElement>(form, '[data-field="note-text"]').textContent = options.note.text;
    requireElement<HTMLElement>(form, '[data-field-label="title"]').textContent = translate("inboxPromote.titleLabel");
    requireElement<HTMLElement>(form, '[data-field-label="target"]').textContent = translate("inboxPromote.targetLabel");
    requireElement<HTMLElement>(form, '[data-field-label="status"]').textContent = translate("taskCreate.statusLabel");
    requireElement<HTMLElement>(form, '[data-field-label="work-mode"]').textContent = translate("taskCreate.workModeLabel");
    requireElement<HTMLElement>(form, '[data-field-label="deadline"]').textContent = translate("taskCreate.deadlineLabel");
    requireElement<HTMLElement>(form, '[data-field-label="url"]').textContent = translate("taskCreate.urlLabel");
    cancelButton.textContent = translate("common.cancel");
    submitButton.textContent = translate("inboxPromote.submit");
    // 便条的第一段才是任务标题；其余是正文，移入时写进任务文档
    const noteParts = splitInboxNoteText(options.note.text);
    titleInput.value = noteParts.title;

    const statusChoices = createTaskChoiceGroup({
        container: requireElement(form, '[data-choice-group="status"]'),
        input: statusInput,
        choices: TASK_STATUS_IDS.map((status) => ({
            value: status,
            text: `${TASK_STATUS_CONFIG[status].icon} ${translate(TASK_STATUS_CONFIG[status].labelKey)}`,
        })),
        initialValue: DEFAULT_TASK_STATUS,
    });
    const workModeChoices = createTaskChoiceGroup({
        container: requireElement(form, '[data-choice-group="work-mode"]'),
        input: workModeInput,
        choices: TASK_WORK_MODE_IDS.map((workMode) => ({
            value: workMode,
            text: `${TASK_WORK_MODE_CONFIG[workMode].icon} ${translate(TASK_WORK_MODE_CONFIG[workMode].labelKey)}`,
        })),
    });

    picker = new DocumentPicker({
        translate,
        api: options.pickerApi,
        defaultName: noteParts.title,
        onChange: () => hideError(targetErrorElement),
    });
    // 任务标题就是新文档名的默认来源；用户手动改过文档名后不再跟随
    titleInput.addEventListener("input", () => picker?.setDefaultName(titleInput.value));
    requireElement(form, '[data-field="target"]').append(picker.element);
    void picker.start();

    cancelButton.addEventListener("click", () => {
        controller.cancel();
        dialog.destroy();
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        void submitForm();
    });

    async function submitForm(): Promise<void> {
        if (!picker?.getTarget()) {
            showError(targetErrorElement, translate("inboxPromote.errors.target-required"));
            return;
        }
        submitButton.disabled = true;
        cancelButton.disabled = true;
        statusChoices.setDisabled(true);
        workModeChoices.setDisabled(true);
        submitButton.textContent = translate("inboxPromote.submitting");
        hideError(errorElement);

        const submission = await controller.submit({
            title: titleInput.value,
            url: urlInput.value,
            status: statusInput.value,
            workMode: workModeInput.value,
            deadline: deadlineInput.value,
        });
        if (!submission.accepted) {
            return;
        }

        if (submission.value.kind === "success") {
            showMessage(translate("inboxPromote.created"));
            dialog.destroy();
            return;
        }

        submitButton.disabled = false;
        cancelButton.disabled = false;
        statusChoices.setDisabled(false);
        workModeChoices.setDisabled(false);
        submitButton.textContent = translate("inboxPromote.submit");

        if (submission.value.kind === "validation-error") {
            showError(
                errorElement,
                submission.value.errors.map((error) => translate(VALIDATION_I18N_KEYS[error])).join(" "),
            );
            return;
        }
        if (submission.value.kind === "promote-failed") {
            const message = translate(`inboxPromote.errors.${submission.value.result.reason}`);
            showError(errorElement, message);
            showMessage(message, 7000, "error");
            return;
        }

        console.error("Failed to promote an inbox note", submission.value.error);
        const message = translate("inboxPromote.errors.task-create-failed");
        showError(errorElement, message);
        showMessage(message, 7000, "error");
    }

    titleInput.focus();
    return dialog;
}

function requireElement<TElement extends Element>(root: ParentNode, selector: string): TElement {
    const element = root.querySelector<TElement>(selector);
    if (element === null) {
        throw new Error(`Promote dialog element not found: ${selector}`);
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
