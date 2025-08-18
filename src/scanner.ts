import { Config } from "./config";
import fs from "fs";

class Scanner {
    async scan() {
        const scanned = [
			...await this.scanCommands(),
			...await this.scanManagers()
		];

        const { rollupOptions } = this.config.vite!.build!
        const { input } = rollupOptions!;

        if(!Array.isArray(input)) return;

        input.push(...scanned);
    }

	private scanCommands() {
        const { entryPath } = this.config;

        return this.scanDir(`${entryPath}/commands`, 1);
	}

	private scanManagers() {
		const { entryPath } = this.config;

        return this.scanDir(`${entryPath}/managers`, 1);
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

    constructor(private config: Config) {}
}

export default Scanner;
