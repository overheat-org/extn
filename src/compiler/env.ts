import { join as j } from 'path/posix';
import { readdirSync, readFileSync } from 'fs';
import { parse } from 'dotenv';
import { env } from 'process';

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

const ENV_REGEX = /^\.env(?:\.(development|production))?$/;

export function getEnvFile(cwd = process.cwd()) {
	const envPath = readdirSync(cwd)
		.find(d => d.match(ENV_REGEX)?.[1] == process.env.NODE_ENV)
		?? ".env";

	try {
		const file = readFileSync(j(cwd, envPath));
		return parse(file);
	} catch {
		return {}
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