// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App, IProtyle, Tab } from "siyuan";

const siyuanMocks = vi.hoisted(() => ({
    getFrontend: vi.fn(),
    openMobileFileById: vi.fn(),
    openTab: vi.fn(),
}));

vi.mock("siyuan", () => siyuanMocks);

import { locateSiYuanBlock } from "./navigation";

const APP = {} as App;
const LOCATION = {
    blockId: "20260811005202-pnjize1",
    rootId: "20260811005000-abcdefg",
    notebookId: "20260801000000-hijklmn",
};
const DESKTOP_OPEN_DOCUMENT_ACTIONS = ["cb-get-focus", "cb-get-scroll"];
const MOBILE_OPEN_DOCUMENT_ACTIONS = ["cb-get-scroll"];

function createEditorTarget() {
    const root = document.createElement("div");
    const card = document.createElement("div");
    card.setAttribute("data-ticktick-task-block-id", LOCATION.blockId);
    const scrollIntoView = vi.fn();
    card.scrollIntoView = scrollIntoView;
    const block = document.createElement("div");
    block.dataset.nodeId = LOCATION.blockId;
    root.append(card, block);
    const protyle = { wysiwyg: { element: root } } as IProtyle;
    const tab = { model: { editor: { protyle } } } as unknown as Tab;
    return { card, protyle, root, scrollIntoView, tab };
}

describe("SiYuan block navigation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.replaceChildren();
    });

    it("opens only the root document and reveals the generated task card on desktop", async () => {
        const target = createEditorTarget();
        siyuanMocks.getFrontend.mockReturnValue("desktop");
        siyuanMocks.openTab.mockResolvedValue(target.tab);

        await locateSiYuanBlock(APP, LOCATION);

        expect(siyuanMocks.openTab).toHaveBeenCalledOnce();
        expect(siyuanMocks.openTab).toHaveBeenCalledWith({
            app: APP,
            doc: {
                id: LOCATION.rootId,
                action: DESKTOP_OPEN_DOCUMENT_ACTIONS,
            },
            keepCursor: false,
        });
        expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
        expect(target.card.classList.contains("protyle-wysiwyg--hl")).toBe(true);
        expect(siyuanMocks.openMobileFileById).not.toHaveBeenCalled();
    });

    it("reveals the task card after the root document opens on mobile", async () => {
        for (const frontend of ["mobile", "browser-mobile"]) {
            const target = createEditorTarget();
            vi.clearAllMocks();
            siyuanMocks.getFrontend.mockReturnValue(frontend);

            await locateSiYuanBlock(APP, LOCATION);

            expect(siyuanMocks.openMobileFileById).toHaveBeenCalledOnce();
            expect(siyuanMocks.openMobileFileById).toHaveBeenCalledWith(
                APP,
                LOCATION.rootId,
                MOBILE_OPEN_DOCUMENT_ACTIONS,
                undefined,
                LOCATION.notebookId,
                expect.any(Function),
            );

            const afterOpen = siyuanMocks.openMobileFileById.mock.calls[0][5] as (
                protyle: IProtyle,
            ) => void;
            afterOpen(target.protyle);
            await Promise.resolve();

            expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
            expect(target.card.classList.contains("protyle-wysiwyg--hl")).toBe(true);
            expect(siyuanMocks.openTab).not.toHaveBeenCalled();
        }
    });

    it("ignores an embedded copy and reveals the source task card", async () => {
        const target = createEditorTarget();
        const embed = document.createElement("div");
        embed.dataset.type = "NodeBlockQueryEmbed";
        const embeddedCard = document.createElement("div");
        embeddedCard.setAttribute("data-ticktick-task-block-id", LOCATION.blockId);
        embeddedCard.scrollIntoView = vi.fn();
        const embeddedBlock = document.createElement("div");
        embeddedBlock.dataset.nodeId = LOCATION.blockId;
        embed.append(embeddedCard, embeddedBlock);
        target.root.prepend(embed);
        siyuanMocks.getFrontend.mockReturnValue("desktop");
        siyuanMocks.openTab.mockResolvedValue(target.tab);

        await locateSiYuanBlock(APP, LOCATION);

        expect(embeddedCard.scrollIntoView).not.toHaveBeenCalled();
        expect(target.scrollIntoView).toHaveBeenCalledOnce();
    });
});
