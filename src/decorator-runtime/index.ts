import * as T from '@babel/types';
import { NodePath } from '@babel/traverse';
import generate from '@babel/generator';

import inject from "./inject";
import event from './event';
import singleton from './singleton';
import api from './api';
import http from './http';

const decoratorsMap = { inject, event, singleton, api, http }

function useComptimeDecorator(path: NodePath<T.Decorator>, meta: Record<string, unknown> = {}) {
    const expr = path.node.expression;

    const err = () => new Error(`Unknown comptime decorator '${generate(path.node).code}'`);

    switch (true) {
        case T.isIdentifier(expr): {
            const callback = decoratorsMap[expr.name];
            if(!callback) throw err();

            callback(path, meta);
            break;
        }
        
        case T.isCallExpression(expr) && T.isMemberExpression(expr.callee) && T.isIdentifier(expr.callee.object): {
            const callback = decoratorsMap[expr.callee.object.name];
            if(!callback) throw err();

            callback(path, meta);
            break;
        }

        default: throw new Error(`Unknown comptime decorator '${generate(path.node).code}'`)
    }
}

export default useComptimeDecorator;