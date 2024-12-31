import fs from 'fs';
import * as T from '@babel/types';
import traverse, { NodePath } from "@babel/traverse";
import Config from '../config';
import { relative, dirname, basename, join as j } from 'path/posix';
import { isAbsolute } from 'path';
import { findNodeModulesDir } from '../utils';

const FLAME_MANAGER_REGEX = /^@flame-oh\/manager\-/;
const RELATIVE_PATH_REGEX = /^(\.\/|\.\.\/)/;

class ImportResolver {
    constructor(private dirpath: string, private config: Config) {}

    private nodeModulesDir?: string;
    
    parseAliases(filePath: string, target: string) {
        const tsConfigPath = j(this.config.cwd, 'tsconfig.json');
        
        const tsConfig = fs.readFileSync(tsConfigPath, 'utf-8');
        const { compilerOptions: { paths } } = JSON.parse(tsConfig) as { compilerOptions: { paths: { [k: string]: string[] } } };
    
        for (const alias in paths) {
            const aliasPattern = alias.replace('/*', '');
            if (filePath.startsWith(aliasPattern)) {
                const [firstMatch] = paths[alias];
                const resolvedPath = firstMatch.replace('/*', filePath.slice(aliasPattern.length));
                return j(this.config.cwd, resolvedPath);
            }
        }
    }

    parse(importPath: string) {
        let resumedCurrentPath = this.dirpath.replace(this.config.entryPath, '');
        if(/\/?commands/.test(resumedCurrentPath)) {
            resumedCurrentPath = "";
        }

        const buildCurrentPath = j(this.config.buildPath, resumedCurrentPath);

        let absolutePath: string | undefined;
        
        if(isAbsolute(importPath)) {
            absolutePath = importPath;
        }

        if(RELATIVE_PATH_REGEX.test(importPath)) {
            absolutePath = j(this.dirpath, importPath);
        }

        if(FLAME_MANAGER_REGEX.test(importPath)) {
            absolutePath = j(
                this.nodeModulesDir ??= findNodeModulesDir(this.config.cwd), 
                importPath.replace(FLAME_MANAGER_REGEX, 'managers/')
            );
        }

        if(!absolutePath) {
            absolutePath = this.parseAliases(importPath, buildCurrentPath);
        }

        if(absolutePath) {
            const buildAbsolutePath = absolutePath.replace(this.config.entryPath, this.config.buildPath);
            let path = relative(buildCurrentPath, buildAbsolutePath);

            if(!RELATIVE_PATH_REGEX.test(buildAbsolutePath)) {
                path = `./${path}`;
            }

            if(this.isDir(buildCurrentPath)) {
                importPath = j(path, 'index.js');
            }
            else {
                importPath = this.ensureExt(path);
            }
        }

        return importPath;
    }

    transform(path: NodePath<T.ImportDeclaration>) {
        const source = path.node.source.value;
    
        const defaultSpecifiers = new Array<T.ImportDefaultSpecifier>;
        const namespaceSpecifiers = new Array<T.ImportNamespaceSpecifier>;
        const namedSpecifiers = new Array<T.ImportSpecifier>;
    
        for (const specifier of path.node.specifiers) {
            if (T.isImportDefaultSpecifier(specifier)) {
                defaultSpecifiers.push(specifier);
            } else if (T.isImportNamespaceSpecifier(specifier)) {
                namespaceSpecifiers.push(specifier);
            } else if (T.isImportSpecifier(specifier)) {
                namedSpecifiers.push(specifier);
            }
        }
    
        const statements = new Array<T.Statement>;

        if (defaultSpecifiers.length > 0) {
            for (const specifier of defaultSpecifiers) {
                const modName = specifier.local.name;
                const stmt = T.variableDeclaration('const', [
                    T.variableDeclarator(
                        T.identifier(modName),
                        T.memberExpression(
                            T.awaitExpression(T.callExpression(T.import(), [T.stringLiteral(source)])),
                            T.identifier('default')
                        )
                    )
                ]);
                statements.push(stmt);
            }
        }

        if (namespaceSpecifiers.length > 0) {
            for (const specifier of namespaceSpecifiers) {
                const modName = specifier.local.name;
                const stmt = T.variableDeclaration('const', [
                    T.variableDeclarator(
                        T.identifier(modName),
                        T.awaitExpression(T.callExpression(T.import(), [T.stringLiteral(source)]))
                    )
                ]);
                statements.push(stmt);
            }
        }

        if (namedSpecifiers.length > 0) {
            const props = namedSpecifiers.map(specifier =>
                T.objectProperty(
                    T.identifier((specifier.imported as T.Identifier).name),
                    T.identifier(specifier.local.name)
                )
            );
            const stmt = T.variableDeclaration('const', [
                T.variableDeclarator(
                    T.objectPattern(props),
                    T.awaitExpression(T.callExpression(T.import(), [T.stringLiteral(source)]))
                )
            ]);
            statements.push(stmt);
        }

        path.replaceWithMultiple(statements);

        return statements;
    }

    isDir(absolutePath: string) {
        try {
            const dir = dirname(j(absolutePath, this.config.buildPath));
            const dir2 = dirname(j(findNodeModulesDir(this.config.cwd), this.config.buildPath));

            const filesInDir = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
            const filesInDir2 = fs.existsSync(dir2) ? fs.readdirSync(dir2) : [];

            const path = [...filesInDir, ...filesInDir2].find(d => d.startsWith(basename(absolutePath)));
            if (!path) return;

            const fullPath = j(dir, path);
            return fs.existsSync(fullPath) && !fs.statSync(fullPath).isFile();
        } catch {
            return false;
        }
    }

    ensureExt(path: string) {
        return path.replace(/\.\w+$/, '.js') + (!/\.\w+$/.test(path) ? '.js' : '');
    }

    resolve(path: NodePath<T.ImportDeclaration>) {
        const source = path.get('source');

        source.set('value', this.parse(source.node.value));
    }

    private collected: Record<string, Array<T.ImportSpecifier | T.ImportDefaultSpecifier | T.ImportNamespaceSpecifier>> = {}
    collect(path: NodePath<T.ImportDeclaration>) {
        this.resolve(path);
    
        const source = path.node.source.value;
        if (!this.collected[source]) {
            this.collected[source] = [];
        }
    
        const uniqueSpecifiers = path.node.specifiers.filter(
            (specifier) => !this.collected[source].includes(specifier)
        );
    
        this.collected[source].push(...uniqueSpecifiers);

        path.remove();
    }

    insert(ast?: T.Node) {
        const body = T.isFile(ast)
            ? ast.program.body
            : T.isProgram(ast)
                ? ast.body
                : [];

        if(!body) throw new Error('Invalid AST');

        Object.entries(this.collected).forEach(([source, specifiers]) => {
            const importDeclaration = T.importDeclaration(
                specifiers,
                T.stringLiteral(source)
            );

            body.push(importDeclaration);
        });

        return body; 
    }

    traverse(node: T.Node) {
        traverse(node, {
            ImportDeclaration: this.resolve
        });
    }
}

export default ImportResolver;