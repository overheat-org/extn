import fs from 'fs/promises';
import * as T from '@babel/types';
import Config from '../config';
import { BabelFileResult, transform, transformFromAst, TransformOptions } from '@babel/core';
import { dirname, basename, join as j } from 'path';
import { parse } from '@babel/parser';

class BaseLoader {
    async transformFile(ast: T.Program | T.File | string, options: TransformOptions = {}) {
        const { promise, resolve, reject } = Promise.withResolvers<BabelFileResult>();
        const opts =  {
            ...options,
            ...this.config.babel
        }
        const callback = (err, result) => err ? reject(err) : resolve(result!);
        
        if(typeof ast == 'string') transform(ast, opts, callback);
        else transformFromAst(ast, undefined, opts, callback);

        return promise;
    }

    async emitFile(filename: string, result: BabelFileResult) {
        const outputPath = j(this.config.buildPath, filename);
        return this.emitAbsoluteFile(outputPath, result);
    }
    
    async emitAbsoluteFile(path: string, result: BabelFileResult) {
        await fs.mkdir(dirname(path), { recursive: true });
        await fs.writeFile(path, result.code!);
    }

    parseFile(content: string) {
        return parse(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'decorators']
        });
    }

    toExtension(path: string) {
        const base = basename(path);

        return base.slice(base.indexOf('.'), base.length);
    }

    constructor(protected config: Config) {}
}

export default BaseLoader;