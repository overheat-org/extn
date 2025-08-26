import * as T from "@babel/types";
import { NodePath } from "@babel/traverse";
import Analyzer from "./analyzer";
import Graph from "./graph";
import decorators from "./definitions/decorators";
import { DecoratorDefinition, DecoratorTransform } from "./definitions/base";

export interface DecoratorNodeWrapper {
    name: string | string[];
    property: NodePath<T.MemberExpression['property']>
    params: NodePath<T.CallExpression['arguments'][number]>[]
}

/** @internal */
class Transformer {
    private analyzer: Analyzer;

    async transformModule(id: string, code: string) {
        const steps = this.analyzer.analyzeModule(id, code);
        let index = 0;

        while(index < steps.length) {
            const step = steps[index];

            await step(id, code);

            index++;
        }
    }

	transformDecorator(node: DecoratorNodeWrapper) {
        let definitions = decorators;
        let lastDef: DecoratorDefinition | undefined = undefined;

        const handleName = (part: string) => {
            lastDef = definitions.find(d => d.name == part);
            definitions = lastDef?.children ?? [];
        }

        Array.isArray(node.name)
            ? node.name.forEach(handleName)
            : handleName(node.name)

        this.handleTransformDecorator(
            lastDef?.transform,
            node
        )
	}

    private handleTransformDecorator(transform: DecoratorTransform, node: DecoratorNodeWrapper) {
        if(typeof transform != "object") return transform.call(this, node);

        if(
            transform.class && 
            node.target.isClassDeclaration()
        ) {
            transform.class.call(this, node);
        }

        if(
            transform.member &&
            node.target.isClassMethod()
        ) {
            transform.member.call(this, node);
        }

        if(
            transform.param &&
            node.target.isIdentifier()
        ) {
            transform.param.call(this, node);
        }
    }

	transformCommand(node: NodePath<Program>) {
        
	}

    constructor(public graph: Graph) {
        this.analyzer = new Analyzer(this, this.graph);
    }
}

export default Transformer;
