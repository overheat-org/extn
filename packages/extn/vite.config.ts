import path from "node:path";
import dts from 'vite-plugin-dts';
import { makeConfig } from "../build";

export default makeConfig({
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
		outDir: "lib",
		lib: {
			entry: {
				index: path.resolve(__dirname, "src/index.ts"),
				"jsx-runtime": path.resolve(__dirname, "src/jsx-runtime.ts"),
				hooks: path.resolve(__dirname, "src/hooks.ts")
			},
			formats: ["es"]
		},
	}
});