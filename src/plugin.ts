import { Plugin } from 'rollup';
import { name, version } from '../package.json';

/** 
 * @internal 
 * 
 * Intercept transformation of code in vite process
 */
class BridgePlugin {
	name = name;
	version = version;

	transform(code: string, id: string) {
		
	}

	static setup() {
		const instance = new this;
		
		return {
			name,
			version,
			transform: instance.transform
		} satisfies Plugin;
	}

	private constructor() {}
}

export default BridgePlugin;