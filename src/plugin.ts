import { Plugin } from 'rollup';
import virtual from "./virtual";
import Compiler from '.';

declare const __NAME__: string;
declare const __VERSION__: string;

/** 
 * @internal 
 * 
 * Intercept transformation of code in vite process
 */
function BridgePlugin(compiler: Compiler) {
	const { codegen, transformer, config } = compiler;
	
	return {
		name: __NAME__,
		version: __VERSION__,
		buildEnd(options) {
			codegen.generate(this);
		},
		transform(code, id) {
			transformer.transformModule(id, code);
		},
		load(id) {
			console.log("LOAD", id);
			const handler = virtual?.[`virtual:${id}`];

			return typeof handler == "function" 
				? handler({config})
				: handler;
		},
	} satisfies Plugin
}

export default BridgePlugin;
