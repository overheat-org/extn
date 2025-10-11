import { name, version } from './package.json';
import path from 'path';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import dts from 'vite-plugin-dts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [
        dts({
            include: ['src'],
            outDir: 'types',
            entryRoot: 'src'
        }),
    ],
    ssr: {
        noExternal: true,
    },
    build: {
        minify: false,
        sourcemap: true,
        lib: {
            entry: [
                path.resolve(__dirname, 'src/lib/index.ts'),
                path.resolve(__dirname, 'src/cli.ts')
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
	define: {
		__NAME__: JSON.stringify(name),
		__VERSION__: JSON.stringify(version)
	}
});
