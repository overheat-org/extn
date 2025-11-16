import { makeConfig } from "../build";

export default makeConfig({
	build: {
		outDir: "out",
		lib: {
			entry: "src/index.ts",
			formats: ["es"]
		},
		rollupOptions: {
			output: {
				banner: "#!/usr/bin/node"
			}
		}
	}
});