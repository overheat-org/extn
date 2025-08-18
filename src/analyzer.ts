import { NodePath } from "@babel/traverse";
import { Decorator } from "./definitions/base";
import Graph from "./graph";
import Transformer from "./transformer";
import * as T from "@babel/types";

abstract class AnalyzerStep {
	abstract analyze(id: string, code: string): void;

	protected async parse(code: string) {
		return {} as NodePath<T.Program>;
	}

	constructor(
		protected transformer: Transformer, 
		protected graph: Graph
	) {}
}

class DecoratorAnalyzer extends AnalyzerStep {
	CONTENT_REGEX = /@[a-z][a-zA-Z]+(?=\s)/;

	async analyze(id: string, code: string) {
		if(!this.CONTENT_REGEX.test(code)) return;

		const program = await this.parse(code);

		program.traverse({
			Decorator: async path => {
				const expr = path.get('expression');

				let name!: string;
				let property: NodePath<T.MemberExpression['property']> | undefined;
				let params: Array<NodePath<T.CallExpression['arguments'][number]>>;

				const typeMap = {
					Identifier(path: NodePath<T.Identifier>) {
						name = path.get('name');
					},
					MemberExpression(path: NodePath<T.MemberExpression>) {
						const object = path.get('object');

						property = path.get('property');

						typeMap[object.node.type].call(this, object);
					},
					CallExpression(path: NodePath<T.CallExpression>) {
						const callee = path.get('callee');

						params = path.get("arguments");

						typeMap[callee.node.type].call(this, callee);
					}
				}

				let decorator: Decorator | undefined = undefined;
				for (const d of Object.values(decorators)) {
					if (property) {
						if (!(d instanceof Container) || d.name !== this.resolveName(property)) continue;

						decorator = d.decorators[name];
					}

					if (!(d instanceof Decorator) || d.name !== name) continue;

					decorator = d;
				}

				if (!decorator) return;

				let params = new Array;
				const expr = path.get('expression')

				if (expr.isCallExpression()) {

				}
				decorator.transform.call(this, {
					module: this.module,
					target: path.parentPath,
					params: path.get('expression'),
					path,
				});
			}
		});
	}

	analyzeDecorator(path: NodePath<T.Decorator>) {
		const target = path.parentPath;
		let name!: string;
		let property: NodePath<T.MemberExpression['property']> | undefined;
		let params = new Array<NodePath<T.CallExpression['arguments'][number]>>;

		const typeMap = {
			Identifier(path: NodePath<T.Identifier>) {
				name = path.get('name');
			},
			MemberExpression(path: NodePath<T.MemberExpression>) {
				const object = path.get('object');

				property = path.get('property');

				typeMap[object.node.type](this);
			},
			CallExpression(path: NodePath<T.CallExpression>) {
				const callee = path.get('callee');

				params = path.get("arguments");

				typeMap[callee.node.type](this);
			}
		}
		
		return { name, target, property, params }
	}
}

class CommandAnalyzer extends AnalyzerStep {
	PATH_REGEX = /^\$[A-Za-z][\w-]*\.(t|j)sx?$/;
	
	analyze(id: string, code: string) {
		if(!this.PATH_REGEX.test(id)) return;

		const command = this.transformer.transformCommand(code);
		this.graph.addCommand(command);
	}
}

class Analyzer {
	private steps: AnalyzerStep[];

	analyzeModule(id: string, code: string) {
		this.steps.forEach(step => step.analyze(id, code));
	}

	async analyzeClassDependencies(node: NodePath) {}

	constructor(transformer: Transformer, graph: Graph) {
		this.steps = [
			new DecoratorAnalyzer(transformer, graph),
			new CommandAnalyzer(transformer, graph),
		];
	}
}

export default Analyzer;
