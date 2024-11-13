import { type RspackPluginInstance } from '@rspack/core';
import { join as j } from 'path';
import fs from 'fs';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { REGEX } from '../../lib/consts';

const PLUGIN_NAME = 'FlamecoreLoader';

export default (): RspackPluginInstance => ({
    apply(compiler) {
        const context = compiler.context;
        const injections = new Array<string>();

        compiler.hooks.beforeCompile.tap(PLUGIN_NAME, (params) => {
            const managersPath = j(context, 'managers');
            if (fs.existsSync(managersPath)) {
                processDirectory(managersPath);
            }

            const flameOhPath = j(context, 'node_modules/@flame-oh');
            if (fs.existsSync(flameOhPath)) {
                for (const dirent of fs.readdirSync(flameOhPath, { withFileTypes: true })) {
                    if (!dirent.isDirectory()) continue;
                    if (!REGEX.EXTERN_MANAGERS.test(`@flame-oh/${dirent.name}`)) continue;

                    processDirectory(j(flameOhPath, dirent.name));
                }
            }
        });

        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
            for(const i of injections) {
                compilation.fileDependencies.add(i);
            }
        });

        function processDirectory(dirPath: string) {
            for (const dirent of fs.readdirSync(dirPath, { withFileTypes: true })) {
                const filePath = j(dirPath, dirent.name);
                
                if (dirent.isDirectory()) {
                    const extensions = ['ts', 'tsx', 'zig', 'js', 'jsx'];
                    const indexPathPossibilities = extensions.map(e => j(filePath, `index.${e}`));
                    const indexPath = indexPathPossibilities.find(p => fs.existsSync(p));
                    
                    if (indexPath) {
                        const source = fs.readFileSync(indexPath, 'utf-8');
                        if (isInjection(source)) {
                            injections.push(indexPath);
                        }
                    }
                } else {
                    const source = fs.readFileSync(filePath, 'utf-8');
                    if (isInjection(source)) {
                        injections.push(filePath);
                    }
                }
            }
        }
    }
});

function isInjection(source: string) {
    let hasInjected = false;

    const ast = parser.parse(source, {
        sourceType: 'module',
        plugins: ['typescript', 'decorators', 'jsx' ]
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

            hasInjected = !!selectedClass.decorators?.find((d: any) => d.expression.type == 'Identifier' && d.expression.name == 'inject');
        }
    })

    return hasInjected;
}