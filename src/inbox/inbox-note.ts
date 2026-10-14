import { addLocalCalendarDays, getLocalDate } from "../domain/local-date";

/**
 * 收件箱便条：任务产生之前的记录，不是任务。
 *
 * 它只携带「文字 + 分级 + 时间」。任何任务字段（状态、截止日期、工作分类、
 * 重点安排、目标链接）都不得出现在这里——一旦出现，就会出现两份互相打架的权威数据。
 * 参见 AGENTS.md 的架构不变量。
 */

export const INBOX_NOTE_TIERS = ["quick", "formal"] as const;

export type InboxNoteTier = (typeof INBOX_NOTE_TIERS)[number];

export const DEFAULT_INBOX_NOTE_TIER: InboxNoteTier = "quick";

export const MAX_INBOX_NOTE_TEXT_LENGTH = 2000;

/** 「今日已完成」只展示当天；更早的完成记录保留这些天后清理。 */
export const INBOX_COMPLETED_RETENTION_DAYS = 7;

export type InboxNote = {
    id: string;
    text: string;
    tier: InboxNoteTier;
    /** 创建时刻，ISO 8601 带时区。 */
    createdAt: string;
    /** 完成时刻；缺省表示仍在待处理。 */
    completedAt?: string;
};

export type InboxNoteTextResult =
    | { valid: true; text: string }
    | { valid: false; reason: "text-empty" | "text-too-long" };

export function isInboxNoteTier(value: unknown): value is InboxNoteTier {
    return typeof value === "string"
        && INBOX_NOTE_TIERS.includes(value as InboxNoteTier);
}

export function normalizeInboxNoteText(value: unknown): InboxNoteTextResult {
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length === 0) {
        return { valid: false, reason: "text-empty" };
    }
    if (text.length > MAX_INBOX_NOTE_TEXT_LENGTH) {
        return { valid: false, reason: "text-too-long" };
    }
    return { valid: true, text };
}

export type InboxNoteParts = {
    /** 第一段，作为任务标题与默认文档名。 */
    title: string;
    /** 其余内容，移入任务清单时写进任务文档。 */
    body: string;
};

/**
 * 把便条文字拆成标题与正文。
 *
 * 规则：**第一段是标题（到第一个空行为止），其余是正文**。
 * 这样即使标题自己折了一行也不会被切开；正文可以是一整封 email。
 * 拆分只发生在显示与移入时，便条本身仍然只存一段文字，不新增字段。
 */
export function splitInboxNoteText(text: string): InboxNoteParts {
    const normalized = text.replace(/\r\n|\r/g, "\n");
    const paragraphs = normalized.split(/\n\s*\n/);
    const title = (paragraphs[0] ?? "").trim();
    if (paragraphs.length === 1) {
        return { title, body: "" };
    }
    return {
        title,
        body: paragraphs.slice(1).join("\n\n").trim(),
    };
}

/** 便条完成的本地日期；未完成或时间非法时返回 undefined。 */
export function getInboxNoteCompletedDate(note: InboxNote): string | undefined {
    if (!note.completedAt || !isIsoDateTime(note.completedAt)) {
        return undefined;
    }
    return getLocalDate(new Date(note.completedAt));
}

export function isInboxNoteCompletedOn(note: InboxNote, localDate: string): boolean {
    return getInboxNoteCompletedDate(note) === localDate;
}

/**
 * 严格解析一条便条；任何字段非法都返回 undefined，由调用方丢弃该条，
 * 不让一条坏数据拖垮整个收件箱。
 */
export function parseInboxNote(value: unknown): InboxNote | undefined {
    if (!isRecord(value)) {
        return undefined;
    }
    const id = typeof value.id === "string" ? value.id.trim() : "";
    if (id.length === 0) {
        return undefined;
    }
    const text = normalizeInboxNoteText(value.text);
    if (!text.valid) {
        return undefined;
    }
    if (!isInboxNoteTier(value.tier)) {
        return undefined;
    }
    if (!isIsoDateTime(value.createdAt)) {
        return undefined;
    }
    const completedAt = value.completedAt === undefined
        ? undefined
        : isIsoDateTime(value.completedAt) ? value.completedAt : undefined;
    if (value.completedAt !== undefined && completedAt === undefined) {
        return undefined;
    }
    return {
        id,
        text: text.text,
        tier: value.tier,
        createdAt: value.createdAt,
        ...(completedAt ? { completedAt } : {}),
    };
}

/** 完成记录是否已超过保留期（用来清理）。 */
export function isInboxNoteCompletionExpired(
    note: InboxNote,
    today: string,
    retentionDays = INBOX_COMPLETED_RETENTION_DAYS,
): boolean {
    const completedDate = getInboxNoteCompletedDate(note);
    if (!completedDate || !Number.isInteger(retentionDays) || retentionDays < 1) {
        return false;
    }
    const oldestKept = addLocalCalendarDays(today, -(retentionDays - 1));
    return oldestKept !== undefined && completedDate < oldestKept;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: unknown): value is string {
    return typeof value === "string"
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        && Number.isFinite(Date.parse(value));
}
