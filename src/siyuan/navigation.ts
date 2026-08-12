import {
    getFrontend,
    openMobileFileById,
    openTab,
    type App,
    type IProtyle,
    type Tab,
    type TProtyleAction,
} from "siyuan";
import { TASK_CARD_BLOCK_ID_ATTRIBUTE } from "../task-card/renderer";

const DESKTOP_OPEN_DOCUMENT_ACTIONS: TProtyleAction[] = [
    "cb-get-focus",
    "cb-get-scroll",
];
const MOBILE_OPEN_DOCUMENT_ACTIONS: TProtyleAction[] = ["cb-get-scroll"];
const HIGHLIGHT_DURATION_MS = 1024;
const CARD_WAIT_TIMEOUT_MS = 1000;
const CARD_WAIT_INTERVAL_MS = 50;

type MobileFileOpener = (
    app: App,
    id: string,
    action?: TProtyleAction[],
    scrollPosition?: ScrollLogicalPosition,
    notebookId?: string,
    afterOpen?: (protyle: IProtyle) => void,
) => void;

export type SiYuanBlockLocation = {
    blockId: string;
    rootId: string;
    notebookId?: string;
};

export async function locateSiYuanBlock(
    app: App,
    location: SiYuanBlockLocation,
): Promise<void> {
    const frontend = getFrontend();
    if (frontend === "mobile" || frontend === "browser-mobile") {
        locateMobileBlock(app, location);
        return;
    }

    const tab = await openTab({
        app,
        doc: {
            id: location.rootId,
            action: [...DESKTOP_OPEN_DOCUMENT_ACTIONS],
        },
        keepCursor: false,
    });
    const protyle = getTabProtyle(tab);
    if (protyle) {
        await revealTaskBlock(protyle, location.blockId);
    }
}

function locateMobileBlock(app: App, location: SiYuanBlockLocation): void {
    const openMobileFile = openMobileFileById as MobileFileOpener;
    openMobileFile(
        app,
        location.rootId,
        [...MOBILE_OPEN_DOCUMENT_ACTIONS],
        undefined,
        location.notebookId,
        (protyle) => {
            void revealTaskBlock(protyle, location.blockId);
        },
    );
}

function getTabProtyle(tab: Tab): IProtyle | null {
    const model = tab?.model as { editor?: { protyle?: IProtyle } } | undefined;
    return model?.editor?.protyle ?? null;
}

async function revealTaskBlock(protyle: IProtyle, blockId: string): Promise<void> {
    const root = protyle.wysiwyg?.element;
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const block = findSourceBlock(root, blockId);
    if (!block) {
        return;
    }

    const waitDeadline = Date.now() + CARD_WAIT_TIMEOUT_MS;
    let target = findTaskCard(root, blockId);
    while (!target && Date.now() < waitDeadline) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, CARD_WAIT_INTERVAL_MS));
        target = findTaskCard(root, blockId);
    }
    target ??= block;

    target.scrollIntoView({ block: "center", behavior: "auto" });
    target.classList.add("protyle-wysiwyg--hl");
    window.setTimeout(() => target.classList.remove("protyle-wysiwyg--hl"), HIGHLIGHT_DURATION_MS);
}

function findSourceBlock(root: HTMLElement, blockId: string): HTMLElement | null {
    return Array.from(root.querySelectorAll<HTMLElement>(`[data-node-id="${blockId}"]`))
        .find((block) => {
            const embed = block.closest<HTMLElement>('[data-type="NodeBlockQueryEmbed"]');
            return embed === null || embed === block;
        }) ?? null;
}

function findTaskCard(root: HTMLElement, blockId: string): HTMLElement | null {
    return Array.from(root.querySelectorAll<HTMLElement>(
        `[${TASK_CARD_BLOCK_ID_ATTRIBUTE}="${blockId}"]`,
    )).find((card) => {
        const embed = card.closest<HTMLElement>('[data-type="NodeBlockQueryEmbed"]');
        return embed === null || embed === card;
    }) ?? null;
}
