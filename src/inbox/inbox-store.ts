import {
    DEFAULT_INBOX_NOTE_TIER,
    INBOX_COMPLETED_RETENTION_DAYS,
    isInboxNoteCompletionExpired,
    isInboxNoteTier,
    isInboxNoteCompletedOn,
    normalizeInboxNoteText,
    parseInboxNote,
    type InboxNote,
    type InboxNoteTier,
} from "./inbox-note";

/**
 * 收件箱在插件数据文件里的完整形态。
 *
 * 这份文件保存的是**不可重建的原创内容**（便条文字），不是缓存，
 * 所以解析结果必须把「版本不认识」和「丢弃了坏条目」如实报出来，
 * 让调用方能够拒绝写回，而不是静默清空用户的东西。
 */

export const INBOX_STORE_VERSION = 1 as const;
export const INBOX_STORE_FILE = "inbox.json";
export const MAX_INBOX_NOTES = 5000;

export type InboxStore = {
    version: typeof INBOX_STORE_VERSION;
    notes: InboxNote[];
};

export type InboxStoreParseResult = {
    store: InboxStore;
    /** 版本号不认识（例如用户降级了插件）。此时绝不能把 store 写回原文件。 */
    unsupportedVersion: boolean;
    /** 被丢弃的非法条目数，用于向用户如实提示。 */
    droppedNoteCount: number;
};

export type InboxMutationFailure =
    | "text-empty"
    | "text-too-long"
    | "invalid-tier"
    | "note-limit-reached"
    | "note-not-found";

export type InboxMutationResult =
    | { ok: true; store: InboxStore }
    | { ok: false; reason: InboxMutationFailure };

export type InboxNoteDraft = {
    id: string;
    text: string;
    tier: InboxNoteTier;
    createdAt: string;
};

export function createEmptyInboxStore(): InboxStore {
    return { version: INBOX_STORE_VERSION, notes: [] };
}

export function parseInboxStore(value: unknown): InboxStoreParseResult {
    if (!isRecord(value)) {
        return {
            store: createEmptyInboxStore(),
            unsupportedVersion: false,
            droppedNoteCount: 0,
        };
    }
    if (Object.keys(value).length === 0) {
        // 思源在插件数据文件尚不存在时返回空对象，这是「还没有数据」，
        // 不是「版本不认识」——否则第一次记录就会被当成损坏数据拒绝写入。
        return {
            store: createEmptyInboxStore(),
            unsupportedVersion: false,
            droppedNoteCount: 0,
        };
    }
    if (value.version !== INBOX_STORE_VERSION) {
        return {
            store: createEmptyInboxStore(),
            unsupportedVersion: true,
            droppedNoteCount: 0,
        };
    }

    const rawNotes = Array.isArray(value.notes) ? value.notes : [];
    const notes: InboxNote[] = [];
    const seenIds = new Set<string>();
    let droppedNoteCount = 0;
    for (const raw of rawNotes) {
        const note = parseInboxNote(raw);
        if (!note || seenIds.has(note.id)) {
            droppedNoteCount += 1;
            continue;
        }
        seenIds.add(note.id);
        notes.push(note);
    }
    return {
        store: { version: INBOX_STORE_VERSION, notes },
        unsupportedVersion: false,
        droppedNoteCount,
    };
}

export function addInboxNote(
    store: InboxStore,
    draft: InboxNoteDraft,
): InboxMutationResult {
    const id = typeof draft.id === "string" ? draft.id.trim() : "";
    if (id.length === 0 || store.notes.some((note) => note.id === id)) {
        return { ok: false, reason: "note-not-found" };
    }
    const text = normalizeInboxNoteText(draft.text);
    if (!text.valid) {
        return { ok: false, reason: text.reason };
    }
    if (!isInboxNoteTier(draft.tier)) {
        return { ok: false, reason: "invalid-tier" };
    }
    if (store.notes.length >= MAX_INBOX_NOTES) {
        return { ok: false, reason: "note-limit-reached" };
    }

    const note: InboxNote = {
        id,
        text: text.text,
        tier: draft.tier,
        createdAt: draft.createdAt,
    };
    return { ok: true, store: { version: INBOX_STORE_VERSION, notes: [...store.notes, note] } };
}

export function removeInboxNote(store: InboxStore, id: string): InboxStore {
    return {
        version: INBOX_STORE_VERSION,
        notes: store.notes.filter((note) => note.id !== id),
    };
}

/**
 * 修改便条的文字和分级。
 *
 * id、创建时间和完成时间都保持不变：编辑不是重记一条，
 * 记录时间不能让便条跳到列表顶部，完成状态也不能被编辑顺手抹掉。
 */
