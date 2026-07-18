import type { TaskCardViewModel } from "./card-view-model";

export const TASK_CARD_CONTAINER_ATTRIBUTE = "data-ticktick-task-enhancement";
export const TASK_CARD_BLOCK_ID_ATTRIBUTE = "data-ticktick-task-block-id";

export type TaskCardActions = {
    onEditTask(blockId: string, options: { focus: "status" }): void;
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
    card.setAttribute("contenteditable", "false");

    const identity = document.createElement("span");
    identity.className = "ticktick-task-card__identity";
    identity.textContent = viewModel.identity;

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

    card.append(identity, main, status);
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

function findTaskCardDecorations(blockElement: HTMLElement): HTMLElement[] {
    const cards: HTMLElement[] = [];
    let sibling = blockElement.previousElementSibling;
    while (sibling instanceof HTMLElement && isTaskCardDecoration(sibling)) {
        cards.push(sibling);
        sibling = sibling.previousElementSibling;
    }
    return cards;
}
