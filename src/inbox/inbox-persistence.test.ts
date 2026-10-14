import { describe, expect, it } from "vitest";

import {
    INBOX_BACKUP_FILES,
    InboxStoreError,
    loadInboxStore,
    saveInboxStore,
    type InboxPersistenceApi,
} from "./inbox-persistence";
import { INBOX_STORE_FILE, INBOX_STORE_VERSION, type InboxStore } from "./inbox-store";

const CREATED = "2026-10-11T14:32:00.000Z";

function note(id: string, text = "内容") {
    return { id, text, tier: "quick" as const, createdAt: CREATED };
}

function storeOf(...ids: string[]): InboxStore {
    return { version: INBOX_STORE_VERSION, notes: ids.map((id) => note(id)) };
}

type FakeOptions = {
    /** saveData 抛错的文件名（含 "*" 通配全部）。 */
    failSaveFor?: string;
    /** saveData 实际写入的值（用来模拟写入内容不符）。 */
    corruptSaveFor?: string;
    failLoad?: boolean;
};

function createFakeApi(initial: Record<string, unknown> = {}, options: FakeOptions = {}) {
    const files = new Map<string, unknown>(Object.entries(initial));
    const savedFiles: string[] = [];
    const api: InboxPersistenceApi = {
        async loadData(file) {
            if (options.failLoad) {
                throw new Error("load failed");
            }
            return files.get(file) ?? {};
        },
        async saveData(file, value) {
            const shouldFail = options.failSaveFor === file || options.failSaveFor === "*";
            if (shouldFail) {
                throw new Error("save failed");
            }
            savedFiles.push(file);
            files.set(file, options.corruptSaveFor === file
                ? { version: INBOX_STORE_VERSION, notes: [] }
                : structuredClone(value));
            return null;
        },
    };
    return { api, files, savedFiles };
}

describe("loadInboxStore", () => {
    it("数据文件不存在时返回空收件箱", async () => {
        const { api } = createFakeApi();
        await expect(loadInboxStore(api)).resolves.toEqual({
            store: { version: INBOX_STORE_VERSION, notes: [] },
            droppedNoteCount: 0,
        });
    });

    it("读出便条，并丢弃非法条目后如实报告数量", async () => {
        const { api } = createFakeApi({
            [INBOX_STORE_FILE]: {
                version: INBOX_STORE_VERSION,
                notes: [note("note-1"), { id: "note-2", text: "", tier: "quick", createdAt: CREATED }],
            },
        });
        const result = await loadInboxStore(api);
        expect(result.store.notes.map((item) => item.id)).toEqual(["note-1"]);
        expect(result.droppedNoteCount).toBe(1);
    });

    it("版本不认识时抛错，绝不返回空收件箱让调用方写回去", async () => {
        const { api } = createFakeApi({
            [INBOX_STORE_FILE]: { version: 99, notes: [note("from-future")] },
        });
        await expect(loadInboxStore(api)).rejects.toMatchObject({
            name: "InboxStoreError",
            code: "unsupported-version",
        });
    });

    it("读取失败时抛出 load-failed", async () => {
        const { api } = createFakeApi({}, { failLoad: true });
        await expect(loadInboxStore(api)).rejects.toBeInstanceOf(InboxStoreError);
        await expect(loadInboxStore(api)).rejects.toMatchObject({ code: "load-failed" });
    });

    it("读取时顺带清掉过期的完成记录，但不写回文件", async () => {
        const expired = new Date(2026, 9, 1, 10, 0, 0).toISOString();
        const { api, savedFiles } = createFakeApi({
            [INBOX_STORE_FILE]: {
                version: INBOX_STORE_VERSION,
                notes: [note("pending"), { ...note("old-done"), completedAt: expired }],
            },
        });
        const result = await loadInboxStore(api, "2026-10-11");
        expect(result.store.notes.map((item) => item.id)).toEqual(["pending"]);
        expect(savedFiles).toEqual([]);
    });
});

