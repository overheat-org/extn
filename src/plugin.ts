import { Plugin } from 'rollup';
import { name, version } from '../package.json';
import virtual from "./virtual";
import { Config } from './config';
import Transformer from './transformer';
import Graph from './graph';

// TODO: checar se o id é o path absoluto, se nao temos um bo

/** 
 * @internal 
 * 
 * Intercept transformation of code in vite process
 */
class BridgePlugin {
    name = name;
    version = version;

    private graph = new Graph();
    private transformer = new Transformer(this.graph);

    transform(code: string, id: string) {
        this.transformer.transform(id, code);
    }

    load(id: string) {
        const handler = virtual?.[id];

        return typeof handler == "function" 
            ? handler(this.config)
            : handler;
    }

    static setup(config: Config) {
        const instance = new this(config);

        return {
            name,
            version,
            transform: instance.transform,
            load: instance.load,
        } satisfies Plugin;
    }

    private constructor(private config: Config) { }
}

export default BridgePlugin;
