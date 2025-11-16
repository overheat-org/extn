import * as T from "@babel/types";
import { ExtnError, getErrorLocation } from "../../../shared/reporter";
import { NodeObserver, ObserverContext } from "../parser";
import { FileTypes } from "../../../shared/consts";
import { ObserveNode } from "@utils/decorators";

export class DeclarationsAnalyzer {
	constructor(private observers: NodeObserver) {}

	@ObserveNode("EnumDeclaration")
	analyzeEnum({ node, path, type }: ObserverContext<T.EnumDeclaration>) {
		if(type != FileTypes.Command) return;
		
		throw new ExtnError('Cannot use enum in command', getErrorLocation(node, path));
	}

	@ObserveNode("ClassDeclaration")
	analyzeClass({ node, path, type }: ObserverContext<T.ClassDeclaration>) {
		if(type != FileTypes.Command) return;

		throw new ExtnError('Cannot use class in command', getErrorLocation(node, path));
	}
}