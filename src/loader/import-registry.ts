import p from 'path/posix';
import * as T from '@babel/types';
import { parse } from '@babel/parser';
import { loadConfig } from 'tsconfig-paths';
import path from 'path';
import Config from '../config';

const RELATIVE_PATH_REGEX = /^(?:\.\.?\/)[^\s]*$/;

export class ImportResolver {
    registered = {
        "managers/Init": undefined
    }

    // Os arquivos que tem importações, serão resolvidas, e serão salvas somente a diferença entre entryPath.
    // O objeto do registered terá um objeto rico em informações como o path de build esperado.
    // Não será resolvido aqui, importações de modulos e path aliases
}

class ImportRegistry {
    imports = new Map<string, Set<{ name: string, type: 'default' | '*' | 'named' }>>();
    resolved = new Set<{ name: string; type: "default" | "*" | "named", path: string }>();
    from?: string
    to?: string
    private pathAliases: Record<string, string> = {}

    register(node: T.ImportDeclaration) {
        const path = node.source.value;

        if (!this.imports.has(path)) {
            this.imports.set(path, new Set());
        }

        const imported = this.imports.get(path)!;

        node.specifiers.forEach(specifier => {
            if (T.isImportSpecifier(specifier)) {
                imported.add({ name: specifier.local.name, type: 'named' });
            } else if (T.isImportDefaultSpecifier(specifier)) {
                imported.add({ name: specifier.local.name, type: 'default' });
            } else if (T.isImportNamespaceSpecifier(specifier)) {
                imported.add({ name: specifier.local.name, type: '*' });
            }
        });
    }

    private loadTsConfigAliases(cwd: string) {
        const tsConfigResult = loadConfig(cwd);
        
        if (tsConfigResult.resultType !== 'success') {
            console.warn('Não foi possível carregar o tsconfig');
            return;
        }

        const { absoluteBaseUrl, paths } = tsConfigResult;
        
        for (const [alias, pathValues] of Object.entries(paths)) {
            const cleanAlias = alias.replace('/*', '');
            const cleanPath = pathValues[0].replace('/*', '');
            
            this.pathAliases[cleanAlias] = path.resolve(
                absoluteBaseUrl, 
                cleanPath
            ).replace(/\\/g, '/');
        }

        console.log('Path Aliases:', this.pathAliases);
    }

    private resolveAlias(importPath: string, currentFilePath: string): string {
        for (const [alias, fullPath] of Object.entries(this.pathAliases)) {
            if (importPath.startsWith(`${alias}/`)) {
                const relativePath = importPath.replace(`${alias}/`, '');
                const resolvedPath = path.resolve(fullPath, relativePath);
                return path.relative(path.dirname(currentFilePath), resolvedPath).replace(/\\/g, '/');
            }
        }
        return importPath;
    }

    parse(
        astOrBody: T.Program | T.Statement[] | string, 
        options: { clearImportsBefore?: boolean, path?: string } = { clearImportsBefore: false }
    ): T.ImportDeclaration[] {
        let body!: T.Statement[];
        {
            switch (true) {
                case typeof astOrBody == 'string':
                    body = parse(astOrBody).program.body;
                    break;
                    
                case T.isNode(astOrBody) && T.isProgram(astOrBody):
                    body = astOrBody.body;
                    break;

                case Array.isArray(astOrBody):
                    body = astOrBody;
                    break;

                default:
                    throw new Error('Cannot parse this target')
            }
        }
        
        const imports = new Array<T.ImportDeclaration>;

        for (let i = body.length - 1; i >= 0; i--) {
            if (T.isImportDeclaration(body[i])) {
                const importNode = body[i] as T.ImportDeclaration;

                if (this.to) {
                    const resolvedPath = this.resolveAlias(importNode.source.value, this.to);

                    if(RELATIVE_PATH_REGEX.test(resolvedPath) ||
                       Object.keys(this.pathAliases).some(alias =>
                           importNode.source.value.startsWith(alias)
                       )) {
                        if (options.path) {
                            const pathWithEntry = p.join(options.path, resolvedPath);
                            let pathWithBuild = pathWithEntry.replace(this.from!, this.to);
                
                            importNode.source.value = p.relative(this.to, pathWithBuild);
                            if(!importNode.source.value.startsWith('.')) {
                                importNode.source.value = `./${importNode.source.value}`;
                            }
                        } else {
                            importNode.source.value = resolvedPath;
                        }
                
                        importNode.source.value = changeFileExtension(importNode.source.value, 'js')
                    }
                }
                
                const FLAME_MANAGER_REGEX = /^@flame-oh\/manager\-/;
                if(FLAME_MANAGER_REGEX.test(importNode.source.value)) {
                    importNode.source.value = changeFileExtension(
                        `./${importNode.source.value.replace(FLAME_MANAGER_REGEX, 'managers/')}`,
                        'js'
                    );
                }
                
                this.register(importNode);
                imports.push(importNode);
                
                if (options.clearImportsBefore) {
                    body.splice(i, 1);
                }
            }
        }

        return imports;
    }

