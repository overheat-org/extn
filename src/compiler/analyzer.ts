import * as T from '@babel/types';
import { Module } from "./module";
import { FlameError, FlameErrorLocation } from "./reporter";
import { getErrorLocation } from "./utils";
import Graph, { ModuleSymbol } from "./graph";
import ImportResolver from "./import-resolver";
import { NodePath } from '@babel/traverse';

export abstract class Analyzer {
    protected graph!: Graph;
    protected importResolver!: ImportResolver;
    private toInit = new Array();

    init<D extends new (...args: any[]) => any>(dependency: D): InstanceType<D> {
        const instance = new dependency(this.module);
        this.toInit.push(instance);

        return instance;
    }

    __analyze__(graph: Graph, importResolver: ImportResolver) {
        this.graph = graph;
        this.importResolver = importResolver;
        this.toInit.forEach(d => d.__analyze__(graph, importResolver));
        return this.analyze?.();
    }

    abstract analyze(): Promise<void> | void;

    getDeclaration(
        path: NodePath<T.Identifier | T.TSTypeReference>
    ): NodePath | null {
        let name: string | undefined

        if (path.isIdentifier()) {
            name = path.node.name
        } else if (
            path.isTSTypeReference() &&
            path.get('typeName').isIdentifier()
        ) {
            name = (path.get('typeName').node as any).name
        }

        if (!name) return null
        const binding = path.scope.getBinding(name)
        return binding?.path ?? null
    }

    protected dispatchByType<T extends T.Node>(
        path: NodePath<T>,
        map: Record<string, (path: any) => any>
    ) {
        const fn = map[path.type];
        if (!fn) throw new Error(`Unsupported type: ${path.type}`);
        return fn.call(this, path);
    }

    resolveName(path: NodePath) {
        return this.resolveNameStmt(path);
    }

    private resolveNameCallExpr(path: NodePath<T.CallExpression>) {
        const callee = path.get('callee');

        if (callee.isV8IntrinsicIdentifier()) return callee.node.name;
        else return this.resolveNameExpr(callee as NodePath<T.Expression>);
    }

    private resolveNameStmt(path: NodePath): string {
        const result = this.dispatchByType(path, {
            Decorator: this.resolveNameDecorator,
            ClassDeclaration: this.resolveNameClassDeclaration,
            ClassMethod: this.resolveNameClassMethod,
        })

        if(!result) return this.resolveNameExpr(path);

        return result;
    }

    private resolveNameClassDeclaration(path: NodePath<T.ClassDeclaration>) {
        return this.resolveNameIdentifier(path.get('id') as NodePath<T.Identifier>);
    }

    private resolveNameClassMethod(path: NodePath<T.ClassMethod>) {
        return this.resolveNameExpr(path.get('key'));
    } 

    private resolveNameExpr(path: NodePath): string {
        return this.dispatchByType(path, {
            Identifier: this.resolveNameIdentifier,
            MemberExpression: this.resolveNameMemberExpr,
            CallExpression: this.resolveNameCallExpr,
        });
    }

    private resolveNameIdentifier(path: NodePath<T.Identifier>) {
        return path.node.name;
    }

    private resolveNameMemberExpr(path: NodePath<T.MemberExpression>) {
        return this.resolveNameExpr(path.get('object'));
    }

    private resolveNameDecorator(path: NodePath<T.Decorator>) {
        return this.resolveNameExpr(path.get('expression'));
    }

    constructor(protected module: Module) { }
}

enum DecoratorTarget {
    CLASS,
    METHOD,
    PARAM
}

export class DecoratorAnalyzer extends Analyzer {
    private dependencyAnalyzer = this.init(DependencyAnalyzer);

    private HTTP_METHODS = ["get", "head", "post", "put", "delete", "connect", "options", "trace", "patch"];
    private errors = {
        WRONG_SYNTAX(a: string, b: string, c: FlameErrorLocation) {
            return new FlameError(`Wrong syntax for decorator: ${a}\n\n${b}`, c);
        }
    }

    async analyze() {
        await this.module.traverse({
            Decorator: async path => {
                const name = this.resolveName(path) ?? "";
                if (!/^[a-z]/.test(name)) return;
                const key = `analyze${name.replace(/^./, c => c.toUpperCase())}`;

                this[key]?.(path);
            }
        });
    }

