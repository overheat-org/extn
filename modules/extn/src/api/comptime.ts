import * as T from '@babel/types';
import { NodePath } from "@babel/traverse";
import { Evaluation } from "../evaluation/base";
import CompilationHooks from "../hooks/compilation";
import generate from '@babel/generator';

declare global {
    function comptime(callback: CompilationHooks): any
}

/** @internal */
export class ComptimeExprEvaluation extends Evaluation {
	analyze(code: string) {
		if(!code.includes('comptime')) return;

		const node = this.parse(code);
		const queue = new Array<NodePath<T.CallExpression>>();

		node.traverse({
			CallExpression: p => queue.push(p)
		});

		for(const p of queue) this.analyzeCallExpression(p);
	}

	builtinFunctionsMap = {
		comptime: this.analyzeComptimeExpression,
	}
	
	analyzeCallExpression(path: NodePath<T.CallExpression>) {
		const callee = path.get("callee");
		if(!callee.isIdentifier()) return;

		if(!(callee.node.name in this.builtinFunctionsMap)) return;
		this.builtinFunctionsMap[callee.node.name](path);
	}

	/**
	 * example:
	 * ```js
	 * comptime(compilation => {});
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
