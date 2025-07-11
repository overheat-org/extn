import * as T from '@babel/types'; 
import babel from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import CompilationHooks from './hooks/compilation';

/** @internal */
abstract class Analyzer {
	__analyze__(code: string) {
		return this.analyze?.(code);
	}

	abstract analyze(code: string): Promise<void> | void;

	protected parse(code: string) {
		const result = babel.parse(code, {
			tokens: true,
		});
		if (!result) throw new Error("Parse failed");

		result.errors?.forEach(console.error);

		let programPath!: NodePath
		
		traverse(result.program, {
			Program: p => void (programPath = p, p.stop())
		});

		return programPath;
	}
}

/** @internal */
class ComptimeApiAnalyzer extends Analyzer {
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