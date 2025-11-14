import * as T from '@babel/types';
import { NodePath } from "@babel/traverse";
import _traverse from "@babel/traverse";
import { parse } from '@babel/parser';
import { FileTypes } from '@consts';
const traverse = ('default' in _traverse ? _traverse.default : _traverse) as typeof _traverse;

export interface ObserverContext<N = any> { path: string, node: NodePath<N>, type: FileTypes }

type CallbackObserver = (ctx: ObserverContext) => unknown;

export class NodeObserver {
	private map = new Map<T.Node['type'], CallbackObserver[]>;
	
	on(type: T.Node['type'], callback: CallbackObserver) {
		let result = this.map.has(type) 
			? this.map.get(type)!
			: [];

		result.push(callback);

		this.map.set(type, result);
	}

	async emit(path: string, node: NodePath, type: FileTypes) {
		if(!this.map.has(node.type)) return;
		
		for(const handler of this.map.get(node.type)!) {
			await handler({ path, node, type });
		}
	}
}

class Parser {
	private observers = new Set<NodeObserver>;

	observe() {
		const ob = new NodeObserver();

		this.observers.add(ob);

		return ob;
	}

	parseService(path: string, content: string) {
		return this.parse(FileTypes.Service, path, content);
	}
	
	parseCommand(path: string, content: string) {
		return this.parse(FileTypes.Command, path, content);
	}

	private async parse(type: FileTypes, path: string, content: string) {
		const tasks = new Array<Promise<void>>;

		const ast = parse(content, {
			sourceType: 'module',
			sourceFilename: path,
			plugins: ["decorators", "typescript", "jsx"],
			errorRecovery: true
		});

		const handleNode = async (node: NodePath) => {
			for(const observer of this.observers) {
				await observer.emit(path, node, type);
			}
		}

		traverse(ast, {
			enter: node => tasks.push(handleNode(node))
		});

		await Promise.all(tasks);
		
		return ast.program;
	}
}

export default Parser;