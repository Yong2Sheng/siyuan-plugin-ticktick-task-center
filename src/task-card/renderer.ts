import type { TaskCardViewModel } from "./card-view-model";
import { getDeadlineState } from "../domain/deadline";
import { createDeadlineButton } from "./deadline-button";

export const TASK_CARD_CONTAINER_ATTRIBUTE = "data-ticktick-task-enhancement";
export const TASK_CARD_BLOCK_ID_ATTRIBUTE = "data-ticktick-task-block-id";

export type TaskCardActions = {
    onEditTask(blockId: string, options: { focus: "status" | "deadline" }): void;
};

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
    card.setAttribute("data-deadline-state", getDeadlineState(viewModel.deadline).kind);
    card.setAttribute("contenteditable", "false");

    const identity = document.createElement("span");
    identity.className = "ticktick-task-card__identity";
    identity.append(createTaskIdentityIcon(), viewModel.identity);

    const main = document.createElement("span");
    main.className = "ticktick-task-card__main";

    const link = document.createElement("a");
    link.className = "ticktick-task-card__link";
    link.href = viewModel.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = viewModel.title;
    link.textContent = viewModel.linkText;
    main.append(link);

    const deadline = createDeadlineButton({
        className: "ticktick-task-card__deadline",
        deadline: viewModel.deadline,
        translate: (key) => viewModel.translate(key),
        onClick: () => actions?.onEditTask(blockId, { focus: "deadline" }),
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

    card.append(identity, main, status, deadline);
    blockElement.before(card);
    return true;
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