    resolve<T extends T.Program | T.Statement[]>(astOrBody: T): T {
        const body = Array.isArray(astOrBody) ? astOrBody : astOrBody.body;

        this.imports.forEach((variables, path) => {
            const defaultImport = [...variables].find((v) => v.type === "default");
            const namespaceImport = [...variables].find((v) => v.type === "*");
            const namedImports = [...variables].filter((v) => v.type === "named");

            if (defaultImport || namedImports.length > 0) {
                const specifiers: (T.ImportSpecifier | T.ImportDefaultSpecifier)[] = [];

                if (
                    defaultImport &&
                    ![...this.resolved].some(
                        (imported) =>
                            imported.name === defaultImport.name &&
                            imported.type === "default" &&
                            imported.path === path
                    )
                ) {
                    specifiers.push(
                        T.importDefaultSpecifier(T.identifier(defaultImport.name))
                    );
                    this.resolved.add({
                        name: defaultImport.name,
                        type: "default",
                        path,
                    });
                }

                namedImports.forEach(({ name }) => {
                    if (
                        ![...this.resolved].some(
                            (imported) =>
                                imported.name === name &&
                                imported.type === "named" &&
                                imported.path === path
                        )
                    ) {
                        specifiers.push(
                            T.importSpecifier(T.identifier(name), T.identifier(name))
                        );
                        this.resolved.add({
                            name,
                            type: "named",
                            path,
                        });
                    }
                });

                if (specifiers.length > 0) {
                    const importDeclaration = T.importDeclaration(
                        specifiers,
                        T.stringLiteral(path)
                    );
                    body.unshift(importDeclaration);
                }
            }

            if (
                namespaceImport &&
                ![...this.resolved].some(
                    (imported) =>
                        imported.name === namespaceImport.name &&
                        imported.type === "*" &&
                        imported.path === path
                )
            ) {
                const namespaceDeclaration = T.importDeclaration(
                    [
                        T.importNamespaceSpecifier(
                            T.identifier(namespaceImport.name)
                        ),
                    ],
                    T.stringLiteral(path)
                );
                body.unshift(namespaceDeclaration);
                this.resolved.add({
                    name: namespaceImport.name,
                    type: "*",
                    path,
                });
            }
        });

        if (!Array.isArray(astOrBody)) {
            astOrBody.body = body;
        }

        return (Array.isArray(astOrBody) ? body : T.program(body)) as T;
    }

    constructor(options?: { from: string, to: string }) {
        const config = ImportRegistry.config;

        this.from = options?.from ?? config.entryPath;
        this.to = options?.to ?? config.buildPath;
        
        this.loadTsConfigAliases(config.cwd);
    }

    private static config: Config;
    static init(config: Config) {
        this.config = config;
    }
}

function changeFileExtension(path: string, newExtension: string): string {
    const pathWithoutExtension = path.replace(/\.[^/.]+$/, '');
    return `${pathWithoutExtension}.${newExtension.replace(/^\./, '')}`;
}

export default ImportRegistry;