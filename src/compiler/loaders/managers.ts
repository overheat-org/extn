import fs from "fs/promises";
import { BuildOptions, Plugin } from "esbuild";
import Config from "../../config";
import { join as j } from 'path/posix';
import esbuild from "esbuild";
import ComptimeDecoratorsPlugin from "@meta-oh/comptime-decorators";
import { FLAME_MANAGER_REGEX } from "../../consts";
import { findNodeModulesDir } from "../utils";
import decorators from '../decorators';
import { glob } from 'glob';
import { loader as CommandLoader } from "./commands";

const DEFAULT_ESBUILD_CONFIG: BuildOptions = {
    plugins: [
        ComptimeDecoratorsPlugin(decorators, { sourceType: 'module', plugins: ['decorators', 'typescript', 'jsx'] })
    ]
}

const isRootPath = (path: string) => /^\.?\/?[^/]+$/.test(path);

export function ManagerLoader(config: Config) {
    const OUT_MANAGERS = j(config.buildPath, 'managers');

    const handleStart = async () => {
        const managersPath = j(config.entryPath, 'managers');
        const waiting = new Array<Promise<unknown>>;

        for(const dirent of await fs.readdir(managersPath, { withFileTypes: true })) {
            waiting.push(
                esbuild.build({
                    ...DEFAULT_ESBUILD_CONFIG,
                    entryPoints: [dirent.isFile()
                        ? j(managersPath, dirent.name)
                        : j(managersPath, dirent.name, 'index')
                    ],
                    outdir: OUT_MANAGERS,
                })
            );
        }

        const flamePath = findNodeModulesDir(config.cwd, '@flame-oh');

        for(const dirent of await fs.readdir(flamePath, { withFileTypes: true })) {
            const path = j(dirent.parentPath, dirent.name);
            
            if(!FLAME_MANAGER_REGEX.test(path)) continue;

            const name = dirent.name.split('-')[1];

            try {
                const { main } = JSON.parse(await fs.readFile(j(path, 'package.json'), 'utf-8'));

                let outConfig: BuildOptions = {};

                if(isRootPath(main)) outConfig = {
                    outfile: j(OUT_MANAGERS, `${name}.js`)
                }
                else {
                    outConfig = {
                        outdir: j(OUT_MANAGERS, name)
                    }

                    const { resolve, promise } = Promise.withResolvers<void>();

                    CommandLoader.pending = promise;
                    
                    glob(j(path, '/**/command.{ts,js,tsx,jsx}')).then(paths => {
                        console.log({paths})
                        for(const p of paths) CommandLoader.readFile(p);
                        
                        resolve();
                    });
                }

                const entrypointPath = j(path, main);

                waiting.push(
                    esbuild.build({
                        ...DEFAULT_ESBUILD_CONFIG,
                        entryPoints: [entrypointPath],
                        ...outConfig,
                    })
                );
            } catch {
                throw new Error(`Cannot find package.json of extern manager '${name}'.`);
            }
        }

        await Promise.all(waiting);
    }
 
    const plugin: Plugin = {
        name: "ManagerPlugin",
        setup(build) {
            build.onStart(handleStart);
        },
    }

    return plugin;
}