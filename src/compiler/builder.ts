import * as T from '@babel/types';
import { template } from "@babel/core";
import Generator from "./generator";
import Graph, { ModuleSymbol } from "./graph";
import { Module, NodeModule } from "./module";
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
            this.emitRoutes(),
            this.emitCommands(),
            this.emitEvents()
        ])
        await this.buildModules()
    }

    private async buildModules() {
        for (const module of this.graph.modules) {
            if(module instanceof NodeModule) continue;
            
            await module.transform(this.transformer);
            const content = this.generator.generateModule(module);

            await fs.writeFile(module.buildPath, content, { recursive: true });
        }
    }

    private emitEvents() {
        const symbols = new Set<ModuleSymbol>;

        const resolveSymbol = (symbol: ModuleSymbol) => {
            if(symbols.has(symbol)) return;

            symbols.add(symbol);
        }

        const objects = Array.from(this.graph.events).map(r => {
            resolveSymbol(r.symbol.parent!);
            
            return T.objectExpression([
                T.objectProperty(T.identifier("type"), T.stringLiteral(r.type)),
                T.objectProperty(T.identifier("once"), T.booleanLiteral(r.once)),
                T.objectProperty(T.identifier("handler"), T.stringLiteral(r.symbol.name)),
                T.objectProperty(T.identifier("entity"), T.identifier(r.symbol.parent!.name))
            ])
        })

        const exportation = T.exportDefaultDeclaration(
            T.arrayExpression(objects)
        );

        const imports = Array.from(symbols).map(symbol => {
            let modPath: string;
            
            if(symbol.module.entryPath.includes('node_modules')) {
                modPath = symbol.module.basename;
            } else {
                modPath = Module.pathToRelative(symbol.module.buildPath, this.config.buildPath);
            }

            return T.importDeclaration(
                [T.importSpecifier(symbol.id, symbol.id)],
                T.stringLiteral(modPath)
            );
        });

        const ast = T.file(T.program([
            ...imports,
            exportation
        ]));

        const module = Module.from("", ast);

        module.buildPath = join(this.config.buildPath, 'events.js');

        this.graph.addModule(module);
    }

    private emitRoutes() {
        const symbols = new Set<ModuleSymbol>;

        const resolveSymbol = (symbol: ModuleSymbol) => {
            if(symbols.has(symbol)) return;

            symbols.add(symbol);
        }

        const objects = Array.from(this.graph.routes).map(r => {
            resolveSymbol(r.symbol.parent!);
            
            return T.objectExpression([
                T.objectProperty(T.identifier("endpoint"), T.stringLiteral(r.endpoint)),
                T.objectProperty(T.identifier("method"), T.stringLiteral(r.method)),
                T.objectProperty(T.identifier("ipc"), T.booleanLiteral(r.ipc)),
                T.objectProperty(T.identifier("handler"), T.stringLiteral(r.symbol.name)),
                T.objectProperty(T.identifier("entity"), T.identifier(r.symbol.parent!.name))
            ])
        })

        const exportation = T.exportDefaultDeclaration(
            T.arrayExpression(objects)
        );

        const imports = Array.from(symbols).map(symbol => {
            let modPath: string;
            
            if(symbol.module.entryPath.includes('node_modules')) {
                modPath = symbol.module.basename;
            } else {
                modPath = Module.pathToRelative(symbol.module.buildPath, this.config.buildPath);
            }

            return T.importDeclaration(
                [T.importSpecifier(symbol.id, symbol.id)],
                T.stringLiteral(modPath)
            );
        });

        const ast = T.file(T.program([
            ...imports,
            exportation
        ]));

        const module = Module.from("", ast);

        module.buildPath = join(this.config.buildPath, 'routes.js');

        this.graph.addModule(module);
    }

    private async emitCommands() {        
        const ast = T.file(
            await this.mergeCommands()
        );

        this.graph.addModule(join(this.config.buildPath, 'commands.js'), ast);
    }

    private async mergeCommands() {
        const registrations = await Promise.all(this.graph.commands.map(
            async m => {
                await m.transform(this.transformer);

                return template.statement(`
                    __container__.add(async () => {
                        %%body%%
                    });
                `)({
                    body: m.content.program.body
                });
            }
        ));

        return T.program([
            ...template.statements(`
                import { createElement as _jsx, Fragment as _Frag } from 'diseact/jsx-runtime';
                import { CommandContainer } from '@flame-oh/core';
            
                const __container__ = new CommandContainer();
            `)(),
            ...registrations,
            template.statement(`export default __container__;`)()
        ]);
    }

    private async emitIndex() {
        const statements = template.statements(`
            import { FlameClient } from '@flame-oh/core';

            process.env = {
                ...process.env,
                ...${JSON.stringify(getEnvFile(this.config.cwd))}
            }

            const client = new FlameClient({
                entryUrl: import.meta.url,
                intents: ${JSON.stringify(this.config.intents)}
            });

            client.start();
        `, { placeholderPattern: false })();

        const module = Module.from("", T.file(T.program(statements, [], 'module')));
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
        const objects = Array.from(new Set([...this.graph.injectables, ...this.graph.managers])).map(i => {
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
            let modPath: string;
            
            if(symbol.module.entryPath.includes('node_modules')) {
                modPath = symbol.module.basename;
            } else {
                modPath = Module.pathToRelative(symbol.module.buildPath, this.config.buildPath);
            }

            return T.importDeclaration(
                [T.importSpecifier(symbol.id, symbol.id)],
                T.stringLiteral(modPath)
            );
        });

        const ast = T.file(T.program([
            ...imports,
            exportation
        ]));

        const module = Module.from("", ast);

        module.buildPath = join(this.config.buildPath, 'dependency-graph.js');

        this.graph.addModule(module);
    }
}

export default Builder;