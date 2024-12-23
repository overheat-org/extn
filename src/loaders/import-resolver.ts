import * as T from '@babel/types';
import traverse, { NodePath } from "@babel/traverse";
import Config from '../config';
import { relative, join as j } from 'path/posix';
import { isAbsolute } from 'path';

const FLAME_MANAGER_REGEX = /^@flame-oh\/manager\-/;
const RELATIVE_PATH_REGEX = /^(\.\/|\.\.\/)/;

class ImportResolver {
    constructor(private dirpath: string, private config: Config) {}

    parseRelative(path: string, target: string) {
        const entryDirname = this.dirpath;

        const absoluteEntryPath = j(entryDirname, path);
        const a = absoluteEntryPath.replace(this.config.entryPath, target);

        return a;
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

        let absolutePath!: string;
        
        if(isAbsolute(importPath)) {
            absolutePath = importPath;
        }

        if(RELATIVE_PATH_REGEX.test(importPath)) {
            absolutePath = this.parseRelative(importPath, buildCurrentPath);
        }

        if(FLAME_MANAGER_REGEX.test(importPath)) {
            absolutePath = this.parseFlameDir(importPath);
        }

        if(absolutePath) {
            let path = relative(buildCurrentPath, absolutePath);

            if(!RELATIVE_PATH_REGEX.test(absolutePath)) {
                path = `./${path}`;
            }
            
            importPath = this.ensureExt(path);
        }

        // console.log(importPath)

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