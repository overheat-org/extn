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
            plugins: [
                {
                    name: 'include-template-folders',
                    buildStart() {
                        const templateDirs = glob.sync('src/**/static');

                        for (const dir of templateDirs) {
                            const files = fs.readdirSync(dir);

                            for (const file of files) {
                                const filePath = path.join(dir, file);
                                if (fs.statSync(filePath).isFile()) {
                                    this.emitFile({
                                        type: 'asset',
                                        fileName: path.relative('src', filePath),
                                        source: fs.readFileSync(filePath, 'utf-8')
                                    });
                                }
                            }
                        }
                    }
                }
            ]
        }
    },
});
