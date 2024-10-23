import { join as j } from 'path';
import { existsSync, readdirSync } from 'fs';

export const EnvName = {
    COMMON: '.env',
    PROD: '.env.production',
    DEV: '.env.development'
}

export function createEnvFileOption(cwd: string, dev: boolean) {
    const cwdFiles = readdirSync(cwd);
    const nameByMode = dev ? EnvName.DEV : EnvName.PROD;
    
    if(cwdFiles.includes(nameByMode)) {
        return `--env-file=${j(cwd, nameByMode)}`
    }

    if(cwdFiles.includes(EnvName.COMMON)) {
        return `--env-file=${j(cwd, EnvName.COMMON)}`
    }
}