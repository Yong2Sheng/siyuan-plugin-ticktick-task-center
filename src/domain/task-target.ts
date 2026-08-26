import { isSiYuanId } from "./siyuan-id";

export type TaskTarget =
    | { kind: "ticktick"; url: string }
    | { kind: "dida365"; url: string }
    | { kind: "siyuan-block"; url: string; blockId: string }
    | { kind: "https-resource"; url: string };

export const TASK_TARGET_OPEN_LABEL_KEYS = {
    ticktick: "taskTarget.openTickTick",
    dida365: "taskTarget.openDida365",
    "siyuan-block": "taskTarget.openSiYuan",
    "https-resource": "taskTarget.openResource",
} as const satisfies Record<TaskTarget["kind"], string>;

export type TaskTargetParseFailure =
    | "invalid-url"
    | "unsupported-protocol"
    | "embedded-credentials"
    | "invalid-siyuan-block";

export type TaskTargetParseResult =
    | { valid: true; target: TaskTarget }
    | { valid: false; reason: TaskTargetParseFailure };

export function parseTaskTarget(value: string): TaskTargetParseResult {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return { valid: false, reason: "invalid-url" };
    }

    if (url.username !== "" || url.password !== "") {
        return { valid: false, reason: "embedded-credentials" };
    }

    if (url.protocol === "https:") {
        if (url.hostname === "") {
            return { valid: false, reason: "invalid-url" };
        }
        if (url.hostname === "ticktick.com") {
            return { valid: true, target: { kind: "ticktick", url: url.toString() } };
        }
        if (url.hostname === "dida365.com") {
            return { valid: true, target: { kind: "dida365", url: url.toString() } };
        }
        return { valid: true, target: { kind: "https-resource", url: url.toString() } };
    }

    if (url.protocol === "siyuan:") {
        const pathMatch = /^\/([^/]+)$/.exec(url.pathname);
        const blockId = pathMatch?.[1];
        if (
            url.hostname !== "blocks"
            || !isSiYuanId(blockId)
            || url.port !== ""
            || url.search !== ""
            || url.hash !== ""
        ) {
            return { valid: false, reason: "invalid-siyuan-block" };
        }
        return {
            valid: true,
            target: {
                kind: "siyuan-block",
                url: `siyuan://blocks/${blockId}`,
                blockId,
            },
        };
    }

    return { valid: false, reason: "unsupported-protocol" };
}

export function isAllowedTaskTarget(value: string): boolean {
    return parseTaskTarget(value).valid;
}
