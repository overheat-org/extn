import fs from 'fs/promises';
import Config from "../config";
import traverse from '@babel/traverse';
import * as T from '@babel/types';
import { join as j } from 'path/posix';
import { getEnvFilePath } from '../env';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';
import ImportManager from './import-manager';
import { transformFromAstAsync } from '@babel/core';
import * as Diseact from 'diseact';
import BaseLoader from './base';

class CommandsLoader extends BaseLoader {
    commandsDir: string;
    env: NodeJS.ProcessEnv;
    rest = new REST();

    async intermediateParseFile(filePath: string) {
        const buf = await fs.readFile(filePath);
        let command: T.Expression | undefined = undefined;
        let rest = new Array<T.Statement>;
        const ast = this.parseFile(buf.toString('utf-8'));

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
        this.queueCommands.push(await this.intermediateParseFile(filePath));
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
                    path.node.value = T.jsxExpressionContainer(T.booleanLiteral(true));
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

        const r = this.rest.put(route, { body: evaluated });

        this.queueRegistryCommands.length = 0;

        return await r;
    }

    async mergeFiles(files: typeof this.queueCommands) {
        const imports = new ImportManager({ from: j(this.config.entryPath, 'commands'), to: this.config.buildPath });
        const context = new Array<T.Statement>;
        const commandProperties = new Array<T.ObjectProperty>;

        for (const file of files) {
            if (!/\.(j|t)sx?$/.test(file.path)) continue;
            if (!file.command || !T.isJSXElement(file.command)) continue;

            imports.parse(file.rest, { clearImportsBefore: true, path: file.path });

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
        const parsedFiles = files.map(f => this.intermediateParseFile(j(this.commandsDir, f)));
        return Promise.all(parsedFiles);
    }

    async load() {
        const { promise: registeredCommands, resolve, reject } = Promise.withResolvers();

        const commands = await this.readDir();
        this.registryCommands().then(resolve).catch(reject);

        const ast = await this.mergeFiles([...commands, ...this.queueCommands]);
        const result = await this.transformFile(ast, { filename: 'commands.tsx' });
        await this.emitFile('commands.js', result);

        await registeredCommands;
    }

    constructor(protected config: Config, private isDev: boolean) {
        super(config);

        this.commandsDir = j(this.config.entryPath, 'commands');
        
        const envPath = getEnvFilePath(config.cwd, isDev);
        if (!envPath) throw new Error('Env File not found');

        const data = readFileSync(envPath);
        this.env = dotenv.parse(data) as NodeJS.ProcessEnv;
        this.rest.setToken(this.env.TOKEN);
    }
}

export default CommandsLoader;