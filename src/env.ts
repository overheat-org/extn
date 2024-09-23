import { join as j } from 'path';
import { existsSync } from 'fs';

export const EnvName = {
    COMMON: '.env',
    PROD: '.env.production',
    DEV: '.env.development'
}

export function createEnvFileOption(cwd: string, dev: boolean) {
    const nameByMode = dev ? EnvName.DEV : EnvName.PROD;
    
    if(existsSync(j(cwd, nameByMode))) {
        return `--env-file=${j(cwd, nameByMode)}`
    }

    if(existsSync(j(cwd, EnvName.COMMON))) {
        return `--env-file=${j(cwd, EnvName.COMMON)}`
    }
}