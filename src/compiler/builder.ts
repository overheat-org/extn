import * as T from '@babel/types';
import { template } from "@babel/core";
import Generator from "./generator";
import Graph from "./graph";
import { Module } from "./module";
import Transformer from "./transformer";
import fs from 'fs/promises';
import Config from '../config';
import { join } from 'path';
import { getEnvFile } from './env';

class Builder {
    private generator: Generator;

    constructor(private config: Config, private graph: Graph, private transformer: Transformer) {
        this.generator = new Generator();
    }

    async build() {
        await this.emitIndex();
        await this.buildCommand();
        await this.buildModules();
    }

    private async buildModules() {
        for (const module of this.graph.modules) {
            await this.transformer.transformModule(module);
            const content = this.generator.generateModule(module);

            await fs.writeFile(module.buildPath, content, { recursive: true });
        }
    }

    private async buildCommand() {
        const ast = T.file(
            await this.mergeCommands()
        );

        this.graph.addModule(join(this.config.buildPath, 'commands.js'), ast);
    }

    private async mergeCommands() {
        const registrations = await Promise.all(this.graph.commands.map(
            async m => {
                await this.transformer.transformModule(m);

                return template.statement(`
                __map__.register(async () => {
                    %%body%%
                });
            `)({
                body: m.content.program.body
            })}
        ));

        return T.program([
            ...template.statements(`
                import { createElement as _jsx, Fragment as _Frag } from 'diseact/jsx-runtime';
                import { CommandMap } from '@flame-oh/core/internal';
            
                const __map__ = new CommandMap();
            `)(),
            ...registrations,
            template.statement(`export default __map__;`)()
        ]);
    }

    private async emitIndex() {
        const mappedInjectionImports = new Array<T.ImportDeclaration>;
        const mappedInjections = new Array<string>;

        for (const injection of this.graph.injections) {
            const modPath = Module.pathToRelative(injection.module.buildPath, this.config.buildPath);

            mappedInjections.push(injection.id.name);
            mappedInjectionImports.push(
                T.importDeclaration([
                    T.importSpecifier(
                        injection.id,
                        injection.id
                    )
                ], T.stringLiteral(modPath))
            )
        }

        const statements = template.statements(`
                import { FlameClient } from '@flame-oh/core';
                %%IMPORTS%%
    
                process.env = {
                    ...process.env,
                    ...${JSON.stringify(getEnvFile(this.config.cwd))}
                }
    
                const client = new FlameClient({ 
                    commands: import('./commands.js'),
                    managers: [${mappedInjections.join(', ')}],
                    intents: ${JSON.stringify(this.config.intents)}
                });
    
                client.login();
            `)({
            IMPORTS: mappedInjectionImports,
        });

        const module = new Module("", T.file(T.program(statements, [], 'module')));
        module.buildPath = join(this.config.buildPath, 'index.js');

        this.graph.addModule(module);
    }
}

export default Builder;