import { NodePath } from "@babel/traverse";
import * as T from "@babel/types";

type NodeLike<T = T.Node> = NodePath<T> | T;

const nodeTypeMap = {
    FunctionDeclaration: resolveFunctionDeclaration,
    ClassMethod: resolveClassMethod,
    ClassDeclaration: resolveClassDeclaration,
    VariableDeclaration: resolveVariableDeclaration,
} as { [k in T.Node['type']]: (node: NodeLike) => any }

const HASNT_ID = new Error('This node has not a id');

function resolveFunctionDeclaration(node: NodeLike<T.FunctionDeclaration>) {
	return getPropOf(node, 'id');
}

function resolveClassMethod(node: NodeLike<T.ClassMethod>) {
	const key = getPropOf(node, 'key');
	if(key.type != 'Identifier') throw HASNT_ID;

	return key
}

function resolveClassDeclaration(node: NodeLike<T.ClassDeclaration>) {
	return getPropOf(node, 'id');
}

function resolveVariableDeclaration(node: NodeLike<T.VariableDeclaration>) {
	const decl = getPropOf(node, 'declarations')[0];

	return getPropOf(decl, 'id');
}

export function resolveNodeId(node: NodePath<T.Node>): NodePath<T.Identifier>;
export function resolveNodeId(node: T.Node): T.Identifier;
export function resolveNodeId(node: NodeLike): T.Identifier | NodePath<T.Identifier> {
    if(!(node.type in nodeTypeMap)) throw HASNT_ID;

    return nodeTypeMap[node.type](node);
}

function getPropOf<N extends T.Node, K extends keyof N>(node: NodePath<N> | N, key: K) {
	if (node instanceof NodePath) {
		return node.get(key);
	}
	return node[key] as N[K];
}
