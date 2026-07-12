import type { Protyle } from "siyuan";

import { isSiYuanId } from "../siyuan/blocks";

export function getEditableRootDocumentId(protyle: Protyle): string | null {
    const context = protyle.protyle;
    if (context.disabled || !isSiYuanId(context.block.rootID)) {
        return null;
    }

    return context.block.rootID;
}
