import { Config } from "./config";
import fs from "fs";
import Transformer from "./transformer";

/** @internal */
class Scanner {
    async scan() {
		await Promise.all([
			this.scanCommandsDir(),
			this.scanManagersDir()
		]);
    }

	private async scanCommandsDir() {
        const { entryPath } = this.config;

        const dir = await this.scanDir(`${entryPath}/commands`, 1);

		for(const id of dir) {
			const code = await fs.promises.readFile(id, 'utf-8');
	
			await this.transformer.transformModule(id, code);
		}
	}

	private async scanManagersDir() {
		const { entryPath } = this.config;

        const dir = await this.scanDir(`${entryPath}/managers`, 1);

		const { rollupOptions } = this.config.vite!.build!
        const { input } = rollupOptions!;

        if(!Array.isArray(input)) return;

        input.push(...dir);
	}

    async scanDir(path: string, depth?: number) {
        const files = await fs.promises.readdir(path, { withFileTypes: true });
        const result = new Array<string>

        for (const file of files) {
            if (file.isDirectory()) {
                if ((depth ?? 0) < 1) continue;

                result.push(...await this.scanDir(`${file.parentPath}/${file.name}`, depth ? depth - 1 : undefined));
            }

            result.push(`${file.parentPath}/${file.name}`);
        }

        return result;
    }

    constructor(private config: Config, private transformer: Transformer) {}
}

export default Scanner;
