class ImportRegistry {
    config: Config;
    imports = new Map<string, Set<{ name: string, type: 'default' | '*' | 'named' }>>();
    resolved = new Set<{ name: string; type: "default" | "*" | "named", path: string }>();
    private pathAliases: Record<string, string> = {}
    
    evaluate(path: string) {
        // todos os paths devem ter seu inicio substituido por path.replace(this.from, this.to)
        // commands path devem remover seu path depois de commands tipo "C://.../commands/myCommand.tsx" to "C://.../commands"
        
        path = path.replace(this.from!, '');
        
        
    }
    // Os arquivos que tem importações, serão resolvidas, e serão salvas somente a diferença entre entryPath.
    
    register(
        node: T.ImportDeclaration,
        options: { clearImportsBefore?: boolean, path?: string } = { clearImportsBefore: false }
    ) {
        if (options.path) {
            const path = options.path;

            options.path = options.path.replace(this.from!, this.to!);

            console.log(options.path)
        }
        
        if (this.to) {
            let resolvedPath = this.resolveAlias(node.source.value, this.to);

            if(RELATIVE_PATH_REGEX.test(resolvedPath) && this.from) {
                resolvedPath = p.join(this.from, resolvedPath);
            }

            if (FLAME_MANAGER_REGEX.test(resolvedPath)) {
                resolvedPath = resolvedPath.replace(FLAME_MANAGER_REGEX, p.join(this.from!, '/managers'));
            }

            if(pathAll.isAbsolute(resolvedPath)) {
                const pathToBuild = resolvedPath.replace(this.from!, this.to);

                // console.log({path: options.path})
                
                resolvedPath = p.relative(options.path ?? this.to, pathToBuild);
                
                if(!resolvedPath.startsWith('.')) {
                    resolvedPath = changeFileExtension(`./${resolvedPath}`, 'js');
                }

                // console.log({resolvedPath})
            }


            node.source.value = resolvedPath;
        }
        
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

            this.pathAliases[cleanAlias] = p.resolve(
                absoluteBaseUrl,
                cleanPath
            ).replace(/\\/g, '/');
        }
    }

    private resolveAlias(importPath: string, currentFilePath: string): string {
        for (const [alias, fullPath] of Object.entries(this.pathAliases)) {
            if (importPath.startsWith(`${alias}/`)) {
                const relativePath = importPath.replace(`${alias}/`, '');
                const resolvedPath = p.resolve(fullPath, relativePath);
                return p.relative(p.dirname(currentFilePath), resolvedPath).replace(/\\/g, '/');
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

                this.register(importNode, options);
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

    constructor(private resolver: ImportResolver, private type?: string) {
        this.config = resolver.config;
        this.loadTsConfigAliases(this.config.cwd);
    }
}