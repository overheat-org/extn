import * as T from "@babel/types";
import { NodePath } from "@babel/traverse";
import { ZenError, getErrorLocation } from "../../reporter";
import NodeChannels from "../node-observer";

export class DeclarationsAnalyzer {
	constructor(observers: NodeChannels) {
		observers.commands.on("EnumDeclaration", this.command$analyzeEnum);
	}

	command$analyzeEnum(path: string, node: NodePath<T.EnumDeclaration>) {
		throw new ZenError('Cannot use enum in command', getErrorLocation(node, path));
	}

	command$analyzeClass(path: string, node: NodePath<T.ClassDeclaration>) {
		throw new ZenError('Cannot use class in command', getErrorLocation(node, path));
	}
}