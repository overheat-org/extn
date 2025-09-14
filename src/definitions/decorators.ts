import * as T from '@babel/types';
import { NodePath } from '@babel/traverse';
import { HTTP_METHODS } from '../consts';
import { DecoratorDefinition } from './base';

export default [
	{
		name: 'injectable',
		transform: {
			async class({ analyzer, graph, parentNode, node }) {
				const dependencies = await analyzer.analyzeClassDependencies(parentNode);
				const symbol = graph.resolveSymbol({ kind: '', id, node, parentNode });
				graph.addInjectable(symbol, dependencies);
			}
		}
	},
	{
		name: 'manager',
		transform: {
			async class({ analyzer, graph, parentNode, node }) {
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
				method(ctx) {
					const ERROR_EXAMPLE = '@http.get("/route/to/handle")\nmethod(args) {\n\t...\n}';
					const endpoint = analyzer.analyzeHttpRoute(ast, ERROR_EXAMPLE);

					const classDecl = ast.target;

					const symbol = graph.resolveSymbol(ast.target, ast.path);

					graph.addRoute({
						endpoint,
						method,
						symbol,
						ipc: false
					});
				}
			}
		}))
	},
	{
		name: "event",
		transform: {
			method(ast) {
				const classDecl = ast.target.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassMethod>;

				const parentSymbol = ModuleSymbol.from(this.resolveName(classDecl), this.module);
				const symbol = ModuleSymbol.from(this.resolveName(ast.target), this.module, parentSymbol);

				const key = ast.target.get('key');
				if (!key.isIdentifier()) {
					const locStart = key.node.loc?.start!;

					throw new FlameError("Expected a comptime known class method name", { path: this.module.entryPath, ...locStart });
				};

				const methodName = key.node.name;

				const NAME_ERROR = new FlameError(
					"The method name should starts with 'On' or 'Once' and continue with a discord event name\n\nlike: 'OnceReady'",
					{ path: this.module.entryPath, ...key.node.loc?.start! }
				);

				const matches = methodName.match(/^(On|Once)([A-Z][a-zA-Z]*)$/);
				if (!matches) throw NAME_ERROR;

				const once = { 
					Once: true,
					On: false, 
					undefined() {
						throw NAME_ERROR;
					}
				}[matches[1]];

				const type = matches[2].charAt(0).toLowerCase() + matches[2].slice(1);

				this.graph.addEvent({
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
			class(ast) {
				const className = this.resolveName(ast.target.get('id') as NodePath<T.Identifier>);

				ast.path.insertAfter(
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
