import { NodePath } from '@babel/traverse';
import * as T from '@babel/types';

type CallbackObserver = (path: string, node: NodePath<any>) => unknown;

export class NodeObserver {
	private map = new Map<T.Node['type'], CallbackObserver[]>;
	
	on(type: T.Node['type'], callback: CallbackObserver) {
		let result = this.map.has(type) 
			? this.map.get(type)!
			: [];

		result.push(callback);

		this.map.set(type, result);
	}

	async emit(path: string, node: NodePath) {
		if(!this.map.has(node.type)) return;
		
		for(const handler of this.map.get(node.type)!) {
			await handler(path, node);
		}
	}
}

class NodeChannels {
	commands = new NodeObserver();
	services = new NodeObserver();
}

export default NodeChannels;