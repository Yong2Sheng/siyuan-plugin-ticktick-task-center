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
    current?: boolean;
    disabled?: boolean;
    type?: "separator" | "submenu" | "readonly" | "empty";
    click?: (element: HTMLElement, event: MouseEvent) => void | boolean | Promise<void | boolean>;
};

export class Menu {
    readonly element = document.createElement("div");
    isOpen = false;

    constructor(readonly id?: string) {
        this.element.className = "b3-menu";
        // 真实 Menu 会用传入的 id 标记根元素，测试里也保持一致，便于区分同时存在的菜单。
        if (id) {
            this.element.id = id;
        }
    }

    addItem(option: MenuItem): HTMLElement {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "b3-menu__item";
        item.textContent = option.label ?? "";
        if (option.warning) {
            item.dataset.warning = "true";
        }
        // 当前档位与禁用状态要能被断言到，否则菜单测试只能看文案。
        if (option.current) {
            item.dataset.current = "true";
        }
        if (option.type) {
            item.dataset.type = option.type;
        }
        item.disabled = Boolean(option.disabled);
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
