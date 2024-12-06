import { NodePath } from '@babel/traverse';
import * as T from '@babel/types';
import { useErrors } from '../utils';

const a = {
    contexts: ['method'],
    comptime(target: T.ClassDeclaration, method: T.ClassMethod) {
        const classBody = target.body.body;
        const _constructor = classBody.find(e => T.isClassMethod(e) && e.kind == 'constructor') as T.ClassMethod;
        let methodName = T.isIdentifier(method.key) ? method.key.name : undefined;
        let eventName!: string;
        let once = false;

        if (methodName?.startsWith('Once')) {
            once = true;
            eventName = methodName.replace('Once', '');
            eventName = methodName.charAt(0).toLowerCase() + methodName.slice(1);
        }
        else if (methodName?.startsWith('On')) {
            eventName = methodName.replace('On', '');
            eventName = methodName.charAt(0).toLowerCase() + methodName.slice(1);
        }
        else {
            throw new Error(`Invalid name: The method name should starts with "On" or "Once" and continue with a event name`)
        }

        _constructor.body.body.push(T.expressionStatement(
            generateEventListener(
                once, 
                eventName,
                T.memberExpression(T.identifier('this'), T.identifier(methodName))
            )
        ));
        
        if (target && target.decorators) {
            target.decorators = target.decorators.filter(
                (d: any) => !(d.expression.type === 'Identifier' && d.expression.name === 'event')
            );
        }
    }
}

const errors = useErrors({
    EXPECTED_METHOD: "This decorator only can be used on class method declarations",
    EXPECTED_COMPTIME_NAME: "Expecting a comptime known class method name",
    INVALID_NAME_FORMAT: "The method name should starts with 'On' or 'Once' and continue with a discord event name\n\nlike: 'OnceReady'"
});

export default {
    name: 'event',
    comptime(path: NodePath<T.Decorator>) {
        const methodDecl = path.findParent(p => p.isClassMethod()) as NodePath<T.ClassMethod>;
        if(!methodDecl) throw errors.EXPECTED_METHOD;

        const classDecl = methodDecl.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassDeclaration>;
        
        let once = false;
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

        path.remove();
    }
}

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