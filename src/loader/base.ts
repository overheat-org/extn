import fs from 'fs/promises';
import * as T from '@babel/types';
import Config from '../config';
import { BabelFileResult, transform, transformFromAst, TransformOptions } from '@babel/core';
import path, { join as j } from 'path';
import { parse } from '@babel/parser';

class BaseLoader {
    async transformFile(ast: T.Program | string, options: TransformOptions = {}) {
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
        const { dir, base } = path.parse(filename);
        const outputPath = j(this.config.buildPath, dir || "", base);
    
        if (dir) {
            await fs.mkdir(j(this.config.buildPath, dir), { recursive: true });
        }
    
        await fs.writeFile(outputPath, result.code!);
    }

    parse(content: string) {
        return parse(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'decorators']
        });
    }

    constructor(protected config: Config) {}
}

export default BaseLoader;