import * as T from '@babel/types';
import { NodePath } from '@babel/traverse';
import { HTTP_METHODS } from '../consts';
import { DecoratorDefinition } from './base';
import { FlameError } from '../reporter';
import { resolveNodeId } from '../utils';

export default [
    {
        name: 'injectable',
        transform: {
            async class({ analyzer, graph, targetNode: parentNode, node }) {
                const dependencies = await analyzer.analyzeClassDependencies(parentNode);
                const symbol = graph.resolveSymbol(node);
                graph.addInjectable(symbol, dependencies);
            }
        }
    },
    {
        name: 'manager',
        transform: {
            async class({ analyzer, graph, targetNode: parentNode, node }) {
                const dependencies = await analyzer.analyzeClassDependencies(parentNode);
                const symbol = graph.resolveSymbol(node);
                graph.addManager(symbol, dependencies);
            }
        }
    },
    {
        name: 'http',
        children: HTTP_METHODS.map(method => ({
            name: method,
            transform: {
                method({ analyzer, graph, node, targetNode: methodNode }) {
                    const ERROR_EXAMPLE = '@http.get("/route/to/handle")\nmethod(args) {\n\t...\n}';
                    const endpoint = analyzer.analyzeHttpRoute(node, ERROR_EXAMPLE);

                    const classNode = methodNode.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassDeclaration>;
                    const symbol = graph.resolveSymbol(methodNode, classNode);

                    graph.addRoute({
                        endpoint,
                        method,
                        symbol,
                        ipc: false
                    });
                }
            }
        }) as DecoratorDefinition)
    },
    {
        name: "event",
        transform: {
            method({ graph, node, targetNode: methodNode }) {
                const classNode = methodNode.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassDeclaration>;
                const symbol = graph.resolveSymbol(methodNode, classNode);

                const key = methodNode.get('key');
                if (!key.isIdentifier()) {
                    const locStart = key.node.loc?.start!;

                    throw new FlameError("Expected a comptime known class method name", { path: id, ...locStart });
                };

                const methodName = key.node.name;

                const NAME_ERROR = new FlameError(
                    "The method name should starts with 'On' or 'Once' and continue with a discord event name\n\nlike: 'OnceReady'",
                    { path: id, ...key.node.loc?.start! }
                );

                const matches = methodName.match(/^(On|Once)([A-Z][a-zA-Z]*)$/);
                if (!matches) throw NAME_ERROR;

                const once = { Once: true, On: false }[matches[1]];
                if(!once) throw NAME_ERROR;

                const type = matches[2].charAt(0).toLowerCase() + matches[2].slice(1);

                graph.addEvent({
                    once,
                    type,
                    symbol
                });
            }
        }
    },
    {
        name: 'serializable',
        transform: {
            class({ node, targetNode: parentNode }) {
                const className = resolveNodeId(parentNode).node.name;

                node.insertAfter(
                    T.assignmentExpression(
                        "=",
                        T.memberExpression(
                            T.identifier(className),
                            T.identifier("__serializable__")
                        ),
                        T.booleanLiteral(true)
                    )
                )
            }
        }
    },
] as DecoratorDefinition[];
