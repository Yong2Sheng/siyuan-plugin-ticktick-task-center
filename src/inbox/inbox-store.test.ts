import { describe, expect, it } from "vitest";

import {
    INBOX_STORE_VERSION,
    MAX_INBOX_NOTES,
    addInboxNote,
    completeInboxNote,
    createEmptyInboxStore,
    createInboxNoteDraft,
    createInboxNoteId,
    findInboxNote,
    parseInboxStore,
    pruneInboxStore,
    removeInboxNote,
    selectInboxNotesCompletedOn,
    selectPendingInboxNotes,
    setInboxNoteTier,
    type InboxStore,
} from "./inbox-store";

const CREATED = "2026-10-11T14:32:00.000Z";

function storeWith(...notes: Array<Partial<{ id: string; text: string; tier: string; createdAt: string; completedAt: string }>>): InboxStore {
    return {
        version: INBOX_STORE_VERSION,
        notes: notes.map((note, index) => ({
            id: note.id ?? `note-${index}`,
            text: note.text ?? `便条 ${index}`,
            tier: (note.tier ?? "quick") as "quick" | "formal",
            createdAt: note.createdAt ?? CREATED,
            ...(note.completedAt ? { completedAt: note.completedAt } : {}),
        })),
    };
}

describe("parseInboxStore", () => {
    it("把空数据解析成空收件箱", () => {
        for (const value of [undefined, null, [], "text", 42]) {
            const parsed = parseInboxStore(value);
            expect(parsed.store).toEqual(createEmptyInboxStore());
            expect(parsed.unsupportedVersion).toBe(false);
            expect(parsed.droppedNoteCount).toBe(0);
        }
    });

    it("把空对象当成「还没有数据」，而不是版本不认识", () => {
        // 思源在插件数据文件尚不存在时返回空对象；若当成损坏，
        // 第一次记录就会被拒绝，收件箱永远用不了。
        const parsed = parseInboxStore({});
        expect(parsed.store).toEqual(createEmptyInboxStore());
        expect(parsed.unsupportedVersion).toBe(false);
        expect(parsed.droppedNoteCount).toBe(0);
    });

    it("只有 version 字段、没有 notes 时按空列表处理", () => {
        const parsed = parseInboxStore({ version: INBOX_STORE_VERSION });
        expect(parsed.store.notes).toEqual([]);
        expect(parsed.unsupportedVersion).toBe(false);
    });

    it("有内容但没有版本号时视为不认识，避免覆盖", () => {
        const parsed = parseInboxStore({
            notes: [{ id: "note-1", text: "内容", tier: "quick", createdAt: CREATED }],
        });
        expect(parsed.unsupportedVersion).toBe(true);
        expect(parsed.store.notes).toEqual([]);
    });

    it("丢弃非法条目并如实报告丢弃数量", () => {
        const parsed = parseInboxStore({
            version: INBOX_STORE_VERSION,
            notes: [
                { id: "note-1", text: "留下", tier: "quick", createdAt: CREATED },
                { id: "note-2", text: "  ", tier: "quick", createdAt: CREATED },
                { id: "note-3", text: "分级非法", tier: "urgent", createdAt: CREATED },
                "not-an-object",
            ],
        });
        expect(parsed.store.notes.map((note) => note.id)).toEqual(["note-1"]);
        expect(parsed.droppedNoteCount).toBe(3);
        expect(parsed.unsupportedVersion).toBe(false);
    });

    it("重复 id 只保留第一条", () => {
        const parsed = parseInboxStore({
            version: INBOX_STORE_VERSION,
            notes: [
                { id: "note-1", text: "第一条", tier: "quick", createdAt: CREATED },
                { id: "note-1", text: "重复", tier: "quick", createdAt: CREATED },
            ],
        });
        expect(parsed.store.notes).toHaveLength(1);
        expect(parsed.store.notes[0]?.text).toBe("第一条");
        expect(parsed.droppedNoteCount).toBe(1);
    });

    it("版本不认识时明确标记，调用方据此拒绝写回", () => {
        const parsed = parseInboxStore({
            version: 99,
            notes: [{ id: "note-1", text: "来自未来版本", tier: "quick", createdAt: CREATED }],
        });
        expect(parsed.unsupportedVersion).toBe(true);
        expect(parsed.store.notes).toEqual([]);
    });
});

