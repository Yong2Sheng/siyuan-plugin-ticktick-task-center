import { describe, expect, it, vi } from "vitest";

import { InboxController } from "./inbox-controller";
import { INBOX_STORE_VERSION, type InboxStore } from "./inbox-store";
import { InboxStoreError } from "./inbox-persistence";

const NOW = new Date("2026-10-11T14:32:00.000Z");

function createMemoryStore(initial: InboxStore = { version: INBOX_STORE_VERSION, notes: [] }) {
    let store = initial;
    const save = vi.fn(async (next: InboxStore) => {
        store = next;
    });
    return {
        load: vi.fn(async () => ({ store, droppedNoteCount: 0 })),
        save,
        getStore: () => store,
    };
}

function createController(memory: ReturnType<typeof createMemoryStore>, onError = vi.fn()) {
    return new InboxController({
        load: memory.load,
        save: memory.save,
        now: () => NOW,
        onError,
    });
}

describe("InboxController", () => {
    it("加载后把便条放进状态", async () => {
        const memory = createMemoryStore({
            version: INBOX_STORE_VERSION,
            notes: [{ id: "note-1", text: "订酒店", tier: "quick", createdAt: NOW.toISOString() }],
        });
        const controller = createController(memory);

        await controller.start();

        expect(controller.getState().store.notes).toHaveLength(1);
        expect(controller.getState().loading).toBe(false);
        expect(controller.getState().error).toBe(false);
    });

    it("加载失败时进入错误状态并回调", async () => {
        const onError = vi.fn();
        const controller = new InboxController({
            load: async () => {
                throw new InboxStoreError("unsupported-version");
            },
            save: async () => undefined,
            onError,
        });

        await controller.start();

        expect(controller.getState().error).toBe(true);
        expect(controller.getState().loading).toBe(false);
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it("记录便条并落盘", async () => {
        const memory = createMemoryStore();
        const controller = createController(memory);
        await controller.start();

        const result = await controller.capture("  订 11 月会议期间住的酒店  ", "quick");

        expect(result).toEqual({ ok: true });
        expect(memory.getStore().notes).toHaveLength(1);
        expect(memory.getStore().notes[0]?.text).toBe("订 11 月会议期间住的酒店");
        expect(controller.getState().store.notes[0]?.tier).toBe("quick");
    });

    it("空文字被拒绝且不写盘", async () => {
        const memory = createMemoryStore();
        const controller = createController(memory);
        await controller.start();

        await expect(controller.capture("   ", "quick")).resolves.toEqual({
            ok: false,
            reason: "text-empty",
        });
        expect(memory.save).not.toHaveBeenCalled();
    });

    it("保存失败时状态保持旧内容，不显示没落盘的新内容", async () => {
        const memory = createMemoryStore();
        const onError = vi.fn();
        const controller = createController(memory, onError);
        await controller.start();
        memory.save.mockRejectedValueOnce(new Error("disk full"));

        const result = await controller.capture("订酒店", "quick");

        expect(result).toEqual({ ok: false, reason: "save-failed" });
        expect(controller.getState().store.notes).toEqual([]);
        expect(controller.getState().saving).toBe(false);
        expect(onError).toHaveBeenCalled();
    });

    it("完成便条后它离开待处理，但仍留在数据里", async () => {
        const memory = createMemoryStore();
        const controller = createController(memory);
        await controller.start();
        await controller.capture("交工位费", "quick");
        const noteId = controller.getState().store.notes[0]!.id;

        await expect(controller.complete(noteId)).resolves.toEqual({ ok: true });

        const notes = controller.getState().store.notes;
        expect(notes).toHaveLength(1);
        expect(notes[0]?.completedAt).toBe(NOW.toISOString());
    });

    it("改级、删除与 consume 都走同一条串行写入", async () => {
        const memory = createMemoryStore();
        const controller = createController(memory);
        await controller.start();
        await controller.capture("顺便找份文件", "quick");
        const noteId = controller.getState().store.notes[0]!.id;

        await controller.setTier(noteId, "formal");
        expect(controller.getState().store.notes[0]?.tier).toBe("formal");

        await controller.consume(noteId);
        expect(controller.getState().store.notes).toEqual([]);
    });

    it("编辑便条只改文字与分级，保存成功后才替换内存状态", async () => {
        const memory = createMemoryStore();
        const controller = createController(memory);
        await controller.start();
        await controller.capture("旧标题", "quick");
        const noteId = controller.getState().store.notes[0]!.id;

        await expect(controller.update(noteId, "新标题\n\n补充背景", "formal"))
            .resolves.toEqual({ ok: true });

        const note = controller.getState().store.notes[0];
        expect(note?.text).toBe("新标题\n\n补充背景");
        expect(note?.tier).toBe("formal");
        expect(note?.id).toBe(noteId);
        expect(note?.createdAt).toBe(NOW.toISOString());
        expect(memory.getStore()).toEqual(controller.getState().store);
    });

    it("编辑已被删除的便条时失败且不写盘", async () => {
        const memory = createMemoryStore({
            version: INBOX_STORE_VERSION,
            notes: [{ id: "existing", text: "还在", tier: "quick", createdAt: NOW.toISOString() }],
        });
        const controller = createController(memory);
        await controller.start();

        await expect(controller.update("missing", "新内容", "quick"))
            .resolves.toEqual({ ok: false, reason: "note-not-found" });

        expect(memory.save).not.toHaveBeenCalled();
        expect(controller.getState().store.notes[0]?.text).toBe("还在");
    });

    it("编辑写盘失败时保留旧内容，不显示没落盘的修改", async () => {
        const memory = createMemoryStore();
        const controller = createController(memory);
        await controller.start();
        await controller.capture("旧标题", "quick");
        const noteId = controller.getState().store.notes[0]!.id;
        memory.save.mockRejectedValueOnce(new Error("disk full"));

        await expect(controller.update(noteId, "新标题", "formal"))
            .resolves.toEqual({ ok: false, reason: "save-failed" });

        expect(controller.getState().store.notes[0]?.text).toBe("旧标题");
        expect(controller.getState().store.notes[0]?.tier).toBe("quick");
        expect(controller.getState().saving).toBe(false);
    });

    it("并发提交按顺序落盘，不会互相覆盖", async () => {
        const memory = createMemoryStore();
        const controller = createController(memory);
        await controller.start();

        await Promise.all([
            controller.capture("第一条", "quick"),
            controller.capture("第二条", "quick"),
            controller.capture("第三条", "quick"),
        ]);

        expect(memory.getStore().notes.map((note) => note.text)).toEqual([
            "第一条",
            "第二条",
            "第三条",
        ]);
    });

    it("销毁后不再接受改动", async () => {
        const memory = createMemoryStore();
        const controller = createController(memory);
        await controller.start();
        controller.destroy();

        await expect(controller.capture("不该写进去", "quick")).resolves.toEqual({
            ok: false,
            reason: "note-not-found",
        });
        expect(memory.save).not.toHaveBeenCalled();
    });

    it("没读过盘就不写入——否则内存里那份空 store 会把已有便条整份覆盖", async () => {
        const memory = createMemoryStore({
            version: INBOX_STORE_VERSION,
            notes: [{ id: "old", text: "已有的便条", tier: "quick", createdAt: NOW.toISOString() }],
        });
        const controller = createController(memory);

        // 故意不调用 start()
        const result = await controller.capture("新便条", "quick");

        expect(result).toEqual({ ok: true });
        // 写下去的必须是「已有 + 新增」，而不是只剩新增
        expect(memory.getStore().notes.map((note) => note.id)).toEqual(["old", expect.any(String)]);
        expect(memory.getStore().notes[0]?.text).toBe("已有的便条");
    });

    it("读盘失败时拒绝写入，并把错误状态暴露出来", async () => {
        const onError = vi.fn();
        const save = vi.fn(async () => undefined);
        const controller = new InboxController({
            load: async () => {
                throw new InboxStoreError("unsupported-version");
            },
            save,
            onError,
        });

        const result = await controller.capture("不该写进去", "quick");

        expect(result).toEqual({ ok: false, reason: "not-loaded" });
        expect(save).not.toHaveBeenCalled();
        expect(controller.getState().error).toBe(true);
    });

    it("用注入的时钟判断「今天」", async () => {
        const memory = createMemoryStore();
        const controller = createController(memory);
        await controller.start();
        expect(controller.getToday()).toBe("2026-10-11");
    });
});
