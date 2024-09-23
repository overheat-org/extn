import { type RspackPluginInstance } from '@rspack/core';
import { join as j } from 'path';
import fs from 'fs';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

const PLUGIN_NAME = 'FlamecoreLoader';

export default (): RspackPluginInstance => ({
    apply(compiler) {
        const context = compiler.context;

        const injections = new Array<string>

        compiler.hooks.beforeCompile.tap(PLUGIN_NAME, (params) => {
            const managersPath = j(context, 'managers');

            for (const filename of fs.readdirSync(managersPath)) {
                const source = fs.readFileSync(j(managersPath, filename), 'utf-8');

                if(isInjection(source)) {
                    injections.push(j(managersPath, filename));
                }
            }
        });

        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
            for(const i of injections) {
                compilation.fileDependencies.add(i);
            }
        });
    }
});

function isInjection(source: string) {
    let hasInjected = false;

    const ast = parser.parse(source, {
        sourceType: 'module',
        plugins: ['typescript', 'decorators']
    });

    const classes = new Array<any>;

    traverse(ast, {
        ClassDeclaration(path) {
            classes.push(path.node);
        },
        ExportDefaultDeclaration(path) {
            const declaration = path.node.declaration;

            if (declaration.type != 'Identifier') {
                throw new Error(`Expected class declaration, found "${declaration.type}"`);
            }

            const selectedClass = classes.find(c => declaration.name == c.id.name);

            hasInjected = !!selectedClass.decorators?.find((d: any) => d.expression.type == 'Identifier' && d.expression.name == 'Inject');
        }
    })

    return hasInjected;
}