describe("addInboxNote", () => {
    it("新增一条待处理便条", () => {
        const result = addInboxNote(createEmptyInboxStore(), {
            id: "note-1",
            text: "  订 11 月会议期间住的酒店  ",
            tier: "quick",
            createdAt: CREATED,
        });
        expect(result.ok).toBe(true);
        expect(result.ok && result.store.notes).toEqual([
            { id: "note-1", text: "订 11 月会议期间住的酒店", tier: "quick", createdAt: CREATED },
        ]);
    });

    it("拒绝空文字、未知分级和重复 id", () => {
        const empty = createEmptyInboxStore();
        expect(addInboxNote(empty, { id: "a", text: "   ", tier: "quick", createdAt: CREATED }))
            .toEqual({ ok: false, reason: "text-empty" });
        expect(addInboxNote(empty, { id: "a", text: "内容", tier: "urgent" as never, createdAt: CREATED }))
            .toEqual({ ok: false, reason: "invalid-tier" });
        expect(addInboxNote(empty, { id: "  ", text: "内容", tier: "quick", createdAt: CREATED }))
            .toEqual({ ok: false, reason: "note-not-found" });

        const once = addInboxNote(empty, { id: "a", text: "内容", tier: "quick", createdAt: CREATED });
        expect(once.ok).toBe(true);
        if (once.ok) {
            expect(addInboxNote(once.store, { id: "a", text: "再来", tier: "quick", createdAt: CREATED }))
                .toEqual({ ok: false, reason: "note-not-found" });
        }
    });

    it("达到上限后拒绝新增且不破坏原数据", () => {
        const full: InboxStore = {
            version: INBOX_STORE_VERSION,
            notes: Array.from({ length: MAX_INBOX_NOTES }, (_value, index) => ({
                id: `note-${index}`,
                text: "内容",
                tier: "quick" as const,
                createdAt: CREATED,
            })),
        };
        expect(addInboxNote(full, { id: "note-new", text: "内容", tier: "quick", createdAt: CREATED }))
            .toEqual({ ok: false, reason: "note-limit-reached" });
        expect(full.notes).toHaveLength(MAX_INBOX_NOTES);
    });
});

describe("removeInboxNote", () => {
    it("只删掉目标便条", () => {
        const store = storeWith({ id: "a" }, { id: "b" });
        expect(removeInboxNote(store, "a").notes.map((note) => note.id)).toEqual(["b"]);
    });

    it("删不存在的便条不报错也不改动", () => {
        const store = storeWith({ id: "a" });
        expect(removeInboxNote(store, "missing").notes).toEqual(store.notes);
    });
});

describe("setInboxNoteTier", () => {
    it("改级只影响目标便条", () => {
        const store = storeWith({ id: "a" }, { id: "b" });
        const result = setInboxNoteTier(store, "a", "formal");
        expect(result.ok).toBe(true);
        expect(result.ok && result.store.notes.map((note) => note.tier)).toEqual(["formal", "quick"]);
    });

    it("目标不存在或分级非法时失败", () => {
        const store = storeWith({ id: "a" });
        expect(setInboxNoteTier(store, "missing", "formal"))
            .toEqual({ ok: false, reason: "note-not-found" });
        expect(setInboxNoteTier(store, "a", "urgent" as never))
            .toEqual({ ok: false, reason: "invalid-tier" });
    });
});

