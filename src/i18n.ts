export type I18nDictionary = Readonly<Record<string, unknown>>;

export type Translate = (key: string) => string;

export function createTranslator(dictionary: I18nDictionary): Translate {
    return (key: string) => {
        let value: unknown = dictionary;
        for (const segment of key.split(".")) {
            if (typeof value !== "object" || value === null || !(segment in value)) {
                return key;
            }
            value = (value as Record<string, unknown>)[segment];
        }
        return typeof value === "string" ? value : key;
    };
}

export function escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
    })[character] ?? character);
}
