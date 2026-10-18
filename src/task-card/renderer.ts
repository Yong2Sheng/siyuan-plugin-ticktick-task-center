import type { TaskCardViewModel } from "./card-view-model";
import { getDeadlineState } from "../domain/deadline";
import { getLocalDate } from "../domain/local-date";
import { createDeadlineButton } from "./deadline-button";
import { openTaskActionsMenu } from "./task-actions-menu";
import { openTaskPriorityMenu } from "./priority-menu";
import type { TaskTarget } from "../domain/task-target";
import type { TickTickTaskPriority } from "../domain/priority";

export const TASK_CARD_CONTAINER_ATTRIBUTE = "data-ticktick-task-enhancement";
export const TASK_CARD_BLOCK_ID_ATTRIBUTE = "data-ticktick-task-block-id";

export type TaskCardActions = {
    onEditTask(
        blockId: string,
        options: { focus: "status" | "work-mode" | "deadline" | "priority" },
    ): void;
    onDeleteTask?(blockId: string, title: string): void;
    onOpenTaskCenter?(): void;
    onOpenSiYuanTarget?(blockId: string): void;
    /** 标记/撤销今天已推进。写的是任务中心同一组属性。 */
    onToggleDailyProgress?(blockId: string, date: string | undefined): Promise<void>;
    onDailyProgressError?(error: unknown): void;
    onSavePriority?(blockId: string, priority: TickTickTaskPriority): Promise<void>;
    onPriorityError?(error: unknown): void;
};

/** 与任务中心一致的权重徽标样式类名。 */
export const TASK_CARD_PRIORITY_CLASS = "ticktick-task-card__priority";
/** 文档正文卡片的「今日推进」按钮类名。 */
export const TASK_CARD_PROGRESS_CLASS = "ticktick-task-card__progress";

