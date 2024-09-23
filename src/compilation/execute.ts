import { join as j } from 'path';
import { spawnSync } from 'child_process';
import { createEnvFileOption } from '../env';
import Config from '../config';

const RUNTIME_PATH = process.argv[0];

function execute(config: Config, dev: boolean) {
    const args = new Array<string>;
        
    const envFileOption = createEnvFileOption(process.cwd(), dev);

    if(envFileOption) args.push(envFileOption);
    args.push(j(config.buildPath, 'main.js'));
    
    const childProcess = spawnSync(RUNTIME_PATH, args, { stdio: 'inherit' });

    if(childProcess.error) {
        throw childProcess.error;
    }
}

export default execute;