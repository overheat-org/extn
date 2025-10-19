import { NodePath } from "@babel/traverse";
import { ClassDeclaration, ClassMethod, Decorator, Identifier } from "@babel/types";
import Graph from "../graph";
import Analyzer from "../compiler/analyzer";
import Transformer from "../compiler/transformer";

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
	id: string;
	params: any[]
	targetNode: NodePath<ParentNodeTypeMap<T>>;
	node: NodePath<Decorator>;
	graph: Graph;
	analyzer: Analyzer;
}

export type DecoratorTransform = {
    class?: (this: Transformer, ctx: DecoratorTransformContext<TransformType.Class>) => void
    method?: (this: Transformer, ctx: DecoratorTransformContext<TransformType.Method>) => void
    param?: (this: Transformer, ctx: DecoratorTransformContext<TransformType.Param>) => void
} | ((ctx: DecoratorTransformContext<
	| TransformType.Class 
	| TransformType.Method
	| TransformType.Param
>) => void);
