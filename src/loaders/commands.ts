import Config from "../config";
import { TraverseOptions } from '@babel/traverse';
import * as T from '@babel/types';
import { join as j } from 'path/posix';
import { getEnvFilePath } from '../env';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { REST } from 'discord.js';
import BaseLoader from './base';
import Loader from '.';
import ImportResolver from "./import-resolver";
import { ParseResult } from "@babel/parser";

const id = {
    mod: T.identifier('__mod__')
}

class CommandsLoader extends BaseLoader {
    dir: string
    env: NodeJS.ProcessEnv;
    rest = new REST();
    importResolver: ImportResolver;
    highScope = new Array<T.Node>;
    objectProps = new Array<T.Statement>;

    traverse: TraverseOptions = {
        Program: (path) => {
            const statements = new Array<T.Statement>;

            for(const p of path.get('body')) {
                if(p.isImportDeclaration()) {
                    statements.push(...this.importResolver.transform(p));
                }
                else if(p.isExportSpecifier() || p.isExportNamedDeclaration()) {
                    throw new Error('Cannot export in commands');
                }
                else if(p.isTSEnumDeclaration()) {
                    this.highScope.push(T.cloneNode(p.node));
                    p.remove();
                }
                else if(p.isExportDefaultDeclaration()) {
                    statements.push(T.returnStatement(p.node.declaration as T.Expression))
                }
                else {
                    statements.push(T.cloneNode(p.node, true));
                }
            }

            const transformed = T.callExpression(
                T.memberExpression(
                    T.callExpression(
                        T.arrowFunctionExpression(
                            [],
                            T.blockStatement(statements),
                            true
                        ),
                        []
                    ),
                    T.identifier("then")
                ),
                [
                    T.arrowFunctionExpression(
                        [T.identifier('m')], 
                        T.assignmentExpression('=', 
                            id.mod,
                            T.objectExpression([
                                T.spreadElement(id.mod), 
                                T.spreadElement(T.memberExpression(T.identifier('m'), T.identifier('__map__')))
                            ]) 
                        ),
                    )
                ]
            );
                    
            this.objectProps.push(T.expressionStatement(transformed));
        }
    }

    async loadDir() {
        for(const dirent of await this.readDir(this.dir)) {
            const filepath = j(dirent.parentPath, dirent.name);
            const content = await this.parseFile(filepath);

            if(dirent.isFile()) {
                this.traverseContent(content, this.traverse);
            } else {
                await this.loadDir();
            }
        }
    }

    async load() {
        await this.loadDir();

        const program = T.program([
            T.variableDeclaration('const', [T.variableDeclarator(id.mod, T.objectExpression([]))]),
            ...this.objectProps,
            T.exportDefaultDeclaration(id.mod)
        ]);

        const { ast } = await this.transformContent(program, { filename: "commands.tsx", ast: true });
        const content = this.generateContent(ast!);
        await this.emitFile('commands.js', content);
    }

    queueRead(result: ParseResult<T.File>) {
        this.traverseContent(result, this.traverse);
    }

    constructor(protected config: Config, protected loader: Loader, private isDev: boolean) {
        super(config, loader);

        this.dir = j(this.config.entryPath, 'commands');
        this.importResolver = new ImportResolver(this.dir, this.config);
        
        const envPath = getEnvFilePath(config.cwd, isDev);
        if (!envPath) throw new Error('Env File not found');

        const data = readFileSync(envPath);
        this.env = dotenv.parse(data) as NodeJS.ProcessEnv;
        this.rest.setToken(this.env.TOKEN);
    }
}

export default CommandsLoader;