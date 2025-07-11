import { UserConfig } from "vite";
import { builtinModules } from 'node:module';

const stdModules = [...builtinModules, ...builtinModules.map(b => `node:${b}`)];

export default {
    build: {
        target: 'node16',
        lib: {
            name: "extn",
            formats: ["es"],
            entry: "./src/index.ts"
        },
        outDir: "lib",
        rollupOptions: {
            external: [...stdModules, /@babel/, 'vite'],
            output: {
                preserveModules: true,
                preserveModulesRoot: "src",
                entryFileNames: "[name].js"
            }
        }
    },
} as UserConfig;
