import { Plugin } from 'rollup';
import Compiler from './compiler';

declare const __NAME__: string;
declare const __VERSION__: string;

/**
 * Intercept transformation of code in vite process
 */
function BridgePlugin(compiler: Compiler) {
	const { codegen } = compiler;
	
	return {
		name: __NAME__,
		version: __VERSION__,
		buildEnd() {
			codegen.emitCommands(this);
		},
		resolveId(id) {
			return id;
		},
		async load(id) {
			switch (id) {
				case 'virtual:index': return codegen.generateIndex();
				case 'virtual:manifest': return codegen.generateManifest();
				// default: {
				// 	return await transformer.transformModule(id);
				// }
			}
		},
	} satisfies Plugin
}

export default BridgePlugin;
