import { NodePath } from "@babel/traverse";
import { ClassDeclaration, ClassMethod, Decorator, Identifier } from "@babel/types";
import Graph from "@compiler/graph";
import Analyzer from "@compiler/analyzer";

export interface DecoratorDefinition {
    name: string
    transform?: DecoratorTransform
    children?: DecoratorDefinition[]
}

export enum TransformType {
	Class,
	Method,
	Param
}

type ParentNodeTypeMap<T> = T extends TransformType.Class
	? ClassDeclaration
	: T extends TransformType.Method
		? ClassMethod
		: Identifier;

export interface DecoratorTransformContext<T extends TransformType> {
	path: string;
	params: any[]
	targetNode: NodePath<ParentNodeTypeMap<T>>;
	node: NodePath<Decorator>;
}

interface This { 
	graph: Graph, 
	analyzer: Analyzer
}

export type DecoratorTransform = {
    class?: (this: This, ctx: DecoratorTransformContext<TransformType.Class>) => void
    method?: (this: This, ctx: DecoratorTransformContext<TransformType.Method>) => void
    param?: (this: This, ctx: DecoratorTransformContext<TransformType.Param>) => void
} | ((this: This, ctx: DecoratorTransformContext<
	| TransformType.Class 
	| TransformType.Method
	| TransformType.Param
>) => void);
