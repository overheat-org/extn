import { join as j } from 'path/posix';
import * as T from '@babel/types';
import { parse } from '@babel/parser';
import { loadConfig } from 'tsconfig-paths';
import Config from '../config';
import pathAll from 'path';

const RELATIVE_PATH_REGEX = /^(?:\.\.?\/)[^\s]*$/;
const FLAME_MANAGER_REGEX = /^@flame-oh\/manager\-/;

export class ImportResolver {
    global = new Map<string, string>()

    createRegister(targetdir: string) {
        return new ImportRegistry(this, targetdir);
    }

    constructor(public config: Config) {}
}

class ImportRegistry {
    imports = new Map<string, Set<{ name: string, type: 'default' | '*' | 'named' }>>();

    parse(source: string) {
        let short!: string;

        if(FLAME_MANAGER_REGEX.test(source)) {
            short = source.replace(FLAME_MANAGER_REGEX, 'managers/');
        }
        else {
            const absoluteEntryPath = j(this.dir, source);
            short = absoluteEntryPath.replace(this.config.entryPath, '');
        }

        return { short };
    }

    register(node: T.ImportDeclaration) {
        const source = this.parse(node.source.value);
        const absoluteBuildPath = this.resolver.global.get(source.short)!;
        const specifiers = new Set<{ name: string, type: 'default' | '*' | 'named' }>();

        node.specifiers.forEach(specifier => {
            if (T.isImportSpecifier(specifier)) {
                specifiers.add({ name: specifier.local.name, type: 'named' });
            } else if (T.isImportDefaultSpecifier(specifier)) {
                specifiers.add({ name: specifier.local.name, type: 'default' });
            } else if (T.isImportNamespaceSpecifier(specifier)) {
                specifiers.add({ name: specifier.local.name, type: '*' });
            }
        });
        
        this.imports.set(absoluteBuildPath, specifiers);
    }

    resolve<T extends T.Program | T.Statement[]>(
        astOrBody: T, 
        options: { clearImportsBefore?: boolean } = { clearImportsBefore: true }
    ): T {
        const resolved = new Set<{ name: string; type: "default" | "*" | "named", path: string }>();
        const body = Array.isArray(astOrBody) ? astOrBody : astOrBody.body;
        
        this.imports.forEach((variables, path) => {
            const defaultImport = [...variables].find((v) => v.type === "default");
            const namespaceImport = [...variables].find((v) => v.type === "*");
            const namedImports = [...variables].filter((v) => v.type === "named");

            if (defaultImport || namedImports.length > 0) {
                const specifiers: (T.ImportSpecifier | T.ImportDefaultSpecifier)[] = [];

                if (
                    defaultImport &&
                    ![...resolved].some(
                        (imported) =>
                            imported.name === defaultImport.name &&
                            imported.type === "default" &&
                            imported.path === path
                    )
                ) {
                    specifiers.push(
                        T.importDefaultSpecifier(T.identifier(defaultImport.name))
                    );
                    resolved.add({
                        name: defaultImport.name,
                        type: "default",
                        path,
                    });
                }

                namedImports.forEach(({ name }) => {
                    if (
                        ![...resolved].some(
                            (imported) =>
                                imported.name === name &&
                                imported.type === "named" &&
                                imported.path === path
                        )
                    ) {
                        specifiers.push(
                            T.importSpecifier(T.identifier(name), T.identifier(name))
                        );
                        resolved.add({
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
                ![...resolved].some(
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
                resolved.add({
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

    private config: Config
    constructor(private resolver: ImportResolver, private dir: string) {
        this.config = resolver.config;
    }
}

export default ImportRegistry;