import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["./src/index.ts"],
	outDir: "out",
	format: "esm",
	banner: {
		js: "#!/usr/bin/node"
	}
});