export function enhanceTaskBlock(
    blockElement: HTMLElement,
    blockId: string,
    viewModel: TaskCardViewModel,
    actions?: TaskCardActions,
): boolean {
    const existingCards = findTaskCardDecorations(blockElement);
    const matchingCard = existingCards.find((card) =>
        card.getAttribute(TASK_CARD_BLOCK_ID_ATTRIBUTE) === blockId,
    );
    if (matchingCard) {
        for (const card of existingCards) {
            if (card !== matchingCard) {
                card.remove();
            }
        }
        return true;
    }

    const originalContent = findOriginalContent(blockElement);
    if (originalContent === null || blockElement.parentElement === null) {
        return false;
    }

    for (const card of existingCards) {
        card.remove();
    }

    const card = document.createElement("div");
    card.className = "ticktick-task-card";
    card.setAttribute(TASK_CARD_CONTAINER_ATTRIBUTE, "");
    card.setAttribute(TASK_CARD_BLOCK_ID_ATTRIBUTE, blockId);
    card.setAttribute("data-status-tone", viewModel.statusTone);
    card.setAttribute("data-deadline-state", getDeadlineState(
        viewModel.deadline,
        undefined,
        { closed: viewModel.statusTerminal },
    ).kind);
    card.setAttribute("contenteditable", "false");
    if (actions?.onDeleteTask) {
        card.addEventListener("contextmenu", (event) => {
            openTaskActionsMenu(event, {
                translate: viewModel.translate,
                onEdit: () => actions.onEditTask(blockId, { focus: "status" }),
                onDelete: () => actions.onDeleteTask?.(blockId, viewModel.title),
            });
        });
    }

    const identity = document.createElement("span");
    identity.className = "ticktick-task-card__identity";

    const taskCenterButton = document.createElement("button");
    taskCenterButton.type = "button";
    taskCenterButton.className = "ticktick-task-card__identity-button";
    taskCenterButton.title = viewModel.translate("taskCenterView.openTooltip");
    taskCenterButton.setAttribute(
        "aria-label",
        viewModel.translate("taskCenterView.openTooltip"),
    );
    taskCenterButton.append(createTaskIdentityIcon());
    taskCenterButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        actions?.onOpenTaskCenter?.();
    });
    identity.append(taskCenterButton, viewModel.identity);

    const main = document.createElement("span");
    main.className = "ticktick-task-card__main";

    main.append(createTargetControl(viewModel, actions));

    const deadline = createDeadlineButton({
        className: "ticktick-task-card__deadline",
        deadline: viewModel.deadline,
        closed: viewModel.statusTerminal,
        translate: (key) => viewModel.translate(key),
        onClick: () => actions?.onEditTask(blockId, { focus: "deadline" }),
    });

    const classification = document.createElement("span");
    classification.className = "ticktick-task-card__classification";

    const priority = document.createElement("button");
    priority.type = "button";
    priority.className = TASK_CARD_PRIORITY_CLASS;
    priority.dataset.priority = viewModel.priorityConfigured ? viewModel.priority : "unset";
    priority.textContent = viewModel.priorityText;
    priority.title = viewModel.priorityTitle;
    priority.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!actions?.onSavePriority) {
            actions?.onEditTask(blockId, { focus: "priority" });
            return;
        }
        openTaskPriorityMenu(priority, {
            translate: viewModel.translate,
            ...(viewModel.priorityConfigured ? { priority: viewModel.priority } : {}),
            onSelect: (next) => {
                void actions.onSavePriority?.(blockId, next).catch((error) => {
                    actions.onPriorityError?.(error);
                });
            },
        });
    });

    const workMode = document.createElement("button");
    workMode.type = "button";
    workMode.className = "ticktick-task-card__work-mode";
    workMode.textContent = viewModel.workModeText;
    workMode.title = viewModel.workModeTitle;
    workMode.setAttribute("aria-label", viewModel.workModeAriaLabel);
    workMode.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        actions?.onEditTask(blockId, { focus: "work-mode" });
    });

    const status = document.createElement("button");
    status.type = "button";
    status.className = "ticktick-task-card__status";
    status.textContent = viewModel.statusText;
    status.title = viewModel.statusTitle;
    status.setAttribute("aria-label", viewModel.statusAriaLabel);
    status.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        actions?.onEditTask(blockId, { focus: "status" });
    });

    // 分类列竖向堆叠：工作分类 → 状态 → 权重；截止日期仍是独立的原始控件。
    classification.append(workMode, status, priority);

    // 截止日期与「今日推进」竖向同列：推进按钮放到截止日期下方，省横向空间。
    // 用 grid 而不是 flex 纵向容器——截止日期控件的 flex: 0 0 104px 在纵向 flex 里
    // 会被当成高度（按钮会变成正方形）；grid 子项不受 flex 属性影响，尺寸保持不变。
    const deadlineColumn = document.createElement("span");
    deadlineColumn.className = "ticktick-task-card__deadline-column";
    deadlineColumn.append(deadline);
    // 已结束任务不再显示「今日推进」：推进记录对已结束任务没有意义。
    if (!viewModel.statusTerminal && actions?.onToggleDailyProgress) {
        deadlineColumn.append(createProgressButton(blockId, viewModel, actions));
    }

    card.append(identity, main, classification, deadlineColumn);
    blockElement.before(card);
    return true;
}

function createProgressButton(
    blockId: string,
    viewModel: TaskCardViewModel,
    actions: TaskCardActions,
): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = TASK_CARD_PROGRESS_CLASS;
    button.dataset.progressedToday = String(viewModel.progressedToday);
    button.textContent = viewModel.translate(
        viewModel.progressedToday ? "taskCenterView.dailyProgressDone" : "taskCenterView.dailyProgressAction",
    );
    button.title = viewModel.translate(
        viewModel.progressedToday
            ? "taskCenterView.dailyProgressUndoTitle"
            : "taskCenterView.dailyProgressTitle",
    );
    button.setAttribute("aria-pressed", String(viewModel.progressedToday));
    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) {
            return;
        }
        // 先禁用自己，避免写入未返回时被重复点击。
        button.disabled = true;
        const next = viewModel.progressedToday ? undefined : getLocalDate();
        void actions.onToggleDailyProgress?.(blockId, next).catch((error) => {
            button.disabled = false;
            actions.onDailyProgressError?.(error);
        });
    });
    return button;
}

