import { NodePath } from '@babel/traverse';
import * as T from '@babel/types';
import { useErrors } from '../utils';

const errors = useErrors({
    EXPECTED_METHOD: "This decorator only can be used on class method declarations",
    EXPECTED_COMPTIME_NAME: "Expecting a comptime known class method name",
    INVALID_NAME_FORMAT: "The method name should starts with 'On' or 'Once' and continue with a discord event name\n\nlike: 'OnceReady'"
});

function event(path: NodePath<T.Decorator>) {
    const methodDecl = path.findParent(p => p.isClassMethod()) as NodePath<T.ClassMethod>;
    if(!methodDecl) throw errors.EXPECTED_METHOD;
    
    const classDecl = methodDecl.parentPath.parentPath as NodePath<T.ClassDeclaration>;
    
    let once = false;
    // TODO: transform eventName in enum value if eventName exists on discord enum
    let eventName!: string;
    let methodName!: string;
    {
        const key = methodDecl.get('key');
        if(!key.isIdentifier()) throw errors.EXPECTED_COMPTIME_NAME;
        
        methodName = key.node.name;
    }

    if (methodName.startsWith('Once')) {
        once = true;
        eventName = methodName.replace('Once', '');
        eventName = eventName.charAt(0).toLowerCase() + eventName.slice(1);
    }
    else if (methodName.startsWith('On')) {
        eventName = methodName.replace('On', '');
        eventName = eventName.charAt(0).toLowerCase() + eventName.slice(1);
    }
    else throw errors.INVALID_NAME_FORMAT;

    classDecl.traverse({
        ClassMethod(path) {
            if(path.node.kind != 'constructor') return;

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

    if(!path.removed) path.remove();
}

export default event;

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