describe("saveInboxStore", () => {
    it("写入后读回复核通过", async () => {
        const { api, files } = createFakeApi();
        await saveInboxStore(api, storeOf("note-1"));
        expect(files.get(INBOX_STORE_FILE)).toEqual(storeOf("note-1"));
    });

    it("写入前把当前内容轮转进 backup-1，旧备份依次后退", async () => {
        const { api, files } = createFakeApi({
            [INBOX_STORE_FILE]: storeOf("current"),
            [INBOX_BACKUP_FILES[0]]: storeOf("backup-1-old"),
            [INBOX_BACKUP_FILES[1]]: storeOf("backup-2-old"),
        });
        await saveInboxStore(api, storeOf("next"));

        expect(files.get(INBOX_BACKUP_FILES[0])).toEqual(storeOf("current"));
        expect(files.get(INBOX_BACKUP_FILES[1])).toEqual(storeOf("backup-1-old"));
        expect(files.get(INBOX_BACKUP_FILES[2])).toEqual(storeOf("backup-2-old"));
        expect(files.get(INBOX_STORE_FILE)).toEqual(storeOf("next"));
    });

    it("没有历史内容时不写入空备份", async () => {
        const { api, savedFiles } = createFakeApi();
        await saveInboxStore(api, storeOf("note-1"));
        expect(savedFiles).toEqual([INBOX_STORE_FILE]);
    });

    it("写入失败时抛 save-failed，且不动主文件", async () => {
        const { api, files } = createFakeApi(
            { [INBOX_STORE_FILE]: storeOf("current") },
            { failSaveFor: INBOX_STORE_FILE },
        );
        await expect(saveInboxStore(api, storeOf("next"))).rejects.toMatchObject({
            code: "save-failed",
        });
        expect(files.get(INBOX_STORE_FILE)).toEqual(storeOf("current"));
    });

    it("备份轮转失败时中止写入，主文件保持原样", async () => {
        const { api, files } = createFakeApi(
            {
                [INBOX_STORE_FILE]: storeOf("current"),
                [INBOX_BACKUP_FILES[0]]: storeOf("backup-1-old"),
            },
            { failSaveFor: INBOX_BACKUP_FILES[1] },
        );
        await expect(saveInboxStore(api, storeOf("next"))).rejects.toMatchObject({
            code: "save-failed",
        });
        expect(files.get(INBOX_STORE_FILE)).toEqual(storeOf("current"));
    });

    it("写后复核不一致时抛 verify-failed，不假装保存成功", async () => {
        const { api } = createFakeApi({}, { corruptSaveFor: INBOX_STORE_FILE });
        await expect(saveInboxStore(api, storeOf("note-1"))).rejects.toMatchObject({
            code: "verify-failed",
        });
    });

    it("复核逐字段比对，顺序与内容不同都算不一致", async () => {
        const { api } = createFakeApi({}, { corruptSaveFor: INBOX_STORE_FILE });
        await expect(saveInboxStore(api, { version: INBOX_STORE_VERSION, notes: [] }))
            .resolves.toBeUndefined();
        await expect(saveInboxStore(api, storeOf("note-1")))
            .rejects.toMatchObject({ code: "verify-failed" });
    });

    it("完成时间与分级都被复核覆盖", async () => {
        const completedAt = "2026-10-11T15:00:00.000Z";
        const { api, files } = createFakeApi();
        const store: InboxStore = {
            version: INBOX_STORE_VERSION,
            notes: [{ ...note("note-1"), tier: "formal", completedAt }],
        };
        await saveInboxStore(api, store);
        expect(files.get(INBOX_STORE_FILE)).toEqual(store);
    });
});

describe("往返一致", () => {
    it("写入后读回得到同一份便条", async () => {
        const { api } = createFakeApi();
        const store: InboxStore = {
            version: INBOX_STORE_VERSION,
            notes: [note("note-1", "订酒店"), { ...note("note-2", "写说明"), tier: "formal" }],
        };
        await saveInboxStore(api, store);
        const loaded = await loadInboxStore(api, "2026-10-11");
        expect(loaded.store).toEqual(store);
    });
});
