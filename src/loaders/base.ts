import fs from 'fs/promises';
import * as T from '@babel/types';
import Config from '../config';
import { BabelFileResult, transform, transformFromAst, TransformOptions } from '@babel/core';
import { dirname, basename, join as j } from 'path/posix';
import { parse } from '@babel/parser';
import Loader from '.';
import traverse, { NodePath, Scope, TraverseOptions } from '@babel/traverse';
import generate, { GeneratorOptions } from '@babel/generator';

class BaseLoader {
    traverseContent(parent: T.Node, opts?: TraverseOptions, scope?: Scope, state?: any, parentPath?: NodePath) {
        return traverse(parent, opts, scope, state, parentPath);
    }

    async transformContent(ast: string, options?: TransformOptions): Promise<BabelFileResult>
    async transformContent(ast: T.Program | T.File, options?: TransformOptions & { traverse?: TraverseOptions }): Promise<BabelFileResult>
    async transformContent(ast: T.Program | T.File | string, options: TransformOptions & { traverse?: TraverseOptions } = {}) {
        const { traverse: traverseOptions, ..._options } = options;
            
        const { promise, resolve, reject } = Promise.withResolvers<BabelFileResult>();
        const opts =  {
            ..._options,
            ...this.config.babel
        }
        const callback = (err, result) => err ? reject(err) : resolve(result!);
        
        if(typeof ast == 'string') transform(ast, opts, callback);
        else {
            if(traverseOptions) this.traverseContent(ast, traverseOptions);
            transformFromAst(ast, undefined, opts, callback)
        };

        return promise;
    }

    generateContent(ast: T.Node, opts?: GeneratorOptions) {
        return generate(ast, opts)
    }

    async emitFile(filename: string, result: BabelFileResult) {
        const outputPath = j(this.config.buildPath, filename);
        return this.emitAbsoluteFile(outputPath, result);
    }

    readDir(path: string, options: { allowFallbackToParent?: boolean } = {}) {
        return fs.readdir(path, { withFileTypes: true })
            .catch(e => {
                if (e.code === 'ENOTDIR') {
                    return options.allowFallbackToParent
                        ? fs.readdir(dirname(path), { withFileTypes: true }) 
                        : [];
                }
                throw e;
            });
    }

    async readFile(path: string) {
        const content = await fs.readFile(path, 'utf-8');

        switch (path.split('.')[1]) {
            case 'json': return JSON.parse(content)
            default: return content;
        }
    }
    
    async emitAbsoluteFile(path: string, result: BabelFileResult) {
        await fs.mkdir(dirname(path), { recursive: true });
        await fs.writeFile(path, result.code!);
    }

    parseContent(content: string) {
        return parse(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'decorators']
        });
    }

    async parseFile(path: string) {
        const content = await fs.readFile(path, 'utf-8');

        try {
            return this.parseContent(content);
        } catch(e) {
            console.log(`Error occurred in ${path}`);
            
            throw e;
        } 
    }

    toExtension(path: string) {
        const base = basename(path);

        return base.slice(base.indexOf('.'), base.length);
    }

    constructor(protected config: Config, protected loader: Loader) {}
}

export default BaseLoader;