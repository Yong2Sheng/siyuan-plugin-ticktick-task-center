export type ManagedEditDialog = {
    destroy(): void;
    focusStatus(): void;
    focusDeadline(): void;
};

export type EditDialogFocus = "status" | "deadline";

export type EditDialogFactory<TDialog extends ManagedEditDialog> = (
    onDestroy: () => void,
) => Promise<TDialog> | TDialog;

export class EditDialogManager<TDialog extends ManagedEditDialog = ManagedEditDialog> {
    private readonly dialogs = new Map<string, TDialog>();
    private readonly pending = new Map<string, Promise<TDialog>>();
    private stopped = false;

    async open(
        blockId: string,
        factory: EditDialogFactory<TDialog>,
        focus: EditDialogFocus = "status",
    ): Promise<TDialog> {
        if (this.stopped) {
            throw new Error("Task edit dialog manager is stopped");
        }

        const existing = this.dialogs.get(blockId);
        if (existing) {
            focusDialog(existing, focus);
            return existing;
        }

        const pending = this.pending.get(blockId);
        if (pending) {
            const dialog = await pending;
            focusDialog(dialog, focus);
            return dialog;
        }

        let dialog: TDialog | undefined;
        const creation = Promise.resolve(factory(() => {
            if (dialog && this.dialogs.get(blockId) === dialog) {
                this.dialogs.delete(blockId);
            }
        })).then((created) => {
            dialog = created;
            if (this.stopped) {
                created.destroy();
                throw new Error("Task edit dialog manager is stopped");
            }
            this.dialogs.set(blockId, created);
            return created;
        });
        this.pending.set(blockId, creation);

        try {
            const created = await creation;
            focusDialog(created, focus);
            return created;
        } finally {
            if (this.pending.get(blockId) === creation) {
                this.pending.delete(blockId);
            }
        }
    }

    destroyAll(): void {
        this.stopped = true;
        const dialogs = Array.from(this.dialogs.values());
        this.dialogs.clear();
        for (const dialog of dialogs) {
            dialog.destroy();
        }
    }

    get size(): number {
        return this.dialogs.size;
    }
}

function focusDialog(dialog: ManagedEditDialog, focus: EditDialogFocus): void {
    if (focus === "deadline") {
        dialog.focusDeadline();
        return;
    }
    dialog.focusStatus();
}
