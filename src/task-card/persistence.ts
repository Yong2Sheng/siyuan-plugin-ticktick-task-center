import { TASK_CARD_CONTAINER_ATTRIBUTE } from "./renderer";

export type TaskCardPollutionInspection =
    | { kind: "none" }
    | { kind: "valid"; cardCount: number }
    | { kind: "suspicious" };

const SERIALIZED_CARD_SELECTOR = `.ticktick-task-card, [${TASK_CARD_CONTAINER_ATTRIBUTE}]`;

export function inspectTaskCardPollution(
    blockElement: HTMLElement,
): TaskCardPollutionInspection {
    const markers = Array.from(
        blockElement.querySelectorAll<HTMLElement>(SERIALIZED_CARD_SELECTOR),
    );
    if (markers.length === 0) {
        return { kind: "none" };
    }

    const cards = Array.from(new Set(markers.map((marker) =>
        marker.matches(".ticktick-task-card")
            ? marker
            : marker.closest<HTMLElement>(".ticktick-task-card") ?? marker,
    )));
    if (
        cards.length === 0
        || cards.some((card) => !isGeneratedTaskCard(card))
        || markers.some((marker) => !cards.some((card) => card === marker || card.contains(marker)))
    ) {
        return { kind: "suspicious" };
    }

    return { kind: "valid", cardCount: cards.length };
}

function isGeneratedTaskCard(card: HTMLElement): boolean {
    if (card.tagName !== "DIV" || !card.classList.contains("ticktick-task-card")) {
        return false;
    }
    if (!card.hasAttribute(TASK_CARD_CONTAINER_ATTRIBUTE)) {
        return false;
    }

    const children = Array.from(card.children);
    if (children.length !== 3) {
        return false;
    }
    const [identity, main, status] = children;
    if (
        !(identity instanceof HTMLElement)
        || !identity.classList.contains("ticktick-task-card__identity")
        || !(main instanceof HTMLElement)
        || !main.classList.contains("ticktick-task-card__main")
        || !(status instanceof HTMLButtonElement)
        || !status.classList.contains("ticktick-task-card__status")
    ) {
        return false;
    }

    const mainChildren = Array.from(main.children);
    return mainChildren.length === 1
        && mainChildren[0] instanceof HTMLAnchorElement
        && mainChildren[0].classList.contains("ticktick-task-card__link")
        && status.type === "button";
}
