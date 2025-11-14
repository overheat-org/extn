import * as T from "@babel/types";
import { ZenError, getErrorLocation } from "@reporter";
import { NodeObserver, ObserverContext } from "../parser";
import { FileTypes } from "@consts";
import { ObserveNode } from "@utils/decorators";

export class DeclarationsAnalyzer {
	constructor(private observers: NodeObserver) {}

	@ObserveNode("EnumDeclaration")
	analyzeEnum({ node, path, type }: ObserverContext<T.EnumDeclaration>) {
		if(type != FileTypes.Command) return;
		
		throw new ZenError('Cannot use enum in command', getErrorLocation(node, path));
	}

	@ObserveNode("ClassDeclaration")
	analyzeClass({ node, path, type }: ObserverContext<T.ClassDeclaration>) {
		if(type != FileTypes.Command) return;

		throw new ZenError('Cannot use class in command', getErrorLocation(node, path));
	}
}