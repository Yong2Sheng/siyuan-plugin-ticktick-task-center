import { Dialog, showMessage } from "siyuan";

import { TASK_STATUS_CONFIG, TASK_STATUS_IDS } from "../domain/status";
import { DEFAULT_TASK_STATUS } from "../domain/task";
import {
    normalizeTaskData,
    type NormalizedTaskData,
    type TaskDataCandidate,
    type TaskValidationError,
} from "../domain/validation";
import type { Translate } from "../i18n";
import { TaskCreationError } from "./create-task";
import { SubmissionController } from "./submission-controller";

type FormOutcome =
    | { kind: "validation-error"; errors: TaskValidationError[] }
    | { kind: "success" }
    | { kind: "failure"; error: unknown };

export type CreateTaskDialogOptions = {
    translate: Translate;
    initialTitle: string;
    onCreate(task: NormalizedTaskData): Promise<void>;
    onDestroy?(): void;
};

const VALIDATION_I18N_KEYS: Record<TaskValidationError, string> = {
    "title-required": "validation.titleRequired",
    "url-required": "validation.urlRequired",
    "url-invalid": "validation.urlInvalid",
    "url-https-required": "validation.urlHttpsRequired",
    "url-host-invalid": "validation.urlHostInvalid",
    "status-invalid": "validation.statusInvalid",
};

export function showCreateTaskDialog(options: CreateTaskDialogOptions): Dialog {
    const { translate } = options;
    const controller = new SubmissionController<TaskDataCandidate, FormOutcome>(async (candidate) => {
        const normalized = normalizeTaskData(candidate);
        if (!normalized.valid) {
            return { kind: "validation-error", errors: normalized.errors };
        }

        try {
            await options.onCreate(normalized.data);
            return { kind: "success" };
        } catch (error) {
            return { kind: "failure", error };
        }
    });

    const dialog = new Dialog({
        title: translate("taskCreate.dialogTitle"),
        width: "520px",
        disableClose: true,
        hideCloseIcon: true,
        content: `<form class="ticktick-task-form">
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
                <button class="b3-button b3-button--text" data-action="create" type="submit"></button>
            </div>
        </form>`,
        destroyCallback: () => {
            controller.cancel();
            options.onDestroy?.();
        },
    });

    const form = requireElement<HTMLFormElement>(dialog.element, ".ticktick-task-form");
    const titleInput = requireElement<HTMLInputElement>(form, '[data-field="title"]');
    const urlInput = requireElement<HTMLInputElement>(form, '[data-field="url"]');
    const statusSelect = requireElement<HTMLSelectElement>(form, '[data-field="status"]');
    const errorElement = requireElement<HTMLElement>(form, '[data-field="error"]');
    const cancelButton = requireElement<HTMLButtonElement>(form, '[data-action="cancel"]');
    const createButton = requireElement<HTMLButtonElement>(form, '[data-action="create"]');

    requireElement<HTMLElement>(form, '[data-field-label="title"]').textContent = translate("taskCreate.titleLabel");
    requireElement<HTMLElement>(form, '[data-field-label="url"]').textContent = translate("taskCreate.urlLabel");
    requireElement<HTMLElement>(form, '[data-field-label="status"]').textContent = translate("taskCreate.statusLabel");
    cancelButton.textContent = translate("common.cancel");
    createButton.textContent = translate("taskCreate.create");
    titleInput.value = options.initialTitle;

    for (const status of TASK_STATUS_IDS) {
        const config = TASK_STATUS_CONFIG[status];
        const option = document.createElement("option");
        option.value = status;
        option.textContent = `${config.icon} ${translate(config.labelKey)}`;
        option.selected = status === DEFAULT_TASK_STATUS;
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
        createButton.disabled = true;
        cancelButton.disabled = true;
        createButton.textContent = translate("taskCreate.creating");
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
            showMessage(translate("taskCreate.created"));
            dialog.destroy();
            return;
        }

        createButton.disabled = false;
        cancelButton.disabled = false;
        createButton.textContent = translate("taskCreate.create");

        if (submission.value.kind === "validation-error") {
            showError(
                errorElement,
                submission.value.errors.map((error) => translate(VALIDATION_I18N_KEYS[error])).join(" "),
            );
            return;
        }

        console.error("TickTick task creation failed", submission.value.error);
        const message = getCreationErrorMessage(submission.value.error, translate);
        showError(errorElement, message);
        showMessage(message, 7000, "error");
    }

    titleInput.focus();
    return dialog;
}

function getCreationErrorMessage(error: unknown, translate: Translate): string {
    if (!(error instanceof TaskCreationError)) {
        return translate("taskCreate.errors.createFailed");
    }

    if (error.code === "insert-failed") {
        return translate("taskCreate.errors.insertFailed");
    }
    if (error.code === "attribute-write-failed") {
        return translate("taskCreate.errors.attributeWriteFailed");
    }

    return translate("taskCreate.errors.rollbackFailed").replace("${blockId}", error.blockId ?? "");
}

function requireElement<TElement extends Element>(root: ParentNode, selector: string): TElement {
    const element = root.querySelector<TElement>(selector);
    if (element === null) {
        throw new Error(`Task form element not found: ${selector}`);
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
