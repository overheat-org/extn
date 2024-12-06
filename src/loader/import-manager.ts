import p from 'path/posix';
import * as T from '@babel/types';
import { parse } from '@babel/parser';

const RELATIVE_PATH_REGEX = /^(?:\.\.?\/)[^\s]*$/;

class ImportManager {
    imports = new Map<string, Set<{ name: string, type: 'default' | '*' | 'named' }>>();
    resolved = new Set<{ name: string; type: "default" | "*" | "named", path: string }>();
    from?: string
    to?: string

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
                
                if(RELATIVE_PATH_REGEX.test(importNode.source.value)) {
                    if(options.path && this.from && this.to) {
                        const currentFilePath = this.to;

                        // TODO: adicionar index se for diretorio

                        const pathWithEntry = p.join(options.path, importNode.source.value);

                        let pathWithBuild = pathWithEntry.replace(this.from, this.to);

                        importNode.source.value = p.relative(currentFilePath, pathWithBuild);
                        if(!importNode.source.value.startsWith('.')) importNode.source.value = `./${importNode.source.value}`; 
                    }

                    importNode.source.value = changeFileExtension(importNode.source.value, 'js')
                };

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
        this.from = options?.from;
        this.to = options?.to;
    }
}

function changeFileExtension(path: string, newExtension: string): string {
    const pathWithoutExtension = path.replace(/\.[^/.]+$/, '');
    
    return `${pathWithoutExtension}.${newExtension.replace(/^\./, '')}`;
  }

export default ImportManager;