export function updateInboxNote(
    store: InboxStore,
    id: string,
    update: { text: string; tier: InboxNoteTier },
): InboxMutationResult {
    if (!store.notes.some((note) => note.id === id)) {
        return { ok: false, reason: "note-not-found" };
    }
    const text = normalizeInboxNoteText(update.text);
    if (!text.valid) {
        return { ok: false, reason: text.reason };
    }
    if (!isInboxNoteTier(update.tier)) {
        return { ok: false, reason: "invalid-tier" };
    }
    return {
        ok: true,
        store: {
            version: INBOX_STORE_VERSION,
            notes: store.notes.map((note) => (
                note.id === id ? { ...note, text: text.text, tier: update.tier } : note
            )),
        },
    };
}

export function setInboxNoteTier(
    store: InboxStore,
    id: string,
    tier: InboxNoteTier,
): InboxMutationResult {
    if (!isInboxNoteTier(tier)) {
        return { ok: false, reason: "invalid-tier" };
    }
    if (!store.notes.some((note) => note.id === id)) {
        return { ok: false, reason: "note-not-found" };
    }
    return {
        ok: true,
        store: {
            version: INBOX_STORE_VERSION,
            notes: store.notes.map((note) => (note.id === id ? { ...note, tier } : note)),
        },
    };
}

/**
 * 标记完成。完成的便条不再出现在待处理里，但仍留在数据中，
 * 供「今日已完成」展示；超过保留期后由 pruneInboxStore 清理。
 */
export function completeInboxNote(
    store: InboxStore,
    id: string,
    completedAt: string,
): InboxMutationResult {
    const target = store.notes.find((note) => note.id === id);
    if (!target) {
        return { ok: false, reason: "note-not-found" };
    }
    const completed: InboxNote = { ...target, completedAt };
    return {
        ok: true,
        store: {
            version: INBOX_STORE_VERSION,
            notes: store.notes.map((note) => (note.id === id ? completed : note)),
        },
    };
}

/** 清理超过保留期的完成记录；待处理便条一律不动。 */
export function pruneInboxStore(
    store: InboxStore,
    today: string,
    retentionDays = INBOX_COMPLETED_RETENTION_DAYS,
): InboxStore {
    const notes = store.notes.filter((note) => (
        note.completedAt === undefined
        || !isInboxNoteCompletionExpired(note, today, retentionDays)
    ));
    return notes.length === store.notes.length
        ? store
        : { version: INBOX_STORE_VERSION, notes };
}

export type PendingInboxNotes = {
    quick: InboxNote[];
    formal: InboxNote[];
    total: number;
};

/** 待处理便条，两级分开，各自按创建时间倒序（最新的在最上面）。 */
export function selectPendingInboxNotes(store: InboxStore): PendingInboxNotes {
    const pending = store.notes
        .filter((note) => note.completedAt === undefined)
        .sort(compareByCreatedAtDesc);
    const quick = pending.filter((note) => note.tier === "quick");
    const formal = pending.filter((note) => note.tier === "formal");
    return { quick, formal, total: pending.length };
}

/** 指定本地日期完成的便条，最近完成的在最上面。 */
export function selectInboxNotesCompletedOn(
    store: InboxStore,
    localDate: string,
): InboxNote[] {
    return store.notes
        .filter((note) => isInboxNoteCompletedOn(note, localDate))
        .sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? ""));
}

export function findInboxNote(store: InboxStore, id: string): InboxNote | undefined {
    return store.notes.find((note) => note.id === id);
}

/**
 * 生成便条 id。刻意不用思源块 ID 的格式，避免和真正的块 ID 混淆。
 */
export function createInboxNoteId(
    now: Date = new Date(),
    random: () => number = Math.random,
): string {
    const stamp = now.getTime().toString(36);
    const suffix = Math.floor(random() * 0x100000000).toString(36).padStart(7, "0");
    return `note-${stamp}-${suffix}`;
}

export function createInboxNoteDraft(
    text: string,
    tier: InboxNoteTier = DEFAULT_INBOX_NOTE_TIER,
    now: Date = new Date(),
    random: () => number = Math.random,
): InboxNoteDraft {
    return {
        id: createInboxNoteId(now, random),
        text,
        tier,
        createdAt: now.toISOString(),
    };
}

function compareByCreatedAtDesc(left: InboxNote, right: InboxNote): number {
    const created = right.createdAt.localeCompare(left.createdAt);
    return created !== 0 ? created : right.id.localeCompare(left.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
