import fs from 'fs/promises';
import Config from "../config";
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as T from '@babel/types';
import { join as j } from 'path';
import { getEnvFilePath } from '../env';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';
import ImportManager from '../import-manager';
import { transformFromAstAsync } from '@babel/core';
import Diseact from 'diseact';

class CommandsLoader {
    commandsDir = j(this.config.entryPath, 'commands');
    env: NodeJS.ProcessEnv
    rest = new REST()

    async parseFile(filePath: string) {
        const buf = await fs.readFile(filePath);
        let command: T.Expression | undefined = undefined;
        let rest = new Array<T.Statement>;
        const ast = parse(buf.toString('utf-8'), {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });

        traverse(ast!, {
            ExportDefaultDeclaration: {
                enter(path) {
                    command = T.isExpression(path.node.declaration)
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

        if (command) this.queueRegistry(command);

        return {
            path: filePath,
            command,
            rest,
        };
    }

    private queueCommands = new Array<{ path: string, command: T.Expression | undefined, rest: T.Statement[] }>;
    async queueRead(filePath: string) {
        this.queueCommands.push(await this.parseFile(filePath));
    }

    private queueRegistryCommands = new Array<T.Expression>
    async queueRegistry(expr: T.Expression) {
        this.queueRegistryCommands.push(T.cloneNode(expr, true));
    }

    async registryCommands() {
        const { CLIENT_ID, TEST_GUILD_ID } = this.env;

        const route = this.isDev
            ? Routes.applicationGuildCommands(CLIENT_ID, TEST_GUILD_ID!)
            : Routes.applicationCommands(CLIENT_ID);

        const ast = T.file(T.program([T.expressionStatement(T.arrayExpression(this.queueRegistryCommands))]));

        traverse(ast, {
            JSXExpressionContainer(path) {
                if (T.isFunctionExpression(path.node.expression) || T.isArrowFunctionExpression(path.node.expression)) {
                    path.node.expression.body = T.blockStatement([]);
                    path.node.expression.params = [];
                }
            },
            JSXAttribute(path) {
                if (path.node.name.name == 'autocomplete') {
                    path.node.value = T.jSXExpressionContainer(T.booleanLiteral(true));
                }
            }
        });

        const { code } = await transformFromAstAsync(ast, undefined, {
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

        this.queueRegistryCommands.length = 0;
    }

    async mergeFiles(files: typeof this.queueCommands) {
        const imports = new ImportManager();
        const context: T.Statement[] = [];
        const commandProperties: T.ObjectProperty[] = [];

        for (const file of files) {
            if (!/\.(j|t)sx?$/.test(file.path)) continue;
            if (!file.command || !T.isJSXElement(file.command)) continue;

            let commandName!: T.StringLiteral;
            {
                const attribute = file.command.openingElement.attributes.find(
                    (attr) =>
                        (T.isJSXAttribute(attr) && attr.name.name === "name") ||
                        T.isJSXSpreadAttribute(attr)
                );

                if (!attribute) {
                    throw new Error('Command should have a "name" attribute');
                }

                let value;

                if (T.isJSXAttribute(attribute)) {
                    value = attribute.value;

                    if (!T.isStringLiteral(value)) {
                        throw new Error('Name of command should be a string');
                    }
                }

                if (T.isJSXSpreadAttribute(attribute)) {
                    const spreadObject = attribute.argument;

                    if (!T.isObjectExpression(spreadObject)) {
                        throw new Error('Spread attributes must be an object expression');
                    }

                    const nameProperty = spreadObject.properties.find(
                        (prop) =>
                            T.isObjectProperty(prop) &&
                            T.isIdentifier(prop.key) &&
                            prop.key.name === "name"
                    ) as T.ObjectProperty;

                    if (!nameProperty || !T.isStringLiteral(nameProperty.value)) {
                        throw new Error('Name of command should be a string in the spread object');
                    }

                    value = nameProperty.value;
                }

                commandName = value;
            }

            commandProperties.push(
                T.objectProperty(
                    commandName,
                    file.command ?? T.identifier('undefined')
                )
            );
            context.push(...file.rest);
        }

        context.push(
            T.exportDefaultDeclaration(
                T.objectExpression(commandProperties)
            )
        );

        return T.program(imports.resolve(context));
    }

    async readDir() {
        const files = await fs.readdir(this.commandsDir);
        const parsedFiles = files.map(f => this.parseFile(j(this.commandsDir, f)));
        return Promise.all(parsedFiles);
    }

    async emitFile(ast: T.Program) {
        const out = generate(ast, {
            comments: false,
        });

        await fs.mkdir(j(this.config.buildPath, 'tmp'), { recursive: true });
        await fs.writeFile(j(this.config.buildPath, 'tmp', 'commands.tsx'), out.code);
    }

    async load() {
        const { promise: registeredCommands, resolve } = Promise.withResolvers();

        const commands = await this.readDir();
        this.registryCommands().then(resolve);

        const ast = await this.mergeFiles([...commands, ...this.queueCommands]);
        await this.emitFile(ast);

        await registeredCommands;
    }

    constructor(private config: Config, private isDev: boolean) {
        const envPath = getEnvFilePath(config.cwd, isDev);
        if (!envPath) throw new Error('Env File not found');

        const data = readFileSync(envPath);
        this.env = dotenv.parse(data) as NodeJS.ProcessEnv;
        this.rest.setToken(this.env.TOKEN);
    }
}

export default CommandsLoader;