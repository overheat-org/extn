import { NodePath } from "@babel/traverse";
import Transformer from "../transformer";
import { ClassDeclaration, ClassMethod, Identifier } from "@babel/types";

export interface DecoratorDefinition {
    name: string
    transform?: DecoratorTransform
    children?: DecoratorDefinition[]
}

export type DecoratorTransform = {
    class?: (node: NodePath<ClassDeclaration>) => void
    member?: (node: NodePath<ClassMethod>) => void
    param?: (node: NodePath<Identifier>) => void
} | ((node: NodePath<ClassDeclaration | ClassMethod | Identifier>) => void)
