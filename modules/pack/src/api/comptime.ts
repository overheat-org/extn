import * as T from '@babel/types';
import { NodePath } from "@babel/traverse";
import { Evaluation } from "../evaluation/base";
import CompilationHooks from "../hooks/compilation";
import generate from '@babel/generator';

interface Comptime extends CompilationHooks {
	(callback: (hooks: CompilationHooks) => any): void;
}

declare global {
	const Comptime: Comptime;
}


/** @internal */
export class ComptimeExprEvaluation extends Evaluation {
	analyze(code: string) {
		if(!code.includes('Comptime')) return;

		const node = this.parse(code);
		const callExprQueue = new Array<NodePath<T.CallExpression>>();
		const memberExprQueue = new Array<NodePath<T.MemberExpression>>();

		node.traverse({
			CallExpression: p => callExprQueue.push(p),
			MemberExpression: p => memberExprQueue.push(p)
		});

		for(const p of callExprQueue) this.analyzeCallExpression(p);
		for(const p of memberExprQueue) this.analyzeMemberExpression(p);
	}

	analyzeCallExpression(path: NodePath<T.CallExpression>) {
		const callee = path.get("callee");
		if(!callee.isIdentifier()) return;

		if(callee.node.name != "Comptime") return;
		this.analyzeComptimeExpression(path);
	}

	/**
	 * example:
	 * ```js
	 * const BUILD_ID = comptime(compilation => compilation.env.BUILD_ID);
	 * // or
	 * const BUILD_ID = comptime.env.BUILD_ID
	 * ```
	 */
	analyzeComptimeExpression(path: NodePath<T.CallExpression>) {
		const [callbackNode] = path.get("arguments");
		if(!callbackNode.isArrowFunctionExpression()) return;

		const hooks = new CompilationHooks();

		const callback = new Function("hooks", `return (${
			generate(callbackNode.node).code
		})(hooks);`);

		callback(hooks);
	} 
}