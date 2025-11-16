import { defineConfig } from "vite";
import path from "path";
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }) => {
	const dev = mode == 'development';
	
	return {
		plugins: [
			dts({
				include: [
					"src/index.ts",
					"src/hooks.ts",
					"src/jsx-runtime.ts"
				],
				outDir: "types",
				entryRoot: "src"
			})
		],
		build: {
			sourcemap: dev,
			minify: !dev,
			outDir: "lib",
			lib: {
				entry: {
					index: path.resolve(__dirname, "src/index.ts"),
					"jsx-runtime": path.resolve(__dirname, "src/jsx-runtime.ts"),
					hooks: path.resolve(__dirname, "src/hooks.ts")
				},
				formats: ["es"]
			},
			rollupOptions: {
				external: (id) => {
					if (path.isAbsolute(id)) return false;

					// Não externalizar pacotes do seu monorepo
					if (/^(@extn|extn\.js)/.test(id)) return false;

					// Não externalizar imports relativos
					if (id.startsWith('.')) return false;

					// Externalizar node_modules e outros
					return true;
				}
			}
		}
	}
});
