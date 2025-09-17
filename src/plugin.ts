import { Plugin } from 'rollup';
import { name, version } from '../package.json';
import virtual from "./virtual";
import Compiler from '.';

/** 
 * @internal 
 * 
 * Intercept transformation of code in vite process
 */
function BridgePlugin(compiler: Compiler) {
	const { codegen, transformer, config } = compiler;
	
	return {
		name,
		version,
		buildEnd(options) {
			codegen.generate(this);
		},
		transform(code, id) {
			transformer.transformModule(id, code);
		},
		load(id) {
			const handler = virtual?.[id];

			return typeof handler == "function" 
				? handler(config)
				: handler;
		},
	} satisfies Plugin
}

export default BridgePlugin;
