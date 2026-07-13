import type { TaskCardViewModel } from "./card-view-model";

export const TASK_CARD_CONTAINER_ATTRIBUTE = "data-ticktick-task-enhancement";
export const ENHANCED_BLOCK_CLASS = "ticktick-task-block--enhanced";
export const HIDDEN_ORIGINAL_CLASS = "ticktick-task-block__original--hidden";

export type TaskCardActions = {
    onEditTask(blockId: string, options: { focus: "status" }): void;
};

export function enhanceTaskBlock(
    blockElement: HTMLElement,
    blockId: string,
    viewModel: TaskCardViewModel,
    actions?: TaskCardActions,
): boolean {
    if (blockElement.querySelector(`:scope > [${TASK_CARD_CONTAINER_ATTRIBUTE}]`) !== null) {
        return true;
    }

    const originalContent = findOriginalContent(blockElement);
    if (originalContent === null) {
        return false;
    }

    const card = document.createElement("div");
    card.className = "ticktick-task-card";
    card.setAttribute(TASK_CARD_CONTAINER_ATTRIBUTE, "");
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
    originalContent.classList.add(HIDDEN_ORIGINAL_CLASS);
    blockElement.classList.add(ENHANCED_BLOCK_CLASS);

    const attributeElement = Array.from(blockElement.children).find((element) =>
        element.classList.contains("protyle-attr"),
    );
    blockElement.insertBefore(card, attributeElement ?? null);
    return true;
}

export function restoreTaskBlock(blockElement: HTMLElement): void {
    for (const card of blockElement.querySelectorAll(`:scope > [${TASK_CARD_CONTAINER_ATTRIBUTE}]`)) {
        card.remove();
    }
    for (const original of blockElement.querySelectorAll(`:scope > .${HIDDEN_ORIGINAL_CLASS}`)) {
        original.classList.remove(HIDDEN_ORIGINAL_CLASS);
    }
    blockElement.classList.remove(ENHANCED_BLOCK_CLASS);
}

export function restoreTaskBlocks(root: ParentNode): void {
    for (const block of root.querySelectorAll<HTMLElement>(`.${ENHANCED_BLOCK_CLASS}`)) {
        restoreTaskBlock(block);
    }
}

export function isTaskBlockEnhanced(blockElement: HTMLElement): boolean {
    return blockElement.classList.contains(ENHANCED_BLOCK_CLASS)
        && blockElement.querySelector(`:scope > [${TASK_CARD_CONTAINER_ATTRIBUTE}]`) !== null;
}

function findOriginalContent(blockElement: HTMLElement): HTMLElement | null {
    return Array.from(blockElement.children).find((element): element is HTMLElement =>
        element instanceof HTMLElement && element.getAttribute("contenteditable") === "true",
    ) ?? null;
}
