import { join as j } from 'path/posix';
import { spawnSync } from 'child_process';
import { createEnvFileOption } from './env';
import Config from '../config';

const RUNTIME_PATH = process.argv[0];

function execute(config: Config, dev: boolean, ...args: string[]) {
    args ??= [];

    const envFileOption = createEnvFileOption(process.cwd(), dev);

    if(envFileOption) args.push(envFileOption);
    args.push(j(config.buildPath, 'index.js'));

    const childProcess = spawnSync(RUNTIME_PATH, args, { stdio: 'inherit' });

    if(childProcess.error) {
        throw childProcess.error;
    }
}

export default execute;