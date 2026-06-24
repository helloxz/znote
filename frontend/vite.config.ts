import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";

const buildDate = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 10);

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    server: {
        host: "0.0.0.0",
        port: 4000,
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    build: {
        cssCodeSplit: false,
        rollupOptions: {
            output: {
                entryFileNames: `static/assets/index.${buildDate}.js`,
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name && assetInfo.name.endsWith(".css")) {
                        return `static/assets/index.${buildDate}.css`;
                    }
                    return "static/assets/[name]-[hash].[ext]";
                },
                chunkFileNames: "static/assets/[name]-[hash].js",
            },
        },
    },
});
