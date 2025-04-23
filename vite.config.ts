import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    ssr: {
        noExternal: true,
    },
    build: {
        minify: false,
        sourcemap: true,
        lib: {
            entry: [
                path.resolve(__dirname, 'src/lib/index.ts'),
                path.resolve(__dirname, 'src/main.ts')
            ],
            formats: ['es']
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: false,
                format: 'esm',
                preserveModules: true,
                dir: 'dist',
            },
            external: (id) => {
                return id.startsWith('node:') || (!id.startsWith('.') && !path.isAbsolute(id));
            },
            treeshake: false
        }
    },
});
