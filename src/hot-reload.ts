import chokidar from 'chokidar';
import Compiler from './compiler';
import { createEnvFileOption } from './compiler/env';
import { join } from 'path';
import { spawn } from 'child_process';

function HotReload(compiler: Compiler) {
    console.log('enabled hot reload')
    
    const watcher = chokidar.watch(compiler.config.entryPath, {  
        persistent: true,  
        ignoreInitial: true,  
    });

    let isFirstRun = true;

    const run = async () => {
        if (isFirstRun) isFirstRun = false;
        else console.log('reloading');

        await compiler.run();

        const args = new Array<string>;

        const envFileOption = createEnvFileOption(process.cwd(), false);
        if(envFileOption) args.push(envFileOption);

        args.push(join(compiler.config.buildPath, 'index.js'));

        const child = spawn(process.argv[0], args, { stdio: 'inherit' });
        child.on('exit', (code) => process.exit(code ?? 0));
    };

    watcher.on('all', run);

    run();
}

export default HotReload;