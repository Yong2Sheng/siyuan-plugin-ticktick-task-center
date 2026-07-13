type DialogOptions = {
    content: string;
    destroyCallback?: () => void;
};

export class Dialog {
    readonly element = document.createElement("div");
    private destroyed = false;

    constructor(private readonly options: DialogOptions) {
        this.element.innerHTML = options.content;
        document.body.append(this.element);
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        this.element.remove();
        this.options.destroyCallback?.();
    }
}

export const showMessageCalls: unknown[][] = [];

export function showMessage(...args: unknown[]): void {
    showMessageCalls.push(args);
}

export function getAllEditor(): unknown[] {
    return [];
}
