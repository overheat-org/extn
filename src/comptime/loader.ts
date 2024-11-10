import { basename, dirname, extname, isAbsolute, join, normalize, resolve } from 'path';
import fs from 'fs/promises';
import { Client } from 'discord.js';
import babel from '@babel/parser';
import traverse, { Node } from '@babel/traverse';
import Config from '../config';
import generate from '@babel/generator';

type ImportPath = string;

interface ProcessedAST {
    imports: Set<string>;
    body: Node[];
}

interface FileData {
    path: string;
    imports: Map<string, Node | Node[]>;
    exports: Node[];
    default: Node | undefined;
    hasInjected: boolean;
}


class ManagersLoader {
    async readFile(filePath: string) {
        const imports = new Map<ImportPath, Node | Node[]>();
        const exports = new Array<Node>();
        const buf = await fs.readFile(filePath);

        const ast = babel.parse(buf.toString('utf-8'), {
            sourceType: 'module',
            plugins: ['typescript', 'decorators']
        });
        let hasInjected = false;
        const classes = new Array<any>();
        let export_default: Node | undefined = undefined;

        traverse(ast, {
            ImportDeclaration: (importPath) => {
                const source = importPath.node.source.value;
                const absoluteSource = (() => {
                    try {
                        return isAbsolute(source)
                            ? source
                            : resolve(dirname(filePath), source);
                    }
                    catch {
                        // repass responsibility to webpack
                        return source;
                    }
                })();

                if (!imports.has(absoluteSource)) {
                    const nodeResolve = imports.get(absoluteSource);

                    if (Array.isArray(nodeResolve)) {
                        const combinedSpecifiers = [...nodeResolve, importPath.node].reduce((acc: any[], curr: any) => {
                            return [...acc, ...curr.specifiers];
                        }, []);

                        const combinedImport = {
                            ...importPath.node,
                            specifiers: combinedSpecifiers
                        };
                        imports.set(absoluteSource, combinedImport);
                    } else {
                        if (nodeResolve?.type === 'ImportDeclaration') {
                            const combinedSpecifiers = [
                                ...(nodeResolve.specifiers || []),
                                ...(importPath.node.specifiers || [])
                            ];

                            const combinedImport = {
                                ...importPath.node,
                                specifiers: combinedSpecifiers
                            };
                            imports.set(absoluteSource, combinedImport);
                        } else {
                            imports.set(absoluteSource, importPath.node);
                        }
                    }
                } else {
                    imports.set(absoluteSource, importPath.node);
                }
            },

            ImportExpression: (path) => {
                const source = path.node.source;
                if (source.type === 'StringLiteral') {
                    const absoluteSource = isAbsolute(source.value)
                        ? source.value
                        : resolve(dirname(filePath), source.value);

                    imports.set(absoluteSource, path.node);
                }
            },

            ClassDeclaration(path) {
                classes.push(path.node);
            },

            ExportDefaultDeclaration(path) {
                const declaration = path.node.declaration;

                if (declaration.type !== 'Identifier') {
                    throw new Error(`Expected class declaration, found "${declaration.type}"`);
                }

                const selectedClass = classes.find(c => declaration.name === c.id.name);
                export_default = selectedClass as Node;

                if (selectedClass && selectedClass.decorators) {
                    selectedClass.decorators = selectedClass.decorators.filter(
                        (d: any) => !(d.expression.type === 'Identifier' && d.expression.name === 'inject')
                    );
                }

                hasInjected = !!selectedClass?.decorators?.find(
                    (d: any) => d.expression.type === 'Identifier' && d.expression.name === 'inject'
                );
            },

            ExportSpecifier(path) {
                exports.push(path.node);
            },

            ExportAllDeclaration(path) {
                const source = path.node.source.value;
                const absoluteSource = isAbsolute(source)
                    ? source
                    : resolve(dirname(filePath), source);

                exports.push({
                    type: 'ExportAllDeclaration',
                    source: {
                        type: 'StringLiteral',
                        value: absoluteSource
                    }
                });
            }
        });

        return {
            path: filePath,
            imports,
            exports,
            default: export_default,
            hasInjected
        };
    }

    async readContext(dirPath: string) {
        const files = await readFilesRecursively(dirPath);

        const fileDataPromises = files.map(file => this.readFile(file));
        const filesData = await Promise.all(fileDataPromises);

        const injectedFiles = filesData.filter(f => f.hasInjected);
        const normalFiles = filesData.filter(f => !f.hasInjected);

        const injectedAST = processFiles(injectedFiles);
        const normalAST = processFiles(normalFiles);

        const injectedCode = generateCode(injectedAST);
        const normalCode = generateCode(normalAST);

        return {
            injected: injectedCode,
            normal: normalCode
        };

        async function readFilesRecursively(dir: string): Promise<string[]> {
            const files: string[] = [];

            async function scan(currentDir: string) {
                const entries = await fs.readdir(currentDir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = join(currentDir, entry.name);

                    if (entry.isDirectory()) {
                        await scan(fullPath);
                    } else if (entry.isFile() && /\.(ts|js)x?$/.test(entry.name)) {
                        files.push(fullPath);
                    }
                }
            }

            await scan(dir);
            return files;
        }

        function processFiles(files: FileData[]): ProcessedAST {
            const imports = new Set<string>();
            const body: Node[] = [];

            files.forEach(file => {
                file.imports.forEach((importNode, importPath) => {
                    const normalizedPath = normalize(importPath);
                    imports.add(normalizedPath);
                });
            });

            files.forEach(file => {
                if (file.default) {
                    body.push(file.default);
                }

                file.exports.forEach(exportNode => {
                    body.push(exportNode);
                });
            });

            return {
                imports,
                body
            };
        }

        function generateCode(ast: ProcessedAST): string {
            const importStatements = Array.from(ast.imports).map(importPath => {
                return {
                    type: 'ImportDeclaration',
                    specifiers: [
                        {
                            type: 'ImportDefaultSpecifier',
                            local: {
                                type: 'Identifier',
                                name: basename(importPath, extname(importPath))
                            }
                        }
                    ],
                    source: {
                        type: 'StringLiteral',
                        value: importPath
                    }
                };
            });

            const fullAST = {
                type: 'Program',
                body: [...importStatements, ...ast.body],
                sourceType: 'module' as const
            } as Node;

            const { code } = generate(fullAST, {
                comments: true,
                retainLines: true
            });

            return code;
        }
    }

    constructor(private config: Config) {}
}

class Loader {
    run(client: Client) {}

    managers: ManagersLoader;
    
    constructor(config: Config) {
        this.managers = new ManagersLoader(config);
    }
}

export default Loader;