    analyzeDecorator(path: NodePath<T.Decorator>) {
        const { dispatchByType } = this;
        const expr = path.get('expression');

        const target = path.parentPath;
        let name!: string;
        let property: NodePath<T.MemberExpression['property']> | undefined;
        let params = new Array<NodePath<T.CallExpression['arguments'][number]>>;

        dispatchByType(expr, {
            Identifier(path: NodePath<T.Identifier>) {
                name = path.get('name');
            },
            MemberExpression(path: NodePath<T.MemberExpression>) {
                const object = path.get('object');

                property = path.get('property');

                dispatchByType(object, this);
            },
            CallExpression(path: NodePath<T.CallExpression>) {
                const callee = path.get('callee');

                params = path.get("arguments");

                dispatchByType(callee, this);
            }
        });

        return { name, target, property, params }
    }

    async analyzeInjectable(path: NodePath<T.Decorator>) {
        const meta = this.analyzeDecorator(path);
        this.targetExpect(meta.target, DecoratorTarget.CLASS);

        if (meta.property) return;

        const dependencies = await this.dependencyAnalyzer.analyzeClass(meta.target);
        const symbol = ModuleSymbol.from(this.resolveName(meta.target), this.module);

        this.graph.addInjectable(symbol, dependencies);
    }

    async analyzeManager(path: NodePath<T.Decorator>) {
        const meta = this.analyzeDecorator(path);
        this.targetExpect(meta.target, DecoratorTarget.CLASS);

        if (meta.property) return;

        const dependencies = await this.dependencyAnalyzer.analyzeClass(meta.target);
        const symbol = ModuleSymbol.from(this.resolveName(meta.target), this.module);

        this.graph.addManager(symbol, dependencies);
    }

    analyzeHttpBased(path: NodePath<T.Decorator>) {
        const meta = this.analyzeDecorator(path);
        this.targetExpect(meta.target, DecoratorTarget.CLASS);

        const decoratorName = this.resolveName(path);
        const ERROR_EXAMPLE = `@${decoratorName}.get("/route/to/handle")\nmethod(args) {\n\t...`;

        if (!meta.property) throw this.errors.WRONG_SYNTAX(
            "this decorator expects a member expression",
            ERROR_EXAMPLE,
            getErrorLocation(path, this.module)
        );

        const propName = this.resolveName(meta.property);

        if (!this.HTTP_METHODS.includes(propName)) throw new FlameError(
            `invalid ${decoratorName == 'http' ? 'http' : 'ipc'} method`,
            getErrorLocation(path, this.module)
        );

        const [routeParam, ...params] = meta.params;

        if (!routeParam) throw this.errors.WRONG_SYNTAX(
            "this decorator expects a route in params",
            ERROR_EXAMPLE,
            getErrorLocation(path, this.module)
        );

        if (!routeParam.isStringLiteral()) throw this.errors.WRONG_SYNTAX(
            "this decorator expects a string of a route path in params",
            ERROR_EXAMPLE,
            getErrorLocation(path, this.module)
        );

        const classDecl = meta.target.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassMethod>;
        
        const parentSymbol = ModuleSymbol.from(this.resolveName(classDecl), this.module);
        const symbol = ModuleSymbol.from(this.resolveName(meta.target), this.module, parentSymbol);

        return { endpoint: routeParam.node.value, method: propName, symbol }
    }

    async analyzeHttp(path: NodePath<T.Decorator>) {
        const { endpoint, method, symbol } = this.analyzeHttpBased(path);

        this.graph.addRoute({
            endpoint,
            method,
            symbol,
            ipc: false
        });
    }

    async analyzeApi(path: NodePath<T.Decorator>) {
        const { endpoint, method, symbol } = this.analyzeHttpBased(path);

        this.graph.addRoute({
            endpoint,
            method,
            symbol,
            ipc: true
        });
    }

    async analyzeEvent(path: NodePath<T.Decorator>) {
        const meta = this.analyzeDecorator(path);
        this.targetExpect(meta.target, DecoratorTarget.METHOD);

        const classDecl = meta.target.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassMethod>;

        const parentSymbol = ModuleSymbol.from(this.resolveName(classDecl), this.module);
        const symbol = ModuleSymbol.from(this.resolveName(meta.target), this.module, parentSymbol);

        const key = meta.target.get('key');
        if (!key.isIdentifier()) {
            const locStart = key.node.loc?.start!;

            throw new FlameError("Expected a comptime known class method name", { path: this.module.entryPath, ...locStart });
        };

        const methodName = key.node.name;

        const matches = methodName.match(/^(On|Once)([A-Z][a-zA-Z]*)$/);
        if (!matches) {
            const locStart = key.node.loc?.start!;

            throw new FlameError(
                "The method name should starts with 'On' or 'Once' and continue with a discord event name\n\nlike: 'OnceReady'",
                { path: this.module.entryPath, ...locStart }
            )
        };

        const once = matches[1] == 'Once';
        const type = matches[2].charAt(0).toLowerCase() + matches[2].slice(1);

        this.graph.addEvent({
            once,
            type,
            symbol
        });
    }

