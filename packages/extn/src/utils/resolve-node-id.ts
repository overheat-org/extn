import { NodePath } from "@babel/traverse";
import * as T from "@babel/types";

type NodeLike<T = T.Node> = NodePath<T> | T;

const nodeTypeMap = {
	FunctionDeclaration: resolveFunctionDeclaration,
	ClassMethod: resolveClassMethod,
	ClassDeclaration: resolveClassDeclaration,
	VariableDeclaration: resolveVariableDeclaration,
	Decorator: resolveDecorator,
	TSTypeReference: resolveTSTypeReference,
	TSQualifiedName: resolveTSQualifiedName,
	Identifier: resolveIdentifier,
} as { [k in T.Node['type']]: (node: NodeLike) => any }

const HASNT_ID = x => new Error(
	`This node ${unwrap(getPropOf(x, 'type'))} has not a id`
);

function resolveIdentifier(node: NodeLike<T.Identifier>) {
	return node;
}

function resolveTSQualifiedName(node: NodeLike<T.TSQualifiedName>) {
	const id = getPropOf(node, 'right');

	return id;
}

function resolveTSTypeReference(node: NodeLike<T.TSTypeReference>) {
	const entity = getPropOf(node, 'typeName');

	if(T.isIdentifier(unwrap(entity))) return entity;

	return resolveTSQualifiedName(entity as any);
}

function resolveDecorator(node: NodeLike<T.Decorator>) {
	const expr = getPropOf(node, 'expression');

	return resolveExpression(expr);
}

function resolveFunctionDeclaration(node: NodeLike<T.FunctionDeclaration>) {
	return getPropOf(node, 'id');
}

function resolveClassMethod(node: NodeLike<T.ClassMethod>) {
	const key = getPropOf(node, 'key');

	return resolveExpression(key);
}

function resolveClassDeclaration(node: NodeLike<T.ClassDeclaration>) {
	return getPropOf(node, 'id');
}

function resolveVariableDeclaration(node: NodeLike<T.VariableDeclaration>) {
	const decl = getPropOf(node, 'declarations')[0];

	return getPropOf(decl, 'id');
}

function resolveExpression(node: NodeLike<T.Expression>): T.Identifier | NodePath<T.Identifier> {
	if(!(node.type in nodeTypeMap)) throw HASNT_ID(node);

	return nodeTypeMap[node.type](node);
}

export function resolveNodeId(node: NodePath<any>): NodePath<T.Identifier>;
export function resolveNodeId(node: T.Expression): T.Identifier;
export function resolveNodeId(node: NodeLike<any>): T.Identifier | NodePath<T.Identifier> {
	return resolveExpression(node);
}

function getPropOf<N extends T.Node, K extends keyof N>(node: NodePath<N> | N, key: K) {
	if (node instanceof NodePath) {
		return node.get(key);
	}
	return node[key] as N[K];
}

function unwrap<N extends T.Node>(node: NodePath<N> | N) {
	if (node instanceof NodePath) {
		return node.node;
	}

	return node;
}