import { ImportInfo } from ".";
import { REST, Routes } from 'discord.js';
import traverse from "@babel/traverse";
import { parse } from "@babel/parser";
import * as T from '@babel/types';
import generate from '@babel/generator';
import fs from 'fs/promises';
import { join as j, basename, extname } from 'path';
import helperContent from '!!raw-loader!../lazy.helper';
import Config from "../config";
import { getEnvFilePath } from "../env";
import { readFileSync } from "fs";
import dotenv from 'dotenv';
import { transformFromAstSync } from "@babel/core";
import Diseact from 'diseact';

const DEV = process.env.NODE_ENV == 'development';

interface ParsedCommand {
    path: string;
    data: T.Expression | undefined;
    rest: T.Statement[];
    imports: ImportInfo[];
}

class CommandsLoader {
    env: NodeJS.ProcessEnv
    rest = new REST({ version: '10' });

    async parseFile(filePath: string): Promise<ParsedCommand> {
        const imports: ImportInfo[] = [];
        const rest: T.Statement[] = [];
        let data: T.Expression | undefined;

        const buf = await fs.readFile(filePath);
        const ast = parse(buf.toString('utf-8'), {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });

        traverse(ast!, {
            ImportDeclaration(path) {
                const source = path.node.source.value;
                const specifiers = path.node.specifiers.map(spec => ({
                    local: spec.local.name,
                    imported: T.isImportSpecifier(spec) ? (spec.imported as T.StringLiteral).value : undefined
                }));

                imports.push({ source, specifiers });
                path.remove();
            },

            ExportDefaultDeclaration: {
                enter(path) {
                    data = T.isExpression(path.node.declaration)
                        ? path.node.declaration
                        : T.identifier('undefined');
                },
                exit(path) {
                    path.remove();
                }
            },

            Program: {
                exit(path) {
                    rest.push(...path.node.body);
                }
            }
        });
        
        return {
            path: filePath,
            data,
            rest,
            imports
        };
    }

    async loadCommand(filePath: string, uniqueImports: Map<string, ImportInfo>): Promise<{
        commandName: string;
        commandProperty: T.ObjectProperty;
        statements: T.Statement[];
    }> {
        const parsed = await this.parseFile(filePath);

        this.setCommandToRegister(parsed.data!);
        
        // Add imports to uniqueImports map
        for (const imp of parsed.imports) {
            const key = imp.source;
            if (!uniqueImports.has(key)) {
                uniqueImports.set(key, imp);
            }
        }

        let commandName = basename(parsed.path, extname(parsed.path));
        if (parsed.data && T.isObjectExpression(parsed.data)) {
            const nameProperty = parsed.data.properties.find(
                prop => 
                    T.isObjectProperty(prop) && 
                    T.isIdentifier(prop.key) && 
                    prop.key.name === 'name'
            ) as T.ObjectProperty | undefined;
    
            if (nameProperty && T.isStringLiteral(nameProperty.value)) {
                commandName = nameProperty.value.value;
            }
        }

        const commandProperty = T.objectProperty(
            T.stringLiteral(commandName),
            T.callExpression(
                T.arrowFunctionExpression(
                    [], 
                    T.blockStatement([
                        ...(parsed.imports.length > 0 
                            ? [T.variableDeclaration('const', 
                                parsed.imports.map(i => 
                                    T.variableDeclarator(T.identifier(i.specifiers[0].local),
                                        T.awaitExpression(
                                            T.memberExpression(
                                                T.identifier(`_${i.specifiers[0].local}`),
                                                T.identifier('value')
                                            ),
                                        )
                                    ),
                                )
                            )]
                            : []
                        ),
                        T.returnStatement(parsed.data)
                    ]),
                    true
                ),
                [],
            ) || T.identifier('undefined')
        );

        return {
            commandName,
            commandProperty,
            statements: parsed.rest
        };
    }

    commands: Array<T.Expression> | undefined = [];

    setCommandToRegister(commandExpr: T.Expression) {
        this.commands!.push(commandExpr);
    }
    
