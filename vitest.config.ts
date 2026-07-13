import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            siyuan: resolve(__dirname, "src/test/siyuan.ts"),
        },
    },
});
