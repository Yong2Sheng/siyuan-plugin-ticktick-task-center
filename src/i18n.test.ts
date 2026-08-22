import { describe, expect, it } from "vitest";

import en from "../public/i18n/en.json";
import zhCN from "../public/i18n/zh-CN.json";
import {
    createLanguageTranslator,
    DEFAULT_INTERFACE_LANGUAGE,
    isInterfaceLanguage,
    type InterfaceLanguage,
} from "./i18n";

describe("plugin interface language", () => {
    it("keeps the Chinese and English dictionaries structurally aligned", () => {
        expect(getLeafKeys(en)).toEqual(getLeafKeys(zhCN));
    });

    it("defaults to Chinese and switches dictionaries without recreating consumers", () => {
        let language: InterfaceLanguage = DEFAULT_INTERFACE_LANGUAGE;
        const translate = createLanguageTranslator({ "zh-CN": zhCN, en }, () => language);

        expect(translate("taskCenterView.title")).toBe("滴答任务中心");
        expect(translate("taskCenterView.switchLanguage")).toBe("Switch to English");

        language = "en";
        expect(translate("taskCenterView.title")).toBe("TickTick Task Center");
        expect(translate("taskCenterView.switchLanguage")).toBe("切换为中文");
    });

    it("accepts only supported persisted language values", () => {
        expect(isInterfaceLanguage("zh-CN")).toBe(true);
        expect(isInterfaceLanguage("en")).toBe(true);
        expect(isInterfaceLanguage("en-US")).toBe(false);
        expect(isInterfaceLanguage(undefined)).toBe(false);
    });
});

function getLeafKeys(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) {
        return [prefix];
    }
    return Object.entries(value)
        .flatMap(([key, child]) => getLeafKeys(child, prefix ? `${prefix}.${key}` : key))
        .sort();
}