    async registryCommands() {
        const { CLIENT_ID, TEST_GUILD_ID } = this.env;

        const route = DEV 
            ? Routes.applicationGuildCommands(CLIENT_ID, TEST_GUILD_ID!)
            : Routes.applicationCommands(CLIENT_ID);

        const ast = T.program([T.expressionStatement(T.arrayExpression(this.commands))]);

        traverse(ast, {
            JSXExpressionContainer(path) {
                if (T.isFunctionExpression(path.node.expression) || T.isArrowFunctionExpression(path.node.expression)) {
                    path.node.expression.body = T.blockStatement([]);
                    path.node.expression.params = [];
                }
            }
        });

        const { code } = transformFromAstSync(ast, undefined, {
            plugins: [
                ["@babel/plugin-transform-react-jsx", {
                    pragma: "Diseact.createElement",
                    pragmaFrag: "Diseact.Fragment"
                }]
            ]
        }) ?? {};

        if (!code) throw new Error('Cannot parse JSX command');

        const execute = new Function('Diseact', `return ${code}`);
        
        const evaluated = execute(Diseact);

        await this.rest.put(route, { body: evaluated });

        this.commands = undefined;
    }

    async loadCommandsDir() {
        const commandsDir = j(this.config.entryPath, 'commands');
        const files = await fs.readdir(commandsDir);
        
        const uniqueImports = new Map<string, ImportInfo>();
        const context: T.Statement[] = [];
        const commandProperties: T.ObjectProperty[] = [];

        /*
         * Declare 'usingLazy' to handle lazy imports init
         * Used to ignore first getters call of lazy imports before all lazy are initialized
         */ 
        context.push(
            T.variableDeclaration('let', [
                T.variableDeclarator(T.identifier('usingLazy'), T.booleanLiteral(true))
            ])
        );
        
        // Add helper content first
        context.push(
            ...parse(
                helperContent,
                {
                    sourceType: 'module',
                    plugins: ['typescript'],
                }
            )!.program.body
        );

        // Process each command file
        for (const file of files) {
            if (!/\.(j|t)sx?$/.test(file)) continue;

            const filePath = j(commandsDir, file);
            const { commandProperty, statements } = await this.loadCommand(filePath, uniqueImports);

            commandProperties.push(commandProperty);
            context.push(...statements);
        }

        await this.registryCommands();

        // Add lazy imports
        for (const [source, info] of uniqueImports) {
            context.push(this.createLazyImport(source, info.specifiers));
        }

        context.push(T.expressionStatement(T.assignmentExpression('=', T.identifier('usingLazy'), T.booleanLiteral(false))));

        // Create and add the commands object
        context.push(T.variableDeclaration('const', [T.variableDeclarator(
            T.identifier('_commands'),
            T.objectExpression(commandProperties)
        )]));

        context.push(T.returnStatement(T.identifier('_commands')));

        const asyncContext = T.callExpression(
            T.arrowFunctionExpression([], 
                T.blockStatement(context), 
                true), 
            []
        );

        const exportDefault = T.exportDefaultDeclaration(asyncContext);
        
        // Generate final code
        const output = generate(T.program([exportDefault]), {
            comments: false
        });
        
        await fs.writeFile(j(this.config.buildPath, 'commands.js'), output.code);
    }

    private createLazyImport(importPath: string, specifiers: ImportInfo['specifiers']) {
        const lazyIdentifier = T.identifier('lazy');

        return T.variableDeclaration('const', [
            T.variableDeclarator(
                T.identifier(`_${specifiers[0].local}`),
                T.callExpression(lazyIdentifier, [
                    T.arrowFunctionExpression(
                        [],
                        T.importExpression(
                            T.stringLiteral(importPath)
                        )
                    )
                ])
            )
        ]);
    }

    constructor(private config: Config) {
        const envPath = getEnvFilePath(config.cwd, DEV);
        if(!envPath) throw new Error('Env File not found')

        const data = readFileSync(envPath);
        this.env = dotenv.parse(data) as NodeJS.ProcessEnv;
        this.rest.setToken(this.env.TOKEN);
    }
}

export default CommandsLoader