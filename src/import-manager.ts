import * as T from '@babel/types';

class ImportManager {
    imports = new Map<string, Set<{ name: string, type: 'default' | '*' | 'named' }>>();
    resolved = new Set<{ name: string; type: "default" | "*" | "named", path: string }>();

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

    resolve<T extends T.Program | T.Statement[]>(astOrBody: T, options = { clearImportsBefore: true }): T {
        const body = Array.isArray(astOrBody) ? astOrBody : astOrBody.body;

        for (let i = body.length - 1; i >= 0; i--) {
            if (!T.isImportDeclaration(body[i])) continue;

            this.register(body[i] as T.ImportDeclaration);

            if (options.clearImportsBefore) body.splice(i, 1);
        }
        
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
}

export default ImportManager;