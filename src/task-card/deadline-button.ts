import {
    DEADLINE_TRACK_SEGMENTS,
    formatDeadlineDate,
    getDeadlineState,
    type DeadlineStateKind,
} from "../domain/deadline";
import type { Translate } from "../i18n";

export type DeadlineButtonOptions = {
    className: string;
    deadline?: string;
    today?: string;
    locale?: string;
    translate: Translate;
    onClick(): void;
};

export function createDeadlineButton(options: DeadlineButtonOptions): HTMLButtonElement {
    const state = getDeadlineState(options.deadline, options.today);
    const label = getDeadlineLabel(state.kind, state.daysRemaining, options.translate);
    const dateLabel = options.deadline
        ? formatDeadlineDate(options.deadline, options.locale, options.today)
        : options.translate("deadline.setAction");

    const button = document.createElement("button");
    button.type = "button";
    button.className = options.className;
    button.dataset.deadlineState = state.kind;
    button.title = options.translate("deadline.editTitle");
    button.setAttribute(
        "aria-label",
        options.translate("deadline.editAriaLabel")
            .replace("${summary}", label)
            .replace("${date}", options.deadline ?? options.translate("deadline.none")),
    );

    const summary = document.createElement("span");
    summary.className = `${options.className}-summary`;
    summary.textContent = label;

    const track = document.createElement("span");
    track.className = `${options.className}-track`;
    track.setAttribute("aria-hidden", "true");
    for (let index = 0; index < DEADLINE_TRACK_SEGMENTS; index += 1) {
        const segment = document.createElement("span");
        segment.className = `${options.className}-segment`;
        segment.dataset.filled = String(index < state.filledSegments);
        track.append(segment);
    }

    const date = document.createElement("span");
    date.className = `${options.className}-date`;
    date.textContent = dateLabel;
    button.append(summary, track, date);
    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onClick();
    });
    return button;
}

function getDeadlineLabel(
    kind: DeadlineStateKind,
    daysRemaining: number | undefined,
    translate: Translate,
): string {
    if (kind === "unset") {
        return translate("deadline.none");
    }
    if (kind === "today") {
        return translate("deadline.dueToday");
    }
    if (kind === "overdue") {
        return translate("deadline.overdueDays")
            .replace("${count}", String(Math.abs(daysRemaining ?? 0)));
    }
    return translate("deadline.remainingDays").replace("${count}", String(daysRemaining));
}
