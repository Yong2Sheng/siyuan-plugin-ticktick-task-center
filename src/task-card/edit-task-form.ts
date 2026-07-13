import { Dialog, showMessage } from "siyuan";

import { TASK_STATUS_CONFIG, TASK_STATUS_IDS } from "../domain/status";
import type { PersistedTickTickTaskData } from "../domain/task";
import {
    normalizeTaskData,
    type NormalizedTaskData,
    type TaskDataCandidate,
    type TaskValidationError,
} from "../domain/validation";
import type { Translate } from "../i18n";
import { TaskEditError, type EditTaskResult } from "./edit-task";
import type { ManagedEditDialog } from "./edit-dialog-manager";
import { SubmissionController } from "./submission-controller";

type FormOutcome =
    | { kind: "validation-error"; errors: TaskValidationError[] }
    | { kind: "success"; result: EditTaskResult }
    | { kind: "failure"; error: unknown };

export type EditTaskDialogOptions = {
    translate: Translate;
    initial: PersistedTickTickTaskData;
    onSave(task: NormalizedTaskData): Promise<EditTaskResult>;
    onDestroy?(): void;
};

export type EditTaskDialog = ManagedEditDialog & {
    dialog: Dialog;
};

const VALIDATION_I18N_KEYS: Record<TaskValidationError, string> = {
    "title-required": "validation.titleRequired",
    "url-required": "validation.urlRequired",
    "url-invalid": "validation.urlInvalid",
    "url-https-required": "validation.urlHttpsRequired",
    "url-host-invalid": "validation.urlHostInvalid",
    "status-invalid": "validation.statusInvalid",
};

export function showEditTaskDialog(options: EditTaskDialogOptions): EditTaskDialog {
    const { translate } = options;
    const controller = new SubmissionController<TaskDataCandidate, FormOutcome>(async (candidate) => {
        const normalized = normalizeTaskData(candidate);
        if (!normalized.valid) {
            return { kind: "validation-error", errors: normalized.errors };
        }

        try {
            return { kind: "success", result: await options.onSave(normalized.data) };
        } catch (error) {
            return { kind: "failure", error };
        }
    });

    const dialog = new Dialog({
        title: translate("taskEdit.dialogTitle"),
        width: "520px",
        disableClose: true,
        hideCloseIcon: true,
        content: `<form class="ticktick-task-form ticktick-task-edit-form">
            <label class="b3-label">
                <span data-field-label="title"></span>
                <input class="b3-text-field fn__block" data-field="title" type="text" autocomplete="off">
            </label>
            <label class="b3-label">
                <span data-field-label="url"></span>
                <input class="b3-text-field fn__block" data-field="url" type="url" autocomplete="off">
            </label>
            <label class="b3-label">
                <span data-field-label="status"></span>
                <select class="b3-select fn__block" data-field="status"></select>
            </label>
            <div class="b3-label fn__none ticktick-task-form__error" data-field="error" role="alert"></div>
            <div class="b3-dialog__action">
                <button class="b3-button b3-button--cancel" data-action="cancel" type="button"></button>
                <button class="b3-button b3-button--text" data-action="save" type="submit"></button>
            </div>
        </form>`,
        destroyCallback: () => {
            controller.cancel();
            options.onDestroy?.();
        },
    });

    const form = requireElement<HTMLFormElement>(dialog.element, ".ticktick-task-edit-form");
    const titleInput = requireElement<HTMLInputElement>(form, '[data-field="title"]');
    const urlInput = requireElement<HTMLInputElement>(form, '[data-field="url"]');
    const statusSelect = requireElement<HTMLSelectElement>(form, '[data-field="status"]');
    const errorElement = requireElement<HTMLElement>(form, '[data-field="error"]');
    const cancelButton = requireElement<HTMLButtonElement>(form, '[data-action="cancel"]');
    const saveButton = requireElement<HTMLButtonElement>(form, '[data-action="save"]');
    const controls: Array<HTMLInputElement | HTMLSelectElement | HTMLButtonElement> = [
        titleInput,
        urlInput,
        statusSelect,
        cancelButton,
        saveButton,
    ];

    requireElement<HTMLElement>(form, '[data-field-label="title"]').textContent = translate("taskCreate.titleLabel");
    requireElement<HTMLElement>(form, '[data-field-label="url"]').textContent = translate("taskCreate.urlLabel");
    requireElement<HTMLElement>(form, '[data-field-label="status"]').textContent = translate("taskCreate.statusLabel");
    cancelButton.textContent = translate("common.cancel");
    saveButton.textContent = translate("taskEdit.save");
    titleInput.value = options.initial.title;
    urlInput.value = options.initial.url;

    for (const status of TASK_STATUS_IDS) {
        const config = TASK_STATUS_CONFIG[status];
        const option = document.createElement("option");
        option.value = status;
        option.textContent = `${config.icon} ${translate(config.labelKey)}`;
        option.selected = status === options.initial.status;
        statusSelect.append(option);
    }

    cancelButton.addEventListener("click", () => {
        controller.cancel();
        dialog.destroy();
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        void submitForm();
    });

    async function submitForm(): Promise<void> {
        setDisabled(controls, true);
        saveButton.textContent = translate("taskEdit.saving");
        hideError(errorElement);

        const submission = await controller.submit({
            title: titleInput.value,
            url: urlInput.value,
            status: statusSelect.value,
        });
        if (!submission.accepted) {
            return;
        }

        if (submission.value.kind === "success") {
            showMessage(translate(
                submission.value.result.changed ? "taskEdit.updated" : "taskEdit.noChanges",
            ));
            dialog.destroy();
            return;
        }

        setDisabled(controls, false);
        saveButton.textContent = translate("taskEdit.save");
        if (submission.value.kind === "validation-error") {
            showError(
                errorElement,
                submission.value.errors.map((error) => translate(VALIDATION_I18N_KEYS[error])).join(" "),
            );
            return;
        }

        console.error("TickTick task update failed", submission.value.error);
        const message = getEditErrorMessage(submission.value.error, translate);
        showError(errorElement, message);
        showMessage(message, 7000, "error");
    }

    return {
        dialog,
        destroy: () => dialog.destroy(),
        focusStatus: () => statusSelect.focus(),
    };
}

function getEditErrorMessage(error: unknown, translate: Translate): string {
    if (!(error instanceof TaskEditError)) {
        return translate("taskEdit.errors.updateFailed");
    }

    const keys: Record<Exclude<TaskEditError["code"], "rollback-failed">, string> = {
        "block-unavailable": "taskEdit.errors.blockUnavailable",
        "current-data-invalid": "taskEdit.errors.currentDataInvalid",
        "edit-conflict": "taskEdit.errors.conflict",
        "content-update-failed": "taskEdit.errors.contentUpdateFailed",
        "attribute-write-failed": "taskEdit.errors.attributeWriteFailed",
    };
    if (error.code === "rollback-failed") {
        return translate("taskEdit.errors.rollbackFailed").replace("${blockId}", error.blockId);
    }
    return translate(keys[error.code]);
}

function requireElement<TElement extends Element>(root: ParentNode, selector: string): TElement {
    const element = root.querySelector<TElement>(selector);
    if (!element) {
        throw new Error(`Task edit form element not found: ${selector}`);
    }
    return element;
}

function setDisabled(
    elements: Array<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>,
    disabled: boolean,
): void {
    for (const element of elements) {
        element.disabled = disabled;
    }
}

function hideError(element: HTMLElement): void {
    element.textContent = "";
    element.classList.add("fn__none");
}

function showError(element: HTMLElement, message: string): void {
    element.textContent = message;
    element.classList.remove("fn__none");
}
