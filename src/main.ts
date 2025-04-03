import { extname, join, resolve } from 'path';
import Config from './config';
import { regex } from './consts';
import { readdirSync } from 'fs';
import { readFile } from 'fs/promises';
import HotReload from './hot-reload';
import Compiler from './compiler';
import { spawn } from 'child_process';
import { createEnvFileOption } from './compiler/env';

(async () => {
    let [runtime, _, path, ...args] = process.argv;
    
    if(path) path = resolve(process.cwd(), path);

    let config: Config;
    {
        const filename = readdirSync(path).find(p => regex.CONFIG_PATH.test(p));

        if(!filename) config = new Config({ cwd: path }); 
        else {
            const extension = extname(filename);

            if(extension == '.js') {
                const module = await import(`file://${resolve(path, filename)}`);
                config = new Config({ cwd: path, ...module.default });
            } else {
                config = new Config({
                    cwd: path,
                    ...JSON.parse(await readFile(join(path, filename), 'utf-8'))
                });
            }
        }
    }

    const compiler = new Compiler(config);

    if(args.includes('--hot')) {
        HotReload(compiler);
    }
    else {
        await compiler.run();
        
        const args = new Array<string>;

        const envFileOption = createEnvFileOption(process.cwd(), false);
        if(envFileOption) args.push(envFileOption);

        args.push(join(config.buildPath, 'index.js'));

        const child = spawn(runtime, args, { stdio: 'inherit' });
        child.on('exit', (code) => process.exit(code ?? 0));
    }
})();