describe("completeInboxNote", () => {
    it("打上完成时间后离开待处理", () => {
        const store = storeWith({ id: "a" });
        const result = completeInboxNote(store, "a", "2026-10-11T15:00:00.000Z");
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }
        expect(selectPendingInboxNotes(result.store).total).toBe(0);
        expect(findInboxNote(result.store, "a")?.completedAt).toBe("2026-10-11T15:00:00.000Z");
    });

    it("目标不存在时失败", () => {
        expect(completeInboxNote(storeWith({ id: "a" }), "missing", CREATED))
            .toEqual({ ok: false, reason: "note-not-found" });
    });
});

describe("selectPendingInboxNotes", () => {
    it("两级分开并按创建时间倒序", () => {
        const store = storeWith(
            { id: "old-quick", tier: "quick", createdAt: "2026-10-10T09:00:00.000Z" },
            { id: "new-quick", tier: "quick", createdAt: "2026-10-11T09:00:00.000Z" },
            { id: "formal", tier: "formal", createdAt: "2026-10-11T08:00:00.000Z" },
            { id: "done", tier: "quick", completedAt: "2026-10-11T10:00:00.000Z" },
        );
        const pending = selectPendingInboxNotes(store);
        expect(pending.quick.map((note) => note.id)).toEqual(["new-quick", "old-quick"]);
        expect(pending.formal.map((note) => note.id)).toEqual(["formal"]);
        expect(pending.total).toBe(3);
    });
});

describe("selectInboxNotesCompletedOn", () => {
    it("只返回指定本地日期完成的便条，最近完成的在前", () => {
        const store = storeWith(
            { id: "today-early", completedAt: new Date(2026, 9, 11, 9, 0, 0).toISOString() },
            { id: "today-late", completedAt: new Date(2026, 9, 11, 18, 0, 0).toISOString() },
            { id: "yesterday", completedAt: new Date(2026, 9, 10, 18, 0, 0).toISOString() },
            { id: "pending" },
        );
        expect(selectInboxNotesCompletedOn(store, "2026-10-11").map((note) => note.id))
            .toEqual(["today-late", "today-early"]);
        expect(selectInboxNotesCompletedOn(store, "2026-10-10").map((note) => note.id))
            .toEqual(["yesterday"]);
        expect(selectInboxNotesCompletedOn(store, "2026-10-09")).toEqual([]);
    });
});

describe("pruneInboxStore", () => {
    it("清掉过期的完成记录，待处理便条一律保留", () => {
        const store = storeWith(
            { id: "pending" },
            { id: "fresh", completedAt: new Date(2026, 9, 11, 9, 0, 0).toISOString() },
            { id: "expired", completedAt: new Date(2026, 9, 4, 9, 0, 0).toISOString() },
        );
        const pruned = pruneInboxStore(store, "2026-10-11", 7);
        expect(pruned.notes.map((note) => note.id)).toEqual(["pending", "fresh"]);
    });

    it("没有可清理内容时返回同一个对象", () => {
        const store = storeWith({ id: "pending" });
        expect(pruneInboxStore(store, "2026-10-11", 7)).toBe(store);
    });
});

describe("createInboxNoteId / createInboxNoteDraft", () => {
    it("生成的 id 不采用思源块 ID 的格式，避免混淆", () => {
        const id = createInboxNoteId(new Date("2026-10-11T14:32:00.000Z"), () => 0.5);
        expect(id.startsWith("note-")).toBe(true);
        expect(id).not.toMatch(/^\d{14}-[a-z0-9]{7}$/);
    });

    it("同一毫秒内不同随机数产生不同 id", () => {
        const now = new Date("2026-10-11T14:32:00.000Z");
        const first = createInboxNoteId(now, () => 0.1);
        const second = createInboxNoteId(now, () => 0.9);
        expect(first).not.toBe(second);
    });

    it("草稿默认是快速事项，并带上当前时间", () => {
        const now = new Date("2026-10-11T14:32:00.000Z");
        const draft = createInboxNoteDraft("记一笔", undefined, now, () => 0.5);
        expect(draft.tier).toBe("quick");
        expect(draft.createdAt).toBe("2026-10-11T14:32:00.000Z");
        expect(addInboxNote(createEmptyInboxStore(), draft).ok).toBe(true);
    });
});
