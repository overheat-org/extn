import fs from 'fs/promises';
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from '@babel/generator';
import * as T from '@babel/types';
import { join as j } from 'path';
import Config from "../config";
import client from '!!raw-loader!../helpers/client';

class ClientLoader {
    parseFile() {
        return parse(client, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx']
        });
    }

    async mergeInternalManagers(internalManagers: T.Statement[]) {
        const ast = this.parseFile();
        
        traverse(ast!, {
            Identifier(path) {
                if(path.node.name == 'MANAGERS') {
                    path.replaceWithMultiple(internalManagers);
                }
            }
        });

        return ast;
    }

    async writeFile(ast) {
        const out = generate(ast, {
            comments: false
        });

        await fs.writeFile(j(this.config.buildPath, 'index.js'), out.code);
    }
    
    async load(internalManagers: T.Statement[]) {
        const ast = await this.mergeInternalManagers(internalManagers);
        this.writeFile(ast);
    }
    
    constructor(private config: Config) {}
}

export default ClientLoader;