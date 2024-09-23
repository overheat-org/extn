import { join as j } from 'path';

class Config {
    buildPath!: string;
    entryPath!: string;

    constructor(obj: Partial<Config>) {
        for(const key of Object.keys(obj)) {
            // @ts-ignore
            this[key] = obj[key];
        }
    }

    merge(obj: Partial<Config>) {
        for(const key of Object.keys(obj)) {
            // @ts-ignore
            this[key] = obj[key];
        }

        return this;
    }
    
    static getInstance(path: string, cwd = process.cwd()) {
        const defaultConfig = new Config({
            entryPath: j(cwd, 'src'),
            buildPath: j(cwd, '.flame')
        });

        const config = (() => {
            try {
                return require(path) as Config;
            }
            catch {
                return null;
            }
        })()

        if(config) return defaultConfig.merge(config);
        else return defaultConfig;
    }
}

export default Config;