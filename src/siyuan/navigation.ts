import { openTab, type App, type Tab } from "siyuan";

export async function locateSiYuanBlock(app: App, blockId: string): Promise<Tab> {
    return openTab({
        app,
        doc: {
            id: blockId,
            action: ["cb-get-hl", "cb-get-focus"],
        },
        keepCursor: false,
    });
}
