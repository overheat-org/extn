import * as T from '@babel/types';
import { Module } from "./module";
import _generate from '@babel/generator';

const generate: typeof _generate = typeof _generate == 'object'
    ? (_generate as any).default
    : _generate;

class Generator {
    constructor() {}

    generateModule(module: Module) {
        const result = generate(module.content!);

        return result.code;
    }

    generateFrom(content: T.Node) {
        return generate(content);
    }
}

export default Generator;