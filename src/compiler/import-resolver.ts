import { CompilerOptions } from "typescript";
import { Module } from "./module";
import { findNodeModulesDir } from "./utils";
import { dirname, join, sep } from 'path';
import Config from "../config";
import { REGEX } from "../consts";
import { readFileSync } from "fs";
import { jsonc as JSONC } from "jsonc";

type TsConfig = { compilerOptions: CompilerOptions }

class ImportResolver {
    private tsconfig?: TsConfig;
    
    constructor(private config: Config) {
        try {
            const data = readFileSync(join(config.cwd, 'tsconfig.json'), 'utf-8');
            this.tsconfig = JSONC.parse(data);
        } catch(err) {
            console.error('error: tsconfig.json not found\n', err);
        }
    }

    async resolve(source: string, filepath?: string): Promise<string | undefined> {
        if (source.startsWith('.')) return this.resolveRelativeImport(source, filepath!);
        else if (REGEX.FLAME_MODULE.test(source)) return this.resolveFlameModuleImport(source);
        else if (this.isImportAlias(source)) return this.resolveImportAlias(source);
        else return this.resolveNodeModuleImport(source);
    }

    private resolveNodeModuleImport(path: string): string | undefined {
        try {
            const nodeModulesDir = findNodeModulesDir(this.config.cwd, path);
            if (!nodeModulesDir) return;

            return nodeModulesDir;
        }
        catch {
} 
    }

    private resolveImportAlias(path: string) {
        const { baseUrl, paths } = this.tsconfig?.compilerOptions ?? {};
        if (!paths) return;
    
        const basePath = join(this.config.cwd, baseUrl || '');
    
        for (const alias in paths) {
            const targets = paths[alias];
            if (!Array.isArray(targets) || !targets.length) continue;
    
            let regex: RegExp | null = null;
            let match: RegExpMatchArray | null = null;
    
            if (alias.includes('*')) {
                const pattern = '^' + alias.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('*', '(.*)') + '$';
                regex = new RegExp(pattern);
                match = path.match(regex);
                if (!match) continue;
            } else if (!path.startsWith(alias)) {
                continue;
            }
    
            for (const target of targets) {
                const targetPath = alias.includes('*')
                    ? target.replace('*', match![1])
                    : target;
    
                const candidate = Module.resolvePath(join(basePath, targetPath));
                if (candidate) return candidate;
            }
        }
    }

    private isImportAlias(path: string): boolean {
        const { paths } = this.tsconfig?.compilerOptions ?? {};
        if (!paths) return false;

        for (const alias in paths) {
            if (!Array.isArray(paths[alias]) || !paths[alias].length) continue;

            if (alias.includes('*')) {
                const pattern = '^' + alias.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('*', '(.*)') + '$';
                const regex = new RegExp(pattern);
                if (regex.test(path)) return true;
            } else if (path.startsWith(alias)) {
                return true;
            }
        }

        return false;
    }

    private resolveFlameModuleImport(path: string) {
        const flameDir = findNodeModulesDir(this.config.cwd, '@flame-oh');
        const nodeModules = dirname(flameDir);
        const targetPath = nodeModules + sep + path;
        const absolutePath = Module.resolvePath(targetPath);
    
        return absolutePath!;
    }

    private resolveRelativeImport(source: string, filepath: string) {
        const dirpath = dirname(filepath);
        return Module.resolvePath(source, dirpath)!;
    }
}

export default ImportResolver;