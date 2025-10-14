import * as T from '@babel/types';
import Graph from "../../graph";
import { NodePath } from '@babel/traverse';
import { FlameError, getErrorLocation } from '../../reporter';

export class DependencyAnalyzer {
	constructor(private graph: Graph) { }

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

		return params.map(p => {
			if (!p.isTSParameterProperty()) {
				throw new FlameError("This parameter cannot be injectable", getErrorLocation(node, id));
			}

			return this.analyzeParameter(id, p);
		});
	}

	analyzeParameter(id: string, node: NodePath<T.TSParameterProperty>) {
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