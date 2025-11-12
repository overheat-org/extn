import * as T from '@babel/types';
import { NodePath } from '@babel/traverse';
import { ZenError, getErrorLocation } from '../../reporter';
import { ImportAnalyzer } from './analyzer.import';

export class DependencyAnalyzer {	
	constructor(private importAnalyzer: ImportAnalyzer) {}

	async analyzeClassDeclaration(path: string, node: NodePath<T.ClassDeclaration>) {
		const classBody = node.get('body').get('body');
		const constructor = classBody.find(m => m.isClassMethod() && m.node.kind === "constructor");

		if (!constructor) {
			return [];
		}

		return await this.analyzeConstructor(path, constructor as NodePath<T.ClassMethod>);
	}

	analyzeConstructor(path: string, node: NodePath<T.ClassMethod>) {
		const params = node.get('params');

		return Promise.all(params.map(p => {
			if (!p.isTSParameterProperty()) {
				throw new ZenError("This parameter cannot be injectable", getErrorLocation(node, path));
			}

			return this.analyzeParameter(path, p);
		}));
	}

	analyzeParameter(path: string, node: NodePath<T.TSParameterProperty>) {
		const parameter = node.get("parameter");
		const typeAnnotation = parameter.get("typeAnnotation");

		if (!typeAnnotation.isTSTypeAnnotation()) {
			throw new ZenError("Expected a type annotation for injectable parameter", getErrorLocation(node, path));
		}

		const typeRef = typeAnnotation.get("typeAnnotation");

		if (!typeRef.isTSTypeReference()) {
			throw new ZenError("Expected a injectable type reference", getErrorLocation(node, path));
		}

		return this.importAnalyzer.analyzeTypeDeclaration(path, typeRef);
	}
}