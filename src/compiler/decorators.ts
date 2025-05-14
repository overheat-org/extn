import * as T from '@babel/types';
import { createConstructor, getClassDeclaration, getConstructor, getDecoratorParams, getErrorLocation, resolveName } from "./utils";
import { NodePath } from "@babel/traverse";
import { template } from '@babel/core';
import { FlameError, FlameErrorLocation } from './reporter';
import type { DecoratorDeclaration } from './transformer';

const errors = {
    EXPECTED_CLASS: "This decorator only can be used on class declarations",
    SHOULD_BE_GLOBAL: "Injected classes should be in global scope",
    EXPECTED_METHOD: "This decorator only can be used on class method declarations",
    EXPECTED_COMPTIME_NAME: "Expecting a comptime known class method name",
    INVALID_NAME_FORMAT: "The method name should starts with 'On' or 'Once' and continue with a discord event name\n\nlike: 'OnceReady'",
    EXPECTED_FIND_METHOD: "The target of singleton decorator needs a static find method",
    EXPECTED_IDENTIFIER_PARAM: "The first param of find method needs to be a number or string identifier"
};

const CALL_EXPECTED = (location: FlameErrorLocation, n: string) => new FlameError(`The decorator '${n}' is expecting call expression`, location);

export default {
    inject(path) {
        const classDecl = getClassDeclaration(path);
        if (!classDecl) {
			throw new FlameError(errors.EXPECTED_CLASS, getErrorLocation(path, this.module.entryPath));
		};

        if (!path.removed) path.remove();

        const className = classDecl.get('id').node!.name;
        let parent = classDecl.parentPath;
        let exported = false;

        switch (true) {
            case parent.isExportNamedDeclaration():
                parent = parent.parentPath;
                exported = true;

            case parent.isProgram():
                const program = parent as NodePath<T.Program>;

                if (!exported) {
                    if (
                        !program.get('body').some(node =>
                            node.isExportNamedDeclaration() &&
                            node.get('specifiers').some(specifier =>
                                specifier.isExportSpecifier() &&
                                specifier.get('local').node.name === className
                            )
                        )
                    ) {
                        classDecl.replaceWith(T.exportNamedDeclaration(classDecl.node));
                    };
                }

                break;

                
            default: {
                throw new FlameError(errors.SHOULD_BE_GLOBAL, getErrorLocation(classDecl, this.module.entryPath));
            }
        }
        
        this.graph.addInjection(className, this.module);
    },
    event(path) {
        const methodDecl = path.findParent(p => p.isClassMethod()) as NodePath<T.ClassMethod>;
        if (!methodDecl) {
			const locStart = path.node.loc?.start!;

			throw new FlameError(errors.EXPECTED_METHOD, { path: this.module.entryPath, ...locStart });
		};

        const classDecl = getClassDeclaration(methodDecl)!;

        let once = false;
        // TODO: transform eventName in enum value if eventName exists on discord enum
        let eventName!: string;
        let methodName!: string;
        {
            const key = methodDecl.get('key');
            if (!key.isIdentifier()) {
				const locStart = key.node.loc?.start!;

				throw new FlameError("Expected a comptime known class method name", { path: this.module.entryPath, ...locStart });
			};

            methodName = key.node.name;

            const matches = methodName.match(/^(On|Once)([A-Z][a-zA-Z]*)$/);
            if(!matches) {
				const locStart = key.node.loc?.start!;
				
				throw new FlameError(
					"The method name should starts with 'On' or 'Once' and continue with a discord event name\n\nlike: 'OnceReady'",
					{ path: this.module.entryPath, ...locStart }
				)
			};
            
            once = matches[1] == 'Once';
            eventName = matches[2].charAt(0).toLowerCase() + matches[2].slice(1);
        }

		const constructorPath = getConstructor(classDecl) ?? createConstructor(classDecl);

		const eventListener = T.expressionStatement(generateEventListener(
			once,
			eventName,
			T.memberExpression(
				T.identifier('this'),
				T.identifier(methodName)
			)
		));

		constructorPath.get('body').pushContainer('body', eventListener);

        if (!path.removed) path.remove();
    },
    http(path) {
        path.remove();
    },
    api(path) {
        const methodDecl = path.findParent(p => p.isClassMethod()) as NodePath<T.ClassMethod>;
        if (!methodDecl) {
			throw new FlameError(errors.EXPECTED_METHOD, getErrorLocation(path, this.module.entryPath));
		};

        let method: string;
        {
            const expr = path.get('expression');
            if(!expr.isCallExpression()) throw CALL_EXPECTED(getErrorLocation(expr, this.module.entryPath), "api");
            
            const callee = expr.get('callee');
            if(!callee.isMemberExpression()) throw new FlameError("The decorator 'api' should have a member expression", getErrorLocation(callee, this.module.entryPath));

            method = `__${resolveName(callee.get('property'))}__`;
        }

        const classDecl = methodDecl.parentPath.parentPath as NodePath<T.ClassDeclaration>;
        if(!classDecl.node.superClass) {
            const ipcId = T.identifier('_IPC_');
            classDecl.set('superClass', ipcId);

            const program = path.findParent(n => n.isProgram()) as NodePath<T.Program>;

            program.node.body.unshift(
                T.importDeclaration(
                    [T.importSpecifier(ipcId, T.identifier("IPC"))],
                    T.stringLiteral('@flame-oh/core/internal')
                )
            );
        }
        
        const constructorDecl = getConstructor(classDecl) ?? createConstructor(classDecl, [], [], true);

		let string: string;
		{
			const params = getDecoratorParams(path);
			if(
				!params?.[0].isExpression() || 
				!params[0].isStringLiteral()
			) throw new Error("String expected");
	
			string = params[0].node.value;
		}

		let id: string;
		{
			const expr = methodDecl.get('key');
			if(
				!expr.isIdentifier()
			) throw new Error("Expected a identifier");

			id = expr.node.name;
		}

        const wrapper = template.statement(`
            this.%%method%%(${JSON.stringify(string)}, (...args) => this.%%id%%.bind(this, ...args));
        `);

        if (!path.removed) path.remove();

        constructorDecl.get('body').pushContainer('body', wrapper({ id, method }));
    },
    singleton(path) {
        const classDeclPath = path.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassDeclaration>;
            if(!classDeclPath) {
				const locStart = path.node.loc?.start!;

				throw new FlameError(errors.EXPECTED_CLASS, { path: this.module.entryPath, ...locStart });
			};
        
            classDeclPath.addComment('inner', "@singleton entity");
        
            const bodyPath = classDeclPath.findParent(p => p.isClassBody()) as NodePath<T.ClassBody>;
        
            /**
             * Add 'private static __cache__ = {}' to class body
             */
            bodyPath.set("body", [
                ...bodyPath.get('body'),
                T.classPrivateProperty(
                    T.privateName(T.identifier("__cache__")),
                    T.objectExpression([]),
                    null,
                    true
                ),
            ]);
            
            {
                const findMethodPath = bodyPath.findParent(p => p.isClassMethod() && p.isStatic() && !p.isPrivate()) as NodePath<T.ClassMethod>;
                if(!findMethodPath) return errors.EXPECTED_FIND_METHOD;
        
                const params = findMethodPath.get('params');
                const blockStmtPath = findMethodPath.get('body');
        
                const _idParam = params[0];
                if(!_idParam.isIdentifier()) errors.EXPECTED_IDENTIFIER_PARAM;
                const idParam = _idParam.node as T.Identifier;
        
                const __entity__ = "__entity__";
                const __cache__ = "__cache__";
                const __context__ = "__context__";
                
                blockStmtPath.set('body', [
                    // const __entity__ = this.__cache__[id];
                    T.variableDeclaration('const', [T.variableDeclarator(
                        T.identifier(__entity__), 
                        T.memberExpression(T.memberExpression(T.identifier('this'), T.identifier('__cache__')), idParam, true),
                    )]),
        
                    // if(__entity__) return __entity__;
                    T.ifStatement(T.identifier(__entity__), T.returnStatement(T.identifier(__entity__))),
        
                    // const __context__ = (async () => { ... })()
                    T.variableDeclaration('const', [T.variableDeclarator(
                        T.identifier(__context__),
                        T.callExpression(T.arrowFunctionExpression([], T.cloneNode(blockStmtPath.node), findMethodPath.node.async), [])
                    )]),
        
                    // this.__cache__[id] = __context__;
                    T.assignmentExpression('=', 
                        T.memberExpression(T.memberExpression(T.identifier('this'), T.identifier(__cache__)), idParam, true), 
                        T.identifier(__context__)
                    ),
        
                    // return __context__;
                    T.returnStatement(T.identifier(__context__))
                ]);
            }
            
            if(!path.removed) path.remove();
    }
} satisfies Record<string, DecoratorDeclaration>


const generateEventListener = (once: boolean, event: string, fn: T.Expression) => {
    // Gera `this.client`
    const clientAccess = T.memberExpression(
        T.thisExpression(),
        T.identifier('client')
    );

    // Gera `this.client.once` ou `this.client.on`
    const listenerMethod = T.memberExpression(
        clientAccess,
        T.identifier(once ? 'once' : 'on')
    );

    // Gera o nome do evento como string
    const eventArgument = T.stringLiteral(event);

    // Vincula a função `fn` ao contexto correto (se necessário)
    const boundFn = T.callExpression(
        T.memberExpression(fn, T.identifier('bind')),
        [T.thisExpression()]
    );

    // Gera a chamada do método: `this.client.once('event', fn)` ou `this.client.on('event', fn)`
    const callExpression = T.callExpression(listenerMethod, [
        eventArgument,
        boundFn,
    ]);

    return callExpression;
};
