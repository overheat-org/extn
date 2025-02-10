// TODO: fix type errors

import { NodePath } from '@babel/traverse';
import * as T from '@babel/types';

const EXPECTED_DYNAMIC_IMPORT = new Error('Expected a dynamic import');
const EXPECTED_TOP_LEVEL_IMPORT = new Error('Expected a top level import');

export class TopLevelImport {
    source!: T.StringLiteral;
    attributes?: T.ImportDeclaration['attributes']
    specifiers?: T.ImportDeclaration['specifiers']

    get node() {
        // TODO: attributes arent passing here
        return T.importDeclaration(this.specifiers ?? [], this.source);
    }

    toDynamic() {
        const dynamic = new DynamicImport();

        dynamic.source = this.source;

        const specifiers = new Array;
        const acc = new Array<T.ObjectProperty>;

        for(const s of this.specifiers ?? []) {
            if(s.type == 'ImportNamespaceSpecifier' || s.type == 'ImportDefaultSpecifier') {
                specifiers.push(s.local);
            }

            if(s.type == 'ImportSpecifier') {
                acc.push(T.objectProperty(s.local, s.imported as T.Identifier));
            }
        }

        if (acc.length > 0) {
            specifiers.push(T.objectPattern(acc));
        }

        dynamic.specifiers = specifiers;

        return dynamic;
    }

    constructor(node?: T.ImportDeclaration) {
        if(node) {
            this.source = node.source;
            this.attributes = node.attributes;
            this.specifiers = node.specifiers;
        }
    }
}

export class DynamicImport {
    source!: T.Expression;
    specifiers?: T.LVal[];
    options?: T.Expression | null;
    
    get node() {
        const importExpr = T.awaitExpression(T.importExpression(this.source, this.options));

        if(this.specifiers) {
            const decl: T.VariableDeclarator[] = [
                T.variableDeclarator(
                    this.specifiers[0], 
                    importExpr
                ),
            ];

            if(this.specifiers.length > 1) decl.push(
                T.variableDeclarator(
                    this.specifiers[1],
                    this.specifiers[0] as T.Identifier
                )
            );

            return T.variableDeclaration('const', decl);
        }

        return importExpr;
    }

    toTopLevel() {
        const topLevel = new TopLevelImport();

        topLevel.source = this.source as T.StringLiteral;

        for(const s of this.specifiers ?? []) {
            
        }

        return topLevel;
    }

    constructor(node?: T.VariableDeclaration) {
        if(node) {
            for(const d of node.declarations) {
                (this.specifiers ??= []).push(d.id);
            }
            
            this.source = ((node.declarations[0].init as T.AwaitExpression).argument as T.ImportExpression).source;
        }
    }
}

class ImportManager {
    static fromDynamic(node: T.Node) {
        if (!T.isVariableDeclaration(node) || !T.isImportExpression(node.declarations[0].init)) throw EXPECTED_DYNAMIC_IMPORT;

        return new DynamicImport(node);
    }

    static fromTopLevel(node: T.Node) {
        if (!T.isImportDeclaration(node)) throw EXPECTED_DYNAMIC_IMPORT;

        return new TopLevelImport(node);
    }

    static from(target: T.Node | NodePath<T.Node>) {
        const node = target instanceof NodePath
            ? target.node
            : target;

        if (T.isImportDeclaration(node)) {
            return this.fromTopLevel(node);
        }

        if (T.isImportExpression(node)) {
            return this.fromDynamic(node);
        }
    }
}

export default ImportManager;