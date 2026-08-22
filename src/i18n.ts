export type I18nDictionary = Readonly<Record<string, unknown>>;

export type Translate = (key: string) => string;

export const INTERFACE_LANGUAGES = ["zh-CN", "en"] as const;

export type InterfaceLanguage = typeof INTERFACE_LANGUAGES[number];

export const DEFAULT_INTERFACE_LANGUAGE: InterfaceLanguage = "zh-CN";

export function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
    return INTERFACE_LANGUAGES.some((language) => language === value);
}

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

export function createLanguageTranslator(
    dictionaries: Readonly<Record<InterfaceLanguage, I18nDictionary>>,
    getLanguage: () => InterfaceLanguage,
): Translate {
    const translators: Record<InterfaceLanguage, Translate> = {
        "zh-CN": createTranslator(dictionaries["zh-CN"]),
        en: createTranslator(dictionaries.en),
    };
    return (key) => translators[getLanguage()](key);
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