    private targetExpect(
        path: NodePath<T.Node>,
        target: DecoratorTarget.CLASS
    ): asserts path is NodePath<T.ClassDeclaration>;

    private targetExpect(
        path: NodePath<T.Node>,
        target: DecoratorTarget.METHOD
    ): asserts path is NodePath<T.ClassMethod>;

    private targetExpect(
        path: NodePath<T.Node>,
        target: DecoratorTarget.PARAM
    ): asserts path is NodePath<T.ClassMethod['params'][number]>;

    private targetExpect(path: NodePath<T.Node>, target: DecoratorTarget): void {
        const map = {
            [DecoratorTarget.CLASS]: "class",
            [DecoratorTarget.METHOD]: "method",
            [DecoratorTarget.PARAM]: "param"
        }

        if (
            (target == DecoratorTarget.CLASS && !path.isClassDeclaration()) ||
            (target == DecoratorTarget.METHOD && !path.isClassMethod()) ||
            (target == DecoratorTarget.PARAM && !(
                path.isIdentifier() ||
                path.isPattern() ||
                path.isRestElement() ||
                path.isTSParameterProperty()
            ))
        ) {
            throw new FlameError(
                `Expected a ${map[target]} decorator target, but got ${path.type}`,
                getErrorLocation(path, this.module)
            );
        }
    }
}

export class DependencyAnalyzer extends Analyzer {
    analyze() { }

    analyzeClass(path: NodePath<T.ClassDeclaration>) {
        const classBody = path.get('body').get('body');
        const constructor = classBody.find(m => m.isClassMethod() && m.node.kind === "constructor");

        if (!constructor) {
            return [];
        }

        return this.analyzeConstructor(constructor as NodePath<T.ClassMethod>);
    }

    analyzeConstructor(path: NodePath<T.ClassMethod>) {
        const params = path.get('params');

        return Promise.all(params.map(p => {
            if (!p.isTSParameterProperty()) {
                throw new FlameError("This parameter cannot be injectable", getErrorLocation(path, this.module));
            }

            return this.analyzeParameter(p);
        }));
    }

    async analyzeParameter(path: NodePath<T.TSParameterProperty>) {
        const parameter = path.get("parameter");
        const typeAnnotation = parameter.get("typeAnnotation");

        if (!typeAnnotation.isTSTypeAnnotation()) {
            throw new FlameError("Expected a type annotation for injectable parameter", getErrorLocation(path, this.module));
        }

        const typeRef = typeAnnotation.get("typeAnnotation");

        if (!typeRef.isTSTypeReference()) {
            throw new FlameError("Expected a injectable type reference", getErrorLocation(path, this.module));
        }

        const typeDeclaration = this.getDeclaration(typeRef);

        if (!typeDeclaration?.isImportSpecifier()) {
            throw new FlameError("Expected a import declaration for injectable type", getErrorLocation(path, this.module));
        }

        const source = (typeDeclaration.parentPath.node as T.ImportDeclaration).source.value;

        const filePath = await this.importResolver.resolve(source, this.module.entryPath);
        if (!filePath) {
            throw new FlameError(`Cannot resolve import '${source}'`, getErrorLocation(path, this.module));
        }

        const mod = this.graph.getModule(filePath);
        if (!mod) {
            throw new FlameError(`Module not found '${filePath}'`, getErrorLocation(path, this.module));
        }

        return ModuleSymbol.from((typeRef.node.typeName as T.Identifier).name, mod);
    }
}

class AnalyzerRunner {
    constructor(private graph: Graph, private importResolver: ImportResolver) { }

    async analyze() {
        for (const module of this.graph.modules) {
            if (!module.analyzers) continue;

            for (const analyzer of module.analyzers) {
                await analyzer.__analyze__(this.graph, this.importResolver);
            }
        }
    }
}

export default AnalyzerRunner;