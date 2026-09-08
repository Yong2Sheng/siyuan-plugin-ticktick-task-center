import {
    parseFocusPlanAttribute,
    serializeFocusPlan,
    setFocusEntryOrder,
    toggleFocusDate,
    toggleQuickFocusDate,
    type FocusPlan,
} from "../domain/focus-plan";
import { TASK_BLOCK_OPTIONAL_ATTRIBUTES } from "../domain/task";
import { TASK_STATUS_CONFIG } from "../domain/status";
import { parseTaskBlockAttributes } from "../task-card/task-data";

export type FocusPlanApi = {
    loadAttributes(blockId: string): Promise<Record<string, unknown>>;
    setBlockAttributes(blockId: string, attributes: Record<string, string>): Promise<void>;
};

export type FocusPlanErrorCode =
    | "task-unavailable"
    | "task-invalid"
    | "task-closed"
    | "focus-plan-invalid"
    | "invalid-date"
    | "past-date"
    | "after-deadline"
    | "focus-date-missing"
    | "invalid-order"
    | "write-failed"
    | "verification-failed";

export class FocusPlanError extends Error {
    constructor(
        public readonly code: FocusPlanErrorCode,
        public readonly blockId: string,
        public readonly originalError?: unknown,
    ) {
        super(code);
        this.name = "FocusPlanError";
    }
}

export async function toggleTaskFocusDate(
    api: FocusPlanApi,
    blockId: string,
    targetDate: string,
    today: string,
    mode: "quick" | "exact" = "quick",
    now: () => Date = () => new Date(),
): Promise<FocusPlan> {
    let attributes: Record<string, unknown>;
    try {
        attributes = await api.loadAttributes(blockId);
    } catch (error) {
        throw new FocusPlanError("task-unavailable", blockId, error);
    }

    const task = parseTaskBlockAttributes(attributes);
    if (!task.valid) {
        throw new FocusPlanError("task-invalid", blockId, task.reason);
    }
    if (TASK_STATUS_CONFIG[task.data.status].terminal) {
        throw new FocusPlanError("task-closed", blockId);
    }

    const parsedPlan = parseFocusPlanAttribute(
        attributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.focusPlan],
    );
    if (!parsedPlan.valid) {
        throw new FocusPlanError("focus-plan-invalid", blockId);
    }

    const updated = (mode === "quick" ? toggleQuickFocusDate : toggleFocusDate)(
        parsedPlan.plan,
        targetDate,
        today,
        task.data.deadline,
        now().toISOString(),
    );
    if (!updated.changed) {
        throw new FocusPlanError(updated.reason, blockId);
    }

    const serialized = serializeFocusPlan(updated.plan);
    try {
        await api.setBlockAttributes(blockId, {
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.focusPlan]: serialized,
        });
    } catch (error) {
        throw new FocusPlanError("write-failed", blockId, error);
    }

    let verifiedAttributes: Record<string, unknown>;
    try {
        verifiedAttributes = await api.loadAttributes(blockId);
    } catch (error) {
        throw new FocusPlanError("verification-failed", blockId, error);
    }
    const verified = parseFocusPlanAttribute(
        verifiedAttributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.focusPlan],
    );
    if (!verified.valid || serializeFocusPlan(verified.plan) !== serialized) {
        throw new FocusPlanError("verification-failed", blockId);
    }
    return verified.plan;
}

export async function setTaskFocusOrder(
    api: FocusPlanApi,
    blockId: string,
    focusDate: string,
    order: number,
): Promise<FocusPlan> {
    if (!Number.isFinite(order)) {
        throw new FocusPlanError("invalid-order", blockId);
    }
    let attributes: Record<string, unknown>;
    try {
        attributes = await api.loadAttributes(blockId);
    } catch (error) {
        throw new FocusPlanError("task-unavailable", blockId, error);
    }
    const task = parseTaskBlockAttributes(attributes);
    if (!task.valid) {
        throw new FocusPlanError("task-invalid", blockId, task.reason);
    }
    if (TASK_STATUS_CONFIG[task.data.status].terminal) {
        throw new FocusPlanError("task-closed", blockId);
    }
    const parsedPlan = parseFocusPlanAttribute(
        attributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.focusPlan],
    );
    if (!parsedPlan.valid) {
        throw new FocusPlanError("focus-plan-invalid", blockId);
    }
    const updated = setFocusEntryOrder(parsedPlan.plan, focusDate, order);
    if (!updated) {
        throw new FocusPlanError("focus-date-missing", blockId);
    }

    const serialized = serializeFocusPlan(updated);
    try {
        await api.setBlockAttributes(blockId, {
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.focusPlan]: serialized,
        });
    } catch (error) {
        throw new FocusPlanError("write-failed", blockId, error);
    }
    let verifiedAttributes: Record<string, unknown>;
    try {
        verifiedAttributes = await api.loadAttributes(blockId);
    } catch (error) {
        throw new FocusPlanError("verification-failed", blockId, error);
    }
    const verified = parseFocusPlanAttribute(
        verifiedAttributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.focusPlan],
    );
    if (!verified.valid || serializeFocusPlan(verified.plan) !== serialized) {
        throw new FocusPlanError("verification-failed", blockId);
    }
    return verified.plan;
}
