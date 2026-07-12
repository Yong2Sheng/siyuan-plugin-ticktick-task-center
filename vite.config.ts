import { resolve } from "node:path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import fg from "fast-glob";
import livereload from "rollup-plugin-livereload";
import { viteStaticCopy } from "vite-plugin-static-copy";
import zipPack from "vite-plugin-zip-pack";

const isDev = process.env.NODE_ENV === "development";
const isSourceMapEnabled = process.env.VITE_SOURCEMAP === "inline";
const outputDir = isDev ? "dev" : "dist";

export default defineConfig({
    publicDir: false,
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
    plugins: [
        svelte(),
        viteStaticCopy({
            targets: [
                { src: "./README.md", dest: "./" },
                { src: "./README.zh-CN.md", dest: "./" },
                { src: "./LICENSE", dest: "./" },
                { src: "./plugin.json", dest: "./" },
                { src: "./preview.png", dest: "./" },
                { src: "./icon.png", dest: "./" },
                { src: "./public/i18n/*.json", dest: "./i18n" },
            ],
        }),
    ],
    define: {
        "process.env.DEV_MODE": JSON.stringify(isDev),
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    },
    build: {
        outDir: outputDir,
        emptyOutDir: true,
        minify: true,
        sourcemap: isSourceMapEnabled ? "inline" : false,
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            fileName: () => "index.js",
            formats: ["cjs"],
        },
        rollupOptions: {
            plugins: isDev
                ? [
                    livereload(outputDir),
                    watchExternalFiles([
                        "public/i18n/*.json",
                        "README*.md",
                        "plugin.json",
                    ]),
                ]
                : [
                    zipPack({
                        inDir: "./dist",
                        outDir: "./",
                        outFileName: "package.zip",
                    }),
                ],
            external: ["siyuan", "process"],
            output: {
                entryFileNames: "index.js",
                assetFileNames: (assetInfo) =>
                    assetInfo.name === "style.css" ? "index.css" : assetInfo.name,
            },
        },
    },
});

function watchExternalFiles(patterns: string[]) {
    return {
        name: "watch-external-files",
        async buildStart() {
            const files = await fg(patterns);
            for (const file of files) {
                this.addWatchFile(file);
            }
        },
    };
}
