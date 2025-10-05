import { Config } from "./config";
import fs from "fs/promises";
import Transformer from "./transformer";
import { join as j } from "path";

/** @internal */
class Scanner {
    async scan() {
		await Promise.all([
			this.scanCommandsFiles(),
			this.scanManagersFiles()
		]);
    }

	private async scanCommandsFiles() {
        const { entryPath, commandsPath } = this.config;

		for await (const path of fs.glob(commandsPath, { cwd: entryPath })) {
			const code = await fs.readFile(j(entryPath, path), 'utf-8');
			await this.transformer.transformModule(path, code);
		}
	}

	private async scanManagersFiles() {
		const { entryPath, managersPath } = this.config;
		const { input } = this.config.vite!.build!.rollupOptions!;

		if(!Array.isArray(input)) return;

		for await (const path of fs.glob(managersPath, { cwd: entryPath })) {
			input.push(j(entryPath, path));
		}
	}

    constructor(private config: Config, private transformer: Transformer) {}
}

export default Scanner;
