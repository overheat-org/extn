import { defineConfig } from "tsup";

export default defineConfig({
	entry: [
		"src/index.ts",
		"src/hooks.ts",
		"src/jsx-runtime.ts"
	],
	outDir: "lib",
	format: "esm",
	dts: true
})