import path from 'node:path';
import { defineConfig, UserConfig } from "vite";

export const makeConfig = (config: UserConfig) => defineConfig(({ mode }) => {
	const dev = mode == 'development';
	
	return {
		...config,
		build: {
			ssr: true,
			sourcemap: dev,
			minify: !dev,
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
			},
			...config.build,
		}
	}
});
