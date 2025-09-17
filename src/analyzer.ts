import traverse, { NodePath } from "@babel/traverse";
import Graph from "./graph";
import Transformer from "./transformer";
import * as T from "@babel/types";
import { FlameError, getErrorLocation } from "./reporter";
import { parse } from '@babel/parser';

class DecoratorAnalyzer {
	constructor(
		private transformer: Transformer
	) {}
	
	CONTENT_REGEX = /@[a-z][a-zA-Z]+(?=\s)/;

	async analyze(id: string, code: string) {
		if (!this.CONTENT_REGEX.test(code)) return;

		const program = parseContent(code);

		program.traverse({
			Decorator: async path => this.analyzeDecorator(id, path)
		});
	}

	analyzeDecorator(id: string, path: NodePath<T.Decorator>) {
		const target = path.parentPath;
		let name!: string | string[];
		let params = new Array<NodePath<T.CallExpression['arguments'][number]>>;

		const typeMap = {
			Identifier(path: NodePath<T.Identifier>) {
				const _name = path.get("name");

				if (Array.isArray(name)) {
					name.push(_name);
				}
				else if (typeof name == 'string') {
					name = [name, _name];
				}
				else {
					name = _name;
				}
			},
			MemberExpression(path: NodePath<T.MemberExpression>) {
				const object = path.get('object');

				typeMap[object.node.type](this);
			},
			CallExpression(path: NodePath<T.CallExpression>) {
				const callee = path.get('callee');

				params = path.get("arguments");

				typeMap[callee.node.type](this);
			}
		}

		const targetMap = {
			ClassDeclaration: "class",
			ClassMethod: "method",
			Identifier: "param"
		} as { [k in T.Node['type']]: string }

		this.transformer.transformDecorator({
			name,
			targetNode: target,
			params,
			node: path,
			kind: targetMap[target.node.type]
		})
	}
}

class CommandAnalyzer {
	constructor(
		private graph: Graph,
		private transformer: Transformer
	) {}

	COMMAND_FILE_REGEX = /^\$[A-Za-z][\w-]*\.(t|j)sx?$/;
	COMMAND_DIR_REGEX = /commands\/[A-Za-z]\.(t|j)sx?$/;

	async analyze(id: string, code: string) {
		if (
			!this.COMMAND_DIR_REGEX.test(id) &&
			!this.COMMAND_FILE_REGEX.test(id)
		) return;

		const ast = parseContent(code);
		const command = this.transformer.transformCommand(id, ast);
		this.graph.addCommand(command);
	}
}

class DependencyAnalyzer {
	constructor(private graph: Graph) {}

    analyze(id: string, node: NodePath<T.ClassDeclaration>) {
		return this.analyzeClass(id, node);
	}

    analyzeClass(id: string, node: NodePath<T.ClassDeclaration>) {
        const classBody = node.get('body').get('body');
        const constructor = classBody.find(m => m.isClassMethod() && m.node.kind === "constructor");

        if (!constructor) {
            return [];
        }

        return this.analyzeConstructor(id, constructor as NodePath<T.ClassMethod>);
    }

    analyzeConstructor(id: string, node: NodePath<T.ClassMethod>) {
        const params = node.get('params');

        return Promise.all(params.map(p => {
            if (!p.isTSParameterProperty()) {
                throw new FlameError("This parameter cannot be injectable", getErrorLocation(node, id));
            }

            return this.analyzeParameter(id, p);
        }));
    }

    async analyzeParameter(id: string, node: NodePath<T.TSParameterProperty>) {
        const parameter = node.get("parameter");
        const typeAnnotation = parameter.get("typeAnnotation");

        if (!typeAnnotation.isTSTypeAnnotation()) {
            throw new FlameError("Expected a type annotation for injectable parameter", getErrorLocation(node, id));
        }

        const typeRef = typeAnnotation.get("typeAnnotation");

        if (!typeRef.isTSTypeReference()) {
            throw new FlameError("Expected a injectable type reference", getErrorLocation(node, id));
        }

		return this.graph.resolveSymbol(typeRef);
    }
}


/** @internal */
class Analyzer {
	private commandAnalyzer: CommandAnalyzer;
	private decoratorAnalyzer: DecoratorAnalyzer;
	private dependencyAnalyzer: DependencyAnalyzer;

	async analyzeModule(id: string, code: string) {
		await Promise.all([
			this.commandAnalyzer.analyze(id, code),
			this.decoratorAnalyzer.analyze(id, code)
		]);
	}

	async analyzeClassDependencies(id: string, node: NodePath<T.ClassDeclaration>) {
		return await this.dependencyAnalyzer.analyze(id, node);
	}

	constructor(transformer: Transformer, graph: Graph) {
		this.commandAnalyzer = new CommandAnalyzer(graph, transformer);
		this.decoratorAnalyzer = new DecoratorAnalyzer(transformer);
		this.dependencyAnalyzer = new DependencyAnalyzer(graph);
	}
}

function parseContent(content: string) {
	const { program } = parse(content, { 
		sourceType: 'module',
		plugins: ["decorators", "typescript", "jsx"],
		errorRecovery: true
	});

	let node!: NodePath<T.Program>;
	
	traverse(program, {
		Program: n => node = n
	});

	return node;
}

export default Analyzer;
