import * as T from '@babel/types';
import type { DecoratorDeclaration } from "@meta-oh/comptime-decorators/babel";
import { createConstructor, FlameError, FlameErrorLocation, getConstructor, useErrors } from "./utils";
import { NodePath } from "@babel/traverse";
import Graph from './graph';
import { template } from '@babel/core';

const errors = {
    EXPECTED_CLASS: "This decorator only can be used on class declarations",
    SHOULD_BE_GLOBAL: "Injected classes should be in global scope",
    EXPECTED_METHOD: "This decorator only can be used on class method declarations",
    EXPECTED_COMPTIME_NAME: "Expecting a comptime known class method name",
    INVALID_NAME_FORMAT: "The method name should starts with 'On' or 'Once' and continue with a discord event name\n\nlike: 'OnceReady'",
    EXPECTED_FIND_METHOD: "The target of singleton decorator needs a static find method",
    EXPECTED_IDENTIFIER_PARAM: "The first param of find method needs to be a number or string identifier"
};

export default {
    inject(path, graph: Graph) {
        const classDecl = path.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassDeclaration>;
        if (!classDecl) throw errors.EXPECTED_CLASS;

        if (!path.removed) path.remove();

        classDecl.addComment('leading', "@inject entity");

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
                const locStart = classDecl.node.loc?.start!;

                throw new FlameError(errors.SHOULD_BE_GLOBAL, { path: this.path, ...locStart });
            }
        }

        const module = graph.getModule(this.path)!;
        graph.addInject(className, module);
    },
    event(path) {
        const methodDecl = path.findParent(p => p.isClassMethod()) as NodePath<T.ClassMethod>;
        if (!methodDecl) throw errors.EXPECTED_METHOD;

        methodDecl.addComment('leading', "@event entity");

        const classDecl = methodDecl.parentPath.parentPath as NodePath<T.ClassDeclaration>;

        let once = false;
        // TODO: transform eventName in enum value if eventName exists on discord enum
        let eventName!: string;
        let methodName!: string;
        {
            const key = methodDecl.get('key');
            if (!key.isIdentifier()) throw errors.EXPECTED_COMPTIME_NAME;
            methodName = key.node.name;

            const matches = methodName.match(/^(On|Once)([A-Z][a-zA-Z]*)$/);
            if(!matches) throw errors.INVALID_NAME_FORMAT;
            
            once = matches[0] == 'Once';
            eventName = matches[1];
        }

        classDecl.traverse({
            ClassMethod(path) {
                if (path.node.kind != 'constructor') return;

                const eventListener = T.expressionStatement(generateEventListener(
                    once,
                    eventName,
                    T.memberExpression(
                        T.identifier('this'),
                        T.identifier(methodName)
                    )
                ));

                path.get('body').pushContainer('body', eventListener);
            }
        })

        if (!path.removed) path.remove();
    },
    http(path) {
        path.remove();
    },
    api(path) {
        const methodDecl = path.findParent(p => p.isClassMethod()) as NodePath<T.ClassMethod>;
        if (!methodDecl) throw errors.EXPECTED_METHOD;

        methodDecl.addComment('leading', "@event entity");

        const classDecl = methodDecl.parentPath.parentPath as NodePath<T.ClassDeclaration>;
        const constructorDecl = getConstructor(classDecl) ?? createConstructor(classDecl);

        const wrapper = template.statement(`
            this.addEndpoint(%%string%%, (...args) => this.%%id%%.bind(this, ...args));
        `);


        constructorDecl.get('body').pushContainer('body', wrapper({ string, id }));

        // constructorDecl.

    },
    singleton(path) {
        const classDeclPath = path.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassDeclaration>;
            if(!classDeclPath) throw errors.EXPECTED_CLASS;
        
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

    // Gera a chamada do método: `this.client.once('event', fn)` ou `this.client.on('event', fn)`
    const callExpression = T.callExpression(listenerMethod, [
        eventArgument,
        fn,
    ]);

    return callExpression;
};