import { Dialog, showMessage } from "siyuan";

import type { Translate } from "../i18n";
import { SubmissionController } from "../task-card/submission-controller";
import { createTaskChoiceGroup } from "../task-card/task-choice-group";
import {
    DEFAULT_INBOX_NOTE_TIER,
    INBOX_NOTE_TIERS,
    type InboxNoteTier,
} from "./inbox-note";
import type { InboxActionFailure, InboxActionResult } from "./inbox-controller";

/**
 * 顶栏唤出的「快速记录」小弹窗。
 *
 * 和收件箱里的捕获框是同一套字段、同一份数据（都走 InboxController），
 * 只是不必先打开任务中心页签。
 *
 * 键盘约定与捕获框一致：标题框回车即存、正文框里 ⌘/Ctrl+回车才存。
 * 「保存并继续」留给"灵感连着冒出来"的场景——存下、清空、继续留着。
 */

type FormOutcome =
    | { kind: "saved" }
    | { kind: "failed"; reason: InboxActionFailure };

export type QuickCaptureDialogOptions = {
    translate: Translate;
    initialTier?: InboxNoteTier;
    onCapture(text: string, tier: InboxNoteTier): Promise<InboxActionResult>;
    onDestroy?(): void;
};

export function showQuickCaptureDialog(options: QuickCaptureDialogOptions): Dialog {
    const { translate } = options;
    let saving = false;

    const controller = new SubmissionController<void, FormOutcome>(async () => {
        if (readTitle() === "") {
            return { kind: "failed", reason: "title-required" };
        }
        const result = await options.onCapture(composeText(), readTier());
        return result.ok ? { kind: "saved" } : { kind: "failed", reason: result.reason };
    });

    const dialog = new Dialog({
        title: translate("quickCapture.title"),
        width: "440px",
        content: `<form class="ticktick-quick-capture">
            <label class="b3-label ticktick-quick-capture__field">
                <span data-field-label="title"></span>
                <input class="b3-text-field fn__block ticktick-quick-capture__title" data-field="title" type="text" autocomplete="off">
            </label>
            <label class="b3-label ticktick-quick-capture__field">
                <span data-field-label="body"></span>
                <textarea class="b3-text-field fn__block ticktick-quick-capture__body" data-field="body" rows="4"></textarea>
            </label>
            <div class="b3-label ticktick-quick-capture__field">
                <span data-field-label="tier"></span>
                <div class="ticktick-task-form__choices" data-choice-group="tier" role="radiogroup"></div>
                <input data-field="tier" type="hidden">
            </div>
            <div class="b3-label fn__none ticktick-task-form__error" data-field="error" role="alert"></div>
            <div class="b3-dialog__action">
                <button class="b3-button b3-button--cancel" data-action="cancel" type="button"></button>
                <button class="b3-button b3-button--outline" data-action="continue" type="button"></button>
                <button class="b3-button b3-button--text" data-action="save" type="submit"></button>
            </div>
        </form>`,
        destroyCallback: () => {
            controller.cancel();
            options.onDestroy?.();
        },
    });

    const form = requireElement<HTMLFormElement>(dialog.element, ".ticktick-quick-capture");
    const titleInput = requireElement<HTMLInputElement>(form, '[data-field="title"]');
    const bodyInput = requireElement<HTMLTextAreaElement>(form, '[data-field="body"]');
    const tierInput = requireElement<HTMLInputElement>(form, '[data-field="tier"]');
    const errorElement = requireElement<HTMLElement>(form, '[data-field="error"]');
    const cancelButton = requireElement<HTMLButtonElement>(form, '[data-action="cancel"]');
    const continueButton = requireElement<HTMLButtonElement>(form, '[data-action="continue"]');
    const saveButton = requireElement<HTMLButtonElement>(form, '[data-action="save"]');

    requireElement<HTMLElement>(form, '[data-field-label="title"]').textContent = translate("inbox.titleLabel");
    requireElement<HTMLElement>(form, '[data-field-label="body"]').textContent = translate("inbox.bodyLabel");
    requireElement<HTMLElement>(form, '[data-field-label="tier"]').textContent = translate("inbox.tierGroupLabel");
    titleInput.placeholder = translate("inbox.titlePlaceholder");
    bodyInput.placeholder = translate("inbox.bodyPlaceholder");
    cancelButton.textContent = translate("common.cancel");
    continueButton.textContent = translate("quickCapture.saveAndContinue");
    saveButton.textContent = translate("quickCapture.save");

    const tierChoices = createTaskChoiceGroup({
        container: requireElement(form, '[data-choice-group="tier"]'),
        input: tierInput,
        choices: INBOX_NOTE_TIERS.map((tier) => ({
            value: tier,
            text: translate(tier === "quick" ? "inbox.tierQuick" : "inbox.tierFormal"),
        })),
        initialValue: options.initialTier ?? DEFAULT_INBOX_NOTE_TIER,
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
        continueButton.disabled = busy;
        saveButton.disabled = busy;
        tierChoices.setDisabled(busy);
    }

    async function save(close: boolean): Promise<void> {
        if (saving) {
            return;
        }
        setBusy(true);
        hideError(errorElement);
        const submission = await controller.submit(undefined);
        if (submission.accepted && submission.value.kind === "saved") {
            showMessage(translate("quickCapture.saved"));
            if (close) {
                dialog.destroy();
                return;
            }
            // 保存并继续：清空、把焦点放回标题，留着继续记
            titleInput.value = "";
            bodyInput.value = "";
            setBusy(false);
            titleInput.focus();
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
            void save(true);
        }
    });
    bodyInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.isComposing) {
            event.preventDefault();
            void save(true);
        }
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        void save(true);
    });
    continueButton.addEventListener("click", () => void save(false));
    cancelButton.addEventListener("click", () => dialog.destroy());

    titleInput.focus();
    return dialog;
}

function requireElement<TElement extends Element>(root: ParentNode, selector: string): TElement {
    const element = root.querySelector<TElement>(selector);
    if (element === null) {
        throw new Error(`Quick capture dialog element not found: ${selector}`);
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
