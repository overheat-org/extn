import { defineConfig } from "@rsbuild/core";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";

export default defineConfig({
    source: {
        entry: {
            cli: './src/cli.ts',
        },
    },
    output: {
        target: 'node',
        distPath: { root: './lib' }
    },
    tools: {
        rspack: {
            optimization: {
                splitChunks: {
                    chunks: 'all'
                },
            }
        }
    },
    plugins: [
        pluginNodePolyfill()
    ],
});