import { describe, expect, it, vi } from "vitest";

import { EditDialogManager, type ManagedEditDialog } from "./edit-dialog-manager";

type FakeDialog = ManagedEditDialog & { close(): void };

function factory(created: FakeDialog[]) {
    return vi.fn((onDestroy: () => void): FakeDialog => {
        const dialog: FakeDialog = {
            destroy: vi.fn(() => onDestroy()),
            focusStatus: vi.fn(),
            close: onDestroy,
        };
        created.push(dialog);
        return dialog;
    });
}

describe("EditDialogManager", () => {
    it("reuses one dialog for repeated opens of the same block", async () => {
        const manager = new EditDialogManager<FakeDialog>();
        const created: FakeDialog[] = [];
        const create = factory(created);

        const first = await manager.open("block-a", create);
        const second = await manager.open("block-a", create);

        expect(second).toBe(first);
        expect(create).toHaveBeenCalledOnce();
        expect(first.focusStatus).toHaveBeenCalledTimes(2);
        expect(manager.size).toBe(1);
    });

    it("allows different blocks to own separate dialogs", async () => {
        const manager = new EditDialogManager<FakeDialog>();
        const created: FakeDialog[] = [];
        const create = factory(created);

        await manager.open("block-a", create);
        await manager.open("block-b", create);

        expect(create).toHaveBeenCalledTimes(2);
        expect(manager.size).toBe(2);
    });

    it("removes the block entry after the dialog closes", async () => {
        const manager = new EditDialogManager<FakeDialog>();
        const created: FakeDialog[] = [];
        const create = factory(created);

        await manager.open("block-a", create);
        created[0].close();

        expect(manager.size).toBe(0);
        await manager.open("block-a", create);
        expect(create).toHaveBeenCalledTimes(2);
    });

    it("destroys every open dialog when stopped", async () => {
        const manager = new EditDialogManager<FakeDialog>();
        const created: FakeDialog[] = [];
        const create = factory(created);
        await manager.open("block-a", create);
        await manager.open("block-b", create);

        manager.destroyAll();

        expect(created[0].destroy).toHaveBeenCalledOnce();
        expect(created[1].destroy).toHaveBeenCalledOnce();
        expect(manager.size).toBe(0);
    });
});
