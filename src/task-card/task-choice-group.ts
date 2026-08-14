export type TaskChoiceOption<TValue extends string> = {
    value: TValue;
    text: string;
};

export type TaskChoiceGroup = {
    readonly buttons: readonly HTMLButtonElement[];
    focus(): void;
    setDisabled(disabled: boolean): void;
};

export function createTaskChoiceGroup<TValue extends string>(options: {
    container: HTMLElement;
    input: HTMLInputElement;
    choices: readonly TaskChoiceOption<TValue>[];
    initialValue?: TValue;
}): TaskChoiceGroup {
    const buttons = options.choices.map((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ticktick-task-form__choice";
        button.dataset.value = choice.value;
        button.setAttribute("role", "radio");
        button.textContent = choice.text;
        button.addEventListener("click", () => select(choice.value));
        options.container.append(button);
        return button;
    });

    function select(value: TValue | undefined): void {
        options.input.value = value ?? "";
        for (const button of buttons) {
            const selected = button.dataset.value === value;
            button.classList.toggle("ticktick-task-form__choice--selected", selected);
            button.setAttribute("aria-checked", String(selected));
        }
    }

    select(options.initialValue);

    return {
        buttons,
        focus: () => {
            (buttons.find((button) => button.getAttribute("aria-checked") === "true") ?? buttons[0])
                ?.focus();
        },
        setDisabled: (disabled) => {
            for (const button of buttons) {
                button.disabled = disabled;
            }
        },
    };
}
