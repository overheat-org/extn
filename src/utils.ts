import { NodePath } from "@babel/traverse";
import { Identifier, Node } from "@babel/types";

const nodeTypeMap = {
    FunctionDeclaration: resolveFunctionDeclaration,
    ClassMethod: resolveClassMethod,
    ClassDeclaration: resolveClassDeclaration,
    VariableDeclaration: resolveVariableDeclaration,
} as { [k in Node['type']]: any }

function resolveFunctionDeclaration() {}

function resolveClassMethod() {}

function resolveClassDeclaration() {}

function resolveVariableDeclaration() {}

export function resolveNodeId(node: NodePath | Node): Identifier {
    if(!(node.type in nodeTypeMap)) throw new Error('This node has not a id');

    return nodeTypeMap[node.type](node);
}
