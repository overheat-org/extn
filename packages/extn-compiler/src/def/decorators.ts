import * as T from '@babel/types';
import { NodePath } from '@babel/traverse';
import { DecoratorDefinition } from './base';
import { ExtnError, getErrorLocation, HTTP_METHODS } from '@extn/shared';
import { resolveNodeId } from '../utils/id-resolver';
import { HttpBasedErrors } from '../analyzer';

export default [
    {
        name: 'Injectable',
        transform: {
            async class(ctx) {
                const dependencies = await this.analyzer.analyzeClassDependencies(ctx);
                const symbol = this.graph.resolveSymbol(ctx.node);
                this.graph.addInjectable(symbol, dependencies);
				ctx.node.remove();
            }
        }
    },
    {
        name: 'Service',
        transform: {
            async class(ctx) {
                const dependencies = await this.analyzer.analyzeClassDependencies(ctx);
                const symbol = this.graph.resolveSymbol(ctx.node);
                this.graph.addService(symbol, dependencies);
				ctx.node.remove();
            }
        }
    },
    {
        name: 'Http',
        children: HTTP_METHODS.map(method => ({
            name: method,
            transform: {
                method(ctx) {
					const httpData = this.analyzer.analyzeHttpRoute(ctx);
					
					const ERROR_EXAMPLE = '@http.get("/route/to/handle")\nmethod(args) {\n\t...\n}';
					const ERROR_PATTERN = (msg: string) => new ExtnError(
						`Wrong syntax for decorator: ${msg}\n\n${ERROR_EXAMPLE}`,
						getErrorLocation(ctx.node, ctx.path)						
					)

					switch (httpData) {
						case HttpBasedErrors.ROUTE_EXPECTED: 
							throw ERROR_PATTERN("this decorator expects a route in params");

						case HttpBasedErrors.ROUTE_PATH_STRING_EXPECTED: 
							throw ERROR_PATTERN("this decorator expects a string of a route path in params");
					}
					
					const { endpoint } = httpData;
					
                    const classNode = ctx.targetNode.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassDeclaration>;
                    const symbol = this.graph.resolveSymbol(ctx.targetNode, classNode);

                    this.graph.addRoute({
                        endpoint,
                        method,
                        symbol,
                        ipc: false
                    });

					ctx.node.remove();
                }
            }
        }) as DecoratorDefinition)
    },
    {
        name: "Event",
        transform: {
            method(ctx) {
                const classNode = ctx.targetNode.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassDeclaration>;
                const symbol = this.graph.resolveSymbol(ctx.targetNode, classNode);

                const key = ctx.targetNode.get('key');
                if (!key.isIdentifier()) {
                    const locStart = key.node.loc?.start!;

                    throw new ExtnError("Expected a comptime known class method name", { path: ctx.path, ...locStart });
                };

                const methodName = key.node.name;

                const NAME_ERROR = new ExtnError(
                    "The method name should starts with 'On' or 'Once' and continue with a discord event name\n\nlike: 'OnceReady'",
                    { path: ctx.path, ...key.node.loc?.start! }
                );

                const matches = methodName.match(/^(On|Once)([A-Z][a-zA-Z]*)$/);
                if (!matches) throw NAME_ERROR;

                const once = { Once: true, On: false }[matches[1]];
                if(once === undefined) throw NAME_ERROR;

                const type = matches[2].charAt(0).toLowerCase() + matches[2].slice(1);

                this.graph.addEvent({
                    once,
                    type,
                    symbol
                });
				
				ctx.node.remove();
            }
        }
    },
    {
        name: 'Serializable',
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