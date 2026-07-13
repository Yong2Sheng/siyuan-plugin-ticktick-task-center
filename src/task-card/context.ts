import type { Protyle } from "siyuan";

import { isSiYuanId } from "../domain/siyuan-id";

export function getEditableRootDocumentId(protyle: Protyle): string | null {
    const context = protyle.protyle;
    if (context.disabled || !isSiYuanId(context.block.rootID)) {
        return null;
    }

    return context.block.rootID;
}
