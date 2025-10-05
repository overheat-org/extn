import { Plugin } from 'rollup';
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
		transform(code, id) {
			transformer.transformModule(id, code);
		},
		resolveId(id) {
			if(id.startsWith("virtual:")) return id;
		},
		load(id) {
			if(!id.startsWith('virtual:')) return;
			
			return codegen.generate(id.split(':')[1]);
		},
	} satisfies Plugin
}

export default BridgePlugin;
