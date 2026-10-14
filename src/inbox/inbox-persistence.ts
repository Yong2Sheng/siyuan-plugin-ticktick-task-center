import { getLocalDate } from "../domain/local-date";
import {
    INBOX_STORE_FILE,
    parseInboxStore,
    pruneInboxStore,
    type InboxStore,
} from "./inbox-store";
import type { InboxNote } from "./inbox-note";

/**
 * 收件箱便条的读写。这份数据是**不可重建的原创内容**，所以：
 *
 * 1. 每次写入前先把当前文件轮转进三级备份，备份是写入失败后唯一的回退来源；
 * 2. 写入后立刻读回逐字段复核，不一致就如实报错，不假装保存成功；
 * 3. 遇到不认识的版本号时拒绝继续，绝不把空收件箱写回去覆盖用户内容。
 */

export const INBOX_BACKUP_FILES = [
    "inbox.backup-1.json",
    "inbox.backup-2.json",
    "inbox.backup-3.json",
] as const;

export type InboxPersistenceApi = {
    loadData(file: string): Promise<unknown>;
    saveData(file: string, value: unknown): Promise<unknown>;
};

export type InboxStoreErrorCode =
    | "load-failed"
    | "unsupported-version"
    | "save-failed"
    | "verify-failed";

export class InboxStoreError extends Error {
    constructor(
        public readonly code: InboxStoreErrorCode,
        public readonly originalError?: unknown,
    ) {
        super(code);
        this.name = "InboxStoreError";
    }
}

export type InboxLoadResult = {
    store: InboxStore;
    /** 被丢弃的非法条目数，用于如实向用户提示，而不是静默丢失。 */
    droppedNoteCount: number;
};

export async function loadInboxStore(
    api: InboxPersistenceApi,
    today = getLocalDate(),
): Promise<InboxLoadResult> {
    const parsed = await readInboxStore(api);
    if (parsed.unsupportedVersion) {
        throw new InboxStoreError("unsupported-version");
    }
    return {
        store: pruneInboxStore(parsed.store, today),
        droppedNoteCount: parsed.droppedNoteCount,
    };
}

export async function saveInboxStore(
    api: InboxPersistenceApi,
    store: InboxStore,
): Promise<void> {
    await rotateInboxBackups(api);
    try {
        await api.saveData(INBOX_STORE_FILE, store);
    } catch (error) {
        throw new InboxStoreError("save-failed", error);
    }

    const verified = await readInboxStore(api);
    if (verified.unsupportedVersion || !isSameStore(verified.store, store)) {
        throw new InboxStoreError("verify-failed");
    }
}

/** 读原始文件并解析；不认识的版本号由调用方决定怎么处理。 */
async function readInboxStore(api: InboxPersistenceApi) {
    let raw: unknown;
    try {
        raw = await api.loadData(INBOX_STORE_FILE);
    } catch (error) {
        throw new InboxStoreError("load-failed", error);
    }
    return parseInboxStore(raw);
}

/**
 * 轮转三级备份：当前文件 → backup-1 → backup-2 → backup-3。
 * 顺序是先写靠后的备份，保证任何一步失败都不会覆盖较新的备份。
 */
async function rotateInboxBackups(api: InboxPersistenceApi): Promise<void> {
    const [first, second, third] = INBOX_BACKUP_FILES;
    const [current, backup1, backup2] = await Promise.all([
        api.loadData(INBOX_STORE_FILE),
        api.loadData(first),
        api.loadData(second),
    ]);

    for (const [file, value] of [
        [third, backup2],
        [second, backup1],
        [first, current],
    ] as const) {
        if (!hasContent(value)) {
            continue;
        }
        try {
            await api.saveData(file, value);
        } catch (error) {
            throw new InboxStoreError("save-failed", error);
        }
    }
}

function hasContent(value: unknown): boolean {
    return typeof value === "object"
        && value !== null
        && !Array.isArray(value)
        && Object.keys(value).length > 0;
}

/** 逐字段比对，不依赖 JSON 键顺序。 */
function isSameStore(left: InboxStore, right: InboxStore): boolean {
    if (left.version !== right.version || left.notes.length !== right.notes.length) {
        return false;
    }
    return left.notes.every((note, index) => isSameNote(note, right.notes[index]));
}

function isSameNote(left: InboxNote | undefined, right: InboxNote | undefined): boolean {
    if (!left || !right) {
        return false;
    }
    return left.id === right.id
        && left.text === right.text
        && left.tier === right.tier
        && left.createdAt === right.createdAt
        && left.completedAt === right.completedAt;
}
