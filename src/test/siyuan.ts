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

type MenuItem = {
    label?: string;
    warning?: boolean;
    click?: (element: HTMLElement, event: MouseEvent) => void | boolean | Promise<void | boolean>;
};

export class Menu {
    readonly element = document.createElement("div");
    isOpen = false;

    constructor(readonly id?: string) {
        this.element.className = "b3-menu";
    }

    addItem(option: MenuItem): HTMLElement {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "b3-menu__item";
        item.textContent = option.label ?? "";
        if (option.warning) {
            item.dataset.warning = "true";
        }
        item.addEventListener("click", (event) => {
            void option.click?.(item, event);
        });
        this.element.append(item);
        return item;
    }

    addSeparator(): HTMLElement {
        const separator = document.createElement("div");
        separator.className = "b3-menu__separator";
        this.element.append(separator);
        return separator;
    }

    open(): void {
        this.isOpen = true;
        document.body.append(this.element);
    }

    close(): void {
        this.isOpen = false;
        this.element.remove();
    }
}

export function confirm(): void {}
