import type { IProtyle } from "siyuan";

export const PROTYLE_CONTENT_ROOT_SELECTOR = ".protyle-content > .protyle-wysiwyg";

const EXCLUDED_CONTENT_AREAS = ".b3-dialog, .block__popover, .ticktick-task-center";

export function resolveProtyleContentRoots(protyle: IProtyle): HTMLElement[] {
    const roots = new Set<HTMLElement>();
    const contentElement = protyle.contentElement;
    const declaredRoot = protyle.wysiwyg?.element;

    if (
        declaredRoot instanceof HTMLElement
        && (
            !(contentElement instanceof HTMLElement)
            || declaredRoot.parentElement === contentElement
        )
    ) {
        roots.add(declaredRoot);
    }
    if (contentElement instanceof HTMLElement) {
        for (const root of contentElement.querySelectorAll<HTMLElement>(
            ":scope > .protyle-wysiwyg",
        )) {
            roots.add(root);
        }
    }

    return Array.from(roots).filter(isScannableProtyleContentRoot);
}

export function discoverMountedContentRoots(): HTMLElement[] {
    return Array.from(
        document.querySelectorAll<HTMLElement>(PROTYLE_CONTENT_ROOT_SELECTOR),
    ).filter(isScannableProtyleContentRoot);
}

export function isScannableProtyleContentRoot(root: HTMLElement): boolean {
    return root.isConnected
        && root.classList.contains("protyle-wysiwyg")
        && root.closest(EXCLUDED_CONTENT_AREAS) === null;
}
