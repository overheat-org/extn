import * as T from '@babel/types';
import { NodePath } from '@babel/traverse';
import generate from '@babel/generator';

import inject from "./inject";
import event from './event';
import singleton from './singleton';

const A = { inject, event, singleton }

function useComptimeDecorator(path: NodePath<T.Decorator>, meta: Record<string, unknown> = {}) {
    const expr = path.node.expression;

    const err = () => new Error(`Unknown comptime decorator '${generate(path.node).code}'`);

    switch (true) {
        case T.isIdentifier(expr): {
            const callback = A[expr.name];
            if(!callback) throw err();

            callback(path, meta);
            break;
        }
        
        case T.isCallExpression(expr) && T.isMemberExpression(expr.callee) && T.isIdentifier(expr.callee.object): {
            const callback = A[expr.callee.object.name];
            if(!callback) throw err();

            callback(path, meta);
            break;
        }

        default: throw new Error(`Unknown comptime decorator '${generate(path.node).code}'`)
    }
}

export default useComptimeDecorator;