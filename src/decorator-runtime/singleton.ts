import { NodePath } from '@babel/traverse';
import * as T from '@babel/types';
import { useErrors } from '../utils';

const errors = useErrors({
    EXPECTED_CLASS: "This decorator only can be used on class declarations",
    EXPECTED_FIND_METHOD: "The target of singleton decorator needs a static find method",
    EXPECTED_IDENTIFIER_PARAM: "The first param of find method needs to be a number or string identifier"
});

function singleton(path: NodePath<T.Decorator>, meta: Record<string, unknown>) {
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
    
    path.remove();
}

export default singleton;