import { Plugin } from 'rollup';
import Compiler from './compiler';
import fs from 'fs/promises';

declare const __NAME__: string;
declare const __VERSION__: string;

/** 
 * @internal 
 * 
 * Intercept transformation of code in vite process
 */
function BridgePlugin(compiler: Compiler) {
	const { codegen, transformer } = compiler;
	
	return {
		name: __NAME__,
		version: __VERSION__,
		buildEnd() {
			codegen.emitCommands(this);
			codegen.emitManifest(this);
		},
		resolveId(id) {
			return id;
		},
		async load(id) {
			if(id == 'virtual:index') {
				return codegen.generateIndex();
			}
			
			return await transformer.transformModule(id);
		},
	} satisfies Plugin
}

export default BridgePlugin;
