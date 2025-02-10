import { Plugin } from "esbuild";
import Config from "../../config";
import fs from 'node:fs/promises';
import * as T from '@babel/types';

import _traverse, { NodePath } from '@babel/traverse';
const traverse = typeof _traverse == 'object'
	? (_traverse as any).default
	: _traverse;

import _generate from '@babel/generator';
const generate = typeof _generate == 'object'
	? (_generate as any).default
	: _generate;

import { join as j } from 'path/posix';
import ImportManager from '../import-manager';
import { useErrors } from "../utils";
import parser from '@babel/parser';
import template from "@babel/template";
import esbuild from "esbuild";

const errors = useErrors({
    CANNOT_USE_CLASS: 'Cannot use class in command',
    CANNOT_EXPORT: 'Cannot export in command',
    CANNOT_USE_ENUM: 'Cannot declare enums in command'
});

class LoaderManager {
    pending?: Promise<unknown>;
    modules = new Array<T.Statement>;

    async readDir(path: string) {
        const dir = await fs.readdir(path, { withFileTypes: true });

        for (const dirent of dir) {
            const nextTarget = j(path, dirent.name);

            if (dirent.isFile()) {
                await this.readFile(nextTarget);
            }
            else {
                await this.readDir(nextTarget);
            }
        }
    }

    async readFile(path: string) {
        const data = await fs.readFile(path, 'utf-8');
        const ast = parser.parse(data, { sourceType: 'module', plugins: ['typescript', 'jsx', 'decorators'] });

        let processed!: T.Statement;
        traverse(ast, {
            Program: p => void (processed = this.transformContent(p))
        })


        this.modules.push(processed);
    }

    private transformContent(path: NodePath<T.Program>) {
        const statements = new Array<T.Statement>;

        for (const p of path.get('body')) {
            if (p.isImportDeclaration()) {
                const topLevelImport = ImportManager.fromTopLevel(p.node);
                const dynamicImport = topLevelImport.toDynamic();

                statements.push(dynamicImport.node);
            }
            else if (p.isClassDeclaration()) {
                throw errors.CANNOT_USE_CLASS;
            }
            else if (p.isExportSpecifier() || p.isExportNamedDeclaration()) {
                throw errors.CANNOT_EXPORT;
            }
            else if (p.isTSEnumDeclaration()) {
                throw errors.CANNOT_USE_ENUM;
            }
            else if (p.isExportDefaultDeclaration()) {
                statements.push(T.returnStatement(p.node.declaration as T.Expression))
            }
            else {
                statements.push(T.cloneNode(p.node, true));
            }
        }

        const buildAsyncWrapper = template.statement(`
            (async () => {
                %%body%%
            })().then(m => __module__ = { ...__module__, ...m });
        `);

        return buildAsyncWrapper({
            body: statements,
        });
    }

    async emitMerge(outDir: string) {
        const content = generate(T.program(this.modules)).code;
        const transformed = (await esbuild.transform(content, { loader: 'tsx' })).code;

        await fs.writeFile(j(outDir, 'commands.js'), transformed);
    }
}

export const loader = new LoaderManager();

export function CommandLoader(config: Config) {
    const plugin: Plugin = {
        name: "CommandsPlugin",
        setup(build) {
            build.onStart(async () => {
                await loader.readDir(j(config.entryPath, 'commands'));
                await loader.pending;
                await loader.emitMerge(config.buildPath);
            })
        },
    }

    return plugin;
}