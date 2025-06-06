import * as T from '@babel/types';
import { NodePath, template } from "@babel/core";
import Generator from "./generator";
import Graph, { ModuleSymbol } from "./graph";
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
        await Promise.all([
            this.emitIndex(),
            this.emitDependencyGraph(),
            this.buildCommand(),
            this.buildModules()
        ])
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
                import { CommandRegister } from '@flame-oh/core/internal';
            
                const __map__ = new CommandRegister();
            `)(),
            ...registrations,
            template.statement(`export default __map__;`)()
        ]);
    }

    private async emitIndex() {
        const mappedInjectionImports = new Array<T.ImportDeclaration>;
        const mappedInjections = new Array<string>;

        for (const injection of this.graph.injectables) {
            const modPath = Module.pathToRelative(injection.symbol.filePath, this.config.buildPath);

            mappedInjections.push(injection.symbol.name);
            mappedInjectionImports.push(
                T.importDeclaration([
                    T.importSpecifier(
                        injection.symbol.id,
                        injection.symbol.id
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

    private async emitDependencyGraph() {
        const symbols = new Set<ModuleSymbol>;

        const resolveSymbol = (symbol: ModuleSymbol) => {
            if(symbols.has(symbol)) return;

            symbols.add(symbol);
        }

        /**
         * Iterate each injectable, add all symbols to Set, and returns a AST structure that
         * represents an object like it:
         * 
         * ```ts
         * const object = {
         *     entitity: Init
         *     dependencies: [Client, Payment]
         * }
         * ```
         */
        const objects = Array.from(this.graph.injectables).map(i => {
            resolveSymbol(i.symbol);
            i.dependencies.forEach(s => resolveSymbol(s));

            const dependenciesArray = T.arrayExpression(
                i.dependencies.map(d => d.id)
            );

            const dependenciesProperty = T.objectProperty(
                T.identifier("dependencies"), 
                dependenciesArray
            );

            const entityProperty = T.objectProperty(
                T.identifier("entity"), 
                i.symbol.id
            );            

            return T.objectExpression([
                entityProperty,
                dependenciesProperty
            ]);
        });

        const exportation = T.exportDefaultDeclaration(
            T.arrayExpression(objects)
        );

        /**
         * Get all symbols registered and returns a array with AST structure that represent
         * the import declaration for each symbol mapped, like:
         * 
         * ```ts
         * import { Init } from './managers/Init.js'
         * ```
         */
        const imports = Array.from(symbols).map(symbol => {
            const modPath = Module.pathToRelative(symbol.filePath, this.config.buildPath);

            return T.importDeclaration(
                [T.importSpecifier(symbol.id, symbol.id)],
                T.stringLiteral(modPath)
            );
        });
        
        const ast = T.file(T.program([
            ...imports,
            exportation
        ]));

        const module = new Module("", ast);

        module.buildPath = join(this.config.buildPath, 'dependency-graph.js');

        this.graph.addModule(module);
    }
}

export default Builder;