import { Plugin } from 'rollup';
import { name, version } from '../package.json';
import Evaluator from './evaluation/manager';

/** 
 * @internal 
 * 
 * Intercept transformation of code in vite process
 */
class BridgePlugin {
	name = name;
	version = version;
    evaluator = new Evaluator();
    
	transform(code: string, id: string) {
        this.evaluator.evaluate(code);
	}

	static setup() {
		const instance = new this;
		
		return {
			name,
			version,
			transform: instance.transform,
		} satisfies Plugin;
	}

	private constructor() {}
}

export default BridgePlugin;
