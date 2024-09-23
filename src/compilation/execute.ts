import { join as j } from 'path';
import { spawnSync } from 'child_process';
import { createEnvFileOption } from '../env';

const RUNTIME_PATH = process.argv[0];

function execute(cwd: string, dev: boolean) {
    const args = new Array<string>;
        
    const envFileOption = createEnvFileOption(cwd, dev);

    if(envFileOption) args.push(envFileOption);
    args.push(j(cwd, '.flame', 'main.js'));
    
    const childProcess = spawnSync(RUNTIME_PATH, args, { stdio: 'inherit' });

    if(childProcess.error) {
        throw childProcess.error;
    }
}

export default execute;