function createTargetControl(
    viewModel: TaskCardViewModel,
    actions?: TaskCardActions,
): HTMLElement {
    // 没有目标链接的任务：卡片上少一个控件，只把标题作为普通文本显示，
    // 而不是留一个点不动的灰按钮。
    if (!viewModel.target) {
        const plain = document.createElement("span");
        plain.className = "ticktick-task-card__link ticktick-task-card__link--plain";
        plain.title = viewModel.title;
        plain.textContent = viewModel.title;
        return plain;
    }

    if (viewModel.target.kind === "siyuan-block") {
        const { blockId } = viewModel.target;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ticktick-task-card__link";
        button.title = viewModel.title;
        button.textContent = viewModel.linkText;
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            actions?.onOpenSiYuanTarget?.(blockId);
        });
        return button;
    }

    return createExternalTargetLink(viewModel.target, viewModel.title, viewModel.linkText);
}

function createExternalTargetLink(
    target: Exclude<TaskTarget, { kind: "siyuan-block" }>,
    title: string,
    text: string,
): HTMLAnchorElement {
    const link = document.createElement("a");
    link.className = "ticktick-task-card__link";
    link.href = target.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = title;
    link.textContent = text;
    return link;
}

export function restoreTaskBlock(blockElement: HTMLElement): void {
    for (const card of findTaskCardDecorations(blockElement)) {
        card.remove();
    }
}

export function restoreTaskBlocks(root: ParentNode): void {
    for (const card of root.querySelectorAll<HTMLElement>(
        `[${TASK_CARD_CONTAINER_ATTRIBUTE}][${TASK_CARD_BLOCK_ID_ATTRIBUTE}]`,
    )) {
        card.remove();
    }
}

export function isTaskBlockEnhanced(blockElement: HTMLElement): boolean {
    const blockId = blockElement.dataset.nodeId;
    return blockId !== undefined && findTaskCardDecorations(blockElement).some((card) =>
        card.getAttribute(TASK_CARD_BLOCK_ID_ATTRIBUTE) === blockId,
    );
}

export function getTaskCardDecoration(blockElement: HTMLElement): HTMLElement | null {
    const blockId = blockElement.dataset.nodeId;
    return findTaskCardDecorations(blockElement).find((card) =>
        card.getAttribute(TASK_CARD_BLOCK_ID_ATTRIBUTE) === blockId,
    ) ?? null;
}

export function isTaskCardDecoration(node: Node): boolean {
    const element = node instanceof HTMLElement ? node : node.parentElement;
    return element !== null
        && element.closest(
            `.ticktick-task-card[${TASK_CARD_CONTAINER_ATTRIBUTE}][${TASK_CARD_BLOCK_ID_ATTRIBUTE}]`,
        ) !== null;
}

function findOriginalContent(blockElement: HTMLElement): HTMLElement | null {
    return Array.from(blockElement.children).find((element): element is HTMLElement =>
        element instanceof HTMLElement
        && element.hasAttribute("spellcheck")
        && element.hasAttribute("contenteditable"),
    ) ?? null;
}

function createTaskIdentityIcon(): SVGSVGElement {
    const namespace = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(namespace, "svg");
    icon.classList.add("ticktick-task-card__identity-icon");
    icon.setAttribute("viewBox", "0 0 20 20");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");

    const frame = document.createElementNS(namespace, "rect");
    frame.setAttribute("x", "1.5");
    frame.setAttribute("y", "1.5");
    frame.setAttribute("width", "17");
    frame.setAttribute("height", "17");
    frame.setAttribute("rx", "4.25");
    frame.setAttribute("fill", "currentColor");
    frame.setAttribute("fill-opacity", "0.12");
    frame.setAttribute("stroke", "currentColor");
    frame.setAttribute("stroke-width", "1.5");

    const checklist = document.createElementNS(namespace, "path");
    checklist.setAttribute(
        "d",
        "M4.8 6.9 6.2 8.3 8.55 5.75M10.65 7h4.05M4.8 12.05l1.4 1.4 2.35-2.55m2.1 1.25h4.05",
    );
    checklist.setAttribute("fill", "none");
    checklist.setAttribute("stroke", "currentColor");
    checklist.setAttribute("stroke-width", "1.6");
    checklist.setAttribute("stroke-linecap", "round");
    checklist.setAttribute("stroke-linejoin", "round");

    icon.append(frame, checklist);
    return icon;
}

function findTaskCardDecorations(blockElement: HTMLElement): HTMLElement[] {
    const cards: HTMLElement[] = [];
    let sibling = blockElement.previousElementSibling;
    while (sibling instanceof HTMLElement && isTaskCardDecoration(sibling)) {
        cards.push(sibling);
        sibling = sibling.previousElementSibling;
    }
    return cards;
}
