import fs from 'fs';
import * as T from '@babel/types';
import traverse, { NodePath } from "@babel/traverse";
import Config from '../config';
import { relative, join as j } from 'path/posix';
import { isAbsolute } from 'path';

const FLAME_MANAGER_REGEX = /^@flame-oh\/manager\-/;
const RELATIVE_PATH_REGEX = /^(\.\/|\.\.\/)/;

class ImportResolver {
    constructor(private dirpath: string, private config: Config) {}

    parseAliases(filePath: string, target: string) {
        const tsConfigPath = j(this.config.cwd, 'tsconfig.json');
        
        const tsConfig = fs.readFileSync(tsConfigPath, 'utf-8');
        const { compilerOptions: { paths } } = JSON.parse(tsConfig) as { compilerOptions: { paths: { [k: string]: string[] } } };
    
        for (const alias in paths) {
            const aliasPattern = alias.replace('/*', '');
            if (filePath.startsWith(aliasPattern)) {
                const [firstMatch] = paths[alias];
                const resolvedPath = firstMatch.replace('/*', filePath.slice(aliasPattern.length));
                const entryPath = j(this.config.cwd, resolvedPath);
                return entryPath.replace(this.config.entryPath, this.config.buildPath);
            }
        }
    }

    parseRelative(path: string, target: string) {
        const entryDirname = this.dirpath;
        
        const absoluteEntryPath = j(entryDirname, path);
        console.log({path, target, entryDirname, absoluteEntryPath})
        return absoluteEntryPath.replace(this.config.entryPath, this.config.buildPath);
    }

    parseFlameDir(path: string) {
        path = j(
            this.config.buildPath, 
            path.replace(FLAME_MANAGER_REGEX, 'managers/')
        );

        return path;
    }

    parse(importPath: string) {
        let resumedCurrentPath = this.dirpath.replace(this.config.entryPath, '');
        if(/\/?commands/.test(resumedCurrentPath)) {
            resumedCurrentPath = "";
        }

        const buildCurrentPath = j(this.config.buildPath, resumedCurrentPath);

        let absolutePath: string | undefined;
        
        if(isAbsolute(importPath)) {
            absolutePath = importPath;
        }

        if(RELATIVE_PATH_REGEX.test(importPath)) {
            absolutePath = this.parseRelative(importPath, buildCurrentPath);
        }

        if(FLAME_MANAGER_REGEX.test(importPath)) {
            absolutePath = this.parseFlameDir(importPath);
        }

        if(!absolutePath) {
            absolutePath = this.parseAliases(importPath, buildCurrentPath);
        }

        if(absolutePath) {
            let path = relative(buildCurrentPath, absolutePath);

            if(!RELATIVE_PATH_REGEX.test(absolutePath)) {
                path = `./${path}`;
            }
            
            importPath = this.ensureExt(path);
        }

        return importPath;
    }

    ensureExt(path: string) {
        return path.replace(/\.\w+$/, '.js') + (!/\.\w+$/.test(path) ? '.js' : '');
    }

    resolve(path: NodePath<T.ImportDeclaration>) {
        const source = path.get('source');

        source.set('value', this.parse(source.node.value));
    }

    traverse(node: T.Node) {
        traverse(node, {
            ImportDeclaration: this.resolve
        });
    }
}

export default ImportResolver;