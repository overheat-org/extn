import { NodePath } from "@babel/traverse";
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
    ) { }
}

class DecoratorAnalyzer extends AnalyzerStep {
    CONTENT_REGEX = /@[a-z][a-zA-Z]+(?=\s)/;

    async analyze(id: string, code: string) {
        if (!this.CONTENT_REGEX.test(code)) return;

        const program = await this.parse(code);

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

                if(Array.isArray(name)) {
                    name.push(_name);
                }
                else if(typeof name == 'string') {
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
            parentNode: target,
            params,
			node: path,
			kind: targetMap[target.node.type]
        })
    }
}

class CommandAnalyzer extends AnalyzerStep {
    COMMAND_FILE_REGEX = /^\$[A-Za-z][\w-]*\.(t|j)sx?$/;
	COMMAND_DIR_REGEX = /commands\/[A-Za-z]\.(t|j)sx?$/;

    async analyze(id: string, code: string) {
        if (
			!this.COMMAND_DIR_REGEX.test(id) &&
			!this.COMMAND_FILE_REGEX.test(id)
		) return;

        const ast = await this.parse(code);
        const command = this.transformer.transformCommand(id, ast);
        this.graph.addCommand(command);
    }
}

/** @internal */
class Analyzer {
    private steps: AnalyzerStep[];

    analyzeModule(id: string, code: string) {
        this.steps.forEach(step => step.analyze(id, code));
    }

    async analyzeClassDependencies(node: NodePath) { }

    constructor(transformer: Transformer, graph: Graph) {
        this.steps = [
            new DecoratorAnalyzer(transformer, graph),
            new CommandAnalyzer(transformer, graph),
        ];
    }
}

export default Analyzer;
