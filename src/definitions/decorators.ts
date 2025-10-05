import * as T from '@babel/types';
import { NodePath } from '@babel/traverse';
import { HTTP_METHODS } from '../consts';
import { DecoratorDefinition } from './base';
import { FlameError, getErrorLocation } from '../reporter';
import { resolveNodeId } from '../utils';
import { HttpBasedErrors } from '../analyzer';

export default [
    {
        name: 'injectable',
        transform: {
            async class({ id, analyzer, graph, targetNode: parentNode, node }) {
                const dependencies = analyzer.analyzeClassDependencies(id, parentNode);
                const symbol = graph.resolveSymbol(node);
                graph.addInjectable(symbol, dependencies);
				node.remove();
            }
        }
    },
    {
        name: 'manager',
        transform: {
            async class({ id, analyzer, graph, targetNode: parentNode, node }) {
                const dependencies = analyzer.analyzeClassDependencies(id, parentNode);
                const symbol = graph.resolveSymbol(node);
                graph.addManager(symbol, dependencies);
				node.remove();
            }
        }
    },
    {
        name: 'http',
        children: HTTP_METHODS.map(method => ({
            name: method,
            transform: {
                method({ id, analyzer, graph, node, params, targetNode: methodNode }) {
					const httpData = analyzer.analyzeHttpRoute(node, params);
					
					const ERROR_EXAMPLE = '@http.get("/route/to/handle")\nmethod(args) {\n\t...\n}';
					const ERROR_PATTERN = (msg: string) => new FlameError(
						`Wrong syntax for decorator: ${msg}\n\n${ERROR_EXAMPLE}`,
						getErrorLocation(node, id)						
					)

					switch (httpData) {
						case HttpBasedErrors.ROUTE_EXPECTED: 
							throw ERROR_PATTERN("this decorator expects a route in params");

						case HttpBasedErrors.ROUTE_PATH_STRING_EXPECTED: 
							throw ERROR_PATTERN("this decorator expects a string of a route path in params");
					}
					
					const { endpoint } = httpData;
					
                    const classNode = methodNode.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassDeclaration>;
                    const symbol = graph.resolveSymbol(methodNode, classNode);

                    graph.addRoute({
                        endpoint,
                        method,
                        symbol,
                        ipc: false
                    });

					node.remove();
                }
            }
        }) as DecoratorDefinition)
    },
    {
        name: "event",
        transform: {
            method({ id, graph, targetNode: methodNode, node }) {
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
                if(once === undefined) throw NAME_ERROR;

                const type = matches[2].charAt(0).toLowerCase() + matches[2].slice(1);

                graph.addEvent({
                    once,
                    type,
                    symbol
                });
				
				node.remove();
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

				node.remove();
            }
        }
    }
] as DecoratorDefinition[];
