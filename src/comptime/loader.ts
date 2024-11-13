import { join as j, basename, extname } from 'path';
import fs from 'fs/promises';
import Config from "../config";
import traverse from "@babel/traverse";
import { parse } from "@babel/core";
import * as Types from '@babel/types';
import generate from '@babel/generator';
import helperContent from '!!raw-loader!../helper';

interface ParsedCommand {
    path: string;
    default: Types.Expression | undefined;
    rest: Types.Statement[];
    imports: ImportInfo[];
}

interface ImportInfo {
    source: string;
    specifiers: {
        local: string;
        imported?: string;
    }[];
}

class CommandsLoader {
    async parseFile(filePath: string): Promise<ParsedCommand> {
        const imports: ImportInfo[] = [];
        const rest: Types.Statement[] = [];
        let defaultExport: Types.Expression | undefined;

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
                    imported: Types.isImportSpecifier(spec) ? (spec.imported as Types.StringLiteral).value : undefined
                }));

                imports.push({ source, specifiers });
                path.remove();
            },

            ExportDefaultDeclaration(path) {
                defaultExport = Types.isExpression(path.node.declaration)
                    ? path.node.declaration
                    : Types.identifier('undefined');
                path.remove();
            },

            Program: {
                exit(path) {
                    rest.push(...path.node.body);
                }
            }
        });

        return {
            path: filePath,
            default: defaultExport,
            rest,
            imports
        };
    }

    async loadCommand(filePath: string, uniqueImports: Map<string, ImportInfo>): Promise<{
        commandName: string;
        commandProperty: Types.ObjectProperty;
        statements: Types.Statement[];
    }> {
        const parsed = await this.parseFile(filePath);
        
        // Add imports to uniqueImports map
        for (const imp of parsed.imports) {
            const key = imp.source;
            if (!uniqueImports.has(key)) {
                uniqueImports.set(key, imp);
            }
        }

        let commandName = basename(parsed.path, extname(parsed.path));
        if (parsed.default && Types.isObjectExpression(parsed.default)) {
            const nameProperty = parsed.default.properties.find(
                prop => 
                    Types.isObjectProperty(prop) && 
                    Types.isIdentifier(prop.key) && 
                    prop.key.name === 'name'
            ) as Types.ObjectProperty | undefined;
    
            if (nameProperty && Types.isStringLiteral(nameProperty.value)) {
                commandName = nameProperty.value.value;
            }
        }

        const commandProperty = Types.objectProperty(
            Types.stringLiteral(commandName),
            parsed.default || Types.identifier('undefined')
        );

        return {
            commandName,
            commandProperty,
            statements: parsed.rest
        };
    }

    async loadCommandsDir() {
        const commandsDir = j(this.config.entryPath, 'commands');
        const files = await fs.readdir(commandsDir);
        
        const uniqueImports = new Map<string, ImportInfo>();
        const programBody: Types.Statement[] = [];
        const commandProperties: Types.ObjectProperty[] = [];

        // Add helper content first
        programBody.push(
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
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                const filePath = j(commandsDir, file);
                const { commandProperty, statements } = await this.loadCommand(filePath, uniqueImports);
                commandProperties.push(commandProperty);
                programBody.push(...statements);
            }
        }

        // Add lazy imports
        for (const [source, info] of uniqueImports) {
            programBody.push(this.createLazyImport(source, info.specifiers));
        }

        // Create and add the commands object
        const commandsObject = Types.objectExpression(commandProperties);
        programBody.push(Types.exportDefaultDeclaration(commandsObject));

        // Generate final code
        const output = generate(Types.program(programBody), {
            comments: false
        });

        await fs.writeFile(j(this.config.buildPath, 'commands.js'), output.code);
    }

    private createLazyImport(importPath: string, specifiers: ImportInfo['specifiers']) {
        const lazyIdentifier = Types.identifier('LazyImport');

        return Types.variableDeclaration('const', [
            Types.variableDeclarator(
                Types.identifier(specifiers[0].local),
                Types.callExpression(lazyIdentifier, [
                    Types.stringLiteral(importPath)
                ])
            )
        ]);
    }

    constructor(private config: Config) { }
}

class ManagersLoader {
    async parseFile(filePath: string) {
        // TODO: checar se é um manager injetado ou nao
        
    }

}

class Loader {
    async run() {
        await this.commands.loadCommandsDir();
    }

    commands: CommandsLoader;
    managers: ManagersLoader;

    constructor(config: Config) {
        this.commands = new CommandsLoader(config);
    }
}

export default Loader;