import { join as j } from 'path';
import { readdirSync } from 'fs';

export const EnvName = {
    COMMON: '.env',
    PROD: '.env.production',
    DEV: '.env.development'
}

export function getEnvFilePath(cwd: string, dev: boolean) {
    const cwdFiles = readdirSync(cwd);
    const nameByMode = dev ? EnvName.DEV : EnvName.PROD;

    if(cwdFiles.includes(nameByMode)) {
        return j(cwd, nameByMode);
    }
    
    if(cwdFiles.includes(EnvName.COMMON)) {
        return j(cwd, EnvName.COMMON);
    }
}

export function createEnvFileOption(cwd: string, dev: boolean) {
    const path = getEnvFilePath(cwd, dev);

    if(path) return `--env-file=${path}`;
}

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            NODE_ENV: 'development' | 'production'
            TOKEN: string
            CLIENT_ID: string
            TEST_GUILD_ID?: string
            TEST_CHANNEL_ID?: string
            BUILD_PATH: string
        }
    }
}