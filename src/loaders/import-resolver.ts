import * as T from '@babel/types';
import traverse, { NodePath } from "@babel/traverse";
import Config from '../config';
import { relative, join as j, dirname } from 'path/posix';

const FLAME_MANAGER_REGEX = /^@flame-oh\/manager\-/;

class ImportResolver {
    constructor(private dirpath: string, private config: Config) {}

    parse(importPath: string) {
        let resumedCurrentPath = this.dirpath.replace(this.config.entryPath, '');
        if(/\/?commands/.test(resumedCurrentPath)) {
            resumedCurrentPath = "commands.js";
        }

        const buildCurrentPath = j(this.config.buildPath, resumedCurrentPath);

        const toRelative = (path: string) => relative(dirname(buildCurrentPath), path);
        
        if(FLAME_MANAGER_REGEX.test(importPath)) {
            importPath = j(
                this.config.buildPath, 
                importPath.replace(FLAME_MANAGER_REGEX, 'managers/')
            );

            importPath = toRelative(importPath);

            if (!importPath.endsWith('.js')) {
                importPath += '.js';
            }
        }
        else if(importPath.startsWith('.')) {
            const entryDirname = this.dirpath;

            const buildDirname = dirname(buildCurrentPath);
            const absoluteEntryPath = j(entryDirname, importPath);
            const absoluteBuildPath = absoluteEntryPath.replace(this.config.entryPath, buildDirname);

            importPath = toRelative(absoluteBuildPath);

            if(!importPath.startsWith('.')) {
                importPath = `./${importPath}`;
            }
            
            if (!importPath.endsWith('.js')) {
                importPath += '.js';
            }
        }

        return importPath;
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