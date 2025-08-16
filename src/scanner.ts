import { Config } from "./config";
import fs from "fs";

abstract class ScannerStep {
    abstract scan(): Promise<string[]>

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

    constructor(
        protected config: Config
    ) { }
}

class ManagerScanner extends ScannerStep {
    async scan() {
        const { entryPath } = this.config;

        return this.scanDir(`${entryPath}/managers`, 1);
    }
}

class CommandScanner extends ScannerStep {
    scan() {
        const { entryPath } = this.config;

        return this.scanDir(`${entryPath}/commands`, 1);
    }
}

class Scanner {
    steps: ScannerStep[]

    async scan() {
        const promise = await Promise.all(this.steps.map(s => s.scan()))
        const scanned = promise.flat();

        const { rollupOptions } = this.config.vite!.build!
        const { input } = rollupOptions!;

        if(!Array.isArray(input)) return;

        input.push(...scanned);
    }

    constructor(private config: Config) {
        this.steps = [
            new ManagerScanner(config),
            new CommandScanner(config)
        ]
    }
}

export default Scanner;
